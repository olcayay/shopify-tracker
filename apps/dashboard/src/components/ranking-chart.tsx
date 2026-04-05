"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.6 0.15 180)",
  "oklch(0.6 0.2 330)",
  "oklch(0.6 0.15 200)",
];

interface RankingData {
  date: string;
  position: number | null;
  label: string;
  slug?: string;
  linkPrefix?: string;
  isBuiltForShopify?: boolean;
  iconUrl?: string;
}

export function RankingChart({ data, pageSize = 24 }: { data: RankingData[]; pageSize?: number }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data available.</p>;
  }

  // Group by label
  const labels = [...new Set(data.map((d) => d.label))];

  // Stable color map: label → color (based on original order, never changes)
  const colorMap = new Map<string, string>();
  labels.forEach((label, idx) => {
    colorMap.set(label, COLORS[idx % COLORS.length]);
  });

  // Build per-label info for links
  const labelMeta = new Map<string, { slug?: string; linkPrefix?: string; isBuiltForShopify?: boolean; iconUrl?: string }>();
  for (const d of data) {
    if (!labelMeta.has(d.label)) {
      labelMeta.set(d.label, { slug: d.slug, linkPrefix: d.linkPrefix, isBuiltForShopify: d.isBuiltForShopify, iconUrl: d.iconUrl });
    }
  }

  // Pivot data: each unique date gets one row with a column per label
  // null position means "dropped" — we set it explicitly so the chart line breaks
  const dates = [...new Set(data.map((d) => d.date))];
  const pivoted = dates.map((date) => {
    const row: Record<string, any> = { date };
    for (const label of labels) {
      const item = data.find((d) => d.date === date && d.label === label);
      if (item) row[label] = item.position; // null stays null → line breaks
    }
    return row;
  });

  // Get latest + previous position per label for change indicator
  const latestDate = dates[dates.length - 1];
  const labelStats = labels.map((label) => {
    const items = data.filter((d) => d.label === label);
    const latest = items[items.length - 1];
    const previous = items.length >= 2 ? items[items.length - 2] : undefined;
    // Dropped if: explicit null position OR no data point on the most recent date
    const dropped = latest?.position === null || latest?.date !== latestDate;
    const change =
      !dropped && latest?.position != null && previous?.position != null
        ? previous.position - latest.position
        : undefined;
    return { label, position: latest?.position ?? null, change, dropped };
  });

  // Sort by position ascending, dropped apps go to the bottom
  labelStats.sort((a, b) => {
    if (a.dropped && !b.dropped) return 1;
    if (!a.dropped && b.dropped) return -1;
    if (a.dropped && b.dropped) return a.label.localeCompare(b.label);
    return (a.position ?? Infinity) - (b.position ?? Infinity);
  });

  function toggleLabel(label: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={labels.length === 1 ? 250 : 300}>
        <LineChart data={pivoted}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis reversed domain={[1, "auto"]} fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--foreground))",
              borderRadius: "0.5rem",
            }}
          />
          {labels.map((label) => (
            <Line
              key={label}
              type="monotone"
              dataKey={label}
              stroke={colorMap.get(label)}
              strokeWidth={2}
              dot={{ r: labels.length === 1 ? 4 : 3 }}
              hide={hidden.has(label)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Ranking table */}
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-right px-3 py-2 font-medium w-24">Position</th>
              <th className="text-right px-3 py-2 font-medium w-16">Page</th>
              <th className="text-right px-3 py-2 font-medium w-24">Change</th>
            </tr>
          </thead>
          <tbody>
            {labelStats.map((stat) => {
              const meta = labelMeta.get(stat.label);
              const href =
                meta?.slug && meta?.linkPrefix
                  ? `${meta.linkPrefix}${meta.slug}`
                  : undefined;
              const isHidden = hidden.has(stat.label);
              const color = colorMap.get(stat.label)!;

              return (
                <tr
                  key={stat.label}
                  className={`border-b last:border-0 cursor-pointer select-none transition-opacity ${isHidden ? "opacity-40" : "hover:bg-muted/30"}`}
                  onClick={() => toggleLabel(stat.label)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0 transition-colors"
                        style={{
                          backgroundColor: isHidden ? "transparent" : color,
                          boxShadow: isHidden ? `inset 0 0 0 1.5px ${color}` : "none",
                        }}
                      />
                      {meta?.iconUrl && (
                        <img src={meta.iconUrl} alt="" aria-hidden="true" className="h-5 w-5 rounded shrink-0" />
                      )}
                      {href ? (
                        <Link
                          href={href}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {stat.label}
                        </Link>
                      ) : (
                        <span>{stat.label}</span>
                      )}
                      {meta?.isBuiltForShopify && <span title="Built for Shopify">💎</span>}
                    </div>
                  </td>
                  <td className="text-right px-3 py-2 font-semibold">
                    {stat.dropped ? (
                      <span className="text-red-500 dark:text-red-400 font-normal text-xs">Dropped</span>
                    ) : stat.position === 0 ? (
                      <span className="text-muted-foreground font-normal text-xs">Linked</span>
                    ) : (
                      `#${stat.position}`
                    )}
                  </td>
                  <td className="text-right px-3 py-2 text-muted-foreground">
                    {stat.position != null && stat.position > 0 && !stat.dropped
                      ? `p${Math.ceil(stat.position / pageSize)}`
                      : "\u2014"}
                  </td>
                  <td className="text-right px-3 py-2">
                    {stat.dropped ? (
                      <span className="text-red-500 dark:text-red-400">{"\u2014"}</span>
                    ) : stat.change !== undefined && stat.change !== 0 ? (
                      <span
                        className={
                          stat.change > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-500 dark:text-red-400"
                        }
                      >
                        {stat.change > 0 ? `+${stat.change}` : stat.change}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{"\u2014"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
