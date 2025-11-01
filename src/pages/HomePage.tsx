import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import SearchInput, {
  type ChannelSuggestion,
  type ChannelVideosState,
  type SearchInputHandle,
} from "@/features/home/search-input";
import VideoList from "@/features/home/video-list";
import { searchList } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  MessageCircleQuestionMark,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import helpGif from "@/assets/gif/help.gif";

type YouTubeSearchItem = {
  id?: {
    channelId?: string;
  };
  snippet?: {
    title?: string;
  };
};

function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<ChannelSuggestion[]>([]);
  const [channelVideosState, setChannelVideosState] =
    useState<ChannelVideosState>({
      channelName: "",
      channelId: "",
      channelMetadata: null,
      videos: [],
      error: null,
      isLoading: false,
    });
  const searchInputRef = useRef<SearchInputHandle | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isGlobalSearchEnabled, setIsGlobalSearchEnabled] = useState(false);
  const [isHotCommentsEnabled, setIsHotCommentsEnabled] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);
  const wasDataReadyRef = useRef(false);
  const isHotCommentEffectInitializedRef = useRef(false);
  const isDataReady =
    Boolean(channelVideosState.channelMetadata) &&
    !channelVideosState.isLoading &&
    !channelVideosState.error;

  const handleHotCommentsToggle = (checked: boolean) => {
    setIsHotCommentsEnabled(checked);
  };

  useEffect(() => {
    const restoreState =
      (location.state as { restoreSearchState?: ChannelVideosState } | null)
        ?.restoreSearchState;
    if (!restoreState) return;
    setChannelVideosState(restoreState);
    const api = searchInputRef.current;
    api?.hydrateLastRequest({
      query: restoreState.channelMetadata?.handle ?? restoreState.channelName,
      channelId: restoreState.channelId,
      inputValue: restoreState.channelName,
    });
    setSuggestions([]);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const handleSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();

    if (!trimmed) {
      abortControllerRef.current?.abort();
      setSuggestions([]);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await searchList({
        params: {
          part: "snippet",
          q: trimmed,
          type: "channel",
          maxResults: 10,
          key: import.meta.env.VITE_YOUTUBE_API_KEY,
        },
        signal: controller.signal,
      });

      const items = (response?.items ?? []) as YouTubeSearchItem[];
      const uniqueSuggestions = new Map<string, ChannelSuggestion>();

      for (const item of items) {
        const channelId = item.id?.channelId?.trim();
        const title = item.snippet?.title?.trim();
        if (!channelId || !title || uniqueSuggestions.has(channelId)) continue;
        uniqueSuggestions.set(channelId, { channelId, title });
      }

      setSuggestions(Array.from(uniqueSuggestions.values()));
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("searchList failed", error);
      setSuggestions([]);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const handleManualRefresh = useCallback(() => {
    const api = searchInputRef.current;
    if (!api) return;

    const didRefresh = api.refresh();
    if (didRefresh) return;

    const fallbackChannelId = channelVideosState.channelId.trim();
    const fallbackHandle =
      channelVideosState.channelMetadata?.handle?.trim() ?? "";
    const displayName = channelVideosState.channelName.trim();

    if (!fallbackHandle && !fallbackChannelId && !displayName) return;

    api.hydrateLastRequest({
      query: fallbackHandle || displayName,
      channelId: fallbackChannelId || undefined,
      inputValue: displayName || fallbackHandle,
    });

    void api.refresh();
  }, [
    channelVideosState.channelId,
    channelVideosState.channelMetadata?.handle,
    channelVideosState.channelName,
  ]);

  const handleGlobalSearchToggle = (nextValue: boolean) => {
    if (nextValue) {
      setIsConfirmDialogOpen(true);
      return;
    }
    setIsGlobalSearchEnabled(false);
  };

  const handleConfirmGlobalSearch = () => {
    setIsGlobalSearchEnabled(true);
    setIsConfirmDialogOpen(false);
  };

  const handleCancelGlobalSearch = () => {
    setIsConfirmDialogOpen(false);
    setIsGlobalSearchEnabled(false);
  };

  useEffect(() => {
    if (isDataReady && !wasDataReadyRef.current) {
      setIsSearchCollapsed(true);
    }
    wasDataReadyRef.current = isDataReady;
  }, [isDataReady]);

  useEffect(() => {
    if (!isHotCommentEffectInitializedRef.current) {
      isHotCommentEffectInitializedRef.current = true;
      return;
    }

    searchInputRef.current?.submitCurrentQuery();
  }, [isHotCommentsEnabled]);

  const handleSearchPanelToggle = () => {
    setIsSearchCollapsed((previous) => !previous);
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const searchPanelClasses = cn(
    "mt-4 transition-all duration-300 ease-in-out",
    isSearchCollapsed
      ? "-translate-y-4 max-h-0 overflow-hidden opacity-0 pointer-events-none"
      : "max-h-[420px] overflow-visible opacity-100 translate-y-0",
  );
  const videoListWrapperClasses = cn(
    "w-full max-w-7xl transition-all duration-300 ease-in-out",
    isSearchCollapsed ? "mt-4" : "mt-12",
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-start px-4 pt-14">
      <div className="fixed left-1/2 top-2 z-30 -translate-x-1/2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleSearchPanelToggle}
          aria-expanded={!isSearchCollapsed}
          aria-controls="search-panel"
          aria-label={isSearchCollapsed ? "展开搜索区域" : "收起搜索区域"}
          title={isSearchCollapsed ? "展开搜索区域" : "收起搜索区域"}
          className="rounded-full border border-border/70 bg-background shadow-sm"
        >
          {isSearchCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="w-full max-w-7xl">
        <div id="search-panel" className={searchPanelClasses}>
          <div className="flex flex-col items-center gap-4">
            <div className="flex w-full items-center justify-center gap-1">
              <div className="w-full max-w-md">
                <SearchInput
                  ref={searchInputRef}
                  onSearch={handleSearch}
                  suggestions={suggestions}
                  onChannelVideosUpdate={(next) => setChannelVideosState(next)}
                  isGlobalSearchEnabled={isGlobalSearchEnabled}
                  loadHotComments={isHotCommentsEnabled}
                />
              </div>
              <HoverCard openDelay={100}>
                <HoverCardTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="查看帮助"
                    className="rounded-full border border-border/70"
                  >
                    <MessageCircleQuestionMark className="h-4 w-4" />
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent side="top" align="end" className="w-72 p-3">
                  <img
                    src={helpGif}
                    alt="搜索帮助动图"
                    className="h-auto w-full rounded-md"
                  />
                </HoverCardContent>
              </HoverCard>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="hot-comments-toggle"
                  checked={isHotCommentsEnabled}
                  onCheckedChange={handleHotCommentsToggle}
                />
                <Label
                  htmlFor="hot-comments-toggle"
                  className="text-sm text-muted-foreground"
                >
                  热门评论
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="global-search-toggle"
                  checked={isGlobalSearchEnabled}
                  onCheckedChange={handleGlobalSearchToggle}
                />
                <Label
                  htmlFor="global-search-toggle"
                  className="text-sm text-muted-foreground"
                >
                  全站搜索
                </Label>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={videoListWrapperClasses}>
        <VideoList
          channelVideosState={channelVideosState}
          onRefresh={handleManualRefresh}
          showHotComments={isHotCommentsEnabled}
        />
      </div>
      <AlertDialog
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsConfirmDialogOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>启用全站搜索？</AlertDialogTitle>
            <AlertDialogDescription>
              全站搜索将耗费大量资源，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelGlobalSearch}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGlobalSearch}>
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default HomePage;
