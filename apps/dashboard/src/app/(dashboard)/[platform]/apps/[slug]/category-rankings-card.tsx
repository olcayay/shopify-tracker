"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

export function CategoryRankingsCard({
  platform,
  slug,
  catChanges,
  categoryInfoMap,
}: {
  platform: string;
  slug: string;
  catChanges: { slug: string; label: string; position: number; delta: number }[];
  categoryInfoMap: Map<string, { leaders: any[]; appCount: number | null }>;
}) {
  return (
    <Link href={`/${platform}/apps/${slug}/rankings`} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            Category Rankings
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          {catChanges.length > 0 ? (
            <div className="space-y-4">
              {catChanges.map((cat) => {
                const catInfo = categoryInfoMap.get(cat.slug);
                const leaders = catInfo?.leaders || [];
                const appCount = catInfo?.appCount;
                return (
                  <div key={cat.slug}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted-foreground">
                        {cat.label}
                        {appCount != null && (
                          <span className="text-xs text-muted-foreground/60"> ({appCount})</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <Badge variant="secondary">{cat.position > 0 ? `#${cat.position}` : "Linked"}</Badge>
                        {cat.delta > 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        ) : cat.delta < 0 ? (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </div>
                    </div>
                    {leaders.length > 0 && (
                      <div className="mt-1.5 ml-1 space-y-1">
                        {leaders.map((leader: any) => (
                          <div key={leader.slug} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono">
                              #{leader.position}
                            </Badge>
                            {leader.icon_url ? (
                              <img src={leader.icon_url} alt="" className="h-4 w-4 rounded shrink-0" />
                            ) : (
                              <div className="h-4 w-4 rounded bg-muted shrink-0" />
                            )}
                            <span className="truncate">{leader.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-1">View full rankings {"\u2192"}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Trophy className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                Category rankings will appear here once data is collected
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
