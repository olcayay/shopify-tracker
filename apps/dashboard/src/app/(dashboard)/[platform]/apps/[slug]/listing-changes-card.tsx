"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  History,
  ArrowRight,
} from "lucide-react";
import { relativeDate, getFieldLabels, FIELD_COLORS } from "./utils";

export function CompetitorUpdatesCard({
  platform,
  slug,
  groupedCompChanges,
}: {
  platform: string;
  slug: string;
  groupedCompChanges: {
    competitorName: string;
    competitorSlug: string;
    competitorIcon: string | null;
    fields: string[];
    latestDate: string;
  }[];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Competitor Updates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {groupedCompChanges.length > 0 ? (
          <div className="space-y-1.5">
            {groupedCompChanges.slice(0, 5).map((g) => (
              <Link
                key={g.competitorSlug}
                href={`/${platform}/apps/${g.competitorSlug}/changes`}
                className="flex items-center gap-2 text-sm rounded-md p-1.5 -mx-1.5 hover:bg-muted/50 transition-colors"
              >
                {g.competitorIcon ? (
                  <img src={g.competitorIcon} alt="" className="h-5 w-5 rounded shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded bg-muted shrink-0" />
                )}
                <span className="font-medium truncate">{g.competitorName}</span>
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  {g.fields.map((f) => (
                    <span
                      key={f}
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                        FIELD_COLORS[f] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {getFieldLabels(platform)[f] || f}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{relativeDate(g.latestDate)}</span>
              </Link>
            ))}
            <Link
              href={`/${platform}/apps/${slug}/competitors`}
              className="block text-xs text-muted-foreground pt-2 hover:text-primary transition-colors"
            >
              View all competitors {"\u2192"}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No competitor updates yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              We monitor your competitors for listing updates.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ListingChangesCard({
  platform,
  slug,
  changes,
  todayChanges,
  weekChanges,
  earlierChanges,
}: {
  platform: string;
  slug: string;
  changes: any[];
  todayChanges: any[];
  weekChanges: any[];
  earlierChanges: any[];
}) {
  return (
    <Link href={`/${platform}/apps/${slug}/changes`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Listing Changes
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          {changes.length > 0 ? (
            <div className="space-y-3">
              {todayChanges.length > 0 && (
                <ChangeGroup label="Today" items={todayChanges} platform={platform} />
              )}
              {weekChanges.length > 0 && (
                <ChangeGroup label="This Week" items={weekChanges} platform={platform} />
              )}
              {earlierChanges.length > 0 && (
                <ChangeGroup label="Earlier" items={earlierChanges} platform={platform} />
              )}
              <p className="text-xs text-muted-foreground pt-1">View all changes {"\u2192"}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No changes detected yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                We monitor your listing for any updates.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ChangeGroup({ label, items, platform }: { label: string; items: any[]; platform: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="space-y-1.5">
        {items.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                FIELD_COLORS[c.field] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {getFieldLabels(platform)[c.field] || c.field}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{relativeDate(c.detectedAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
