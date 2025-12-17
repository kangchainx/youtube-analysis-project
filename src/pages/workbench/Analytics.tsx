import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  Film,
  RefreshCw,
  TrendingUp,
  Users2,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ApiError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const WINDOW_OPTIONS = {
  "7d": { label: "最近一周", days: 7 },
  "30d": { label: "最近一个月", days: 30 },
  "90d": { label: "最近三个月", days: 90 },
} as const;

type WindowKey = keyof typeof WINDOW_OPTIONS;

type SubscriptionCardChannel = {
  id: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
};

type SubscriptionCardTopMetric = {
  channel: SubscriptionCardChannel;
  value: string;
  growthRate: string | null;
};

type SubscriptionCardsResult = {
  windowDays: number;
  startDate: string;
  endDate: string;
  top1: {
    subscriberGrowth: SubscriptionCardTopMetric | null;
    traffic: SubscriptionCardTopMetric | null;
    diligence: SubscriptionCardTopMetric | null;
  };
};

type TitleKeywordItem = {
  keyword: string;
  score: number;
  videoCount: number;
  channelCount: number;
};

type TitleKeywordsResult = {
  windowDays: number;
  startDate: string;
  endDate: string;
  candidateLimit: number;
  likeWeight: number;
  limit: number;
  keywords: TitleKeywordItem[];
};

type SubscriptionOption = {
  channelId: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
};

type TrendPoint = { date: string; value: number | null };

type TrendMetricKey = "viewCount" | "subscriberCount" | "videoCount";

type KeywordCloudStyle = CSSProperties & {
  "--kw-delay"?: string;
  "--kw-float-duration"?: string;
  "--kw-float-distance"?: string;
};

const TREND_METRIC_OPTIONS: Record<
  TrendMetricKey,
  { label: string; description: string; color: string }
> = {
  viewCount: {
    label: "播放量",
    description: "频道累计播放量趋势",
    color: "var(--chart-1)",
  },
  subscriberCount: {
    label: "订阅数",
    description: "频道累计订阅数趋势",
    color: "var(--chart-2)",
  },
  videoCount: {
    label: "视频数",
    description: "频道累计公开视频数趋势",
    color: "var(--chart-3)",
  },
};

type TopMetricKey = keyof SubscriptionCardsResult["top1"];

const TOP_METRIC_META: Record<
  TopMetricKey,
  { title: string; description: string; icon: typeof Users2 }
> = {
  subscriberGrowth: {
    title: "涨粉 Top1",
    description: "窗口内订阅增长最多的频道",
    icon: Users2,
  },
  traffic: {
    title: "流量 Top1",
    description: "窗口内播放增长最多的频道",
    icon: Eye,
  },
  diligence: {
    title: "勤奋 Top1",
    description: "窗口内更新视频最多的频道",
    icon: Film,
  },
};

const compactNumberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function parseBigint(value: string | null | undefined): bigint | null {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatCompact(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "-";
  try {
    return compactNumberFormatter.format(value);
  } catch {
    return String(value);
  }
}

function formatSignedCompactBigint(raw: string | null | undefined): string {
  const parsed = parseBigint(raw);
  if (parsed === null) return "-";
  const sign = parsed >= 0n ? "+" : "-";
  const abs = parsed >= 0n ? parsed : -parsed;
  return `${sign}${formatCompact(abs)}`;
}

function formatGrowthRate(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return "-";
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return "-";
  const sign = parsed > 0 ? "+" : parsed < 0 ? "-" : "";
  return `${sign}${Math.abs(parsed * 100).toFixed(1)}%`;
}

function formatHandle(customUrl: string | null | undefined): string | null {
  if (!customUrl) return null;
  const trimmed = customUrl.trim();
  if (!trimmed) return null;
  return `@${trimmed.replace(/^@/, "")}`;
}

function formatShortDate(value: string | number | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

function parseTrendValue(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeTrendDomain(points: TrendPoint[]): [number, number] | null {
  const values = points
    .map((point) => point.value)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );

  if (!values.length) return null;

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * 0.02);
    min -= padding;
    max += padding;
  } else {
    const range = max - min;
    const padding = Math.max(range * 0.08, Math.abs(max) * 0.005);
    min -= padding;
    max += padding;
  }

  if (min < 0 && values.every((value) => value >= 0)) {
    min = 0;
  }

  const lower = Math.floor(min);
  const upper = Math.ceil(max);

  if (lower === upper) {
    return [lower, lower + 1];
  }

  return [lower, upper];
}

