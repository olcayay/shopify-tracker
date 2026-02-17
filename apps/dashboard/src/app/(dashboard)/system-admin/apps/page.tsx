"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
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

type SortKey = "name" | "slug" | "trackedBy" | "competitorBy" | "lastScraped" | "lastChange";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "tracked" | "untracked";

const PAGE_SIZE = 30;

export default function AppsListPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [apps, setApps] = useState<any[]>([]);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tracked");
  const [page, setPage] = useState(1);
  const [scrapeStatus, setScrapeStatus] = useState<Record<string, "idle" | "loading" | "done">>({});

  useEffect(() => {
    loadApps();
  }, [statusFilter]);

  async function loadApps() {
    const url =
      statusFilter === "untracked"
        ? "/api/system-admin/apps"
        : statusFilter === "tracked"
          ? "/api/system-admin/apps?tracked=true"
          : "/api/system-admin/apps";
    const res = await fetchWithAuth(url);
    if (res.ok) setApps(await res.json());
  }

  async function toggleAccounts(slug: string) {
    if (expandedSlug === slug) {
      setExpandedSlug(null);
      setAccountsList([]);
      return;
    }
    setExpandedSlug(slug);
    const res = await fetchWithAuth(`/api/system-admin/apps/${slug}/accounts`);
    if (res.ok) setAccountsList(await res.json());
  }

  async function triggerScrape(slug: string) {
    const status = scrapeStatus[slug];
    if (status === "loading" || status === "done") return;
    setScrapeStatus((s) => ({ ...s, [slug]: "loading" }));
    try {
      await fetchWithAuth("/api/system-admin/scraper/trigger", {
        method: "POST",
        body: JSON.stringify({ type: "app_details", slug }),
      });
      setScrapeStatus((s) => ({ ...s, [slug]: "done" }));
      setTimeout(() => setScrapeStatus((s) => ({ ...s, [slug]: "idle" })), 3000);
    } catch {
      setScrapeStatus((s) => ({ ...s, [slug]: "idle" }));
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "slug" ? "asc" : "desc");
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
    let result = apps;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q)
      );
    }

    if (statusFilter === "tracked") {
      result = result.filter((a) => a.isTracked);
    } else if (statusFilter === "untracked") {
      result = result.filter((a) => !a.isTracked);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "slug":
          cmp = a.slug.localeCompare(b.slug);
          break;
        case "trackedBy":
          cmp = (a.trackedByCount ?? 0) - (b.trackedByCount ?? 0);
          break;
        case "competitorBy":
          cmp = (a.competitorByCount ?? 0) - (b.competitorByCount ?? 0);
          break;
        case "lastScraped":
          cmp =
            new Date(a.lastScrapedAt || 0).getTime() -
            new Date(b.lastScrapedAt || 0).getTime();
          break;
        case "lastChange":
          cmp =
            new Date(a.lastChangeAt || 0).getTime() -
            new Date(b.lastChangeAt || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [apps, search, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const statusCounts = useMemo(() => {
    const base = search.trim()
      ? apps.filter((a) => {
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q);
        })
      : apps;
    return {
      all: base.length,
      tracked: base.filter((a) => a.isTracked).length,
      untracked: base.filter((a) => !a.isTracked).length,
    };
  }, [apps, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Apps"}
        </p>
        <h1 className="text-2xl font-bold">Apps ({filtered.length})</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9"
          />
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
                  onClick={() => toggleSort("name")}
                >
                  Name <SortIcon col="name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("slug")}
                >
                  Slug <SortIcon col="slug" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("trackedBy")}
                >
                  Tracked By <SortIcon col="trackedBy" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("competitorBy")}
                >
                  Competitor For <SortIcon col="competitorBy" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("lastScraped")}
                >
                  Last Scraped <SortIcon col="lastScraped" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("lastChange")}
                >
                  Last Change <SortIcon col="lastChange" />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((app: any) => (
                <Fragment key={app.slug}>
                  <TableRow>
                    <TableCell>
                      <Link
                        href={`/apps/${app.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {app.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {app.slug}
                    </TableCell>
                    <TableCell>
                      {app.isTracked ? (
                        <Badge variant="default">Tracked</Badge>
                      ) : (
                        <Badge variant="secondary">Not tracked</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {app.trackedByCount > 0 || app.competitorByCount > 0 ? (
                        <button
                          onClick={() => toggleAccounts(app.slug)}
                          className="text-primary hover:underline text-sm"
                        >
                          {app.trackedByCount} account
                          {app.trackedByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {app.competitorByCount > 0 ? (
                        <button
                          onClick={() => toggleAccounts(app.slug)}
                          className="text-primary hover:underline text-sm"
                        >
                          {app.competitorByCount} account
                          {app.competitorByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.lastScrapedAt
                        ? formatDateTime(app.lastScrapedAt)
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.lastChangeAt
                        ? formatDateTime(app.lastChangeAt)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => triggerScrape(app.slug)}
                        disabled={scrapeStatus[app.slug] === "loading"}
                        title="Scrape app"
                      >
                        {scrapeStatus[app.slug] === "loading" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : scrapeStatus[app.slug] === "done" ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedSlug === app.slug && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                        <div className="text-sm font-medium mb-2">
                          Accounts using &quot;{app.name}&quot;
                        </div>
                        {accountsList.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No accounts
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {accountsList.map((a: any) => (
                              <Link
                                key={`${a.accountId}-${a.type}`}
                                href={`/system-admin/accounts/${a.accountId}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-sm hover:bg-muted transition-colors"
                              >
                                {a.accountName}
                                <Badge
                                  variant={
                                    a.type === "tracked"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
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
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No apps found
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
