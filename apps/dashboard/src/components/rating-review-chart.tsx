"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format-utils";

interface Snapshot {
  scrapedAt: string;
  averageRating: number | null;
  ratingCount: number | null;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function deduplicateByWeek(snapshots: Snapshot[]) {
  // Snapshots come newest-first from API — reverse to chronological
  const chronological = [...snapshots].reverse();
  const byWeek = new Map<string, { date: string; averageRating: number | null; ratingCount: number | null }>();
  for (const s of chronological) {
    const week = getWeekStart(s.scrapedAt);
    // Latest snapshot per week wins (overwrite)
    byWeek.set(week, {
      date: week,
      averageRating: s.averageRating != null ? Number(s.averageRating) : null,
      ratingCount: s.ratingCount != null ? Number(s.ratingCount) : null,
    });
  }
  return [...byWeek.values()];
}

export function RatingReviewChart({ snapshots }: { snapshots: Snapshot[] }) {
  const data = deduplicateByWeek(snapshots);

  if (data.length < 2) return null;

  const hasRating = data.some((d) => d.averageRating != null);
  const hasReviews = data.some((d) => d.ratingCount != null);

  if (!hasRating && !hasReviews) return null;

  // Compute Y-axis domain for rating (tight around actual values)
  const ratings = data.map((d) => d.averageRating).filter((v): v is number => v != null);
  const minRating = Math.max(0, Math.floor(Math.min(...ratings) * 10) / 10 - 0.2);
  const maxRating = Math.min(5, Math.ceil(Math.max(...ratings) * 10) / 10 + 0.2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {hasRating && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rating History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={11} tickMargin={4} />
                <YAxis
                  domain={[minRating, maxRating]}
                  fontSize={11}
                  tickCount={5}
                />
                <Tooltip
                  formatter={(value) => [Number(value).toFixed(2), "Rating"]}
                  labelFormatter={(label) => `Week of ${label}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="averageRating"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      {hasReviews && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Review Count History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={11} tickMargin={4} />
                <YAxis fontSize={11} />
                <Tooltip
                  formatter={(value) => [
                    formatNumber(Number(value)),
                    "Reviews",
                  ]}
                  labelFormatter={(label) => `Week of ${label}`}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ratingCount"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
