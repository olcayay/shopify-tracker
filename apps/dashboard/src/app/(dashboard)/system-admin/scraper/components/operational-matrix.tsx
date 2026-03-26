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
import { Play } from "lucide-react";
import { PLATFORM_LABELS, PLATFORM_COLORS, SCRAPER_TYPE_LABELS, HEALTH_SCRAPER_TYPES } from "@/lib/platform-display";
import { MatrixCell, getCellStatus, STATUS_COLORS, STATUS_RING, type HealthCell } from "./matrix-cell";

interface OperationalMatrixProps {
  healthData: { matrix: HealthCell[]; summary: { healthy: number; failed: number; stale: number; running: number; partial: number; totalScheduled: number } } | null;
  onTrigger: (platform: string, type: string) => void;
  onTriggerAll: (platform: string) => void;
  triggering: string | null;
}

export function OperationalMatrix({ healthData, onTrigger, onTriggerAll, triggering }: OperationalMatrixProps) {
  if (!healthData) return null;

  // Build lookup: platform:scraperType -> cell
  const cellMap = new Map<string, HealthCell>();
  for (const cell of healthData.matrix) {
    cellMap.set(`${cell.platform}:${cell.scraperType}`, cell);
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
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200">F</Badge> Fallback
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
              {PLATFORM_IDS.map((platformId) => (
                <TableRow key={platformId}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PLATFORM_COLORS[platformId] }}
                      />
                      {PLATFORM_LABELS[platformId]}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      disabled={triggering !== null}
                      onClick={() => onTriggerAll(platformId)}
                      title={`Trigger all scrapers for ${PLATFORM_LABELS[platformId]}`}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      All
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
