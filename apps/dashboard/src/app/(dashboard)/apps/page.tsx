"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { AdminScraperTrigger } from "@/components/admin-scraper-trigger";
import { AppSearchBar } from "@/components/app-search-bar";

type SortKey = "name" | "rating" | "reviews" | "minPaidPrice" | "lastChangeAt" | "launchedDate" | "competitorCount" | "keywordCount";
type SortDir = "asc" | "desc";

export default function AppsPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [appCategories, setAppCategories] = useState<Record<string, { title: string; slug: string; position: number | null }[]>>({});
  const [confirmRemove, setConfirmRemove] = useState<{
    slug: string;
    name: string;
  } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const canEdit = user?.role === "owner" || user?.role === "editor";

  const trackedSlugs = useMemo(() => new Set(apps.map((a) => a.slug)), [apps]);

  useEffect(() => {
    loadApps();
  }, []);

  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.name || a.slug).localeCompare(b.name || b.slug);
          break;
        case "rating":
          cmp = (a.latestSnapshot?.averageRating ?? 0) - (b.latestSnapshot?.averageRating ?? 0);
          break;
        case "reviews":
          cmp = (a.latestSnapshot?.ratingCount ?? 0) - (b.latestSnapshot?.ratingCount ?? 0);
          break;
        case "minPaidPrice":
          cmp = (a.minPaidPrice ?? 0) - (b.minPaidPrice ?? 0);
          break;
        case "lastChangeAt":
          cmp = (a.lastChangeAt || "").localeCompare(b.lastChangeAt || "");
          break;
        case "launchedDate":
          cmp = (a.launchedDate || "").localeCompare(b.launchedDate || "");
          break;
        case "competitorCount":
          cmp = (a.competitorCount ?? 0) - (b.competitorCount ?? 0);
          break;
        case "keywordCount":
          cmp = (a.keywordCount ?? 0) - (b.keywordCount ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [apps, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
    );
  }

  async function loadApps() {
    setLoading(true);
    const res = await fetchWithAuth("/api/apps");
    if (res.ok) {
      const loadedApps = await res.json();
      setApps(loadedApps);

      const slugs = loadedApps.map((a: any) => a.slug).filter(Boolean);
      if (slugs.length > 0) {
        const catRes = await fetchWithAuth("/api/apps/categories", {
          method: "POST",
          body: JSON.stringify({ slugs }),
        });
        if (catRes.ok) setAppCategories(await catRes.json());
      }
    }
    setLoading(false);
  }

  async function trackApp(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth("/api/account/tracked-apps", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const scrapeMsg = data.scraperEnqueued
        ? " Scraping started — details will appear shortly."
        : "";
      setMessage(`Now following "${name}".${scrapeMsg}`);
      loadApps();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to track app");
    }
  }

  async function untrackApp(slug: string, name: string) {
    setMessage("");
    const res = await fetchWithAuth(`/api/account/tracked-apps/${slug}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessage(`Unfollowed "${name}"`);
      loadApps();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to untrack app");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">
          My Apps ({apps.length}
          {account ? `/${account.limits.maxTrackedApps}` : ""})
        </h1>
        <AdminScraperTrigger
          scraperType="app_details"
          label="Scrape All Apps"
        />
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      <AppSearchBar
        mode="follow"
        trackedSlugs={trackedSlugs}
        onFollow={trackApp}
        placeholder="Search apps..."
        className="max-w-md"
      />

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    App <SortIcon col="name" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rating")}>
                    Rating <SortIcon col="rating" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("reviews")}>
                    Reviews <SortIcon col="reviews" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("competitorCount")}>
                    Competitors <SortIcon col="competitorCount" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("keywordCount")}>
                    Keywords <SortIcon col="keywordCount" />
                  </TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("minPaidPrice")}>
                    Min. Paid <SortIcon col="minPaidPrice" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastChangeAt")}>
                    Last Change <SortIcon col="lastChangeAt" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("launchedDate")}>
                    Launched <SortIcon col="launchedDate" />
                  </TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((app) => (
                  <TableRow key={app.slug}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.iconUrl && (
                          <img src={app.iconUrl} alt="" className="h-6 w-6 rounded shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/apps/${app.slug}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {app.name}
                            </Link>
                            {app.isBuiltForShopify && <span title="Built for Shopify">💎</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.averageRating ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.latestSnapshot?.ratingCount != null ? (
                        <Link href={`/apps/${app.slug}/reviews`} className="text-primary hover:underline">
                          {app.latestSnapshot.ratingCount}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.competitorCount ? (
                        <Link href={`/apps/${app.slug}/competitors`} className="text-primary hover:underline">
                          {app.competitorCount}
                        </Link>
                      ) : "0"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.keywordCount ? (
                        <Link href={`/apps/${app.slug}/keywords`} className="text-primary hover:underline">
                          {app.keywordCount}
                        </Link>
                      ) : "0"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {appCategories[app.slug]?.length ? (
                        <div className="flex flex-col gap-0.5">
                          {appCategories[app.slug].map((cat) => (
                            <div key={cat.slug} className="flex items-center gap-1">
                              {cat.position != null && (
                                <span className="font-medium text-muted-foreground">#{cat.position}</span>
                              )}
                              <Link href={`/categories/${cat.slug}`} className="text-primary hover:underline">
                                {cat.title}
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.latestSnapshot?.pricing ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.minPaidPrice != null ? (
                        <Link href={`/apps/${app.slug}/details#pricing-plans`} className="text-primary hover:underline">
                          ${app.minPaidPrice}/mo
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.lastChangeAt ? (
                        <Link href={`/apps/${app.slug}/changes`} className="text-primary hover:underline">
                          {formatDateOnly(app.lastChangeAt)}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.launchedDate
                        ? formatDateOnly(app.launchedDate)
                        : "\u2014"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRemove({
                              slug: app.slug,
                              name: app.name,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {apps.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 10 : 9}
                      className="text-center text-muted-foreground"
                    >
                      No apps yet. Search and follow an app to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmRemove}
        title="Unfollow App"
        description={`Are you sure you want to unfollow "${confirmRemove?.name}"? Its competitors and keywords will also be removed.`}
        onConfirm={() => {
          if (confirmRemove) {
            untrackApp(confirmRemove.slug, confirmRemove.name);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
