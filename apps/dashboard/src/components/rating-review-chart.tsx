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

interface Snapshot {
  scrapedAt: string;
  averageRating: number | null;
  ratingCount: number | null;
}

function deduplicateByDate(snapshots: Snapshot[]) {
  // Snapshots come newest-first from API — reverse to chronological
  const chronological = [...snapshots].reverse();
  const byDate = new Map<string, { date: string; averageRating: number | null; ratingCount: number | null }>();
  for (const s of chronological) {
    const date = s.scrapedAt.slice(0, 10);
    // Latest snapshot per day wins (overwrite)
    byDate.set(date, {
      date,
      averageRating: s.averageRating != null ? Number(s.averageRating) : null,
      ratingCount: s.ratingCount != null ? Number(s.ratingCount) : null,
    });
  }
  return [...byDate.values()];
}

export function RatingReviewChart({ snapshots }: { snapshots: Snapshot[] }) {
  const data = deduplicateByDate(snapshots);

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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} tickMargin={4} />
                <YAxis
                  domain={[minRating, maxRating]}
                  fontSize={11}
                  tickCount={5}
                />
                <Tooltip
                  formatter={(value) => [Number(value).toFixed(2), "Rating"]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="averageRating"
                  stroke="hsl(221, 83%, 53%)"
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} tickMargin={4} />
                <YAxis fontSize={11} />
                <Tooltip
                  formatter={(value) => [
                    Number(value).toLocaleString(),
                    "Reviews",
                  ]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="ratingCount"
                  stroke="hsl(38, 92%, 50%)"
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
