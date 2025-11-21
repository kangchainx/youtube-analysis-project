import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  Film,
  Flag,
  TrendingUp,
  Users2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChartAreaInteractive,
  DATE_RANGE_OPTIONS,
  type AnalyticsPoint,
  type DateRangeKey,
  type MetricKey,
} from "@/components/workbench/chart-area-interactive";
import { YoutubeSetupNotice } from "@/components/workbench/youtube-setup-notice";

type MetricDefinition = {
  label: string;
  description: string;
  color: string;
  formatter?: (value: number | null) => string;
};

type AnalyticsResponse = {
  data?: Array<Partial<AnalyticsPoint>>;
};

type TabularAnalyticsResponse = {
  data?: {
    columnHeaders?: Array<{
      name?: string;
      columnType?: string;
      dataType?: string;
    }>;
    rows?: Array<Array<unknown>>;
  };
};

type ChannelInfo = {
  channelId?: string;
  channelName?: string;
  customUrl?: string | null;
  type?: string;
  description?: string | null;
  viewCount?: number | null;
  subscriberCount?: number | null;
  hiddenSubscriberCount?: boolean | null;
  videoCount?: number | null;
  publishedAt?: string | null;
  thumbnailsDefaultUrl?: string | null;
  country?: string | null;
  bannerExternalUrl?: string | null;
};

type ChannelAvailability = "unknown" | "available" | "missing";

const METRIC_KEYS: MetricKey[] = [
  "views",
  "comments",
  "likes",
  "dislikes",
  "estimatedMinutesWatched",
  "averageViewDuration",
];

const DEFAULT_METRICS: MetricKey[] = [
  "views",
  "comments",
  "likes",
  "estimatedMinutesWatched",
];

const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  views: {
    label: "播放量",
    description: "总观看次数",
    color: "var(--chart-1)",
  },
  comments: {
    label: "评论数",
    description: "观众反馈总数",
    color: "var(--chart-2)",
  },
  likes: {
    label: "点赞数",
    description: "收到的点赞次数",
    color: "var(--chart-3)",
  },
  dislikes: {
    label: "点踩数",
    description: "收到的点踩次数",
    color: "var(--chart-4)",
  },
  estimatedMinutesWatched: {
    label: "观看分钟数",
    description: "累计观看时长 (分钟)",
    color: "var(--chart-5)",
    formatter: (value) => formatNumber(value, "分钟"),
  },
  averageViewDuration: {
    label: "平均观看时长",
    description: "单次观看时长",
    color: "var(--chart-2)",
    formatter: formatDuration,
  },
};

const formatNumber = (value: number | null, suffix?: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const formatter = new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const formatted = formatter.format(value);
  return suffix ? `${formatted}${suffix}` : formatted;
};

