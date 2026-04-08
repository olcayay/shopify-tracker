"use client";

import { PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, Power } from "lucide-react";
import { PLATFORM_LABELS, PLATFORM_COLORS, SCRAPER_TYPE_LABELS, HEALTH_SCRAPER_TYPES } from "@/lib/platform-display";
import { MatrixCell, getCellStatus, STATUS_COLORS, STATUS_RING, type HealthCell } from "./matrix-cell";

interface ScraperPlatformStatus {
  platform: string;
  isVisible: boolean;
  scraperEnabled: boolean;
}

interface OperationalMatrixProps {
  healthData: { matrix: HealthCell[]; summary: { healthy: number; failed: number; stale: number; running: number; partial: number; totalScheduled: number } } | null;
  onTrigger: (platform: string, type: string) => void;
  onTriggerAll: (platform: string) => void;
  triggering: string | null;
  scraperPlatforms: ScraperPlatformStatus[] | null;
  onToggleScraper: (platform: string) => void;
  togglingPlatform: string | null;
}

export function OperationalMatrix({ healthData, onTrigger, onTriggerAll, triggering, scraperPlatforms, onToggleScraper, togglingPlatform }: OperationalMatrixProps) {
  if (!healthData) return null;

  // Build lookup: platform:scraperType -> cell
  const cellMap = new Map<string, HealthCell>();
  for (const cell of healthData.matrix) {
    cellMap.set(`${cell.platform}:${cell.scraperType}`, cell);
  }

  // Build scraper enabled lookup
  const scraperEnabledMap = new Map<string, boolean>();
  if (Array.isArray(scraperPlatforms)) {
    for (const sp of scraperPlatforms) {
      scraperEnabledMap.set(sp.platform, sp.scraperEnabled);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Operational Matrix</CardTitle>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS.green}`} /> Healthy
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS.amber}`} /> Partial
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS.red}`} /> Failed
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS.yellow}`} /> Stale
            </span>
            <span className="flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS.blue} animate-pulse`} /> Running
            </span>
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50">F</Badge> Fallback
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 w-32">Platform</TableHead>
                {HEALTH_SCRAPER_TYPES.map((type) => (
                  <TableHead key={type} className="text-center text-xs px-2">
                    {SCRAPER_TYPE_LABELS[type] || type}
                  </TableHead>
                ))}
                <TableHead className="text-center text-xs px-2 w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PLATFORM_IDS.map((platformId) => {
                const scraperEnabled = scraperEnabledMap.get(platformId) ?? true;
                return (
                <TableRow key={platformId} className={scraperEnabled ? "" : "opacity-40"}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PLATFORM_COLORS[platformId] }}
                      />
                      {PLATFORM_LABELS[platformId]}
                      {!scraperEnabled && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-gray-50 dark:bg-gray-950/30 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-800">
                          OFF
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  {HEALTH_SCRAPER_TYPES.map((type) => {
                    const cell = cellMap.get(`${platformId}:${type}`);
                    return (
                      <TableCell key={type} className="text-center px-1">
                        {cell ? (
                          <MatrixCell
                            cell={cell}
                            onTrigger={onTrigger}
                            triggering={triggering}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center px-1">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        disabled={triggering !== null || !scraperEnabled}
                        onClick={() => onTriggerAll(platformId)}
                        title={`Trigger all scrapers for ${PLATFORM_LABELS[platformId]}`}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-6 w-6 p-0 ${scraperEnabled ? "text-green-600 hover:text-red-600" : "text-red-500 hover:text-green-600"}`}
                        disabled={togglingPlatform === platformId}
                        onClick={() => onToggleScraper(platformId)}
                        title={scraperEnabled ? `Disable scraper for ${PLATFORM_LABELS[platformId]}` : `Enable scraper for ${PLATFORM_LABELS[platformId]}`}
                      >
                        <Power className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
