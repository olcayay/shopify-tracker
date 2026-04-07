"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHeader,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AppSearchBar } from "@/components/app-search-bar";

import type { SortKey, SortDir } from "./types";
import { TOGGLEABLE_COLUMNS, STORAGE_KEY } from "./types";
import { sortCompetitors } from "./sort-utils";
import { CompetitorTableHeaders } from "./competitor-table-headers";
import { CompetitorRow } from "./competitor-row";
import { ColumnToggleDropdown } from "./column-toggle-dropdown";

export default function CompetitorsPage() {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [myApps, setMyApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
    trackedAppSlug: string;
  } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const canEdit = user?.role === "owner" || user?.role === "editor";

  const visibleToggleableColumns = useMemo(() => {
    return TOGGLEABLE_COLUMNS.filter((col) => {
      if (col.key === "featured" && !caps.hasFeaturedSections) return false;
      if (col.key === "similar" && !caps.hasSimilarApps) return false;
      if ((col.key === "rating" || col.key === "reviews" || col.key === "v7d" || col.key === "v30d" || col.key === "v90d" || col.key === "momentum") && !caps.hasReviews) return false;
      if ((col.key === "pricing" || col.key === "minPaidPrice") && !caps.hasPricing) return false;
      if (col.key === "adKeywords" && !caps.hasAdTracking) return false;
      if (col.key === "launchedDate" && !caps.hasLaunchedDate) return false;
      return true;
    });
  }, [caps]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setHiddenColumns(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const isCol = (key: string) => {
    if (key === "featured" && !caps.hasFeaturedSections) return false;
    if (key === "similar" && !caps.hasSimilarApps) return false;
    if ((key === "rating" || key === "reviews" || key === "v7d" || key === "v30d" || key === "v90d" || key === "momentum") && !caps.hasReviews) return false;
    if ((key === "pricing" || key === "minPaidPrice") && !caps.hasPricing) return false;
    if (key === "adKeywords" && !caps.hasAdTracking) return false;
    if (key === "launchedDate" && !caps.hasLaunchedDate) return false;
    return !hiddenColumns.has(key);
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [compRes, appsRes] = await Promise.all([
      fetchWithAuth("/api/account/competitors"),
      fetchWithAuth("/api/account/tracked-apps"),
    ]);
    if (compRes.ok) setCompetitors(await compRes.json());
    if (appsRes.ok) setMyApps(await appsRes.json());
    setLoading(false);
  }

  async function removeCompetitor(
    slug: string,
    name: string,
    trackedAppSlug: string
  ) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(trackedAppSlug)}/competitors/${encodeURIComponent(slug)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${name}" removed from competitors`);
      loadData();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to remove competitor");
    }
  }

  // Group competitors by trackedAppSlug
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of competitors) {
      const key = c.trackedAppSlug;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [competitors]);

  // Build app name lookup
  const appNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of myApps) {
      map.set(a.appSlug, a.appName);
    }
    return map;
  }, [myApps]);

  // Count unique competitors
  const uniqueCount = useMemo(() => {
    return new Set(competitors.map((c) => c.appSlug)).size;
  }, [competitors]);

  const trackedSlugs = useMemo(() => new Set(myApps.map((a) => a.appSlug)), [myApps]);
  const competitorSlugs = useMemo(() => new Set(competitors.map((c) => c.appSlug)), [competitors]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "catRank" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold shrink-0">
          Competitor Apps {loading ? (
            <Skeleton className="inline-block h-6 w-16 align-middle" />
          ) : (
            <>({uniqueCount}{account ? `/${account.limits.maxCompetitorApps}` : ""})</>
          )}
        </h1>
        <div className="flex items-center gap-3 flex-wrap sm:ml-auto">
          <AppSearchBar
            mode="browse-only"
            trackedSlugs={trackedSlugs}
            competitorSlugs={competitorSlugs}
            placeholder="Search apps..."
            className="w-full sm:w-72"
          />
          <ColumnToggleDropdown
            hiddenColumns={hiddenColumns}
            setHiddenColumns={setHiddenColumns}
            visibleToggleableColumns={visibleToggleableColumns}
            isCol={isCol}
            sortKey={sortKey}
            setSortKey={setSortKey}
            setSortDir={setSortDir}
          />
          <AdminScraperTrigger
            scraperType="app_details"
            label="Scrape All Apps"
          />
        </div>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">
          {message}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : myApps.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              No tracked apps yet.{" "}
              <Link href={`/${platform}/apps`} className="text-primary hover:underline">
                Add apps
              </Link>{" "}
              first, then add competitors from app detail pages.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Apps with competitors first */}
          {myApps
            .filter((myApp) => (grouped.get(myApp.appSlug) || []).length > 0)
            .map((myApp) => {
              const comps = grouped.get(myApp.appSlug)!;
              return (
                <Card key={myApp.appSlug}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      {myApp.iconUrl && (
                        <img
                          src={myApp.iconUrl}
                          alt="" aria-hidden="true"
                          className="h-6 w-6 rounded shrink-0"
                        />
                      )}
                      <CardTitle className="text-base">
                        <Link
                          href={`/${platform}/apps/${myApp.appSlug}`}
                          className="text-primary hover:underline"
                        >
                          {myApp.appName || myApp.appSlug}
                        </Link>
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {comps.length} competitor{comps.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <CompetitorTableHeaders
                          isCol={isCol}
                          toggleSort={toggleSort}
                          sortKey={sortKey}
                          sortDir={sortDir}
                          canEdit={canEdit}
                        />
                      </TableHeader>
                      <TableBody>
                        {sortCompetitors(comps, sortKey, sortDir).map((c) => (
                          <CompetitorRow
                            key={`${myApp.appSlug}-${c.appSlug}`}
                            c={c}
                            myAppSlug={myApp.appSlug}
                            platform={platform as string}
                            isCol={isCol}
                            canEdit={canEdit}
                            caps={caps}
                            formatDateOnly={formatDateOnly}
                            onRemove={(slug, name, trackedAppSlug) =>
                              setConfirmRemove({ slug, name, trackedAppSlug })
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}

          {/* Apps without competitors at the bottom */}
          {myApps.filter(
            (myApp) => (grouped.get(myApp.appSlug) || []).length === 0
          ).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground">
                  Apps without competitors
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {myApps
                  .filter(
                    (myApp) =>
                      (grouped.get(myApp.appSlug) || []).length === 0
                  )
                  .map((myApp) => (
                    <Link
                      key={myApp.appSlug}
                      href={`/${platform}/apps/${myApp.appSlug}/competitors`}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
                    >
                      {myApp.iconUrl && (
                        <img
                          src={myApp.iconUrl}
                          alt="" aria-hidden="true"
                          className="h-5 w-5 rounded shrink-0"
                        />
                      )}
                      {myApp.appName || myApp.appSlug}
                      <Badge variant="outline" className="text-xs">
                        Add
                      </Badge>
                    </Link>
                  ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Competitor"
        description={`Are you sure you want to remove "${confirmRemove?.name}" from competitors of "${appNameMap.get(confirmRemove?.trackedAppSlug || "") || confirmRemove?.trackedAppSlug}"?`}
        onConfirm={() => {
          if (confirmRemove) {
            removeCompetitor(
              confirmRemove.slug,
              confirmRemove.name,
              confirmRemove.trackedAppSlug
            );
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
