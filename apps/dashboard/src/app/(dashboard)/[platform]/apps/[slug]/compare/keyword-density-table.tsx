"use client";

import { useKeywordDensity, N_GRAM_COLORS } from "./compare-utils";

export function KeywordDensityTable({ text }: { text: string }) {
  const analysis = useKeywordDensity(text);

  if (analysis.length === 0) return null;

  return (
    <div className="border rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left py-1.5 px-3 font-medium">Keyword</th>
            <th className="text-right py-1.5 px-3 font-medium">Count</th>
            <th className="text-right py-1.5 px-3 font-medium">Density</th>
          </tr>
        </thead>
        <tbody>
          {analysis.map((row) => (
            <tr key={row.keyword} className="border-t">
              <td className="py-1 px-3">
                <span className="flex items-center gap-1.5">
                  {row.keyword}
                  {row.n > 1 && (
                    <span className={`text-[10px] px-1 rounded ${N_GRAM_COLORS[row.n]}`}>
                      {row.n}w
                    </span>
                  )}
                </span>
              </td>
              <td className="py-1 px-3 text-right">{row.count}</td>
              <td className="py-1 px-3 text-right">{row.density}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
