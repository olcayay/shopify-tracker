"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLATFORM_LABELS, PLATFORM_COLORS } from "@/lib/platform-display";
import { timeAgo } from "@/lib/format-utils";

interface ScraperConfigRow {
  platform: string;
  scraperType: string;
  enabled: boolean;
  overrides: Record<string, unknown>;
  updatedAt: string | null;
  updatedBy: string | null;
}

export default function ScraperManagementPage() {
  const { fetchWithAuth } = useAuth();
  const [rows, setRows] = useState<ScraperConfigRow[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchWithAuth("/api/system-admin/scraper-configs")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { configs: ScraperConfigRow[] };
        setRows(data.configs);
      })
      .catch((err) => setError(String(err)));
  }, [fetchWithAuth]);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load: {error}</p>
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading scraper configs…</p>
      </div>
    );
  }

  // Group rows by platform for a more scannable layout
  const byPlatform = new Map<string, ScraperConfigRow[]>();
  for (const row of rows) {
    if (!byPlatform.has(row.platform)) byPlatform.set(row.platform, []);
    byPlatform.get(row.platform)!.push(row);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scraper Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Per-(platform, scraper type) runtime config. Phase 1 is read-only — live
          editing ships in{" "}
          <Link
            href="https://linear.app/plan-b-side-projects/issue/PLA-1041"
            className="underline hover:text-primary"
            target="_blank"
            rel="noreferrer"
          >
            PLA-1041
          </Link>
          . Rows with a non-empty <code className="font-mono text-xs">overrides</code> object
          are not using default code values.
        </p>
      </div>

      {[...byPlatform.entries()].map(([platform, platformRows]) => {
        const anyOverrides = platformRows.some(
          (r) => Object.keys(r.overrides).length > 0 || !r.enabled,
        );
        return (
          <Card key={platform}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] }}
                />
                {PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform}
                {anyOverrides && (
                  <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200">
                    has overrides
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Scraper type</TableHead>
                    <TableHead className="w-24">Enabled</TableHead>
                    <TableHead>Overrides</TableHead>
                    <TableHead className="w-40">Last updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformRows.map((row) => {
                    const overrideKeys = Object.keys(row.overrides);
                    return (
                      <TableRow key={row.scraperType}>
                        <TableCell className="font-mono text-xs">{row.scraperType}</TableCell>
                        <TableCell>
                          {row.enabled ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              on
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              off
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {overrideKeys.length === 0 ? (
                            <span className="text-xs text-muted-foreground">— (all defaults)</span>
                          ) : (
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                              {JSON.stringify(row.overrides, null, 2)}
                            </pre>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.updatedAt ? (
                            <>
                              {timeAgo(row.updatedAt)}
                              {row.updatedBy && <span className="block">by {row.updatedBy}</span>}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
