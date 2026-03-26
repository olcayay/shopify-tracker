"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { timeAgo } from "@/lib/format-utils";

interface UtilityScraperConfig {
  type: string;
  label: string;
  description: string;
  schedule: string;
}

const UTILITY_SCRAPERS: UtilityScraperConfig[] = [
  { type: "daily_digest", label: "Daily Digest", description: "Send ranking reports", schedule: "Daily at 05:00 UTC" },
  { type: "compute_review_metrics", label: "Review Metrics", description: "Compute review velocity", schedule: "Auto (after reviews)" },
  { type: "compute_similarity_scores", label: "Similarity Scores", description: "Compute app similarity", schedule: "Manual" },
  { type: "backfill_categories", label: "Backfill Categories", description: "Register missing categories", schedule: "Manual" },
];

interface UtilityScrapersProps {
  freshness: Map<string, { lastCompletedAt: string | null }>;
  onTrigger: (type: string) => void;
  triggering: string | null;
}

export function UtilityScrapers({ freshness, onTrigger, triggering }: UtilityScrapersProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Utility Scrapers
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {UTILITY_SCRAPERS.map((s) => {
          const fresh = freshness.get(s.type);
          return (
            <Card key={s.type}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-start justify-between mb-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    disabled={triggering !== null}
                    onClick={() => onTrigger(s.type)}
                    title={`Trigger ${s.label}`}
                  >
                    <Play className={`h-3 w-3 ${triggering === s.type ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{s.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">{s.schedule}</Badge>
                  {fresh?.lastCompletedAt ? (
                    <span className="text-muted-foreground">{timeAgo(fresh.lastCompletedAt)}</span>
                  ) : (
                    <span className="text-muted-foreground">Never</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
