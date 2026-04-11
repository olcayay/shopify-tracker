"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/format-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface VisibilityTrendChartProps {
  history: { date: string; visibilityScore: number | null; powerScore: number | null }[];
  showPower?: boolean;
}

export function VisibilityTrendChart({ history, showPower = true }: VisibilityTrendChartProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Score Trend (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No historical score data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = history.map((h) => ({
    date: formatShortDate(h.date),
    visibility: h.visibilityScore != null ? Math.round(h.visibilityScore) : null,
    power: h.powerScore != null ? Math.round(h.powerScore) : null,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Score Trend (30 days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="visibility"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              name="Visibility"
              connectNulls
            />
            {showPower && (
              <Line
                type="monotone"
                dataKey="power"
                stroke="hsl(142, 71%, 45%)"
                strokeWidth={2}
                dot={false}
                name="Power"
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
