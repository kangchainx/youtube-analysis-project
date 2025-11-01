import { Input } from "@/components/ui/input";
import {
  channelsList,
  commentsList,
  commentThreadsList,
  playlistItemsList,
  videosList,
} from "@/lib/youtube";
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
    const [value, setValue] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLFormElement>(null);
    const videosAbortControllerRef = useRef<AbortController | null>(null);
    const lastRequestRef = useRef<{ query: string; channelId?: string } | null>(
      null,
    );

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
      });
    }, [onChannelVideosUpdate]);

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
        };

        const pushState = (partial: Partial<ChannelVideosState> = {}) => {
          if (videosAbortControllerRef.current !== controller) return;
          currentState = { ...currentState, ...partial };
          onChannelVideosUpdate?.(currentState);
        };

        pushState();

        const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
        const parseCount = (count?: string) => {
          if (!count) return 0;
          const parsed = Number(count);
          return Number.isFinite(parsed) ? parsed : 0;
        };

        try {
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

    return (
      <div className="flex w-full max-w-5xl flex-col items-center gap-6">
        <form
          ref={containerRef}
          onSubmit={handleSubmit}
          className="relative w-full max-w-md"
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索频道或Youtuber..."
            className="pl-9"
            value={value}
            onChange={handleChange}
            onFocus={() => {
              if (isGlobalSearchEnabled && suggestions.length > 0) {
                setIsOpen(true);
              }
            }}
          />
          {showSuggestions ? (
            <ul className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-lg border bg-background shadow-lg">
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
