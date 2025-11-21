"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Legend as RechartsLegend,
  type LegendProps,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipProps,
} from "recharts";
import type { Payload as TooltipEntry } from "recharts/types/component/DefaultTooltipContent";
import type { LegendPayload } from "recharts/types/component/DefaultLegendContent";

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

export function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer>");
  }
  return context;
}

type ChartContainerProps = {
  config: ChartConfig;
  className?: string;
  /** Extra inline styles for the wrapper. */
  style?: React.CSSProperties;
  /** Fixed height for the chart container (defaults to 300). */
  height?: number;
  /** Minimum height to avoid zero-size warnings (defaults to 240). */
  minHeight?: number;
  /** Minimum width to avoid zero-size warnings (defaults to 0 so flex layouts can shrink). */
  minWidth?: number;
  children: React.ReactNode;
};

export function ChartContainer({
  config,
  className,
  style,
  height = 300,
  minHeight = 240,
  minWidth = 0,
  children,
}: ChartContainerProps) {
  const colorVars = React.useMemo(() => {
    const entries = Object.entries(config);
    const styles: Record<string, string> = {};

    entries.forEach(([key, value], index) => {
      const cssVar = `--color-${key}`;
      const fallback = `var(--chart-${index + 1})`;
      styles[cssVar] = value.color ?? fallback;
    });

    return styles;
  }, [config]);

  const containerStyle: React.CSSProperties = {
    minWidth,
    minHeight,
    height,
    ...colorVars,
    ...style,
  };

  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn("w-full min-w-0", className)} style={containerStyle}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export function ChartTooltip(props: TooltipProps<number, string>) {
  return <RechartsTooltip {...props} />;
}

export type ChartTooltipContentProps = {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry<number, string>>;
  label?: string | number;
  hideLabel?: boolean;
  indicator?: "dot" | "line";
  valueFormatter?: (value: number | string | null, name: string) => string;
  labelFormatter?: (
    label: string | number | undefined,
    payload?: ReadonlyArray<TooltipEntry<number, string>>,
  ) => React.ReactNode;
  className?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  indicator = "dot",
  hideLabel,
  valueFormatter,
  labelFormatter,
  className,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const renderLabel =
    typeof labelFormatter === "function"
      ? labelFormatter(label, payload)
      : label?.toString();

  return (
    <div
      className={cn(
        "rounded-md border bg-background px-3 py-2 text-sm shadow-md",
        className,
      )}
    >
      {!hideLabel ? (
        <div className="mb-1 text-xs text-muted-foreground">{renderLabel}</div>
      ) : null}
      <div className="grid gap-1">
        {payload.map((entry: TooltipEntry<number, string>) => {
          const key = entry.dataKey?.toString() ?? entry.name?.toString() ?? "";
          const value =
            typeof valueFormatter === "function"
              ? valueFormatter(entry.value as number, key)
              : entry.value;

          const color =
            entry.color || config[key]?.color || "var(--muted-foreground)";
          const indicatorClass =
            indicator === "line" ? "h-0.5 w-3" : "h-2 w-2 rounded-full";

          return (
            <div
              key={`${entry.dataKey}-${entry.value}`}
              className="flex items-center gap-2"
            >
              <span
                className={cn("shrink-0", indicatorClass)}
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground">
                {config[key]?.label ?? entry.name ?? key}
              </span>
              <span className="ml-auto text-foreground">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegend(props: LegendProps) {
  return <RechartsLegend {...props} />;
}

export function ChartLegendContent(props: LegendProps) {
  const { config } = useChart();
  const typedPayload = (props as LegendProps & { payload?: LegendPayload[] })
    .payload;
  if (!typedPayload?.length) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
      {typedPayload.map((entry: LegendPayload) => {
        const key = entry.dataKey?.toString() ?? entry.value?.toString() ?? "";
        const color =
          entry.color || config[key]?.color || "var(--muted-foreground)";
        const label = config[key]?.label ?? entry.value ?? key;

        return (
          <div key={`${key}-${label}`} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
