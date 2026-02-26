"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useFormatDate } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";

type SortKey = "name" | "rating" | "reviews" | "minPaidPrice" | "lastChangeAt" | "launchedDate";
type SortDir = "asc" | "desc";

export default function DeveloperAppsPage() {
  return (
    <Suspense
      fallback={<TableSkeleton rows={8} cols={5} />}
    >
      <DeveloperAppsContent />
    </Suspense>
  );
}

function DeveloperAppsContent() {
  const searchParams = useSearchParams();
  const developerName = searchParams.get("name") || "";
  const { fetchWithAuth } = useAuth();
  const { formatDateOnly } = useFormatDate();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [appCategories, setAppCategories] = useState<Record<string, { title: string; slug: string; position: number | null }[]>>({});
  const [lastChanges, setLastChanges] = useState<Record<string, string>>({});

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    if (!developerName) {
      setLoading(false);
      return;
    }
    loadApps();
  }, [developerName]);

  async function loadApps() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/apps/by-developer?name=${encodeURIComponent(developerName)}`
    );
    if (res.ok) {
      const loadedApps = await res.json();
      setApps(loadedApps);

      const slugs = loadedApps.map((a: any) => a.slug).filter(Boolean);
      if (slugs.length > 0) {
        const [catRes, lcRes] = await Promise.all([
          fetchWithAuth("/api/apps/categories", {
            method: "POST",
            body: JSON.stringify({ slugs }),
          }),
          fetchWithAuth("/api/apps/last-changes", {
            method: "POST",
            body: JSON.stringify({ slugs }),
          }),
        ]);
        if (catRes.ok) setAppCategories(await catRes.json());
        if (lcRes.ok) setLastChanges(await lcRes.json());
      }
    }
    setLoading(false);
  }

  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.name || a.slug).localeCompare(b.name || b.slug);
          break;
        case "rating":
          cmp = (a.averageRating ?? 0) - (b.averageRating ?? 0);
          break;
        case "reviews":
          cmp = (a.ratingCount ?? 0) - (b.ratingCount ?? 0);
          break;
        case "minPaidPrice":
          cmp = (a.minPaidPrice ?? 0) - (b.minPaidPrice ?? 0);
          break;
        case "lastChangeAt":
          cmp = (lastChanges[a.slug] || "").localeCompare(lastChanges[b.slug] || "");
          break;
        case "launchedDate":
          cmp = (a.launchedDate || "").localeCompare(b.launchedDate || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [apps, sortKey, sortDir, lastChanges]);

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

  if (!developerName) {
    return <p className="text-muted-foreground">No developer specified.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Apps by {developerName}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{apps.length} Apps</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : apps.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No apps found for this developer.
            </p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((app: any) => (
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
                      {app.averageRating != null
                        ? Number(app.averageRating).toFixed(1)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {app.ratingCount != null ? (
                        <Link href={`/apps/${app.slug}/reviews`} className="text-primary hover:underline">
                          {app.ratingCount.toLocaleString()}
                        </Link>
                      ) : "\u2014"}
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
                      {app.pricing ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.minPaidPrice != null ? (
                        <Link href={`/apps/${app.slug}/details#pricing-plans`} className="text-primary hover:underline">
                          {app.minPaidPrice === 0
                            ? "Free"
                            : `$${app.minPaidPrice}/mo`}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lastChanges[app.slug] ? (
                        <Link href={`/apps/${app.slug}/changes`} className="text-primary hover:underline">
                          {formatDateOnly(lastChanges[app.slug])}
                        </Link>
                      ) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.launchedDate
                        ? formatDateOnly(app.launchedDate)
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
