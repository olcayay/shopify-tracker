"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ConfigEditDialog } from "./components/config-edit-dialog";

export interface ScraperConfigRow {
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
  const [editing, setEditing] = useState<{ platform: string; type: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/system-admin/scraper-configs");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { configs: ScraperConfigRow[] };
      setRows(data.configs);
    } catch (err) {
      setError(String(err));
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled(row: ScraperConfigRow) {
    const res = await fetchWithAuth(
      `/api/system-admin/scraper-configs/${row.platform}/${row.scraperType}`,
      {
        method: "PATCH",
        body: JSON.stringify({ enabled: !row.enabled }),
      },
    );
    if (res.ok) await load();
  }

  if (error) return <div className="p-6 text-destructive">Failed to load: {error}</div>;
  if (!rows) return <div className="p-6 text-muted-foreground">Loading scraper configs…</div>;

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
          Per-(platform, scraper type) runtime config. Click <b>Configure</b> to edit overrides
          on a row; changes apply to the next job within ~15s (worker cache TTL). Empty overrides
          means the scraper is using the code defaults. Schema registry currently covers only{" "}
          <code className="font-mono text-xs">app_details</code> —{" "}
          <Link
            href="https://linear.app/plan-b-side-projects/issue/PLA-1042"
            className="underline hover:text-primary"
            target="_blank"
            rel="noreferrer"
          >
            PLA-1042
          </Link>{" "}
          extends it to every type.
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
                  style={{
                    backgroundColor:
                      PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS],
                  }}
                />
                {PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? platform}
                {anyOverrides && (
                  <Badge
                    variant="outline"
                    className="ml-2 text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200"
                  >
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
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformRows.map((row) => {
                    const overrideKeys = Object.keys(row.overrides);
                    return (
                      <TableRow key={row.scraperType}>
                        <TableCell className="font-mono text-xs">{row.scraperType}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={row.enabled ? "outline" : "destructive"}
                            className="h-6 text-xs"
                            onClick={() => toggleEnabled(row)}
                          >
                            {row.enabled ? "on" : "off"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {overrideKeys.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              — (all defaults)
                            </span>
                          ) : (
                            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto max-w-md">
                              {JSON.stringify(row.overrides, null, 2)}
                            </pre>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.updatedAt ? (
                            <>
                              {timeAgo(row.updatedAt)}
                              {row.updatedBy && (
                                <span className="block">by {row.updatedBy}</span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              setEditing({ platform: row.platform, type: row.scraperType })
                            }
                          >
                            Configure
                          </Button>
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

      {editing && (
        <ConfigEditDialog
          platform={editing.platform}
          scraperType={editing.type}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
