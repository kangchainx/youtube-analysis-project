import { useEffect, useMemo, useRef, useState } from "react";
import { TypographyH2, TypographyLead } from "@/components/ui/typography";
import ChannelSpotlightCard, {
  type ChannelSpotlight,
} from "@/features/home/channel-spotlight-card";
import { apiFetch } from "@/lib/api-client";
import { DataErrorState } from "@/components/ui/data-error-state";

type SpotlightChannelResponse = {
  handle?: string;
  channelId?: string;
  title?: string;
  description?: string;
  avatarUrl?: string;
  totalViews?: string | number;
  totalSubscribers?: string | number;
  order?: number;
  updatedAt?: string;
};

const PLACEHOLDER_COUNT = 5;

const TestimonialsStrip = () => {
  const [spotlightChannels, setSpotlightChannels] = useState<
    ChannelSpotlight[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [placeholderCount, setPlaceholderCount] =
    useState<number>(PLACEHOLDER_COUNT);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSpotlightChannels() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await apiFetch<SpotlightChannelResponse[]>(
          "/api/spotlight-channels",
          {
            signal: controller.signal,
          },
        );

        const formatter = new Intl.NumberFormat("zh-CN", {
          notation: "compact",
          compactDisplay: "short",
        });

        const normalizeCount = (value?: string): string => {
          if (!value) return "0";
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return "0";
          return formatter.format(parsed);
        };

        const normalized = (Array.isArray(response) ? response : [])
          .map((item) => {
            const sanitizedHandle = (item.handle ?? "").replace(/^@+/, "");
            return {
              name: item.title?.trim() || sanitizedHandle || "未命名频道",
              handle: sanitizedHandle || null,
              channelId: item.channelId?.trim() || null,
              description:
                item.description?.trim() || "该频道暂未提供简介信息。",
              totalViews: normalizeCount(
                typeof item.totalViews === "string"
                  ? item.totalViews
                  : String(item.totalViews ?? ""),
              ),
              totalSubscribers: normalizeCount(
                typeof item.totalSubscribers === "string"
                  ? item.totalSubscribers
                  : String(item.totalSubscribers ?? ""),
              ),
              avatarUrl: item.avatarUrl || null,
            } satisfies ChannelSpotlight;
          })
          .filter((item) => item.name.trim().length > 0);

        if (controller.signal.aborted) return;

        setPlaceholderCount(
          normalized.length > 0 ? normalized.length : PLACEHOLDER_COUNT,
        );

        if (normalized.length === 0) {
          setErrorMessage("未找到可展示的频道，请稍后重试。");
        }

        setSpotlightChannels(normalized);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load spotlight channels", error);
        setErrorMessage(
          error instanceof Error ? error.message : "加载精选频道信息失败。",
        );
        setPlaceholderCount(PLACEHOLDER_COUNT);
        setSpotlightChannels([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadSpotlightChannels();

    return () => {
      controller.abort();
    };
  }, [retryKey]);

  const duplicatedList = useMemo(
    () =>
      spotlightChannels.length > 0
        ? [...spotlightChannels, ...spotlightChannels]
        : [],
    [spotlightChannels],
  );
  const hoverCounterRef = useRef(0);
  const [isPaused, setIsPaused] = useState(false);
  const handleRetry = () => {
    setRetryKey((current) => current + 1);
  };

  const handleHoverChange = (hovering: boolean) => {
    hoverCounterRef.current += hovering ? 1 : -1;
    hoverCounterRef.current = Math.max(hoverCounterRef.current, 0);
    setIsPaused(hoverCounterRef.current > 0);
  };

  const shouldShowErrorState = Boolean(errorMessage && !isLoading);
  const showEmptyState =
    !isLoading && spotlightChannels.length === 0 && !errorMessage;

  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      <TypographyH2 className="text-center text-2xl font-semibold text-foreground md:text-3xl">
        想做自媒体？
      </TypographyH2>
      <TypographyLead className="text-center text-base text-foreground md:text-lg">
        不妨先看看优秀的博主是怎么做的
      </TypographyLead>
      <div
        className="relative mt-6 h-[280px] w-full overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
        }}
      >
        {spotlightChannels.length > 0 ? (
          <div
            className="absolute inset-0 flex w-max items-center gap-6"
            style={{
              animation: "testimonials-marquee 26s linear infinite",
              animationPlayState: isPaused ? "paused" : "running",
            }}
          >
            {duplicatedList.map((channel, index) => (
              <ChannelSpotlightCard
                key={`${channel.name}-${index}`}
                spotlight={channel}
                className="h-full w-[360px]"
                onHoverChange={handleHoverChange}
              />
            ))}
          </div>
        ) : shouldShowErrorState ? (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <DataErrorState
              className="w-full max-w-md bg-background/95"
              title="精选频道加载失败"
              description={
                errorMessage ?? "暂时无法获取精选频道，请稍后重试。"
              }
              actionLabel="重新加载"
              onRetry={handleRetry}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex w-max items-center gap-6">
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <div
                key={`placeholder-${index}`}
                className="h-full w-[360px] rounded-2xl border border-border/30 bg-muted/20 p-6 shadow-inner"
              >
                <div className="flex h-full flex-col gap-4 animate-pulse text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-12 w-12 rounded-full bg-muted/50" />
                    <div className="flex flex-1 flex-col gap-2">
                      <span className="h-4 w-32 rounded-full bg-muted/40" />
                      <span className="h-3 w-24 rounded-full bg-muted/30" />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <span className="h-3 w-full rounded-full bg-muted/30" />
                    <span className="h-3 w-5/6 rounded-full bg-muted/20" />
                    <span className="h-3 w-4/6 rounded-full bg-muted/20" />
                  </div>
                  <div className="mt-auto flex flex-col gap-2">
                    <span className="h-10 w-full rounded-xl bg-muted/25" />
                    <span className="h-10 w-full rounded-xl bg-muted/25" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showEmptyState ? (
        <p className="text-sm text-muted-foreground">
          暂无法加载精选频道，请稍后重试。
        </p>
      ) : null}
    </div>
  );
};

export default TestimonialsStrip;
