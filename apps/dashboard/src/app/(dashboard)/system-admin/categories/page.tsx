"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { PLATFORMS, type PlatformId } from "@appranks/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  Loader2,
  Check,
} from "lucide-react";
import { useFormatDate } from "@/lib/format-date";
import { PlatformOverviewCards } from "@/components/platform-overview-cards";

type SortKey = "title" | "slug" | "platform" | "parent" | "appCount" | "starredBy" | "lastScraped";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "tracked" | "untracked";

const PAGE_SIZE = 30;

export default function CategoriesListPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [categories, setCategories] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tracked");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [scrapeStatus, setScrapeStatus] = useState<Record<number, "idle" | "loading" | "done">>({});

  useEffect(() => {
    loadCategories();
  }, [statusFilter, platformFilter]);

  async function loadCategories() {
    const params = new URLSearchParams();
    if (statusFilter === "tracked") params.set("tracked", "true");
    if (platformFilter) params.set("platform", platformFilter);
    const qs = params.toString();
    const url = `/api/system-admin/categories${qs ? `?${qs}` : ""}`;
    const res = await fetchWithAuth(url);
    if (res.ok) setCategories(await res.json());
  }

  async function toggleAccounts(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setAccountsList([]);
      return;
    }
    setExpandedId(id);
    const res = await fetchWithAuth(`/api/system-admin/categories/${id}/accounts`);
    if (res.ok) setAccountsList(await res.json());
  }

  async function triggerScrape(id: number, slug: string, platform?: string) {
    const status = scrapeStatus[id];
    if (status === "loading" || status === "done") return;
    setScrapeStatus((s) => ({ ...s, [id]: "loading" }));
    try {
      await fetchWithAuth("/api/system-admin/scraper/trigger", {
        method: "POST",
        body: JSON.stringify({ type: "category", slug, platform }),
      });
      setScrapeStatus((s) => ({ ...s, [id]: "done" }));
      setTimeout(() => setScrapeStatus((s) => ({ ...s, [id]: "idle" })), 3000);
    } catch {
      setScrapeStatus((s) => ({ ...s, [id]: "idle" }));
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "slug" || key === "platform" ? "asc" : "desc");
    }
    setPage(1);
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

  const filtered = useMemo(() => {
    let result = categories;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q)
      );
    }

    if (statusFilter === "tracked") {
      result = result.filter((c) => c.isTracked);
    } else if (statusFilter === "untracked") {
      result = result.filter((c) => !c.isTracked);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "slug":
          cmp = a.slug.localeCompare(b.slug);
          break;
        case "platform":
          cmp = (a.platform || "").localeCompare(b.platform || "");
          break;
        case "parent":
          cmp = (a.parentTitle || "").localeCompare(b.parentTitle || "");
          break;
        case "appCount":
          cmp = (a.appCount ?? 0) - (b.appCount ?? 0);
          break;
        case "starredBy":
          cmp = (a.starredByCount ?? 0) - (b.starredByCount ?? 0);
          break;
        case "lastScraped":
          cmp =
            new Date(a.lastScrapedAt || 0).getTime() -
            new Date(b.lastScrapedAt || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [categories, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const statusCounts = useMemo(() => {
    const base = search.trim()
      ? categories.filter((c) => {
          const q = search.toLowerCase();
          return c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
        })
      : categories;
    return {
      all: base.length,
      tracked: base.filter((c) => c.isTracked).length,
      untracked: base.filter((c) => !c.isTracked).length,
    };
  }, [categories, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Categories"}
        </p>
        <h1 className="text-2xl font-bold">Categories ({filtered.length})</h1>
      </div>

      <PlatformOverviewCards type="categories" activePlatform={platformFilter} onSelect={(p) => { setPlatformFilter(p); setPage(1); }} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title or slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>
          <select
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded-md px-3 py-1.5 text-sm bg-background h-9"
          >
            <option value="">All Platforms</option>
            {(Object.keys(PLATFORMS) as PlatformId[]).map((pid) => (
              <option key={pid} value={pid}>
                {PLATFORMS[pid].name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["all", "All"],
              ["tracked", "Tracked"],
              ["untracked", "Not Tracked"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setStatusFilter(key);
                setPage(1);
              }}
            >
              {label}
              {statusCounts[key] > 0 && (
                <span className="ml-1 opacity-70">({statusCounts[key]})</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("title")}
                >
                  Title <SortIcon col="title" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("platform")}
                >
                  Platform <SortIcon col="platform" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("slug")}
                >
                  Slug <SortIcon col="slug" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Level</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("parent")}
                >
                  Parent <SortIcon col="parent" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("appCount")}
                >
                  App Count <SortIcon col="appCount" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("starredBy")}
                >
                  Starred By <SortIcon col="starredBy" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("lastScraped")}
                >
                  Last Scraped <SortIcon col="lastScraped" />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((cat: any) => (
                <Fragment key={cat.id}>
                  <TableRow>
                    <TableCell className="max-w-[260px]">
                      <Link
                        href={`/${cat.platform || "shopify"}/categories/${cat.slug}`}
                        className="text-primary hover:underline font-medium truncate block"
                      >
                        {cat.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {cat.platform && PLATFORMS[cat.platform as PlatformId]
                          ? PLATFORMS[cat.platform as PlatformId].name
                          : cat.platform ?? "\u2014"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {cat.slug}
                    </TableCell>
                    <TableCell>
                      {cat.isTracked ? (
                        <Badge variant="default">Tracked</Badge>
                      ) : (
                        <Badge variant="secondary">Not tracked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.categoryLevel}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {cat.parentTitle ? (
                        <span className="truncate block">
                          {cat.parentTitle}
                        </span>
                      ) : cat.parentSlug ? (
                        <Link
                          href={`/${cat.platform || "shopify"}/categories/${cat.parentSlug}`}
                          className="text-primary hover:underline"
                        >
                          {cat.parentSlug}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.appCount ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {cat.starredByCount > 0 ? (
                        <button
                          onClick={() => toggleAccounts(cat.id)}
                          className="text-primary hover:underline text-sm"
                        >
                          {cat.starredByCount} account
                          {cat.starredByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cat.lastScrapedAt
                        ? formatDateTime(cat.lastScrapedAt)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => triggerScrape(cat.id, cat.slug, cat.platform)}
                        disabled={scrapeStatus[cat.id] === "loading"}
                        title="Scrape category"
                      >
                        {scrapeStatus[cat.id] === "loading" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : scrapeStatus[cat.id] === "done" ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === cat.id && (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-muted/30 p-4">
                        <div className="text-sm font-medium mb-2">
                          Accounts starring &quot;{cat.title}&quot;
                        </div>
                        {accountsList.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No accounts
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {accountsList.map((a: any) => (
                              <Link
                                key={a.accountId}
                                href={`/system-admin/accounts/${a.accountId}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-sm hover:bg-muted transition-colors"
                              >
                                {a.accountName}
                                <Badge variant="default" className="text-xs">
                                  {a.type}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground"
                  >
                    No categories found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}&ndash;
                {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
