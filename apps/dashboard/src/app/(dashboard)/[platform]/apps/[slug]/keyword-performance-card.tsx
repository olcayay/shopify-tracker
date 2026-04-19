"use client";

import Link from "@/components/ui/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Search,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from "lucide-react";
import { useLayoutVersion, buildAppLink } from "@/hooks/use-layout-version";

export function KeywordPerformanceCard({
  platform,
  slug,
  keywords,
  rankedKeywordCount,
  kwMovers,
  topKeywords,
}: {
  platform: string;
  slug: string;
  keywords: any[];
  rankedKeywordCount: number;
  kwMovers: { slug: string; label: string; position: number; delta: number }[];
  topKeywords: { slug: string; label: string; position: number }[];
}) {
  const version = useLayoutVersion();

  return (
    <Link href={buildAppLink(platform, slug, "keywords", version)} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Keyword Performance
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </CardHeader>
        <CardContent>
          {keywords.length > 0 ? (
            <div className="space-y-3">
              {/* Header stat */}
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{rankedKeywordCount}</span>{" "}
                of {keywords.length} keywords ranked
              </p>

              {/* Movers */}
              {kwMovers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Movers</p>
                  <div className="space-y-1">
                    {kwMovers.map((kw) => (
                      <div key={kw.slug} className="flex items-center justify-between text-sm">
                        <span className="truncate">{kw.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <Badge variant="secondary" className="text-xs">#{kw.position}</Badge>
                          {kw.delta > 0 ? (
                            <span className="flex items-center text-xs text-green-600 dark:text-green-400">
                              <ArrowUpRight className="h-3 w-3" />+{kw.delta}
                            </span>
                          ) : (
                            <span className="flex items-center text-xs text-red-600 dark:text-red-400">
                              <ArrowDownRight className="h-3 w-3" />{kw.delta}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Positions */}
              {topKeywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Top Positions</p>
                  <div className="space-y-1">
                    {topKeywords.map((kw) => (
                      <div key={kw.slug} className="flex items-center justify-between text-sm">
                        <span className="truncate">{kw.label}</span>
                        <Badge variant="secondary" className="ml-2 shrink-0 text-xs">#{kw.position}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <p className="text-xs text-muted-foreground pt-1">Manage keywords {"\u2192"}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Track keywords to monitor your search visibility
              </p>
              <span className={buttonVariants({ size: "sm", variant: "outline" })}>
                <Plus className="h-3.5 w-3.5" />
                Add Your First Keywords
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
