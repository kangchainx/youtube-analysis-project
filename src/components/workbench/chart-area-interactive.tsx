"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const DATE_RANGE_OPTIONS = {
  all: { label: "自创建以来", days: null },
  "7d": { label: "最近一周", days: 7 },
  "30d": { label: "最近一个月", days: 30 },
  "90d": { label: "最近三个月", days: 90 },
} as const;

export type DateRangeKey = keyof typeof DATE_RANGE_OPTIONS;

export type MetricKey =
  | "views"
  | "comments"
  | "likes"
  | "dislikes"
  | "estimatedMinutesWatched"
  | "averageViewDuration";

export type AnalyticsPoint = {
  date: string;
} & Partial<Record<MetricKey, number | null>>;

type ChartAreaInteractiveProps = {
  data: AnalyticsPoint[];
  selectedMetrics: MetricKey[];
  metricConfig: Record<
    MetricKey,
    { label: string; color: string; formatter?: (value: number | null) => string }
  >;
  dateRange: DateRangeKey;
  onDateRangeChange: (range: DateRangeKey) => void;
  rangeOptions?: typeof DATE_RANGE_OPTIONS;
  renderRangeSelector?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  title?: string;
  description?: string;
};

const formatDateLabel = (value: string | number | null | undefined) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
};

export function ChartAreaInteractive({
  data,
  selectedMetrics,
  metricConfig,
  dateRange,
  onDateRangeChange,
  rangeOptions = DATE_RANGE_OPTIONS,
  renderRangeSelector = true,
  isLoading = false,
  error = null,
  onRetry,
  title = "指标趋势",
  description = "按时间查看已选指标走势",
}: ChartAreaInteractiveProps) {
  const chartConfig = React.useMemo<ChartConfig>(() => {
    return selectedMetrics.reduce((acc, key) => {
      acc[key] = {
        label: metricConfig[key]?.label ?? key,
        color: metricConfig[key]?.color,
      };
      return acc;
    }, {} as ChartConfig);
  }, [metricConfig, selectedMetrics]);

  const sortedData = React.useMemo(() => {
    // 确保按时间升序渲染，避免后端返回的列表顺序不一致导致折线跳动
    return [...data].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return aTime - bTime;
    });
  }, [data]);

  const formatTooltipValue = React.useCallback(
    (rawValue: number | string | null, name: string) => {
      const numeric =
        typeof rawValue === "number"
          ? rawValue
          : Number.parseFloat(rawValue as string);
      const safeNumber = Number.isFinite(numeric) ? numeric : null;
      const config = metricConfig[name as MetricKey];
      if (config?.formatter) return config.formatter(safeNumber);
      return safeNumber?.toLocaleString() ?? "-";
    },
    [metricConfig],
  );

  const renderBody = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            重新加载
          </Button>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex min-h-[240px] items-center justify-center gap-3 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span className="text-sm">加载中...</span>
        </div>
      );
    }

    if (!sortedData.length) {
      return (
        <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
          暂无数据，选择其他时间范围试试。
        </div>
      );
    }

    return (
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[320px] w-full"
      >
        <AreaChart data={sortedData} margin={{ left: 12, right: 12 }}>
          <defs>
            {selectedMetrics.map((metric) => (
              <linearGradient
                key={metric}
                id={`fill-${metric}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${metric})`}
                  stopOpacity={0.28}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${metric})`}
                  stopOpacity={0.06}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={24}
            tickFormatter={(value) => formatDateLabel(value)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={70}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                indicator="line"
                valueFormatter={(value, name) =>
                  formatTooltipValue(value as number, name)
                }
                labelFormatter={(value) => formatDateLabel(value)}
              />
            }
          />
          {selectedMetrics.map((metric) => (
            <Area
              key={metric}
              dataKey={metric}
              type="monotone"
              stroke={`var(--color-${metric})`}
              fill={`url(#fill-${metric})`}
              strokeWidth={2}
              connectNulls
              dot={false}
              isAnimationActive={false}
            />
          ))}
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    );
  };

  return (
    <Card className="pt-0">
      <CardHeader className="space-y-2 border-b py-4 sm:flex sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {renderRangeSelector ? (
          <div className="flex items-center gap-2">
            {(Object.keys(rangeOptions) as DateRangeKey[]).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={dateRange === key ? "default" : "ghost"}
                className={cn(
                  "h-9 rounded-full px-3",
                  dateRange === key ? "shadow-sm" : "text-muted-foreground",
                )}
                onClick={() => onDateRangeChange(key)}
              >
                {rangeOptions[key].label}
              </Button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="px-2 py-6 sm:px-4">{renderBody()}</CardContent>
    </Card>
  );
}

export default ChartAreaInteractive;
