"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface TimeSeriesConfig {
  key: string;
  label: string;
  color: string;
}

export interface TimeSeriesChartProps {
  /** Array of data points — each object must have a `time` key plus keys matching series config */
  data: Record<string, unknown>[];
  /** Series definitions: which keys to plot, labels, and colors */
  series: TimeSeriesConfig[];
  /** Height of the chart container in pixels (default: 300) */
  height?: number;
  /** Format function for X-axis labels (receives the `time` value) */
  formatXAxis?: (value: string) => string;
  /** Format function for Y-axis labels */
  formatYAxis?: (value: number) => string;
  /** Format function for tooltip time label */
  formatTooltipTime?: (value: string) => string;
  /** Show dots on lines (default: false) */
  showDots?: boolean;
  /** Time range options for selector (e.g., ["12h", "24h", "48h", "72h"]) */
  timeRanges?: string[];
  /** Currently selected time range */
  selectedRange?: string;
  /** Callback when time range changes */
  onRangeChange?: (range: string) => void;
}

function DefaultTooltip({
  active,
  payload,
  label,
  series,
  formatTime,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
  series: TimeSeriesConfig[];
  formatTime?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;

  const seriesMap = new Map(series.map((s) => [s.key, s]));

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-medium mb-1">
        {formatTime ? formatTime(label || "") : label}
      </p>
      {payload.map((entry) => {
        const config = seriesMap.get(entry.dataKey);
        return (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">
              {config?.label || entry.dataKey}:
            </span>
            <span className="font-medium">{entry.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TimeSeriesChart({
  data,
  series,
  height = 300,
  formatXAxis,
  formatYAxis,
  formatTooltipTime,
  showDots = false,
  timeRanges,
  selectedRange,
  onRangeChange,
}: TimeSeriesChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleSeries = series.filter((s) => !hiddenSeries.has(s.key));

  return (
    <div className="space-y-2">
      {/* Time range selector + Legend */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {series.map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`flex items-center gap-1.5 text-xs transition-opacity ${
                hiddenSeries.has(s.key) ? "opacity-40 line-through" : ""
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </button>
          ))}
        </div>

        {/* Time range selector */}
        {timeRanges && onRangeChange && (
          <div className="flex items-center gap-1">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => onRangeChange(range)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  selectedRange === range
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickFormatter={formatXAxis}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickFormatter={formatYAxis}
            width={40}
          />
          <Tooltip
            content={
              <DefaultTooltip
                series={series}
                formatTime={formatTooltipTime}
              />
            }
          />
          {visibleSeries.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={showDots}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
