import { Input } from "@/components/ui/input";
import {
  channelsList,
  commentsList,
  commentThreadsList,
  playlistItemsList,
  videosList,
} from "@/lib/youtube";
import { getYoutubeApiKey } from "@/lib/config";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Search } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

type ChannelsListItem = {
  id?: string;
  handle?: string;
  snippet?: {
    title?: string;
    description?: string;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
  statistics?: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
  };
};

type ThumbnailResource = {
  url?: string;
};

type Thumbnails = {
  default?: ThumbnailResource;
  medium?: ThumbnailResource;
  high?: ThumbnailResource;
  standard?: ThumbnailResource;
  maxres?: ThumbnailResource;
};

type PlaylistItemsListItem = {
  snippet?: {
    title?: string;
    publishedAt?: string;
    resourceId?: {
      videoId?: string;
    };
    thumbnails?: Thumbnails;
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
};

type VideosListItem = {
  id?: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    tags?: string[];
    thumbnails?: Thumbnails;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    favoriteCount?: string;
    commentCount?: string;
  };
};

type CommentSnippet = {
  textDisplay?: string;
  textOriginal?: string;
  authorChannelId?: {
    value?: string;
  } | null;
  likeCount?: number;
  totalReplyCount?: number;
};

type CommentResource = {
  id?: string;
  snippet?: CommentSnippet;
};

type CommentThreadsListItem = {
  snippet?: {
    topLevelComment?: CommentResource;
    totalReplyCount?: number;
  };
};

export type VideoTableRow = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  topComment: string;
  topCommentLikeCount: number;
  topCommentReplyCount: number;
  channelId?: string;
  channelTitle?: string;
  channelHandle?: string;
  description?: string;
  duration?: string;
  tags?: string[];
  topCommentAuthor?: string;
  topCommentPublishedAt?: string;
  source?: "local" | "youtube";
};

export type ChannelMetadata = {
  handle: string;
  title: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
};

export type ChannelVideosState = {
  channelName: string;
  channelId: string;
  channelMetadata: ChannelMetadata | null;
  videos: VideoTableRow[];
  error: string | null;
  isLoading: boolean;
  isSubscribed: boolean | null;
  isSubscriptionLoading: boolean;
};

export type ChannelSuggestion = {
  channelId: string;
  title: string;
};

export type SearchInputHandle = {
  refresh: () => boolean;
  submitCurrentQuery: () => void;
  hydrateLastRequest: (payload: {
    query: string;
    channelId?: string;
    inputValue?: string;
  }) => void;
};

interface SearchInputProps {
  onSearch: (query: string) => void | Promise<void>;
  suggestions?: ChannelSuggestion[];
  onChannelVideosUpdate?: (state: ChannelVideosState) => void;
  isGlobalSearchEnabled?: boolean;
  loadHotComments?: boolean;
}

type LocalChannelStatistics = {
  subscriberCount?: string | number | null;
  videoCount?: string | number | null;
  viewCount?: string | number | null;
};

type LocalChannelRecord = {
  id?: string | null;
  channelId?: string | null;
  title?: string | null;
  description?: string | null;
  handle?: string | null;
  customUrl?: string | null;
  thumbnailUrl?: string | null;
  statistics?: LocalChannelStatistics | null;
  subscriberCount?: string | number | null;
  videoCount?: string | number | null;
  viewCount?: string | number | null;
};

type LocalChannelResponse = {
  data?: LocalChannelRecord | null;
};

type LocalTopComment = {
  videoId?: string | null;
  channelId?: string | null;
  commentContent?: string | null;
  comment_content?: string | null;
  canReply?: boolean | null;
  can_reply?: boolean | null;
  isPublic?: boolean | null;
  is_public?: boolean | null;
  likeCount?: number | string | null;
  like_count?: number | string | null;
  totalReplyCount?: number | string | null;
  total_reply_count?: number | string | null;
  authorDisplayName?: string | null;
  author_display_name?: string | null;
  authorProfileImageUrl?: string | null;
  author_profile_image_url?: string | null;
  authorChannelUrl?: string | null;
  author_channel_url?: string | null;
  authorChannelId?: string | null;
  author_channel_id?: string | null;
  publishedAt?: string | null;
  published_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  lastUpdate?: string | null;
  last_update?: string | null;
};

type LocalVideoStatistics = {
  viewCount?: string | number | null;
  likeCount?: string | number | null;
  favoriteCount?: string | number | null;
  commentCount?: string | number | null;
} | null;

