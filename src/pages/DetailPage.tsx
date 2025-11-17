import * as ButtonPrimitive from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DataErrorState } from "@/components/ui/data-error-state";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChannelMetadata,
  ChannelVideosState,
  VideoTableRow,
} from "@/features/home/search-input";
import YouTubeEmbed from "@/components/video/youtube-embed";
import { useTranscriptionTasks } from "@/contexts/TranscriptionTasksContext";
import { getYoutubeApiKey } from "@/lib/config";
import { apiFetch, ApiError } from "@/lib/api-client";
import { channelsList, commentThreadsList, videosList } from "@/lib/youtube";
import {
  ArrowLeft,
  BellMinus,
  BellPlus,
  ExternalLink,
  Loader2,
  MessageCircle,
  ThumbsUp,
} from "lucide-react";
import { ArrowLineUp, Textbox } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FormEvent, JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ExportFormat } from "@/lib/video-transcription-api";

const UIButton = ButtonPrimitive.Button;

type DetailPageLocationState = {
  video?: VideoTableRow;
  channel?: ChannelMetadata;
  relatedVideos?: VideoTableRow[];
  searchState?: ChannelVideosState;
  hotCommentsEnabled?: boolean;
  globalSearchEnabled?: boolean;
};

type DetailVideoStatistics = {
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

type DetailVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  duration: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  tags: string[];
  statistics: DetailVideoStatistics;
};

type ChannelSnapshot = ChannelMetadata & {
  thumbnailUrl?: string;
};

type CommentPreview = {
  id: string;
  author: string;
  text: string;
  likeCount: number;
  replyCount: number;
  publishedAt: string;
};

type VideosListItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      standard?: { url?: string };
      default?: { url?: string };
    };
    tags?: string[];
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
};

type CommentThreadsListItem = {
  id?: string;
  snippet?: {
    topLevelComment?: {
      id?: string;
      snippet?: {
        authorDisplayName?: string;
        textOriginal?: string;
        textDisplay?: string;
        likeCount?: number;
        publishedAt?: string;
      };
    };
    totalReplyCount?: number;
  };
};

type ChannelsListItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    videoCount?: string;
  };
};

const MAX_COMMENT_COUNT = 6;
const MAX_TAG_COUNT = 8;

const TRANSCRIPTION_EXPORT_FORMATS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
}> = [
  {
    value: "txt",
    label: "TXT 文本",
    description: "通用纯文本格式，方便再次编辑或复制。",
  },
  {
    value: "markdown",
    label: "Markdown",
    description: "带有基础排版结构，适合文档分享。",
  },
  {
    value: "docx",
    label: "Word 文档",
    description: "可直接在 Office/Docs 中打开修改。",
  },
  {
    value: "pdf",
    label: "PDF",
    description: "只读格式，便于直接分发。",
  },
];

function isCommentPermissionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /commentThreads\.list request failed:\s*403/i.test(error.message);
}

function safeParseCount(value?: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatISODuration(duration?: string) {
  if (!duration) return "-";
  const match =
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(duration) ?? undefined;
  if (!match) return duration;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const segments = [];
  if (hours) {
    segments.push(hours.toString().padStart(2, "0"));
  }
  segments.push(minutes.toString().padStart(2, "0"));
  segments.push(seconds.toString().padStart(2, "0"));
  return segments.join(":");
}

function formatChannelMetric(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 1000) return Math.round(value).toString();
  if (value < 10000) {
    const kValue = value / 1000;
    const formatted = kValue.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted}k`;
  }
  const wValue = value / 10000;
  const formatted =
    wValue >= 100
      ? Math.round(wValue).toString()
      : wValue.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}w`;
}

