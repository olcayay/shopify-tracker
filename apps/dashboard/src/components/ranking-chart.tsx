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

interface RankingData {
  date: string;
  position: number;
  label: string;
}

export function RankingChart({ data }: { data: RankingData[] }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data available.</p>;
  }

  // Group by label for multiple lines
  const labels = [...new Set(data.map((d) => d.label))];

  if (labels.length === 1) {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis reversed domain={[1, "auto"]} fontSize={12} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="position"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 4 }}
            name={labels[0]}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Multiple labels — show as table
  return (
    <div className="space-y-2">
      {labels.map((label) => {
        const items = data.filter((d) => d.label === label);
        const latest = items[items.length - 1];
        return (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="font-mono">{label}</span>
            <span className="font-semibold">#{latest?.position}</span>
          </div>
        );
      })}
    </div>
  );
}