type LocalVideoRecord = {
  id?: string | null;
  videoId?: string | null;
  title?: string | null;
  description?: string | null;
  publishedAt?: string | null;
  contentDetails?: {
    videoPublishedAt?: string | null;
    duration?: string | null;
  } | null;
  duration?: string | null;
  thumbnailUrl?: string | null;
  thumbnails?: Thumbnails | null;
  statistics?: LocalVideoStatistics;
  viewCount?: string | number | null;
  likeCount?: string | number | null;
  favoriteCount?: string | number | null;
  commentCount?: string | number | null;
  channelId?: string | null;
  channelTitle?: string | null;
  channelHandle?: string | null;
  tags?: string[] | null;
  topComment?: LocalTopComment | null;
  top_comment?: LocalTopComment | null;
};

type LocalVideosResponse = {
  data?: LocalVideoRecord[] | null;
  meta?: {
    limit?: number;
    offset?: number;
    total?: number;
    includeTopComment?: boolean;
  } | null;
};

const CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;
const LOCAL_VIDEO_PAGE_SIZE = 200;

const SearchInput = forwardRef<SearchInputHandle, SearchInputProps>(
  function SearchInput(
    {
      onSearch,
      suggestions = [],
      onChannelVideosUpdate,
      isGlobalSearchEnabled = false,
      loadHotComments = false,
    }: SearchInputProps,
    ref,
  ) {
    const navigate = useNavigate();
    const [value, setValue] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLFormElement>(null);
    const videosAbortControllerRef = useRef<AbortController | null>(null);
    const lastRequestRef = useRef<{ query: string; channelId?: string } | null>(
      null,
    );

    const extractVideoIdFromUrl = useCallback((url: string): string | null => {
      const trimmed = url.trim();
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return null;
      }

      try {
        // 处理各种 YouTube URL 格式
        // http://www.youtube.com/watch?v=VIDEO_ID
        // https://www.youtube.com/watch?v=VIDEO_ID
        // http://www.youtube.com/embed/VIDEO_ID
        // https://youtu.be/VIDEO_ID
        // http://youtube.com/watch?v=VIDEO_ID&other=params

        // 如果包含 youtu.be
        const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (youtuBeMatch) {
          return youtuBeMatch[1];
        }

        // 如果包含 youtube.com/watch?v=
        const watchMatch = trimmed.match(
          /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        );
        if (watchMatch) {
          return watchMatch[1];
        }

        // 如果包含 youtube.com/embed/
        const embedMatch = trimmed.match(
          /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        );
        if (embedMatch) {
          return embedMatch[1];
        }

        // 如果包含 youtube.com/v/
        const vMatch = trimmed.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
        if (vMatch) {
          return vMatch[1];
        }

        return null;
      } catch {
        return null;
      }
    }, []);

    // 清空频道列表并重置 loading/subscription 状态
    const resetChannelVideos = useCallback(() => {
      videosAbortControllerRef.current?.abort();
      videosAbortControllerRef.current = null;
      lastRequestRef.current = null;
      onChannelVideosUpdate?.({
        channelName: "",
        channelId: "",
        channelMetadata: null,
        videos: [],
        error: null,
        isLoading: false,
        isSubscribed: null,
        isSubscriptionLoading: false,
      });
    }, [onChannelVideosUpdate]);

    // 核心：尝试根据查询词加载频道视频，优先命中本地缓存，失败再回退到 YouTube
    const loadChannelVideos = useCallback(
      async (rawQuery: string, options?: { channelId?: string }) => {
        const trimmed = rawQuery.trim();
        const resolvedChannelId = options?.channelId?.trim();
        if (!trimmed && !resolvedChannelId) return;

        videosAbortControllerRef.current?.abort();
        const controller = new AbortController();
        videosAbortControllerRef.current = controller;

        lastRequestRef.current = {
          query: trimmed,
          channelId: resolvedChannelId,
        };

        let currentState: ChannelVideosState = {
          channelName: trimmed,
          channelId: resolvedChannelId ?? "",
          channelMetadata: null,
          videos: [],
          error: null,
          isLoading: true,
          isSubscribed: null,
          isSubscriptionLoading: false,
        };

        const pushState = (partial: Partial<ChannelVideosState> = {}) => {
          if (videosAbortControllerRef.current !== controller) return;
          currentState = { ...currentState, ...partial };
          onChannelVideosUpdate?.(currentState);
        };

        pushState();

        const parseCount = (count?: string | number | null) => {
          if (typeof count === "number") {
            return Number.isFinite(count) ? count : 0;
          }
          if (typeof count === "string") {
            const parsed = Number(count);
            return Number.isFinite(parsed) ? parsed : 0;
          }
          return 0;
        };

        const pickFirstString = (
          ...values: Array<string | null | undefined>
        ): string => {
          for (const value of values) {
            if (typeof value !== "string") continue;
            const trimmed = value.trim();
            if (trimmed) return trimmed;
          }
          return "";
        };

        const resolveLocalCommentText = (
          comment: LocalTopComment | null,
        ): string => {
          if (!comment) return "";
          return pickFirstString(
            comment.commentContent,
            comment.comment_content,
          );
        };

        const resolveLocalCommentLikeCount = (
          comment: LocalTopComment | null,
        ): number => parseCount(comment?.likeCount ?? comment?.like_count ?? 0);

        const resolveLocalCommentReplyCount = (
          comment: LocalTopComment | null,
        ): number =>
          parseCount(
            comment?.totalReplyCount ?? comment?.total_reply_count ?? 0,
          );

        const resolveLocalCommentAuthor = (
          comment: LocalTopComment | null,
        ): string =>
          pickFirstString(
            comment?.authorDisplayName,
            comment?.author_display_name,
          );

        const resolveLocalCommentPublishedAt = (
          comment: LocalTopComment | null,
        ): string =>
          pickFirstString(comment?.publishedAt, comment?.published_at);

        const ensureHandleFormat = (value: string) => {
          const trimmedHandle = value.trim().replace(/^@+/, "");
          if (!trimmedHandle) return "";
          return `@${trimmedHandle}`;
        };

        const normalizeCustomUrlPath = (value: string) => {
          const withoutHandlePrefix = value.trim().replace(/^@+/, "");
          return withoutHandlePrefix;
        };

        const fetchSubscriptionStatus = async (channelId: string) => {
          try {
            const response = await apiFetch<{
              data?: { subscribed?: boolean };
            }>(
              `/api/youtube/subscription-status?channel_id=${encodeURIComponent(channelId)}`,
              { signal: controller.signal },
            );
            return typeof response?.data?.subscribed === "boolean"
              ? response.data.subscribed
              : null;
          } catch (subscriptionError) {
            if (controller.signal.aborted) return null;
            if (
              subscriptionError instanceof ApiError &&
              subscriptionError.status === 401
            ) {
              return null;
            }
            console.error(
              "Failed to fetch subscription status",
              subscriptionError,
            );
            return null;
          }
        };

        type LocalLoadResult = {
          channelId: string;
          channelMetadata: ChannelMetadata;
          videos: VideoTableRow[];
        };

        const fetchLocalChannel = async (
          path: string,
        ): Promise<LocalChannelRecord | null> => {
          try {
            const response = await apiFetch<LocalChannelResponse>(path, {
              signal: controller.signal,
            });
            return response?.data ?? null;
          } catch (error) {
            if (controller.signal.aborted) return null;
            if (
              error instanceof ApiError &&
              [400, 401, 403, 404].includes(error.status)
            ) {
              return null;
            }
            console.error("Failed to fetch local channel data", error);
            return null;
          }
        };

        const fetchLocalVideos = async (
          channelIdValue: string,
        ): Promise<LocalVideoRecord[] | null> => {
          const collected: LocalVideoRecord[] = [];
          let offset = 0;
          let hasMore = true;
          while (hasMore) {
            if (controller.signal.aborted) return null;
            const params = new URLSearchParams({
              limit: LOCAL_VIDEO_PAGE_SIZE.toString(),
              offset: offset.toString(),
            });
            if (loadHotComments) {
              params.set("includeTopComment", "true");
            }
            try {
              const response = await apiFetch<LocalVideosResponse>(
                `/api/youtube/channels/${encodeURIComponent(channelIdValue)}/videos?${params.toString()}`,
                { signal: controller.signal },
              );
              const batch = Array.isArray(response?.data)
                ? (response.data.filter((record): record is LocalVideoRecord =>
                    Boolean(record),
                  ) as LocalVideoRecord[])
                : [];
              collected.push(...batch);
              const total = response?.meta?.total;
              offset += batch.length;
              const reachedEnd =
                batch.length < LOCAL_VIDEO_PAGE_SIZE ||
                (typeof total === "number" && offset >= total);
              hasMore = !reachedEnd;
            } catch (error) {
              if (controller.signal.aborted) return null;
              if (
                error instanceof ApiError &&
                [401, 403, 404].includes(error.status)
              ) {
                return null;
              }
              console.error("Failed to fetch local channel videos", error);
              return null;
            }
          }
          return collected;
        };

        const toChannelMetadata = (
          record: LocalChannelRecord,
        ): ChannelMetadata => {
          const stats = record.statistics ?? {};
          const title = record.title?.trim() ?? trimmed;
          const rawHandle =
            record.handle?.trim() ?? record.customUrl?.trim() ?? "";
          const fallbackHandle = ensureHandleFormat(
            trimmed.startsWith("@") ? trimmed : `@${trimmed}`,
          );
          return {
            handle: rawHandle ? ensureHandleFormat(rawHandle) : fallbackHandle,
            title,
            description: record.description?.trim() ?? "",
            subscriberCount: parseCount(
              stats.subscriberCount ?? record.subscriberCount,
            ),
            videoCount: parseCount(stats.videoCount ?? record.videoCount),
            viewCount: parseCount(stats.viewCount ?? record.viewCount),
          };
        };

        const toVideoRows = (
          records: LocalVideoRecord[],
          channelIdHint: string,
          channelMetadataHint: ChannelMetadata | null,
        ): VideoTableRow[] => {
          return records
            .map<VideoTableRow | null>((record) => {
              const id = record.videoId?.trim() ?? record.id?.trim();
              if (!id) return null;
              const stats = record.statistics ?? null;
              const thumbnails = record.thumbnails ?? null;
              const topComment =
                record.topComment ?? record.top_comment ?? null;
              const description = record.description?.trim() ?? "";
              const tags =
                Array.isArray(record.tags) && record.tags.length > 0
                  ? record.tags
                      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
                      .filter((tag): tag is string => Boolean(tag))
                  : [];
              const thumbnailUrl =
                record.thumbnailUrl?.trim() ??
                thumbnails?.high?.url?.trim() ??
                thumbnails?.medium?.url?.trim() ??
                thumbnails?.default?.url?.trim() ??
                "";
              const publishedAt =
                record.publishedAt ??
                record.contentDetails?.videoPublishedAt ??
                "";
              const duration =
                record.contentDetails?.duration ?? record.duration ?? "";
              return {
                id,
                title: record.title?.trim() ?? "Untitled",
                publishedAt,
                thumbnailUrl,
                viewCount: parseCount(
                  stats?.viewCount ?? record.viewCount ?? 0,
                ),
                likeCount: parseCount(
                  stats?.likeCount ?? record.likeCount ?? 0,
                ),
                favoriteCount: parseCount(
                  stats?.favoriteCount ?? record.favoriteCount ?? 0,
                ),
                commentCount: parseCount(
                  stats?.commentCount ?? record.commentCount ?? 0,
                ),
                topComment: resolveLocalCommentText(topComment),
                topCommentLikeCount: resolveLocalCommentLikeCount(topComment),
                topCommentReplyCount: resolveLocalCommentReplyCount(topComment),
                channelId: record.channelId?.trim() ?? channelIdHint,
                channelTitle:
                  record.channelTitle?.trim() ??
                  channelMetadataHint?.title ??
                  "",
                channelHandle:
                  record.channelHandle?.trim() ??
                  channelMetadataHint?.handle ??
                  "",
                description,
                duration,
                tags,
                topCommentAuthor: resolveLocalCommentAuthor(topComment),
                topCommentPublishedAt:
                  resolveLocalCommentPublishedAt(topComment),
                source: "local",
              };
            })
            .filter((record): record is VideoTableRow => record !== null)
            .sort((a, b) => {
              const viewDiff = b.viewCount - a.viewCount;
              if (viewDiff !== 0) return viewDiff;
              const likeDiff = b.likeCount - a.likeCount;
              if (likeDiff !== 0) return likeDiff;
              const timeA = new Date(a.publishedAt).getTime();
              const timeB = new Date(b.publishedAt).getTime();
              const normalizedA = Number.isFinite(timeA) ? timeA : 0;
              const normalizedB = Number.isFinite(timeB) ? timeB : 0;
              return normalizedB - normalizedA;
            });
        };

        // 命中本地缓存：按 channelId 或 customUrl 查询，命中后立即返回
        const tryLoadFromLocal = async (): Promise<LocalLoadResult | null> => {
          const attemptChannelById = async (channelIdValue: string) => {
            if (!channelIdValue) return null;
            return fetchLocalChannel(
              `/api/youtube/channels/${encodeURIComponent(channelIdValue)}`,
            );
          };

          const attemptChannelByCustomUrl = async (
            customUrl: string,
          ): Promise<LocalChannelRecord | null> => {
            const normalizedCustomUrl = normalizeCustomUrlPath(customUrl);
            if (!normalizedCustomUrl) return null;
            return fetchLocalChannel(
              `/api/youtube/channels/custom/${encodeURIComponent(normalizedCustomUrl)}`,
            );
          };

          let channelRecord: LocalChannelRecord | null = null;

          if (resolvedChannelId) {
            channelRecord = await attemptChannelById(resolvedChannelId);
          }

          if (!channelRecord && CHANNEL_ID_PATTERN.test(trimmed)) {
            channelRecord = await attemptChannelById(trimmed);
          }

          if (!channelRecord) {
            const candidates = Array.from(
              new Set(
                [
                  trimmed,
                  trimmed.startsWith("@") ? trimmed.slice(1) : `@${trimmed}`,
                ]
                  .map((candidate) => candidate.trim())
                  .filter(Boolean),
              ),
            );
            for (const candidate of candidates) {
              channelRecord = await attemptChannelByCustomUrl(candidate);
              if (channelRecord) break;
            }
          }

          if (!channelRecord) return null;

          const channelIdValue =
            channelRecord.channelId?.trim() ?? channelRecord.id?.trim();
          if (!channelIdValue) return null;

          const channelMetadata = toChannelMetadata(channelRecord);
          const videoRecords = await fetchLocalVideos(channelIdValue);
          if (!videoRecords) return null;

          const videos = toVideoRows(
            videoRecords,
            channelIdValue,
            channelMetadata,
          );
          return { channelId: channelIdValue, channelMetadata, videos };
        };

        const localResult = await tryLoadFromLocal();
        if (controller.signal.aborted) return;
        if (localResult) {
          if (videosAbortControllerRef.current !== controller) return;
          lastRequestRef.current = {
            query: localResult.channelMetadata.title,
            channelId: localResult.channelId,
          };
          pushState({
            channelId: localResult.channelId,
            channelMetadata: localResult.channelMetadata,
            videos: localResult.videos,
            error: null,
            isLoading: false,
            isSubscriptionLoading: true,
            isSubscribed: null,
          });
          const subscriptionStatus = await fetchSubscriptionStatus(
            localResult.channelId,
          );
          if (controller.signal.aborted) return;
          pushState({
            isSubscribed: subscriptionStatus,
            isSubscriptionLoading: false,
          });
          return;
        }

        try {
          // 本地未命中：退回到 YouTube，按 channelId/handle 获取频道与上传列表
          const apiKey = await getYoutubeApiKey();
          if (controller.signal.aborted) return;

          const channelResponse = await channelsList({
            params: {
              part: "id,contentDetails,snippet,statistics",
              maxResults: 1,
              key: apiKey,
              ...(resolvedChannelId
                ? { id: resolvedChannelId }
                : { forHandle: trimmed }),
            },
            signal: controller.signal,
          });

          const channelItems = (channelResponse?.items ??
            []) as ChannelsListItem[];
          const firstChannel = channelItems[0];
          const channelId = firstChannel?.id?.trim();
          const uploadsPlaylistId =
            firstChannel?.contentDetails?.relatedPlaylists?.uploads?.trim();

          if (!channelId || !uploadsPlaylistId) {
            if (videosAbortControllerRef.current !== controller) return;
            pushState({
              error: "Channel or playlist not found",
              channelMetadata: null,
              videos: [],
              isLoading: false,
              channelId: "",
              isSubscriptionLoading: false,
              isSubscribed: null,
            });
            return;
          }

          const normalizedChannelName =
            firstChannel?.snippet?.title?.trim() ?? trimmed;
          const channelHandle =
            firstChannel?.handle?.trim() ??
            (trimmed.startsWith("@") ? trimmed : `@${trimmed}`);
          const channelDescription =
            firstChannel?.snippet?.description?.trim() ?? "";
          const stats = firstChannel?.statistics ?? {};
          const channelMetadata = {
            handle: channelHandle,
            title: normalizedChannelName,
            description: channelDescription,
            subscriberCount: parseCount(stats.subscriberCount),
            videoCount: parseCount(stats.videoCount),
            viewCount: parseCount(stats.viewCount),
          };

          lastRequestRef.current = { query: normalizedChannelName, channelId };

          if (videosAbortControllerRef.current !== controller) return;
          pushState({
            channelId,
            channelMetadata,
            isSubscriptionLoading: true,
            isSubscribed: null,
          });

          const subscriptionStatus = await fetchSubscriptionStatus(channelId);
          if (controller.signal.aborted) return;
          pushState({
            isSubscribed: subscriptionStatus,
            isSubscriptionLoading: false,
          });

          const playlistMetadata = new Map<
            string,
            { title?: string; publishedAt?: string; thumbnailUrl?: string }
          >();

          const totalVideos = parseCount(stats.videoCount);
          const resolvePlaylistPageSize = () => {
            if (totalVideos < 200) return 50;
            if (totalVideos <= 600) return 25;
            return 10;
          };
          const playlistPageSize = resolvePlaylistPageSize();

          let pageToken: string | undefined;

          do {
            const playlistResponse = await playlistItemsList({
              params: {
                part: "snippet,contentDetails",
                playlistId: uploadsPlaylistId,
                maxResults: playlistPageSize,
                pageToken,
                key: apiKey,
              },
              signal: controller.signal,
            });

            const items = (playlistResponse?.items ??
              []) as PlaylistItemsListItem[];
            for (const item of items) {
              const snippet = item.snippet ?? {};
              const contentDetails = item.contentDetails ?? {};
              const thumbnails = snippet.thumbnails ?? {};
              const videoId =
                contentDetails.videoId?.trim() ??
                snippet.resourceId?.videoId?.trim();
              if (!videoId) continue;
              const thumbnailUrl =
                thumbnails.high?.url?.trim() ??
                thumbnails.medium?.url?.trim() ??
                thumbnails.default?.url?.trim();
              playlistMetadata.set(videoId, {
                title: snippet.title?.trim(),
                publishedAt:
                  contentDetails.videoPublishedAt ?? snippet.publishedAt,
                thumbnailUrl,
              });
            }

            pageToken =
              typeof playlistResponse?.nextPageToken === "string"
                ? playlistResponse.nextPageToken.trim() || undefined
                : undefined;

            if (videosAbortControllerRef.current !== controller) {
              return;
            }
          } while (pageToken);

          const videoIds = Array.from(playlistMetadata.keys());

          if (videoIds.length === 0) {
            if (videosAbortControllerRef.current !== controller) return;
            pushState({
              videos: [],
              error: null,
              isLoading: false,
            });
            return;
          }

          const videosItems: VideosListItem[] = [];
          const chunkSize = 50;
          for (let index = 0; index < videoIds.length; index += chunkSize) {
            const chunk = videoIds.slice(index, index + chunkSize);
            const response = await videosList({
              params: {
                part: "snippet,statistics",
                id: chunk,
                key: apiKey,
              },
              signal: controller.signal,
            });

            videosItems.push(...((response?.items ?? []) as VideosListItem[]));

            if (videosAbortControllerRef.current !== controller) {
              return;
            }
          }

          if (videosAbortControllerRef.current !== controller) return;

          const fetchTopComments = async (channelOwnerId: string) => {
            const results = new Map<
              string,
              { text: string; likeCount: number; replyCount: number }
            >();
            const uniqueIds = Array.from(
              new Set(
                videosItems
                  .map((item) => item.id?.trim())
                  .filter((id): id is string => Boolean(id)),
              ),
            );

            for (const videoId of uniqueIds) {
              if (controller.signal.aborted) break;
              if (videosAbortControllerRef.current !== controller) {
                return results;
              }

              try {
                const threadResponse = await commentThreadsList({
                  params: {
                    part: "snippet",
                    videoId,
                    order: "relevance",
                    maxResults: 5,
                    textFormat: "plainText",
                    key: apiKey,
                  },
                  signal: controller.signal,
                });

                const threadItems = (
                  (threadResponse?.items ?? []) as CommentThreadsListItem[]
                ).slice(0, 5);

                for (const threadItem of threadItems) {
                  const topLevel = threadItem?.snippet?.topLevelComment ?? null;
                  const commentId = topLevel?.id?.trim();
                  const commentSnippet = topLevel?.snippet;
                  const authorId =
                    commentSnippet?.authorChannelId?.value?.trim() ?? "";
                  const threadReplyCount =
                    threadItem?.snippet?.totalReplyCount ?? 0;
                  if (authorId && authorId === channelOwnerId) {
                    continue;
                  }

                  const normalizedComment =
                    commentSnippet?.textOriginal?.trim() ??
                    commentSnippet?.textDisplay?.trim() ??
                    "";

                  if (normalizedComment) {
                    results.set(videoId, {
                      text: normalizedComment,
                      likeCount: commentSnippet?.likeCount ?? 0,
                      replyCount: threadReplyCount,
                    });
                    break;
                  }

                  if (!commentId) {
                    continue;
                  }

                  const commentResponse = await commentsList({
                    params: {
                      part: "snippet",
                      id: commentId,
                      textFormat: "plainText",
                      key: apiKey,
                    },
                    signal: controller.signal,
                  });

                  const commentItems = (commentResponse?.items ??
                    []) as CommentResource[];
                  const fallbackSnippet = commentItems[0]?.snippet;
                  const fallbackAuthorId =
                    fallbackSnippet?.authorChannelId?.value?.trim() ?? "";
                  if (fallbackAuthorId && fallbackAuthorId === channelOwnerId) {
                    continue;
                  }
                  const fallbackComment =
                    fallbackSnippet?.textOriginal?.trim() ??
                    fallbackSnippet?.textDisplay?.trim() ??
                    "";

                  if (fallbackComment) {
                    results.set(videoId, {
                      text: fallbackComment,
                      likeCount: fallbackSnippet?.likeCount ?? 0,
                      replyCount: threadReplyCount,
                    });
                    break;
                  }
                }
              } catch (commentError) {
                if (controller.signal.aborted) break;
                console.error(
                  `Failed to fetch top comment for video ${videoId}`,
                  commentError,
                );
              }
            }

            return results;
          };

          const topCommentsMap = loadHotComments
            ? await fetchTopComments(channelId)
            : new Map<
                string,
                { text: string; likeCount: number; replyCount: number }
              >();

          if (videosAbortControllerRef.current !== controller) return;

          const rows = videosItems
            .map<VideoTableRow | null>((item) => {
              const id = item.id?.trim();
              if (!id) return null;

              const snippet = item.snippet ?? {};
              const stats = item.statistics ?? {};
              const fallback = playlistMetadata.get(id) ?? {};
              const thumbnails = snippet.thumbnails ?? {};
              const thumbnailUrl =
                thumbnails.high?.url?.trim() ??
                thumbnails.medium?.url?.trim() ??
                thumbnails.default?.url?.trim() ??
                fallback.thumbnailUrl ??
                "";

              return {
                id,
                title: snippet.title?.trim() ?? fallback.title ?? "Untitled",
                publishedAt: snippet.publishedAt ?? fallback.publishedAt ?? "",
                thumbnailUrl,
                viewCount: parseCount(stats.viewCount),
                likeCount: parseCount(stats.likeCount),
                favoriteCount: parseCount(stats.favoriteCount),
                commentCount: parseCount(stats.commentCount),
                topComment: topCommentsMap.get(id)?.text ?? "",
                topCommentLikeCount: topCommentsMap.get(id)?.likeCount ?? 0,
                topCommentReplyCount: topCommentsMap.get(id)?.replyCount ?? 0,
                channelId,
                channelTitle: normalizedChannelName,
                channelHandle,
                description: snippet.description?.trim() ?? "",
                duration: "",
                tags: Array.isArray(snippet.tags)
                  ? snippet.tags
                      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
                      .filter((tag): tag is string => Boolean(tag))
                  : [],
                source: "youtube",
              };
            })
            .filter((item): item is VideoTableRow => item !== null)
            .sort((a, b) => {
              const viewDiff = b.viewCount - a.viewCount;
              if (viewDiff !== 0) return viewDiff;
              const likeDiff = b.likeCount - a.likeCount;
              if (likeDiff !== 0) return likeDiff;
              const timeA = new Date(a.publishedAt).getTime();
              const timeB = new Date(b.publishedAt).getTime();
              const normalizedA = Number.isFinite(timeA) ? timeA : 0;
              const normalizedB = Number.isFinite(timeB) ? timeB : 0;
              return normalizedB - normalizedA;
            });

          pushState({
            videos: rows,
            error: null,
            isLoading: false,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error("Failed to load channel videos", error);
          if (videosAbortControllerRef.current !== controller) return;
          pushState({
            error: "Failed to load channel videos",
            videos: [],
            channelMetadata: null,
            isLoading: false,
            isSubscriptionLoading: false,
          });
        } finally {
          if (videosAbortControllerRef.current === controller) {
            videosAbortControllerRef.current = null;
          }
        }
      },
      [loadHotComments, onChannelVideosUpdate],
    );

    const runCurrentQuery = useCallback(() => {
      const trimmed = value.trim();
      if (!trimmed) {
        if (isGlobalSearchEnabled) {
          void onSearch("");
        } else {
          resetChannelVideos();
        }
        return;
      }

      if (isGlobalSearchEnabled) {
        void onSearch(trimmed);
        return;
      }

      void loadChannelVideos(trimmed);
    }, [
      isGlobalSearchEnabled,
      loadChannelVideos,
      onSearch,
      resetChannelVideos,
      value,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => {
          const lastRequest = lastRequestRef.current;
          if (!lastRequest) return false;
          void loadChannelVideos(lastRequest.query, {
            channelId: lastRequest.channelId,
          });
          return true;
        },
        submitCurrentQuery: runCurrentQuery,
        hydrateLastRequest: ({ query, channelId, inputValue }) => {
          const normalizedQuery = query.trim();
          const normalizedChannelId = channelId?.trim();

          if (!normalizedQuery && !normalizedChannelId) return;

          lastRequestRef.current = {
            query: normalizedQuery || normalizedChannelId || "",
            channelId: normalizedChannelId,
          };

          if (normalizedQuery || inputValue) {
            setValue(inputValue ?? normalizedQuery);
          }
        },
      }),
      [loadChannelVideos, runCurrentQuery],
    );

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmed = value.trim();
      if (!trimmed) return;

      setIsOpen(false);

      // 检查是否以 http:// 或 https:// 开头，如果是，尝试提取视频ID并跳转
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const videoId = extractVideoIdFromUrl(trimmed);
        if (videoId) {
          navigate(`/detail/${videoId}`);
          return;
        }
      }

      // 保持原有逻辑
      if (isGlobalSearchEnabled) {
        void onSearch(trimmed);
        return;
      }

      void loadChannelVideos(trimmed);
    };

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setValue(nextValue);

      const trimmed = nextValue.trim();
      if (!trimmed) {
        resetChannelVideos();
        setIsOpen(false);
        if (isGlobalSearchEnabled) {
          void onSearch("");
        }
        return;
      }

      if (!isGlobalSearchEnabled) {
        setIsOpen(false);
        return;
      }

      setIsOpen(true);
      void onSearch(trimmed);
    };

    const handleSuggestionSelect = (suggestion: ChannelSuggestion) => {
      setValue(suggestion.title);
      setIsOpen(false);
      const trimmed = suggestion.title.trim();
      if (!trimmed) return;

      void loadChannelVideos(trimmed, { channelId: suggestion.channelId });
    };

    useEffect(() => {
      if (!isOpen) return;

      const handlePointerDown = (event: MouseEvent) => {
        const form = containerRef.current;
        if (!form) return;
        if (form.contains(event.target as Node)) return;
        setIsOpen(false);
      };

      document.addEventListener("mousedown", handlePointerDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
      };
    }, [isOpen]);

    useEffect(() => {
      if (suggestions.length === 0) {
        setIsOpen(false);
      }
    }, [suggestions.length]);

    useEffect(() => {
      return () => {
        videosAbortControllerRef.current?.abort();
      };
    }, []);

    const showSuggestions =
      isGlobalSearchEnabled && isOpen && suggestions.length > 0;
    const canSubmit = value.trim().length > 0;

    return (
      <div className="flex w-full max-w-5xl flex-col items-center gap-6">
        <form
          ref={containerRef}
          onSubmit={handleSubmit}
          className="group relative w-full max-w-md"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-primary/30 via-white/20 to-primary/30 opacity-0 blur-[18px] transition-opacity duration-300 group-focus-within:opacity-100"
          />
          <div className="flex items-center overflow-hidden rounded-full border border-white/20 bg-white/80 backdrop-blur-md shadow-[0_15px_40px_-20px_rgba(15,23,42,0.75)] transition-all duration-300 focus-within:border-white/70 focus-within:bg-white/90 focus-within:shadow-[0_25px_65px_-25px_rgba(15,23,42,0.85)] focus-within:ring-2 focus-within:ring-white/40 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_15px_40px_-20px_rgba(0,0,0,0.9)] dark:focus-within:border-primary/50 dark:focus-within:bg-slate-900/80 dark:focus-within:ring-primary/40">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-muted-foreground/80" />
              <Input
                type="search"
                placeholder="输入频道ID或视频地址进行搜索"
                className="h-12 rounded-none border-0 bg-transparent pl-11 pr-4 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-foreground dark:placeholder:text-muted-foreground/80"
                value={value}
                onChange={handleChange}
                onFocus={() => {
                  if (isGlobalSearchEnabled && suggestions.length > 0) {
                    setIsOpen(true);
                  }
                }}
              />
            </div>
            <button
              type="submit"
              aria-label="执行搜索"
              disabled={!canSubmit}
              className="group flex h-12 w-16 items-center justify-center border-l border-white/30 bg-white/50 text-slate-900 backdrop-blur-md transition-all duration-200 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-800/80 dark:text-foreground dark:hover:bg-slate-700/80 dark:focus-visible:ring-primary/50 dark:focus-visible:ring-offset-slate-900"
            >
              <Search
                className="h-5 w-5 text-slate-900 transition-transform duration-150 group-hover:scale-110 group-hover:text-primary dark:text-foreground"
                aria-hidden="true"
              />
            </button>
          </div>
          {showSuggestions ? (
            <ul className="absolute left-0 right-0 top-full z-10 mt-2 max-h-[29vh] overflow-hidden overflow-y-auto rounded-lg border bg-background shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {suggestions.map((suggestion) => (
                <li key={suggestion.channelId}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestionSelect(suggestion)}
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{suggestion.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      </div>
    );
  },
);

export default SearchInput;