function AnalyticsPage() {
  const [windowKey, setWindowKey] = useState<WindowKey>("30d");
  const windowDays = WINDOW_OPTIONS[windowKey].days;
  const [isWindowPickerOpen, setIsWindowPickerOpen] = useState(false);

  const [topCards, setTopCards] = useState<SubscriptionCardsResult | null>(
    null
  );
  const [isTopCardsLoading, setIsTopCardsLoading] = useState(false);
  const [topCardsError, setTopCardsError] = useState<string | null>(null);
  const topCardsReqId = useRef(0);

  const [keywords, setKeywords] = useState<TitleKeywordsResult | null>(null);
  const [isKeywordsLoading, setIsKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const keywordsReqId = useRef(0);

  const [subscriptions, setSubscriptions] = useState<SubscriptionOption[]>([]);
  const [isSubscriptionsLoading, setIsSubscriptionsLoading] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(
    null
  );
  const subscriptionsReqId = useRef(0);

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [isChannelPickerOpen, setIsChannelPickerOpen] = useState(false);

  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>("viewCount");
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [trendRange, setTrendRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>(null);
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const trendReqId = useRef(0);

  const selectedChannel = useMemo(
    () =>
      subscriptions.find((item) => item.channelId === selectedChannelId) ??
      null,
    [selectedChannelId, subscriptions]
  );

  const loadSubscriptions = useCallback(async () => {
    const requestId = (subscriptionsReqId.current += 1);
    setIsSubscriptionsLoading(true);
    setSubscriptionsError(null);

    try {
      const response = await apiFetch<{
        data?: Array<{
          id: string;
          channelId?: string;
          customUrl?: string | null;
          channel?: {
            id?: string;
            title?: string;
            customUrl?: string | null;
            thumbnailUrl?: string | null;
          } | null;
        }>;
      }>("/api/youtube/subscriptions?limit=100&offset=0");

      if (subscriptionsReqId.current !== requestId) return;

      const records = Array.isArray(response?.data) ? response.data : [];
      const normalized = records
        .map<SubscriptionOption | null>((record) => {
          const channel = record.channel ?? null;
          const channelId = record.channelId ?? channel?.id ?? null;
          if (!channelId) return null;

          const title =
            channel?.title?.trim() ||
            record.customUrl?.trim() ||
            channelId ||
            "未命名频道";

          return {
            channelId,
            title,
            customUrl: channel?.customUrl ?? record.customUrl ?? null,
            thumbnailUrl: channel?.thumbnailUrl ?? null,
          };
        })
        .filter(Boolean) as SubscriptionOption[];

      setSubscriptions(normalized);
    } catch (caught) {
      console.error("Failed to load subscriptions", caught);
      if (subscriptionsReqId.current !== requestId) return;

      if (caught instanceof ApiError) {
        setSubscriptionsError(
          caught.status === 401
            ? "登录已过期，请重新登录。"
            : caught.message || "获取订阅列表失败，请稍后重试。"
        );
      } else if (caught instanceof Error) {
        setSubscriptionsError(caught.message);
      } else {
        setSubscriptionsError("获取订阅列表失败，请稍后重试。");
      }
      setSubscriptions([]);
    } finally {
      if (subscriptionsReqId.current === requestId) {
        setIsSubscriptionsLoading(false);
      }
    }
  }, []);

  const loadTopCards = useCallback(async () => {
    const requestId = (topCardsReqId.current += 1);
    setIsTopCardsLoading(true);
    setTopCardsError(null);

    try {
      const response = await apiFetch<{ data?: SubscriptionCardsResult }>(
        `/api/youtube/subscriptions/cards?days=${windowDays}`
      );

      if (topCardsReqId.current !== requestId) return;
      setTopCards(response?.data ?? null);
    } catch (caught) {
      console.error("Failed to load subscription cards", caught);
      if (topCardsReqId.current !== requestId) return;

      if (caught instanceof ApiError) {
        setTopCardsError(
          caught.status === 401
            ? "登录已过期，请重新登录。"
            : caught.message || "获取 Top1 数据失败，请稍后重试。"
        );
      } else if (caught instanceof Error) {
        setTopCardsError(caught.message);
      } else {
        setTopCardsError("获取 Top1 数据失败，请稍后重试。");
      }
      setTopCards(null);
    } finally {
      if (topCardsReqId.current === requestId) {
        setIsTopCardsLoading(false);
      }
    }
  }, [windowDays]);

  const loadKeywords = useCallback(async () => {
    const requestId = (keywordsReqId.current += 1);
    setIsKeywordsLoading(true);
    setKeywordsError(null);

    try {
      const response = await apiFetch<{ data?: TitleKeywordsResult }>(
        `/api/youtube/subscriptions/title-keywords?days=${windowDays}&limit=20&candidate_limit=500&like_weight=50`
      );

      if (keywordsReqId.current !== requestId) return;
      setKeywords(response?.data ?? null);
    } catch (caught) {
      console.error("Failed to load keywords", caught);
      if (keywordsReqId.current !== requestId) return;

      if (caught instanceof ApiError) {
        setKeywordsError(
          caught.status === 401
            ? "登录已过期，请重新登录。"
            : caught.message || "获取关键词数据失败，请稍后重试。"
        );
      } else if (caught instanceof Error) {
        setKeywordsError(caught.message);
      } else {
        setKeywordsError("获取关键词数据失败，请稍后重试。");
      }
      setKeywords(null);
    } finally {
      if (keywordsReqId.current === requestId) {
        setIsKeywordsLoading(false);
      }
    }
  }, [windowDays]);

  const loadTrend = useCallback(async () => {
    if (!selectedChannelId) return;

    const requestId = (trendReqId.current += 1);
    setIsTrendLoading(true);
    setTrendError(null);

    try {
      const response = await apiFetch<{
        data?: {
          channelId?: string;
          metric?: string;
          windowDays?: number;
          startDate?: string;
          endDate?: string;
          points?: Array<{ date?: string; value?: string | null }>;
        };
      }>(
        `/api/youtube/channels/${encodeURIComponent(
          selectedChannelId
        )}/statistics/daily?metric=${trendMetric}&days=${windowDays}`
      );

      if (trendReqId.current !== requestId) return;

      const points = Array.isArray(response?.data?.points)
        ? response.data!.points
        : [];

      const normalized = points
        .map<TrendPoint | null>((point) => {
          const date = point.date?.trim();
          if (!date) return null;
          return {
            date,
            value: parseTrendValue(point.value ?? null),
          };
        })
        .filter(Boolean) as TrendPoint[];

      normalized.sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        return aTime - bTime;
      });

      setTrendPoints(normalized);
      if (response?.data?.startDate && response?.data?.endDate) {
        setTrendRange({
          startDate: response.data.startDate,
          endDate: response.data.endDate,
        });
      } else {
        setTrendRange(null);
      }
    } catch (caught) {
      console.error("Failed to load trend points", caught);
      if (trendReqId.current !== requestId) return;

      if (caught instanceof ApiError) {
        setTrendError(
          caught.status === 403
            ? "需要先订阅该频道后再查看趋势数据。"
            : caught.status === 401
              ? "登录已过期，请重新登录。"
              : caught.message || "获取趋势数据失败，请稍后重试。"
        );
      } else if (caught instanceof Error) {
        setTrendError(caught.message);
      } else {
        setTrendError("获取趋势数据失败，请稍后重试。");
      }
      setTrendPoints([]);
      setTrendRange(null);
    } finally {
      if (trendReqId.current === requestId) {
        setIsTrendLoading(false);
      }
    }
  }, [selectedChannelId, trendMetric, windowDays]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    void loadTopCards();
    void loadKeywords();
  }, [loadKeywords, loadTopCards]);

  useEffect(() => {
    if (!subscriptions.length) {
      setSelectedChannelId(null);
      return;
    }

    setSelectedChannelId((previous) => {
      if (
        previous &&
        subscriptions.some((item) => item.channelId === previous)
      ) {
        return previous;
      }
      return subscriptions[0].channelId;
    });
  }, [subscriptions]);

  useEffect(() => {
    if (!selectedChannelId) {
      setTrendPoints([]);
      setTrendRange(null);
      setTrendError(null);
      return;
    }
    void loadTrend();
  }, [loadTrend, selectedChannelId]);

  const handleRefreshAll = () => {
    void loadSubscriptions();
    void loadTopCards();
    void loadKeywords();
    void loadTrend();
  };

  const trendChartConfig = useMemo<ChartConfig>(() => {
    return {
      value: {
        label: TREND_METRIC_OPTIONS[trendMetric].label,
        color: TREND_METRIC_OPTIONS[trendMetric].color,
      },
    };
  }, [trendMetric]);

  const trendChartData = useMemo(
    () =>
      trendPoints.map((point) => ({
        date: point.date,
        value: point.value,
      })),
    [trendPoints]
  );

  const trendYAxisDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    const computed = computeTrendDomain(trendPoints);
    return computed ?? ["auto", "auto"];
  }, [trendPoints]);

  const keywordCloud = useMemo(() => {
    const list = keywords?.keywords ?? [];
    const total = list.length;
    const colors = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ];

    return list.map((item, index) => {
      const ratio = total <= 1 ? 0 : index / (total - 1);
      const fontSize = Math.round(40 - ratio * 22);
      return {
        ...item,
        rank: index + 1,
        fontSize,
        color: colors[index % colors.length],
      };
    });
  }, [keywords]);

  const renderTopMetricCard = (metricKey: TopMetricKey) => {
    const meta = TOP_METRIC_META[metricKey];
    const Icon = meta.icon;

    if (isTopCardsLoading) {
      return (
        <Card
          key={`top-${metricKey}-skeleton`}
          className="border-border/70 bg-gradient-to-b from-muted/60 to-background"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      );
    }

    const metric = topCards?.top1?.[metricKey] ?? null;
    const handle = formatHandle(metric?.channel.customUrl);

    return (
      <Card
        key={`top-${metricKey}`}
        className="border-border/70 bg-gradient-to-b from-muted/60 to-background"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {meta.title}
            </CardTitle>
            <span className="flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              {formatGrowthRate(metric?.growthRate)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center gap-3">
            {metric?.channel.thumbnailUrl ? (
              <img
                src={metric.channel.thumbnailUrl}
                alt={metric.channel.title}
                className="h-10 w-10 rounded-full border border-border/60 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/40">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {metric?.channel.title ?? "暂无数据"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {handle ?? metric?.channel.id ?? "请先订阅频道"}
              </p>
            </div>
          </div>

          <div className="text-3xl font-semibold text-foreground">
            {metric ? formatSignedCompactBigint(metric.value) : "-"}
          </div>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </CardContent>
      </Card>
    );
  };

  const renderTrendBody = () => {
    if (subscriptionsError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-destructive">{subscriptionsError}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadSubscriptions()}
          >
            重新加载
          </Button>
        </div>
      );
    }

    if (isSubscriptionsLoading) {
      return (
        <div className="flex h-[320px] items-center justify-center gap-3 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span className="text-sm">加载订阅频道...</span>
        </div>
      );
    }

    if (!subscriptions.length) {
      return (
        <Empty className="bg-card/50 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users2 className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>还没有订阅频道</EmptyTitle>
            <EmptyDescription>
              订阅一些频道后，即可在这里查看它们的趋势与热词分析。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/workbench/subscriptions">去订阅频道</Link>
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    if (!selectedChannelId) {
      return (
        <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
          请选择一个订阅频道查看趋势。
        </div>
      );
    }

    if (trendError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-destructive">{trendError}</p>
          <Button size="sm" variant="outline" onClick={() => void loadTrend()}>
            重新加载
          </Button>
        </div>
      );
    }

    const hasValue = trendChartData.some((point) => point.value !== null);
    if (!hasValue) {
      return (
        <div className="relative min-h-[240px]">
          {isTrendLoading ? (
            <div className="absolute inset-0 flex items-center justify-center gap-3 text-muted-foreground">
              <Spinner className="h-5 w-5" />
              <span className="text-sm">加载趋势数据...</span>
            </div>
          ) : (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
              暂无趋势数据，选择其他频道或时间窗口试试。
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative">
        {isTrendLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-background/60 text-muted-foreground backdrop-blur-sm">
            <Spinner className="h-5 w-5" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : null}

        <ChartContainer
          config={trendChartConfig}
          className="aspect-auto h-[320px] w-full"
        >
          <LineChart data={trendChartData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={24}
              tickFormatter={(value) => formatShortDate(value)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={80}
              domain={trendYAxisDomain}
              allowDecimals={false}
              tickFormatter={(value: number) => value.toLocaleString()}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  valueFormatter={(value) =>
                    typeof value === "number" ? value.toLocaleString() : "-"
                  }
                  labelFormatter={(label) => formatShortDate(label)}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2.25}
              dot={false}
              connectNulls
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-in-out"
            />
          </LineChart>
        </ChartContainer>
      </div>
    );
  };

  const renderKeywordBody = () => {
    if (keywordsError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-destructive">{keywordsError}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadKeywords()}
          >
            重新加载
          </Button>
        </div>
      );
    }

    if (isKeywordsLoading) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: 18 }).map((_, index) => (
              <Skeleton
                key={`kw-skeleton-${index}`}
                className={cn(
                  "h-9 rounded-full",
                  index % 3 === 0 ? "w-28" : index % 3 === 1 ? "w-20" : "w-24"
                )}
              />
            ))}
          </div>
        </div>
      );
    }

    if (!keywordCloud.length) {
      return (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          暂无关键词数据，等待频道发布视频后再来看看。
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center justify-center gap-2 py-2">
        {keywordCloud.map((item) => {
          const delayMs = Math.min(900, (item.rank - 1) * 55);
          const floatDuration = 6.8 + (item.rank % 7) * 0.35;
          const floatDistance = item.rank % 2 === 0 ? "3px" : "-3px";
          const style: KeywordCloudStyle = {
            fontSize: `${item.fontSize}px`,
            color: item.color,
            "--kw-delay": `${delayMs}ms`,
            "--kw-float-duration": `${floatDuration.toFixed(2)}s`,
            "--kw-float-distance": floatDistance,
          };

          return (
            <Tooltip key={item.keyword}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="animate-keyword-cloud rounded-full border border-border/70 bg-muted/30 px-3 py-1 font-medium leading-none text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  style={style}
                >
                  {item.keyword}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">#{item.rank}</div>
                  <div>热度：{item.score.toFixed(2)}</div>
                  <div>覆盖视频：{item.videoCount}</div>
                  <div>覆盖频道：{item.channelCount}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">频道分析</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            基于订阅频道的增长 Top1、趋势走势与关键词热度洞察。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover
            open={isWindowPickerOpen}
            onOpenChange={setIsWindowPickerOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {WINDOW_OPTIONS[windowKey].label}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="end">
              <Command>
                <CommandInput placeholder="搜索时间窗口" />
                <CommandEmpty>未找到范围</CommandEmpty>
                <CommandGroup>
                  {(Object.keys(WINDOW_OPTIONS) as WindowKey[]).map((key) => (
                    <CommandItem
                      key={key}
                      onSelect={() => {
                        setWindowKey(key);
                        setIsWindowPickerOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          windowKey === key ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="flex-1">
                        {WINDOW_OPTIONS[key].label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {WINDOW_OPTIONS[key].days} 天
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefreshAll}
            disabled={isTopCardsLoading || isKeywordsLoading || isTrendLoading}
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">增长 Top1</h2>
            <p className="text-sm text-muted-foreground">
              统计窗口：近 {windowDays} 天（{topCards?.startDate ?? "-"} ~{" "}
              {topCards?.endDate ?? "-"}）
            </p>
          </div>
          {topCardsError ? (
            <p className="text-xs text-destructive">{topCardsError}</p>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["subscriberGrowth", "traffic", "diligence"] as TopMetricKey[]).map(
            (metricKey) => renderTopMetricCard(metricKey)
          )}
        </div>
      </div>

      <Card className="pt-0">
        <CardHeader className="space-y-2 border-b py-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle>趋势折线图</CardTitle>
            <CardDescription>
              {selectedChannel?.title
                ? `${selectedChannel.title} · ${TREND_METRIC_OPTIONS[trendMetric].description}`
                : "选择订阅频道查看趋势数据"}
              {trendRange?.startDate && trendRange?.endDate
                ? `（${trendRange.startDate} ~ ${trendRange.endDate}）`
                : `（近 ${windowDays} 天）`}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Popover
              open={isChannelPickerOpen}
              onOpenChange={setIsChannelPickerOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  role="combobox"
                  aria-expanded={isChannelPickerOpen}
                  className="min-w-[220px] justify-between gap-2"
                  disabled={isSubscriptionsLoading || !subscriptions.length}
                >
                  <span className="truncate">
                    {selectedChannel?.title ?? "选择订阅频道"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command>
                  <CommandInput placeholder="搜索频道" />
                  <CommandEmpty>未找到频道</CommandEmpty>
                  <CommandGroup>
                    {subscriptions.map((item) => (
                      <CommandItem
                        key={item.channelId}
                        value={`${item.title} ${item.channelId} ${item.customUrl ?? ""}`}
                        onSelect={() => {
                          setSelectedChannelId(item.channelId);
                          setIsChannelPickerOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedChannelId === item.channelId
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {item.title}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatHandle(item.customUrl) ?? ""}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 p-1">
              {(Object.keys(TREND_METRIC_OPTIONS) as TrendMetricKey[]).map(
                (key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={trendMetric === key ? "default" : "ghost"}
                    className={cn(
                      "h-8 rounded-full px-3",
                      trendMetric === key
                        ? "shadow-sm"
                        : "text-muted-foreground"
                    )}
                    onClick={() => setTrendMetric(key)}
                    disabled={!selectedChannelId}
                  >
                    {TREND_METRIC_OPTIONS[key].label}
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 py-6 sm:px-4">
          {renderTrendBody()}
        </CardContent>
      </Card>

      <Card className="pt-0">
        <CardHeader className="space-y-2 border-b py-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle>关键词词云</CardTitle>
            <CardDescription>
              统计近 {windowDays} 天发布的长视频标题，按热度聚合输出关键词榜。
            </CardDescription>
          </div>
          {/* <div className="text-xs text-muted-foreground">
            {keywords
              ? `候选：${keywords.candidateLimit} · like 权重：${keywords.likeWeight} · 展示：${keywords.limit}`
              : null}
          </div> */}
        </CardHeader>
        <CardContent className="px-2 py-6 sm:px-4">
          {renderKeywordBody()}
        </CardContent>
      </Card>
    </div>
  );
}

export default AnalyticsPage;