function DetailPage(): JSX.Element {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = (location as { state?: DetailPageLocationState }) ?? {};
  const searchStateSnapshot =
    (state?.searchState as ChannelVideosState | null) ?? null;

  const [videoDetail, setVideoDetail] = useState<DetailVideo | null>(() => {
    if (!state?.video) return null;
    const tags = Array.isArray(state.video.tags)
      ? state.video.tags.filter((tag): tag is string => Boolean(tag))
      : [];
    return {
      id: state.video.id,
      title: state.video.title,
      description: state.video.description ?? "",
      publishedAt: state.video.publishedAt,
      duration: state.video.duration ?? "",
      channelId:
        state.video.channelId?.trim() ?? searchStateSnapshot?.channelId ?? "",
      channelTitle:
        state.video.channelTitle ??
        state?.channel?.title ??
        searchStateSnapshot?.channelMetadata?.title ??
        "",
      thumbnailUrl: state.video.thumbnailUrl,
      tags,
      statistics: {
        viewCount: state.video.viewCount,
        likeCount: state.video.likeCount,
        commentCount: state.video.commentCount,
      },
    };
  });
  const [channelSnapshot, setChannelSnapshot] =
    useState<ChannelSnapshot | null>(
      searchStateSnapshot?.channelMetadata ?? state?.channel ?? null,
    );
  const [topComments, setTopComments] = useState<CommentPreview[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(!state?.video);
  const [error, setError] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isCreatingTranscription, setIsCreatingTranscription] = useState(false);
  const [isTranscriptionDialogOpen, setIsTranscriptionDialogOpen] =
    useState(false);
  const [selectedExportFormat, setSelectedExportFormat] =
    useState<ExportFormat>("txt");
  const [includeTimestamps, setIncludeTimestamps] = useState(false);
  const [includeHeader, setIncludeHeader] = useState(false);
  const [subscriptionState, setSubscriptionState] = useState(() => ({
    isSubscribed: Boolean(searchStateSnapshot?.isSubscribed),
    isLoading: searchStateSnapshot?.isSubscriptionLoading ?? false,
  }));
  const isSubscribed = subscriptionState.isSubscribed;
  const isSubscriptionLoading = subscriptionState.isLoading;
  useEffect(() => {
    setSubscriptionState((previous) => ({
      ...previous,
      isSubscribed: Boolean(searchStateSnapshot?.isSubscribed),
    }));
  }, [searchStateSnapshot?.isSubscribed]);

  const { createTask: enqueueTranscriptionTask } = useTranscriptionTasks();

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { notation: "standard" }),
    [],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [],
  );

  const formatCount = (value: number) => numberFormatter.format(value);

  const resetTranscriptionForm = () => {
    setSelectedExportFormat("txt");
    setIncludeTimestamps(false);
    setIncludeHeader(false);
  };

  const handleTranscriptionDialogOpenChange = (open: boolean) => {
    if (!open && isCreatingTranscription) {
      return;
    }
    setIsTranscriptionDialogOpen(open);
    if (!open) {
      resetTranscriptionForm();
    }
  };

  const handleTranscriptionClick = () => {
    if (!videoDetail?.id) {
      toast.error("创建任务失败", {
        description: "无法获取视频标识，请稍后再试。",
      });
      return;
    }
    setIsTranscriptionDialogOpen(true);
  };

  const handleChannelSubscribe = async () => {
    const channelId = videoDetail?.channelId?.trim();
    if (!channelId || isSubscribed || isSubscriptionLoading) return;

    setSubscriptionState((previous) => ({ ...previous, isLoading: true }));
    try {
      await apiFetch("/api/youtube/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel_id: channelId }),
      });
      setSubscriptionState({ isSubscribed: true, isLoading: false });
      toast.success("订阅成功");
    } catch (caught) {
      console.error("Subscribe request failed", caught);
      const message =
        caught instanceof ApiError
          ? caught.message || "订阅失败，请稍后重试。"
          : caught instanceof Error
            ? caught.message
            : "订阅失败，请稍后重试。";
      toast.error(message);
      setSubscriptionState((previous) => ({ ...previous, isLoading: false }));
    }
  };

  const handleChannelUnsubscribe = async () => {
    const channelId = videoDetail?.channelId?.trim();
    if (!channelId || !isSubscribed || isSubscriptionLoading) return;

    setSubscriptionState((previous) => ({ ...previous, isLoading: true }));
    try {
      const response = await apiFetch<{
        data?: { channelId?: string; unsubscribed?: boolean };
      }>("/api/youtube/subscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel_id: channelId }),
      });
      const unsubscribed =
        typeof response?.data?.unsubscribed === "boolean"
          ? response.data.unsubscribed
          : true;
      setSubscriptionState({ isSubscribed: false, isLoading: false });
      toast.success(
        unsubscribed ? "取消订阅成功" : "尚未订阅该频道，已同步状态。",
      );
    } catch (caught) {
      console.error("Unsubscribe request failed", caught);
      const message =
        caught instanceof ApiError
          ? caught.message || "取消订阅失败，请稍后重试。"
          : caught instanceof Error
            ? caught.message
            : "取消订阅失败，请稍后重试。";
      toast.error(message);
      setSubscriptionState((previous) => ({ ...previous, isLoading: false }));
    }
  };

  const handleTranscriptionConfirm = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!videoDetail?.id) {
      toast.error("创建任务失败", {
        description: "无法获取视频标识，请稍后再试。",
      });
      return;
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoDetail.id}`;
    setIsCreatingTranscription(true);

    try {
      await enqueueTranscriptionTask({
        url: videoUrl,
        title: videoDetail.title,
        exportFormat: selectedExportFormat,
        includeTimestamps,
        includeHeader,
      });
      toast.success("任务已添加至任务中心", {
        description: (
          <Link
            to="/workbench/tasks"
            className="text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            点击前往查看进度
          </Link>
        ),
      });
      setIsTranscriptionDialogOpen(false);
      resetTranscriptionForm();
    } catch (error) {
      toast.error("创建任务失败", {
        description: error instanceof Error ? error.message : "请稍后重试。",
      });
    } finally {
      setIsCreatingTranscription(false);
    }
  };

  const buildDetailFromVideoRow = (row: VideoTableRow): DetailVideo => {
    const tags = Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => Boolean(tag))
      : [];
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      publishedAt: row.publishedAt,
      duration: row.duration ?? "",
      channelId: row.channelId ?? searchStateSnapshot?.channelId ?? "",
      channelTitle:
        row.channelTitle ??
        searchStateSnapshot?.channelMetadata?.title ??
        state?.channel?.title ??
        "",
      thumbnailUrl: row.thumbnailUrl,
      tags,
      statistics: {
        viewCount: row.viewCount,
        likeCount: row.likeCount,
        commentCount: row.commentCount,
      },
    };
  };

  useEffect(() => {
    const controller = new AbortController();
    const resolvedVideoId = (videoId ?? "").trim();
    if (!resolvedVideoId) {
      setError("缺少视频标识，无法加载详情。");
      return () => controller.abort();
    }

    const loadFromLocalState = (targetVideoId: string): VideoTableRow | null => {
      const candidateFromState =
        state?.video?.source === "local" && state.video.id === targetVideoId
          ? state.video
          : null;
      const candidateFromSnapshot =
        searchStateSnapshot?.videos?.find(
          (video) => video.id === targetVideoId && video.source === "local",
        ) ?? null;
      const localVideo = candidateFromState ?? candidateFromSnapshot;
      if (!localVideo) return null;

      const channelMeta =
        searchStateSnapshot?.channelMetadata ?? state?.channel ?? null;
      if (channelMeta) {
        setChannelSnapshot((previous) => previous ?? { ...channelMeta });
      }

      setVideoDetail(buildDetailFromVideoRow(localVideo));
      setIsLoading(false);
      return localVideo;
    };

    async function fetchDetails(targetVideoId: string) {
      setIsLoading(true);
      setCommentsLoading(true);
      setError(null);

      const cachedVideo = loadFromLocalState(targetVideoId);
      if (cachedVideo) {
        setCommentsLoading(true);
      }

      try {
        const apiKey = await getYoutubeApiKey();
        const signal = controller.signal;

        if (!cachedVideo) {
          const videoResponse = await videosList({
            params: {
              part: "snippet,statistics,contentDetails",
              id: targetVideoId,
              maxResults: 1,
              key: apiKey,
            },
            signal,
          });

          const videoItems = (videoResponse?.items ?? []) as VideosListItem[];
          const [firstVideo] = videoItems;
          if (!firstVideo) {
            throw new Error("未找到该视频");
          }

          const snippet = firstVideo.snippet ?? {};
          const stats = firstVideo.statistics ?? {};
          const contentDetails = firstVideo.contentDetails ?? {};
          const detail: DetailVideo = {
            id: targetVideoId,
            title: snippet.title?.trim() || "未命名视频",
            description: snippet.description ?? "",
            publishedAt: snippet.publishedAt ?? "",
            duration: contentDetails.duration ?? "",
            channelId: snippet.channelId ?? "",
            channelTitle: snippet.channelTitle ?? state?.channel?.title ?? "",
            thumbnailUrl:
              snippet.thumbnails?.high?.url ??
              snippet.thumbnails?.medium?.url ??
              snippet.thumbnails?.standard?.url ??
              snippet.thumbnails?.default?.url ??
              state?.video?.thumbnailUrl,
            tags: (snippet.tags ?? []).slice(0, MAX_TAG_COUNT),
            statistics: {
              viewCount: safeParseCount(stats.viewCount),
              likeCount: safeParseCount(stats.likeCount),
              commentCount: safeParseCount(stats.commentCount),
            },
          };

          if (!controller.signal.aborted) {
            setVideoDetail(detail);
          }

          const channelId = detail.channelId;
          if (channelId) {
            const channelResponse = await channelsList({
              params: {
                part: "snippet,statistics",
                id: channelId,
                maxResults: 1,
                key: apiKey,
              },
              signal: controller.signal,
            });

            const channelItems = (channelResponse?.items ??
              []) as ChannelsListItem[];
            const [firstChannel] = channelItems;
            if (firstChannel && !controller.signal.aborted) {
              const channelSnippet = firstChannel.snippet ?? {};
              const channelStats = firstChannel.statistics ?? {};
              setChannelSnapshot({
                handle: channelSnippet.customUrl
                  ? `@${channelSnippet.customUrl.replace(/^@/, "")}`
                  : (state?.channel?.handle ?? ""),
                title:
                  channelSnippet.title?.trim() ?? state?.channel?.title ?? "",
                description:
                  channelSnippet.description ??
                  state?.channel?.description ??
                  "",
                subscriberCount: safeParseCount(channelStats.subscriberCount),
                videoCount: safeParseCount(channelStats.videoCount),
                viewCount: safeParseCount(channelStats.viewCount),
                thumbnailUrl:
                  channelSnippet.thumbnails?.high?.url ??
                  channelSnippet.thumbnails?.medium?.url ??
                  channelSnippet.thumbnails?.default?.url,
              });
            }
          }
        }

        if (!controller.signal.aborted) {
          setIsLoading(false);
        }

        try {
          const commentResponse = await commentThreadsList({
            params: {
              part: "snippet",
              videoId: targetVideoId,
              maxResults: MAX_COMMENT_COUNT,
              order: "relevance",
              textFormat: "plainText",
              key: apiKey,
            },
            signal: controller.signal,
          });

          const commentItems = (commentResponse?.items ??
            []) as CommentThreadsListItem[];
          if (!controller.signal.aborted) {
            const normalizedComments = commentItems
              .map((thread) => {
                const topLevel = thread.snippet?.topLevelComment;
                const commentSnippet = topLevel?.snippet;
                if (!topLevel || !commentSnippet) return null;
                const text =
                  commentSnippet.textOriginal?.trim() ??
                  commentSnippet.textDisplay?.trim() ??
                  "";
                if (!text) return null;
                return {
                  id: topLevel.id ?? "",
                  author: commentSnippet.authorDisplayName ?? "匿名用户",
                  text,
                  likeCount: commentSnippet.likeCount ?? 0,
                  replyCount: thread.snippet?.totalReplyCount ?? 0,
                  publishedAt: commentSnippet.publishedAt ?? "",
                };
              })
              .filter((item): item is CommentPreview => Boolean(item));

            setTopComments(normalizedComments);
            setCommentsLoading(false);
          }
        } catch (commentError) {
          if (controller.signal.aborted) return;
          if (isCommentPermissionError(commentError)) {
            console.warn("Skipping commentThreads error:", commentError);
            setTopComments([]);
            setCommentsLoading(false);
          } else {
            throw commentError;
          }
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        console.error("Failed to load video detail", caught);
        setError(caught instanceof Error ? caught.message : "加载视频详情失败");
        setIsLoading(false);
        setCommentsLoading(false);
      }
    }

    void fetchDetails(resolvedVideoId);

    return () => controller.abort();
  }, [
    refreshCounter,
    searchStateSnapshot,
    state?.channel,
    state?.video,
    videoId,
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const publishedAtDisplay = useMemo(() => {
    if (!videoDetail?.publishedAt) return "-";
    const date = new Date(videoDetail.publishedAt);
    if (Number.isNaN(date.getTime())) return videoDetail.publishedAt;
    return dateFormatter.format(date);
  }, [dateFormatter, videoDetail?.publishedAt]);

  const durationDisplay = useMemo(
    () => formatISODuration(videoDetail?.duration),
    [videoDetail?.duration],
  );

  const engagementRate = useMemo(() => {
    if (!videoDetail) return 0;
    if (videoDetail.statistics.viewCount === 0) return 0;
    return (
      (videoDetail.statistics.likeCount / videoDetail.statistics.viewCount) *
      100
    );
  }, [videoDetail]);

  const handleBack = () => {
    const hasSearchState = Boolean(state?.searchState);
    const hasHotCommentState = typeof state?.hotCommentsEnabled === "boolean";
    const hasGlobalSearchState =
      typeof state?.globalSearchEnabled === "boolean";

    if (hasSearchState || hasHotCommentState || hasGlobalSearchState) {
      navigate("/home", {
        state: {
          ...(hasSearchState ? { restoreSearchState: state?.searchState } : {}),
          ...(hasHotCommentState
            ? { restoreHotComments: state?.hotCommentsEnabled }
            : {}),
          ...(hasGlobalSearchState
            ? { restoreGlobalSearch: state?.globalSearchEnabled }
            : {}),
        },
        replace: true,
      });
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/home");
  };

  const renderHeroSkeleton = () => (
    <div className="space-y-4 rounded-lg border bg-background p-6 shadow-sm">
      <Skeleton className="h-8 w-3/4" />
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  const renderHero = () => {
    if (isLoading || !videoDetail) {
      return renderHeroSkeleton();
    }

    return (
      <div className="space-y-6 rounded-lg border bg-background p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold leading-tight">
            {videoDetail.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{publishedAtDisplay}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>时长: {durationDisplay}</span>
            {videoDetail.tags.length > 0 ? (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex flex-wrap gap-2">
                  {videoDetail.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {videoDetail.id ? (
          <YouTubeEmbed
            videoId={videoDetail.id}
            title={videoDetail.title}
            posterUrl={videoDetail.thumbnailUrl}
          />
        ) : videoDetail.thumbnailUrl ? (
          <div className="overflow-hidden rounded-lg border">
            <img
              src={videoDetail.thumbnailUrl}
              alt={`${videoDetail.title} 缩略图`}
              loading="lazy"
              className="w-full object-cover"
            />
          </div>
        ) : null}

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">视频简介</h2>
          {videoDetail.description ? (
            <div className="space-y-3">
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground ${
                  isDescriptionExpanded ? "" : "line-clamp-6"
                }`}
              >
                {videoDetail.description}
              </p>
              {videoDetail.description.length > 320 ? (
                <UIButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-0 text-xs text-primary"
                  onClick={() =>
                    setIsDescriptionExpanded((previous) => !previous)
                  }
                >
                  {isDescriptionExpanded ? "收起" : "展开全部"}
                </UIButton>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/80">
              暂无视频简介内容。
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderMetrics = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <span className="text-xs uppercase text-muted-foreground">观看</span>
        <p className="mt-2 text-2xl font-semibold">
          {formatCount(videoDetail?.statistics.viewCount ?? 0)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <span className="text-xs uppercase text-muted-foreground">点赞</span>
        <p className="mt-2 text-2xl font-semibold">
          {formatCount(videoDetail?.statistics.likeCount ?? 0)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <span className="text-xs uppercase text-muted-foreground">评论</span>
        <p className="mt-2 text-2xl font-semibold">
          {formatCount(videoDetail?.statistics.commentCount ?? 0)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4 shadow-sm">
        <span className="text-xs uppercase text-muted-foreground">互动率</span>
        <p className="mt-2 text-2xl font-semibold">
          {engagementRate.toFixed(2)}%
        </p>
      </div>
    </div>
  );

  const renderChannelSnapshot = () => {
    const isChannelSubscribed = Boolean(isSubscribed);
    const subscriptionLabel = isSubscriptionLoading
      ? "处理中..."
      : isChannelSubscribed
        ? "取消订阅"
        : "订阅";
    const showSubscriptionButton = Boolean(videoDetail?.channelId);
    const subscriptionIcon = isSubscriptionLoading ? (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    ) : isChannelSubscribed ? (
      <BellMinus className="h-4 w-4" aria-hidden="true" />
    ) : (
      <BellPlus className="h-4 w-4" aria-hidden="true" />
    );
    const subscriptionButton = !showSubscriptionButton
      ? null
      : isChannelSubscribed ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <UIButton
                type="button"
                variant="destructive"
                className="w-full gap-2 sm:w-auto"
                disabled={isSubscriptionLoading}
                aria-pressed={isChannelSubscribed}
              >
                {subscriptionIcon}
                {subscriptionLabel}
              </UIButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>取消订阅该频道？</AlertDialogTitle>
                <AlertDialogDescription>
                  取消后将无法接收该频道的更新通知，确认继续吗？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>保持订阅</AlertDialogCancel>
                <AlertDialogAction
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    void handleChannelUnsubscribe();
                  }}
                  disabled={isSubscriptionLoading}
                >
                  确认取消
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <UIButton
            type="button"
            variant="default"
            className="w-full gap-2 sm:w-auto"
            disabled={isSubscriptionLoading}
            onClick={() => {
              void handleChannelSubscribe();
            }}
            aria-pressed={false}
          >
            {subscriptionIcon}
            {subscriptionLabel}
          </UIButton>
        );

    return (
      <div className="rounded-lg border bg-background p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {channelSnapshot?.thumbnailUrl ? (
              <img
                src={channelSnapshot.thumbnailUrl}
                alt={`${channelSnapshot.title} 头像`}
                className="h-16 w-16 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                {channelSnapshot?.title?.[0] ?? "?"}
              </div>
            )}
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">
                {channelSnapshot?.title ?? "频道详情"}
              </h3>
              {channelSnapshot?.handle ? (
                <p className="text-sm text-muted-foreground">
                  {channelSnapshot.handle}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {subscriptionButton}
            <UIButton
              type="button"
              variant="outline"
              asChild
              className="w-full gap-2 sm:w-auto"
            >
              <a
                href={`https://www.youtube.com/${channelSnapshot?.handle ?? ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                浏览频道
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </UIButton>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">订阅数</p>
            <p className="mt-1 text-xl font-semibold">
              {formatChannelMetric(channelSnapshot?.subscriberCount ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">总播放量</p>
            <p className="mt-1 text-xl font-semibold">
              {formatChannelMetric(channelSnapshot?.viewCount ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">视频总数</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCount(channelSnapshot?.videoCount ?? 0)}
            </p>
          </div>
        </div>
        {channelSnapshot?.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {channelSnapshot.description}
          </p>
        ) : null}
      </div>
    );
  };

  const renderComments = () => {
    if (commentsLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-lg border bg-background p-4 shadow-sm"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      );
    }

    if (topComments.length === 0) {
      return (
        <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground shadow-sm">
          暂无热门评论数据。
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {topComments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-lg border bg-background p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {comment.author}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span>
                {(() => {
                  if (!comment.publishedAt) return "未知时间";
                  const publishedDate = new Date(comment.publishedAt);
                  return Number.isNaN(publishedDate.getTime())
                    ? comment.publishedAt
                    : dateFormatter.format(publishedDate);
                })()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {comment.text}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                {formatCount(comment.likeCount)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" aria-hidden="true" />
                {formatCount(comment.replyCount)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderActionRail = () => {
    const actionButtonClasses =
      "group size-10 rounded-2xl border border-border/60 bg-background text-muted-foreground shadow-md backdrop-blur transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/30";
    const transcriptionButtonClasses = `${actionButtonClasses} ${
      isCreatingTranscription ? "border-primary/60 text-primary" : ""
    }`;

    return (
      <div className="sticky top-1/2 hidden lg:flex lg:-translate-y-1/2 lg:transform lg:self-start lg:flex-col lg:gap-3">
        {showScrollTop ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <UIButton
                type="button"
                size="icon"
                className={actionButtonClasses}
                aria-label="回到顶部"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                variant="plain"
              >
                <ArrowLineUp size={32} />
              </UIButton>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              回到顶部
            </TooltipContent>
          </Tooltip>
        ) : null}
        {showScrollTop ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <UIButton
                type="button"
                size="icon"
                className={actionButtonClasses}
                aria-label="返回上一页"
                onClick={handleBack}
                variant="plain"
              >
                <ArrowLeft size={32} />
              </UIButton>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              返回上一页
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <UIButton
              type="button"
              size="icon"
              className={transcriptionButtonClasses}
              onClick={handleTranscriptionClick}
              aria-label="转文字"
              variant="plain"
              aria-busy={isCreatingTranscription}
            >
              {isCreatingTranscription ? (
                <Spinner className="h-5 w-5 text-primary" />
              ) : (
                <Textbox size={32} />
              )}
            </UIButton>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            转文字
          </TooltipContent>
        </Tooltip>
      </div>
    );
  };

  if (!videoId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-base text-muted-foreground">
          缺少视频标识，无法展示详情。
        </p>
        <UIButton type="button" onClick={() => navigate("/home")}>
          返回首页
        </UIButton>
      </div>
    );
  }

  return (
    <>
      <div className="bg-muted/20">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-10 lg:flex-row lg:items-start lg:gap-4 lg:px-0">
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex items-center gap-2">
              <UIButton
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 px-0 text-sm text-muted-foreground hover:text-foreground"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                返回
              </UIButton>
            </div>

            {error ? (
              <div className="space-y-4">
                <DataErrorState
                  className="border border-dashed border-muted-foreground/60 bg-background/90"
                  title="无法加载视频详情"
                  description={error}
                  actionLabel="重新加载"
                  onRetry={() => {
                    setRefreshCounter((previous) => previous + 1);
                  }}
                />
                <div className="flex justify-center">
                  <UIButton
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                  >
                    返回上一页
                  </UIButton>
                </div>
              </div>
            ) : null}

            {renderHero()}

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">关键指标</h2>
              {renderMetrics()}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">频道概览</h2>
              {renderChannelSnapshot()}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">热门评论</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {topComments.length}
                </span>
              </div>
              {renderComments()}
            </section>
          </div>
          {renderActionRail()}
        </div>
      </div>

      <Dialog
        open={isTranscriptionDialogOpen}
        onOpenChange={handleTranscriptionDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>转文字</DialogTitle>
            <DialogDescription>
              选择导出格式及选项，确认后自动创建转文字任务。
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-6" onSubmit={handleTranscriptionConfirm}>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">导出格式</Label>
                <RadioGroup
                  value={selectedExportFormat}
                  onValueChange={(value: string) =>
                    setSelectedExportFormat(value as ExportFormat)
                  }
                  disabled={isCreatingTranscription}
                  className="space-y-3"
                >
                  {TRANSCRIPTION_EXPORT_FORMATS.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={option.value}
                        className="flex-1 cursor-pointer space-y-0.5"
                      >
                        <div className="font-medium text-sm">
                          {option.label}
                        </div>
                        <div className="text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/40">
                  <div className="flex-1 space-y-0.5 pr-4">
                    <Label
                      htmlFor="include-timestamps"
                      className="text-sm font-medium cursor-pointer"
                    >
                      包含时间戳
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      在每段文本前保留字幕时间码，便于定位。
                    </p>
                  </div>
                  <Switch
                    id="include-timestamps"
                    checked={includeTimestamps}
                    onCheckedChange={setIncludeTimestamps}
                    disabled={isCreatingTranscription}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/40">
                  <div className="flex-1 space-y-0.5 pr-4">
                    <Label
                      htmlFor="include-header"
                      className="text-sm font-medium cursor-pointer"
                    >
                      包含头部信息
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      在开头附上视频标题、链接等元信息。
                    </p>
                  </div>
                  <Switch
                    id="include-header"
                    checked={includeHeader}
                    onCheckedChange={setIncludeHeader}
                    disabled={isCreatingTranscription}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <UIButton
                  type="button"
                  variant="outline"
                  disabled={isCreatingTranscription}
                  className="min-w-[100px]"
                >
                  取消
                </UIButton>
              </DialogClose>
              <UIButton
                type="submit"
                disabled={isCreatingTranscription}
                className="min-w-[120px]"
              >
                {isCreatingTranscription ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4 text-primary-foreground" />
                    创建中...
                  </>
                ) : (
                  "开始转文字"
                )}
              </UIButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DetailPage;
