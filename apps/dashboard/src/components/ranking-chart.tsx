"use client";

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
  "hsl(221, 83%, 53%)",
  "hsl(38, 92%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(0, 72%, 51%)",
  "hsl(262, 83%, 58%)",
  "hsl(180, 70%, 40%)",
  "hsl(330, 70%, 50%)",
  "hsl(200, 80%, 50%)",
];

interface RankingData {
  date: string;
  position: number;
  label: string;
  slug?: string;
  linkPrefix?: string;
}

export function RankingChart({ data }: { data: RankingData[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data available.</p>;
  }

  // Group by label
  const labels = [...new Set(data.map((d) => d.label))];

  // Build per-label info for links
  const labelMeta = new Map<string, { slug?: string; linkPrefix?: string }>();
  for (const d of data) {
    if (!labelMeta.has(d.label)) {
      labelMeta.set(d.label, { slug: d.slug, linkPrefix: d.linkPrefix });
    }
  }

  // Pivot data: each unique date gets one row with a column per label
  const dates = [...new Set(data.map((d) => d.date))];
  const pivoted = dates.map((date) => {
    const row: Record<string, any> = { date };
    for (const label of labels) {
      const item = data.find((d) => d.date === date && d.label === label);
      if (item) row[label] = item.position;
    }
    return row;
  });

  // Get latest + previous position per label for change indicator
  const labelStats = labels.map((label) => {
    const items = data.filter((d) => d.label === label);
    const latest = items[items.length - 1];
    const previous = items.length >= 2 ? items[items.length - 2] : undefined;
    const change =
      latest && previous ? previous.position - latest.position : undefined;
    return { label, position: latest?.position, change };
  });

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={labels.length === 1 ? 250 : 300}>
        <LineChart data={pivoted}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis reversed domain={[1, "auto"]} fontSize={12} />
          <Tooltip />
          {labels.map((label, idx) => (
            <Line
              key={label}
              type="monotone"
              dataKey={label}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={{ r: labels.length === 1 ? 4 : 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Ranking table */}
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-right px-3 py-2 font-medium w-24">Position</th>
              <th className="text-right px-3 py-2 font-medium w-16">Page</th>
              <th className="text-right px-3 py-2 font-medium w-24">Change</th>
            </tr>
          </thead>
          <tbody>
            {labelStats.map((stat, idx) => {
              const meta = labelMeta.get(stat.label);
              const href =
                meta?.slug && meta?.linkPrefix
                  ? `${meta.linkPrefix}${meta.slug}`
                  : undefined;

              return (
                <tr key={stat.label} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      {href ? (
                        <Link
                          href={href}
                          className="text-primary hover:underline"
                        >
                          {stat.label}
                        </Link>
                      ) : (
                        <span>{stat.label}</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right px-3 py-2 font-semibold">
                    #{stat.position}
                  </td>
                  <td className="text-right px-3 py-2 text-muted-foreground">
                    {stat.position != null
                      ? `p${Math.ceil(stat.position / 24)}`
                      : "\u2014"}
                  </td>
                  <td className="text-right px-3 py-2">
                    {stat.change !== undefined && stat.change !== 0 ? (
                      <span
                        className={
                          stat.change > 0
                            ? "text-green-600"
                            : "text-red-500"
                        }
                      >
                        {stat.change > 0 ? `+${stat.change}` : stat.change}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
