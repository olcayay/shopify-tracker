"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisibilityScorePopover } from "@/components/visibility-score-popover";
import { PowerScorePopover } from "@/components/power-score-popover";
import { useFeatureFlag } from "@/contexts/feature-flags-context";
import {
  Zap,
  Eye,
  TrendingUp,
} from "lucide-react";

export function AppScoresCard({
  scoresData,
  caps,
}: {
  scoresData: any;
  caps: { hasReviews: boolean };
}) {
  const hasAppVisibility = useFeatureFlag("app-visibility");
  const hasAppPower = useFeatureFlag("app-power");
  const showVisibilityScores = hasAppVisibility && (scoresData.visibility as any[])?.length > 0;
  const showPowerScores = hasAppPower && (scoresData.power as any[])?.length > 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          App Scores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(showVisibilityScores || showPowerScores) ? (
          <div className="space-y-4">
            {/* Visibility Section */}
            {showVisibilityScores && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Visibility</span>
                </div>
                {(scoresData.visibility as any[]).map((v: any) => (
                  <VisibilityScorePopover
                    key={v.trackedAppSlug}
                    visibilityScore={v.visibilityScore}
                    keywordCount={v.keywordCount}
                    visibilityRaw={parseFloat(v.visibilityRaw) || 0}
                  >
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2.5 flex items-center justify-between cursor-help">
                      <div>
                        <p className="text-xs text-muted-foreground truncate">{v.trackedAppSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                        <p className="text-[10px] text-muted-foreground">{v.keywordCount} keywords</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{v.visibilityScore}</p>
                    </div>
                  </VisibilityScorePopover>
                ))}
              </div>
            )}
            {/* Power Section */}
            {showPowerScores && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Power</span>
                  {scoresData.weightedPowerScore > 0 && (
                    <span className="ml-auto text-lg font-bold text-purple-600 dark:text-purple-400" title="Weighted aggregate power score">
                      {scoresData.weightedPowerScore}
                    </span>
                  )}
                </div>
                {(scoresData.power as any[]).map((p: any) => (
                  <PowerScorePopover
                    key={p.categorySlug}
                    powerScore={p.powerScore}
                    ratingScore={Number(p.ratingScore) || 0}
                    reviewScore={Number(p.reviewScore) || 0}
                    categoryScore={Number(p.categoryScore) || 0}
                    momentumScore={Number(p.momentumScore) || 0}
                    position={p.position}
                    totalApps={p.totalApps}
                    hasReviews={caps.hasReviews}
                  >
                    <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2.5 flex items-center justify-between cursor-help">
                      <div>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.categoryTitle || p.categorySlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          {p.position != null && p.totalApps != null && (
                            <span className="ml-1 text-purple-500/70">(#{p.position}/{p.totalApps})</span>
                          )}
                        </p>
                        {caps.hasReviews && (
                          <p className="text-[10px] text-muted-foreground">
                            rating {((Number(p.ratingScore) || 0) * 100).toFixed(0)}% &middot; reviews {((Number(p.reviewScore) || 0) * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{p.powerScore}</p>
                    </div>
                  </PowerScorePopover>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              Scores will appear after the daily computation runs
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
