"use client";

import { useMemo, useState } from "react";
import { RankingChart } from "@/components/ranking-chart";
import { KeywordWordGroupFilter } from "@/components/keyword-word-group-filter";
import { extractWordGroups, filterKeywordsByWords } from "@/lib/keyword-word-groups";

interface RankingData {
  date: string;
  position: number | null;
  label: string;
  slug?: string;
  linkPrefix?: string;
}

export function KeywordRankingsSection({
  data,
  pageSize,
}: {
  data: RankingData[];
  pageSize: number;
}) {
  const [activeWordFilters, setActiveWordFilters] = useState<Set<string>>(
    new Set()
  );

  // Extract unique keyword labels for word group extraction
  const keywordLabels = useMemo(
    () => [...new Set(data.map((d) => d.label))],
    [data]
  );

  const wordGroups = useMemo(
    () => extractWordGroups(keywordLabels),
    [keywordLabels]
  );

  // Filter chart data based on active word filters
  const filteredData = useMemo(() => {
    if (activeWordFilters.size === 0) return data;
    // Get matching labels using filterKeywordsByWords
    const matchingLabels = new Set(
      filterKeywordsByWords(
        keywordLabels.map((label) => ({ keyword: label })),
        activeWordFilters
      ).map((k) => k.keyword)
    );
    return data.filter((d) => matchingLabels.has(d.label));
  }, [data, activeWordFilters, keywordLabels]);

  return (
    <div className="space-y-3">
      {wordGroups.length > 0 && (
        <KeywordWordGroupFilter
          wordGroups={wordGroups}
          activeWords={activeWordFilters}
          onToggle={(word) =>
            setActiveWordFilters((prev) => {
              const next = new Set(prev);
              if (next.has(word)) next.delete(word);
              else next.add(word);
              return next;
            })
          }
          onClear={() => setActiveWordFilters(new Set())}
        />
      )}
      <RankingChart data={filteredData} pageSize={pageSize} />
    </div>
  );
}
