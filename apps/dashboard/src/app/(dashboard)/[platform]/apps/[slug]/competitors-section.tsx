"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { usePolling } from "@/hooks/use-polling";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { TableSkeleton } from "@/components/skeletons";
import {
  Table,
  TableBody,
} from "@/components/ui/table";
import { PLATFORMS, isPlatformId, type PlatformId } from "@appranks/shared";
import { ConfirmModal } from "@/components/confirm-modal";
import { AppSearchBar } from "@/components/app-search-bar";
import { CompetitorSuggestions } from "@/components/competitor-suggestions";
import { type SortKey, type SortDir, TOGGLEABLE_COLUMNS } from "./competitors-section-types";
import { shouldShowAdsClient } from "@/lib/ads-feature";
import { useFeatureFlags } from "@/contexts/feature-flags-context";
import { ColumnSettingsDropdown } from "./column-settings-dropdown";
import { CompetitorTableHeader } from "./competitor-table-header";
import { CompetitorTableRowItem } from "./competitor-table-row";
import { getSortedCompetitors } from "./competitors-sort";

export function CompetitorsSection({ appSlug }: { appSlug: string }) {
  const { platform } = useParams();
  const caps = isPlatformId(platform as string) ? PLATFORMS[platform as PlatformId] : PLATFORMS.shopify;
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { hasFeature } = useFeatureFlags();
  const hasAppSimilarity = hasFeature("app-similarity");
  const { formatDateOnly } = useFormatDate();
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [lastChanges, setLastChanges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [reordering, setReordering] = useState(false);
  const [selfPinned, setSelfPinned] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [pendingCompetitorSlugs, setPendingCompetitorSlugs] = useState<Map<string, number>>(new Map());
  const [resolvedCompetitorSlugs, setResolvedCompetitorSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`competitors-pin-self-${appSlug}`);
      if (saved !== null) setSelfPinned(JSON.parse(saved));
    } catch {}
    try {
      const saved = localStorage.getItem(`competitors-columns-${appSlug}`);
      if (saved) setHiddenColumns(new Set(JSON.parse(saved)));
    } catch {}
  }, [appSlug]);

  function toggleColumn(key: string) {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (sortKey === key) {
          setSortKey("order");
          setSortDir("asc");
        }
      }
      localStorage.setItem(`competitors-columns-${appSlug}`, JSON.stringify([...next]));
      return next;
    });
  }

  const isCol = (key: string) => {
    if (key === "visibility" && !hasFeature("app-visibility")) return false;
    if (key === "power" && !hasFeature("app-power")) return false;
    if (key === "similarity" && !hasAppSimilarity) return false;
    if (key === "featured" && !caps.hasFeaturedSections) return false;
    if (key === "similar" && !caps.hasSimilarApps) return false;
    if ((key === "rating" || key === "reviews" || key === "v7d" || key === "v30d" || key === "v90d" || key === "momentum") && !caps.hasReviews) return false;
    if ((key === "pricing" || key === "minPaidPrice") && !caps.hasPricing) return false;
    if (key === "ads" && !shouldShowAdsClient(caps, hasFeature)) return false;
    if (key === "launchedDate" && !caps.hasLaunchedDate) return false;
    return !hiddenColumns.has(key);
  };

  function toggleSelfPinned() {
    const next = !selfPinned;
    setSelfPinned(next);
    localStorage.setItem(`competitors-pin-self-${appSlug}`, JSON.stringify(next));
  }

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

  const visibleToggleableColumns = useMemo(() => {
    return TOGGLEABLE_COLUMNS.filter((col) => {
      if (col.key === "visibility" && !hasFeature("app-visibility")) return false;
      if (col.key === "power" && !hasFeature("app-power")) return false;
      if (col.key === "similarity" && !hasAppSimilarity) return false;
      if (col.key === "featured" && !caps.hasFeaturedSections) return false;
      if (col.key === "similar" && !caps.hasSimilarApps) return false;
      if ((col.key === "rating" || col.key === "reviews" || col.key === "v7d" || col.key === "v30d" || col.key === "v90d" || col.key === "momentum") && !caps.hasReviews) return false;
      if ((col.key === "pricing" || col.key === "minPaidPrice") && !caps.hasPricing) return false;
      if (col.key === "ads" && !shouldShowAdsClient(caps, hasFeature)) return false;
      if (col.key === "launchedDate" && !caps.hasLaunchedDate) return false;
      return true;
    }).map((col) => {
      if (col.key === "catRank" && platform === "wordpress") {
        return { ...col, label: "Tag Rank", tip: "Average tag ranking across all tags" };
      }
      return col;
    });
  }, [caps, hasAppSimilarity, hasFeature, platform]);

  useEffect(() => {
    if (!hasAppSimilarity && sortKey === "similarity") {
      setSortKey("order");
      setSortDir("asc");
    }
  }, [hasAppSimilarity, sortKey]);

  useEffect(() => {
    loadCompetitors();
  }, []);

  // Poll for pending competitors that are being scraped
  const pollPendingCompetitors = useCallback(async () => {
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors?includeSelf=true`
    );
    if (!res.ok) return;
    const freshCompetitors = await res.json();
    setCompetitors(freshCompetitors);

    // Also refresh last changes
    const slugs = freshCompetitors.map((c: any) => c.appSlug);
    if (slugs.length > 0) {
      const changesRes = await fetchWithAuth(`/api/apps/last-changes`, {
        method: "POST",
        body: JSON.stringify({ slugs }),
      });
      if (changesRes.ok) {
        setLastChanges(await changesRes.json());
      }
    }

    // Check which pending competitors now have enriched data (from compute jobs)
    const newlyResolved = new Set<string>();
    const stillPending = new Map<string, number>();
    for (const [slug, addedAt] of pendingCompetitorSlugs) {
      const comp = freshCompetitors.find((c: any) => c.appSlug === slug);
      const elapsed = Date.now() - addedAt;
      const hasEnrichedData = comp && (comp.reviewVelocity !== null || comp.similarityScore !== null);
      if (hasEnrichedData || elapsed > 120_000) {
        newlyResolved.add(slug);
      } else {
        stillPending.set(slug, addedAt);
      }
    }

    if (newlyResolved.size > 0) {
      setPendingCompetitorSlugs(stillPending);
      setResolvedCompetitorSlugs((prev) => {
        const next = new Set(prev);
        for (const s of newlyResolved) next.add(s);
        return next;
      });
      // Clear resolved animation after 2 seconds
      setTimeout(() => {
        setResolvedCompetitorSlugs((prev) => {
          const next = new Set(prev);
          for (const s of newlyResolved) next.delete(s);
          return next;
        });
      }, 2000);
    }
  }, [pendingCompetitorSlugs, appSlug, fetchWithAuth]);

  usePolling({
    hasPending: pendingCompetitorSlugs.size > 0,
    fetchFn: pollPendingCompetitors,
  });

  async function loadCompetitors(silent = false) {
    if (!silent) setLoading(true);
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors?includeSelf=true`
    );
    if (res.ok) {
      const comps = await res.json();
      setCompetitors(comps);

      // Fetch last changes for all apps (including self)
      const slugs = comps.map((c: any) => c.appSlug);
      if (slugs.length > 0) {
        const changesRes = await fetchWithAuth(`/api/apps/last-changes`, {
          method: "POST",
          body: JSON.stringify({ slugs }),
        });
        if (changesRes.ok) {
          setLastChanges(await changesRes.json());
        }
      }
    }
    setLoading(false);
  }

  async function addCompetitor(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors`,
      {
        method: "POST",
        body: JSON.stringify({ slug }),
      }
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.scraperEnqueued) {
        setPendingCompetitorSlugs((prev) => new Map(prev).set(slug, Date.now()));
      }
      setMessage(`"${name}" added as competitor`);
      loadCompetitors(true);
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to add competitor");
    }
  }

  async function removeCompetitor(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors/${encodeURIComponent(slug)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${name}" removed from competitors`);
      loadCompetitors();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to remove competitor");
    }
  }

  async function moveCompetitor(index: number, direction: "up" | "down") {
    const newList = [...competitors];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    // Don't swap with the self row
    if (newList[targetIndex]?.isSelf || newList[index]?.isSelf) return;

    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setCompetitors(newList);

    setReordering(true);
    const slugs = newList.filter((c) => !c.isSelf).map((c) => c.appSlug);
    await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/competitors/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({ slugs }),
      }
    );
    setReordering(false);
  }

  // Whether we're in custom order mode (showing move buttons)
  const isCustomOrder = sortKey === "order";

  function sortedCompetitors() {
    return getSortedCompetitors(competitors, sortKey, sortDir, selfPinned, lastChanges);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "order" || key === "catRank" ? "asc" : "desc");
    }
  }

  const competitorSlugs = new Set(competitors.map((c) => c.appSlug));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Competitors for this app
          {account
            ? ` (${account.usage.competitorApps}/${account.limits.maxCompetitorApps} unique across all apps)`
            : ""}
        </p>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      <div className="flex items-center gap-2">
        <AppSearchBar
          mode="competitor"
          competitorSlugs={competitorSlugs}
          currentAppSlug={appSlug}
          onAddCompetitor={addCompetitor}
          placeholder="Search apps..."
          className="max-w-md flex-1"
        />
        <ColumnSettingsDropdown
          appSlug={appSlug}
          hiddenColumns={hiddenColumns}
          setHiddenColumns={setHiddenColumns}
          visibleToggleableColumns={visibleToggleableColumns}
          isCol={isCol}
          toggleColumn={toggleColumn}
          sortKey={sortKey}
          setSortKey={setSortKey}
          setSortDir={setSortDir}
        />
      </div>

      {caps.hasAutoSuggestions && (
        <CompetitorSuggestions
          appSlug={appSlug}
          competitorSlugs={competitorSlugs}
          onCompetitorAdded={(slug, name) => {
            setPendingCompetitorSlugs((prev) => new Map(prev).set(slug, Date.now()));
            setMessage(`"${name}" added as competitor`);
            loadCompetitors(true);
            refreshUser();
          }}
          prominent={competitors.filter((c) => !c.isSelf).length === 0 && !loading}
        />
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : competitors.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No competitors added yet.
          {canEdit && " Use the search above to add competitors."}
        </p>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-14rem)] border rounded-md">
          <Table>
            <CompetitorTableHeader
              canEdit={canEdit}
              isCol={isCol}
              sortKey={sortKey}
              sortDir={sortDir}
              toggleSort={toggleSort}
              platform={platform as string}
            />
            <TableBody>
              {(() => {
                const sorted = sortedCompetitors();
                let competitorNum = 0;
                return sorted.map((comp, idx) => {
                if (!comp.isSelf || !selfPinned) competitorNum++;
                return (
                  <CompetitorTableRowItem
                    key={comp.appSlug}
                    comp={comp}
                    idx={idx}
                    competitorNum={competitorNum}
                    platform={platform as string}
                    canEdit={canEdit}
                    isCol={isCol}
                    isCustomOrder={isCustomOrder}
                    selfPinned={selfPinned}
                    reordering={reordering}
                    competitors={competitors}
                    isPending={pendingCompetitorSlugs.has(comp.appSlug)}
                    isResolved={resolvedCompetitorSlugs.has(comp.appSlug)}
                    caps={caps}
                    lastChanges={lastChanges}
                    formatDateOnly={formatDateOnly}
                    toggleSelfPinned={toggleSelfPinned}
                    moveCompetitor={moveCompetitor}
                    setConfirmRemove={setConfirmRemove}
                  />
                );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Competitor"
        description={`Are you sure you want to remove "${confirmRemove?.name}" from competitors?`}
        onConfirm={() => {
          if (confirmRemove) {
            removeCompetitor(confirmRemove.slug, confirmRemove.name);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
