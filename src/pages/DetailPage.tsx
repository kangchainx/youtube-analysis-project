import * as ButtonPrimitive from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ChannelMetadata,
  ChannelVideosState,
  VideoTableRow,
} from "@/features/home/search-input";
import { channelsList, commentThreadsList, videosList } from "@/lib/youtube";
import { getYoutubeApiKey } from "@/lib/config";
import {
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  MessageCircle,
  ThumbsUp,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

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

  const [videoDetail, setVideoDetail] = useState<DetailVideo | null>(() => {
    if (!state?.video) return null;
    return {
      id: state.video.id,
      title: state.video.title,
      description: "",
      publishedAt: state.video.publishedAt,
      duration: "",
      channelId: "",
      channelTitle: state?.channel?.title ?? "",
      thumbnailUrl: state.video.thumbnailUrl,
      tags: [],
      statistics: {
        viewCount: state.video.viewCount,
        likeCount: state.video.likeCount,
        commentCount: state.video.commentCount,
      },
    };
  });
  const [channelSnapshot, setChannelSnapshot] =
    useState<ChannelSnapshot | null>(state?.channel ?? null);
  const [topComments, setTopComments] = useState<CommentPreview[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(!state?.video);
  const [error, setError] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  useEffect(() => {
    const resolvedVideoId = videoId ?? "";
    if (!resolvedVideoId) return;
    const controller = new AbortController();
    async function fetchDetails() {
      try {
        setIsLoading(true);
        setError(null);
        setCommentsLoading(true);

        const apiKey = await getYoutubeApiKey();
        if (controller.signal.aborted) return;

        const videoResponse = await videosList({
          params: {
            part: "snippet,statistics,contentDetails",
            id: resolvedVideoId,
            key: apiKey,
          },
          signal: controller.signal,
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
          id: resolvedVideoId,
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
                channelSnippet.description ?? state?.channel?.description ?? "",
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

        if (!controller.signal.aborted) {
          setIsLoading(false);
        }

        const commentResponse = await commentThreadsList({
          params: {
            part: "snippet",
            videoId: resolvedVideoId,
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
      } catch (caught) {
        if (controller.signal.aborted) return;
        console.error("Failed to load video detail", caught);
        setError(caught instanceof Error ? caught.message : "加载视频详情失败");
        setIsLoading(false);
        setCommentsLoading(false);
      }
    }

    fetchDetails();

    return () => controller.abort();
  }, [refreshCounter, state?.channel, state?.video, videoId]);

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

  const youtubeWatchUrl = videoDetail
    ? `https://www.youtube.com/watch?v=${videoDetail.id}`
    : null;

  const handleBack = () => {
    const hasSearchState = Boolean(state?.searchState);
    const hasHotCommentState =
      typeof state?.hotCommentsEnabled === "boolean";
    const hasGlobalSearchState =
      typeof state?.globalSearchEnabled === "boolean";

    if (hasSearchState || hasHotCommentState || hasGlobalSearchState) {
      navigate("/home", {
        state: {
          ...(hasSearchState
            ? { restoreSearchState: state?.searchState }
            : {}),
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
          {youtubeWatchUrl ? (
            <UIButton
              type="button"
              variant="default"
              asChild
              className="w-full gap-2 lg:w-auto"
            >
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                在 YouTube 打开
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </UIButton>
          ) : null}
        </div>

        {videoDetail.thumbnailUrl ? (
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

  const renderChannelSnapshot = () => (
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
    <div className="bg-muted/20">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-10 lg:px-0">
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
          <div className="space-y-4 rounded-lg border bg-background p-6 text-center shadow-sm">
            <p className="text-base text-muted-foreground">{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <UIButton type="button" variant="outline" onClick={handleBack}>
                返回上一页
              </UIButton>
              <UIButton
                type="button"
                onClick={() => {
                  setRefreshCounter((previous) => previous + 1);
                }}
              >
                重试
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
      {showScrollTop ? (
        <UIButton
          type="button"
          size="icon"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="回到顶部"
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </UIButton>
      ) : null}
    </div>
  );
}

export default DetailPage;