function formatDuration(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours}小时${remainMinutes}分`;
  }
  return `${minutes}分${seconds.toString().padStart(2, "0")}秒`;
}

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeDate = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date.toISOString().slice(0, 10);
  }
  return null;
};

const formatDateDisplay = (value: string | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

function buildDateRange(range: DateRangeKey, channelStartDate?: string | null) {
  const end = new Date();
  const startFromChannel = channelStartDate ? new Date(channelStartDate) : null;
  const preset = DATE_RANGE_OPTIONS[range];

  let start = new Date(end);
  if (preset.days === null) {
    // “all” 场景优先取频道创建时间，否则退回到今日
    start = startFromChannel ? new Date(startFromChannel) : new Date(end);
  } else {
    start.setDate(end.getDate() - (preset.days - 1));
  }

  if (startFromChannel && start < startFromChannel) {
    start = startFromChannel;
  }

  const format = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: format(start), endDate: format(end) };
}

function DashboardPage() {
  const { scope } = useAuth();
  const hasGoogleAuth = useMemo(
    () => typeof scope === "string" && scope.trim().length > 0,
    [scope],
  );
  const [selectedMetrics, setSelectedMetrics] =
    useState<MetricKey[]>(DEFAULT_METRICS);
  const [cardData, setCardData] = useState<AnalyticsPoint[]>([]);
  const [chartData, setChartData] = useState<AnalyticsPoint[]>([]);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [cardRange, setCardRange] = useState<DateRangeKey>("all");
  const [chartRange, setChartRange] = useState<DateRangeKey>("30d");
  const [chartSelectedMetrics, setChartSelectedMetrics] =
    useState<MetricKey[]>(DEFAULT_METRICS);
  const [isChartRangeOpen, setIsChartRangeOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [channelStartDate, setChannelStartDate] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [channelDetail, setChannelDetail] = useState<ChannelInfo | null>(null);
  const [isChannelLoading, setIsChannelLoading] = useState(false);
  const [channelAvailability, setChannelAvailability] =
    useState<ChannelAvailability>("unknown");

  const loadChannelInfo = useCallback(async () => {
    if (!hasGoogleAuth) {
      setChannelAvailability("unknown");
      setChannelDetail(null);
      setChannelName(null);
      setChannelStartDate(null);
      setChannelError(null);
      return;
    }

    setIsChannelLoading(true);
    setChannelError(null);
    setChannelAvailability("unknown");
    try {
      // 频道可能有多个来源（mine/managed），这里择优选择主频道并回退到最早的发布时间
      const response = await apiFetch<{ data?: ChannelInfo[] }>(
        "/api/youtube/analytics/channels/mine",
      );
      const channels = Array.isArray(response?.data) ? response.data : [];

      if (!channels.length) {
        setChannelAvailability("missing");
        setChannelStartDate(null);
        setChannelName(null);
        setChannelDetail(null);
        setCardData([]);
        setChartData([]);
        setCardRange((previous) => (previous === "all" ? "30d" : previous));
        setChartRange((previous) => (previous === "all" ? "30d" : previous));
        return;
      }

      const mine = channels.find((item) => item?.type === "mine");
      const publishedCandidates = channels
        .map((item) => item?.publishedAt)
        .filter((value): value is string => typeof value === "string");
      const earliestPublished =
        publishedCandidates.length > 0
          ? publishedCandidates.reduce((earliest, current) => {
              return new Date(current) < new Date(earliest)
                ? current
                : earliest;
            })
          : null;
      const primary =
        mine ??
        channels.find((item) => item?.type === "managed") ??
        channels[0] ??
        null;
      const chosen =
        (primary?.publishedAt && primary.publishedAt.trim().length > 0
          ? primary.publishedAt
          : null) ??
        earliestPublished ??
        null;
      const resolvedName =
        primary?.channelName ??
        channels.find((c) => typeof c.channelName === "string")?.channelName ??
        null;
      if (!chosen) {
        setCardRange((previous) => (previous === "all" ? "30d" : previous));
        setChartRange((previous) => (previous === "all" ? "30d" : previous));
      }
      setChannelStartDate(
        chosen ? new Date(chosen).toISOString().slice(0, 10) : null,
      );
      setChannelName(resolvedName);
      setChannelDetail(primary);
      setChannelAvailability("available");
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "获取频道信息失败";
      setChannelError(message);
      setChannelStartDate(null);
      setChannelName(null);
      setChannelDetail(null);
      setChannelAvailability("unknown");
      setCardData([]);
      setChartData([]);
      setCardRange((previous) => (previous === "all" ? "30d" : previous));
      setChartRange((previous) => (previous === "all" ? "30d" : previous));
    } finally {
      setIsChannelLoading(false);
    }
  }, [hasGoogleAuth]);

  useEffect(() => {
    void loadChannelInfo();
  }, [loadChannelInfo]);

  const deriveErrorMessage = (caught: unknown) =>
    caught instanceof ApiError
      ? caught.message
      : caught instanceof Error
        ? caught.message
        : "获取数据失败，请稍后重试。";

  const requestAnalytics = useCallback(
    async (
      range: DateRangeKey,
      channelStart?: string | null,
      sortByDay = false,
    ) => {
      const { startDate, endDate } = buildDateRange(range, channelStart);
      const params = new URLSearchParams({
        ids: "channel==MINE",
        endDate,
        startDate,
        metrics: METRIC_KEYS.join(","),
      });
      params.set("dimensions", "day");
      if (sortByDay) {
        params.set("sort", "day");
      }

      const response = await apiFetch<
        | AnalyticsResponse
        | TabularAnalyticsResponse
        | Array<Partial<AnalyticsPoint>>
      >(`/api/youtube/analytics/reports?${params.toString()}`);

      const rowsFromArray: Array<Partial<AnalyticsPoint>> = Array.isArray(
        response,
      )
        ? (response as Array<Partial<AnalyticsPoint>>)
        : Array.isArray(response?.data)
          ? (response.data as Array<Partial<AnalyticsPoint>>)
          : Array.isArray((response as TabularAnalyticsResponse)?.data?.rows)
            ? ((response as TabularAnalyticsResponse).data!.rows as Array<
                Partial<AnalyticsPoint>
              >)
            : [];

      let normalized: AnalyticsPoint[] = rowsFromArray
        .map((row) => {
          const rawDate =
            row.date ||
            (row as { day?: string }).day ||
            (row as { startDate?: string }).startDate;
          const date = normalizeDate(rawDate);
          if (!date) return null;

          const metrics: Partial<AnalyticsPoint> = { date };
          METRIC_KEYS.forEach((key) => {
            const fromRow =
              (row as Record<MetricKey, unknown>)[key] ??
              (row as { metrics?: Record<string, unknown> }).metrics?.[key];
            metrics[key] = normalizeNumber(fromRow);
          });
          return metrics as AnalyticsPoint;
        })
        .filter(Boolean) as AnalyticsPoint[];

      if (!normalized.length && !Array.isArray(response)) {
        const tabularHeaders = (response as TabularAnalyticsResponse)?.data
          ?.columnHeaders;
        const tabularRows = (response as TabularAnalyticsResponse)?.data?.rows;
        if (Array.isArray(tabularHeaders) && Array.isArray(tabularRows)) {
          normalized = tabularRows
            .map((row) => {
              if (!Array.isArray(row)) return null;
              const metrics: Partial<AnalyticsPoint> = {};

              tabularHeaders.forEach((header, index) => {
                const name = header?.name;
                const value = row[index];
                if (!name) return;
                if (name === "day" || name === "date" || name === "startDate") {
                  metrics.date = typeof value === "string" ? value : endDate;
                  return;
                }
                if ((METRIC_KEYS as readonly string[]).includes(name)) {
                  metrics[name as MetricKey] = normalizeNumber(value);
                }
              });

              if (!metrics.date) {
                metrics.date = endDate;
              }

              return metrics as AnalyticsPoint;
            })
            .filter(Boolean) as AnalyticsPoint[];
        }
      }

      return normalized;
    },
    [],
  );

  const fetchCardAnalytics = useCallback(
    async (range: DateRangeKey, channelStart?: string | null) => {
      setIsCardLoading(true);
      setCardError(null);
      try {
        const normalized = await requestAnalytics(range, channelStart);
        setCardData(normalized);
      } catch (caught) {
        setCardError(deriveErrorMessage(caught));
        setCardData([]);
      } finally {
        setIsCardLoading(false);
      }
    },
    [requestAnalytics],
  );

  const fetchChartAnalytics = useCallback(
    async (range: DateRangeKey, channelStart?: string | null) => {
      setIsChartLoading(true);
      setChartError(null);
      try {
        const normalized = await requestAnalytics(range, channelStart, true);
        setChartData(normalized);
      } catch (caught) {
        setChartError(deriveErrorMessage(caught));
        setChartData([]);
      } finally {
        setIsChartLoading(false);
      }
    },
    [requestAnalytics],
  );

  useEffect(() => {
    if (!hasGoogleAuth || channelAvailability !== "available") {
      setCardData([]);
      setCardError(null);
      return;
    }
    if (cardRange === "all" && !channelStartDate) return;
    void fetchCardAnalytics(cardRange, channelStartDate);
  }, [
    cardRange,
    channelAvailability,
    channelStartDate,
    fetchCardAnalytics,
    hasGoogleAuth,
  ]);

  useEffect(() => {
    if (!hasGoogleAuth || channelAvailability !== "available") {
      setChartData([]);
      setChartError(null);
      return;
    }
    if (chartRange === "all" && !channelStartDate) return;
    void fetchChartAnalytics(chartRange, channelStartDate);
  }, [
    channelAvailability,
    chartRange,
    channelStartDate,
    fetchChartAnalytics,
    hasGoogleAuth,
  ]);

  const totals = useMemo(() => {
    const accumulator: Record<MetricKey, number> = {
      views: 0,
      comments: 0,
      likes: 0,
      dislikes: 0,
      estimatedMinutesWatched: 0,
      averageViewDuration: 0,
    };
    let avgCount = 0;

    // 累加求和，平均观看时长需单独按有效样本数量求平均
    cardData.forEach((row) => {
      METRIC_KEYS.forEach((key) => {
        const value = row[key];
        if (typeof value === "number" && Number.isFinite(value)) {
          if (key === "averageViewDuration") {
            accumulator[key] += value;
            avgCount += 1;
          } else {
            accumulator[key] += value;
          }
        }
      });
    });

    if (avgCount > 0) {
      accumulator.averageViewDuration =
        accumulator.averageViewDuration / avgCount;
    }

    return accumulator;
  }, [cardData]);

  const toggleMetric = (metric: MetricKey) => {
    setSelectedMetrics((previous) => {
      const exists = previous.includes(metric);
      if (exists && previous.length === 1) {
        return previous;
      }
      if (exists) {
        return previous.filter((key) => key !== metric);
      }
      return [...previous, metric];
    });
  };

  const toggleChartMetric = (metric: MetricKey) => {
    setChartSelectedMetrics((previous) => {
      const exists = previous.includes(metric);
      if (exists && previous.length === 1) {
        return previous;
      }
      if (exists) {
        return previous.filter((key) => key !== metric);
      }
      return [...previous, metric];
    });
  };

  const itemsToShow = selectedMetrics.length
    ? selectedMetrics
    : DEFAULT_METRICS;

  const chartItemsToShow = chartSelectedMetrics.length
    ? chartSelectedMetrics
    : DEFAULT_METRICS;

  const [cardStates, setCardStates] = useState<
    Array<{ key: MetricKey; status: "active" | "exiting" }>
  >(itemsToShow.map((key) => ({ key, status: "active" })));

  const activeRangeLabel = DATE_RANGE_OPTIONS[cardRange]?.label ?? "时间范围";

  const channelStats = useMemo(() => {
    if (!channelDetail) return null;
    const start = channelDetail.publishedAt ?? channelStartDate;

    const safePick = (...candidates: Array<string | null | undefined>) => {
      const url = candidates.find(
        (item) => typeof item === "string" && item.trim().length > 0,
      );
      return url?.trim() ?? null;
    };

    const thumbnailUrl = safePick(
      channelDetail.thumbnailsDefaultUrl,
      (channelDetail as Record<string, unknown>).thumbnail as
        | string
        | undefined,
      (channelDetail as Record<string, unknown>).thumbnails_defult_url as
        | string
        | undefined,
      (channelDetail as Record<string, unknown>).thumbnails_default_url as
        | string
        | undefined,
    );

    const bannerUrl = safePick(
      channelDetail.bannerExternalUrl,
      (channelDetail as Record<string, unknown>).banner_external_url as
        | string
        | undefined,
      (channelDetail as Record<string, unknown>).bannerUrl as
        | string
        | undefined,
    );

    return {
      views: formatNumber(channelDetail.viewCount ?? null),
      subscribers: channelDetail.hiddenSubscriberCount
        ? "已隐藏"
        : formatNumber(channelDetail.subscriberCount ?? null),
      subscriberLabel: channelDetail.hiddenSubscriberCount
        ? "订阅数（已隐藏）"
        : "订阅数",
      videos: formatNumber(channelDetail.videoCount ?? null),
      createdAt: formatDateDisplay(start),
      customUrl: channelDetail.customUrl,
      description: channelDetail.description?.trim(),
      thumbnail: thumbnailUrl,
      country: channelDetail.country,
      banner: bannerUrl,
    };
  }, [channelDetail, channelStartDate]);

  const channelStatusText = channelError
    ? channelError
    : isChannelLoading
      ? "频道信息加载中..."
      : channelAvailability === "missing"
        ? "未检测到频道"
        : channelDetail
          ? "频道信息已同步"
          : "暂无频道信息";

  useEffect(() => {
    setCardStates((previous) => {
      const nextSet = new Set(itemsToShow);
      const staying = previous
        .filter((card) => nextSet.has(card.key))
        .map((card) => ({ ...card, status: "active" as const }));
      const exiting = previous
        .filter((card) => !nextSet.has(card.key))
        .map((card) => ({ ...card, status: "exiting" as const }));
      const newOnes = itemsToShow
        .filter((key) => !staying.some((card) => card.key === key))
        .map((key) => ({ key, status: "active" as const }));

      const orderedActive = itemsToShow
        .map(
          (key) =>
            staying.find((card) => card.key === key) ??
            newOnes.find((card) => card.key === key),
        )
        .filter(Boolean) as Array<{ key: MetricKey; status: "active" }>;

      const remainingExiting = exiting.filter(
        (card) => !orderedActive.some((active) => active.key === card.key),
      );

      return [...orderedActive, ...remainingExiting];
    });
  }, [itemsToShow]);

  useEffect(() => {
    if (!cardStates.some((card) => card.status === "exiting")) return;
    const timer = setTimeout(() => {
      setCardStates((current) =>
        current.filter((card) => card.status !== "exiting"),
      );
    }, 240);
    return () => clearTimeout(timer);
  }, [cardStates]);

  const renderMetricCards = () => {
    const cards = cardStates;
    const shouldShowSkeleton = isCardLoading;

    if (shouldShowSkeleton) {
      const count = cards.length || itemsToShow.length || 4;
      return Array.from({ length: count }).map((_, index) => (
        <Card
          key={`skeleton-${index}`}
          className="border-border/70 bg-gradient-to-b from-muted/60 to-background transition-transform duration-300 ease-out animate-metric-swap"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ));
    }

    return cards.map((card) => {
      const metric = card.key;
      const meta = METRIC_DEFINITIONS[metric];
      const value = totals[metric];
      const formatted = meta.formatter
        ? meta.formatter(value)
        : formatNumber(value);
      const animationClass =
        card.status === "exiting"
          ? "animate-metric-exit"
          : "animate-metric-swap";

      return (
        <Card
          key={metric}
          className={cn(
            "border-border/70 bg-gradient-to-b from-muted/60 to-background transition-transform duration-300 ease-out",
            animationClass,
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {meta.label}
              </CardTitle>
              <span className="flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="text-3xl font-semibold text-foreground">
              {formatted}
            </div>
            <p className="text-xs text-muted-foreground">{meta.description}</p>
          </CardContent>
        </Card>
      );
    });
  };

  if (!hasGoogleAuth) {
    return (
      <YoutubeSetupNotice variant="missingGoogle" className="min-h-[78vh]" />
    );
  }

  if (channelAvailability === "missing" && !isChannelLoading) {
    return (
      <YoutubeSetupNotice variant="missingChannel" className="min-h-[78vh]" />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[260px] space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {channelStats?.thumbnail ? (
                <img
                  src={channelStats.thumbnail}
                  alt={channelDetail?.channelName ?? "Channel thumbnail"}
                  className="h-14 w-14 rounded-full border border-border/60 object-cover shadow-sm"
                />
              ) : null}
              <div className="flex min-w-[0] flex-1 flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {channelDetail?.channelName ??
                    channelName ??
                    (isChannelLoading ? "加载中..." : "未获取到频道")}
                </h2>
                {channelStats?.customUrl ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {channelStats.customUrl}
                  </span>
                ) : null}
                {channelStats ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-transform duration-150 hover:-translate-y-0.5">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      {channelStats.views ?? "-"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-transform duration-150 hover:-translate-y-0.5">
                      <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
                      {channelStats.subscribers ?? "-"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-transform duration-150 hover:-translate-y-0.5">
                      <Film className="h-3.5 w-3.5 text-muted-foreground" />
                      {channelStats.videos ?? "-"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-transform duration-150 hover:-translate-y-0.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {channelStats.createdAt ?? "-"}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-transform duration-150 hover:-translate-y-0.5">
                      <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                      {channelStats.country ?? "-"}
                    </span>
                  </div>
                ) : null}
                <span
                  className={cn(
                    "ml-auto text-xs",
                    channelError ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {channelStatusText}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {channelStats?.description || "暂无频道描述"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">关键指标</h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  选择指标
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command>
                  <CommandInput placeholder="搜索指标" />
                  <CommandEmpty>未找到指标</CommandEmpty>
                  <CommandGroup>
                    {METRIC_KEYS.map((metric) => {
                      const isActive = selectedMetrics.includes(metric);
                      return (
                        <CommandItem
                          key={metric}
                          onSelect={() => toggleMetric(metric)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex-1">
                            {METRIC_DEFINITIONS[metric].label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {METRIC_DEFINITIONS[metric].description}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover open={isRangeOpen} onOpenChange={setIsRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {activeRangeLabel}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="end">
                <Command>
                  <CommandInput placeholder="搜索时间范围" />
                  <CommandEmpty>未找到范围</CommandEmpty>
                  <CommandGroup>
                    {(Object.keys(DATE_RANGE_OPTIONS) as DateRangeKey[]).map(
                      (rangeKey) => (
                        <CommandItem
                          key={rangeKey}
                          onSelect={() => {
                            setCardRange(rangeKey);
                            setIsRangeOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              cardRange === rangeKey
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="flex-1">
                            {DATE_RANGE_OPTIONS[rangeKey].label}
                          </span>
                        </CommandItem>
                      ),
                    )}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {cardError ? (
            <p className="text-xs text-destructive">{cardError}</p>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {renderMetricCards()}
        </div>
      </div>

      <ChartAreaInteractive
        data={chartData}
        selectedMetrics={chartItemsToShow}
        metricConfig={METRIC_DEFINITIONS}
        dateRange={chartRange}
        onDateRangeChange={setChartRange}
        rangeOptions={DATE_RANGE_OPTIONS}
        renderRangeSelector={false}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  选择指标
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command>
                  <CommandInput placeholder="搜索指标" />
                  <CommandEmpty>未找到指标</CommandEmpty>
                  <CommandGroup>
                    {METRIC_KEYS.map((metric) => {
                      const isActive = chartSelectedMetrics.includes(metric);
                      return (
                        <CommandItem
                          key={`chart-${metric}`}
                          onSelect={() => toggleChartMetric(metric)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex-1">
                            {METRIC_DEFINITIONS[metric].label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {METRIC_DEFINITIONS[metric].description}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <Popover open={isChartRangeOpen} onOpenChange={setIsChartRangeOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {DATE_RANGE_OPTIONS[chartRange]?.label ?? "时间范围"}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="end">
                <Command>
                  <CommandInput placeholder="搜索时间范围" />
                  <CommandEmpty>未找到范围</CommandEmpty>
                  <CommandGroup>
                    {(Object.keys(DATE_RANGE_OPTIONS) as DateRangeKey[]).map(
                      (rangeKey) => (
                        <CommandItem
                          key={`chart-range-${rangeKey}`}
                          onSelect={() => {
                            setChartRange(rangeKey);
                            setIsChartRangeOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              chartRange === rangeKey
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="flex-1">
                            {DATE_RANGE_OPTIONS[rangeKey].label}
                          </span>
                        </CommandItem>
                      ),
                    )}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        }
        isLoading={isChartLoading}
        error={chartError}
        onRetry={() => fetchChartAnalytics(chartRange, channelStartDate)}
        title="线性图表"
        description="根据时间范围查看指标曲线"
      />
    </div>
  );
}

export default DashboardPage;
