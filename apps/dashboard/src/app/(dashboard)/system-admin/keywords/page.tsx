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
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Zap, Loader2, Check } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { useFormatDate } from "@/lib/format-date";

type SortKey = "keyword" | "trackedBy" | "createdAt" | "lastScraped";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "active" | "inactive";

export default function KeywordsListPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [keywords, setKeywords] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("keyword");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; keyword: string } | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<Record<string, "idle" | "loading" | "done">>({});

  useEffect(() => {
    loadKeywords();
  }, []);

  async function loadKeywords() {
    try {
      const res = await fetchWithAuth("/api/system-admin/keywords");
      if (res.ok) setKeywords(await res.json());
    } catch (err) {
      console.error("Failed to load keywords:", err);
    }
  }

  async function toggleAccounts(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setAccountsList([]);
      return;
    }
    setExpandedId(id);
    const res = await fetchWithAuth(
      `/api/system-admin/keywords/${id}/accounts`
    );
    if (res.ok) setAccountsList(await res.json());
  }

  async function deleteKeyword(id: number) {
    const res = await fetchWithAuth(`/api/system-admin/keywords/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDeleteTarget(null);
      loadKeywords();
    }
  }

  async function triggerScrape(keyword: string) {
    const status = scrapeStatus[keyword];
    if (status === "loading" || status === "done") return;
    setScrapeStatus((s) => ({ ...s, [keyword]: "loading" }));
    try {
      await fetchWithAuth("/api/system-admin/scraper/trigger", {
        method: "POST",
        body: JSON.stringify({ type: "keyword_search", keyword }),
      });
      setScrapeStatus((s) => ({ ...s, [keyword]: "done" }));
      setTimeout(() => setScrapeStatus((s) => ({ ...s, [keyword]: "idle" })), 3000);
    } catch {
      setScrapeStatus((s) => ({ ...s, [keyword]: "idle" }));
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "keyword" ? "asc" : "desc");
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

  const filtered = useMemo(() => {
    let result = keywords;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((kw) => kw.keyword.toLowerCase().includes(q));
    }

    if (statusFilter === "active") {
      result = result.filter((kw) => kw.isActive);
    } else if (statusFilter === "inactive") {
      result = result.filter((kw) => !kw.isActive);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "keyword":
          cmp = a.keyword.localeCompare(b.keyword);
          break;
        case "trackedBy":
          cmp = (a.trackedByCount ?? 0) - (b.trackedByCount ?? 0);
          break;
        case "createdAt":
          cmp =
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime();
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
  }, [keywords, search, statusFilter, sortKey, sortDir]);

  const statusCounts = useMemo(() => {
    const base = search.trim()
      ? keywords.filter((kw) =>
          kw.keyword.toLowerCase().includes(search.toLowerCase())
        )
      : keywords;
    return {
      all: base.length,
      active: base.filter((kw) => kw.isActive).length,
      inactive: base.filter((kw) => !kw.isActive).length,
    };
  }, [keywords, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Keywords"}
        </p>
        <h1 className="text-2xl font-bold">
          Keywords ({filtered.length})
        </h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStatusFilter(key)}
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
                  onClick={() => toggleSort("keyword")}
                >
                  Keyword <SortIcon col="keyword" />
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
                  onClick={() => toggleSort("createdAt")}
                >
                  Created <SortIcon col="createdAt" />
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
              {filtered.map((kw: any) => (
                <Fragment key={kw.id}>
                  <TableRow>
                    <TableCell>
                      <Link
                        href={`/keywords/${kw.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {kw.keyword}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {kw.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {kw.trackedByCount > 0 ? (
                        <button
                          onClick={() => toggleAccounts(kw.id)}
                          className="text-primary hover:underline text-sm"
                        >
                          {kw.trackedByCount} account
                          {kw.trackedByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {kw.createdAt
                        ? formatDateTime(kw.createdAt)
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {kw.lastScrapedAt
                        ? formatDateTime(kw.lastScrapedAt)
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => triggerScrape(kw.keyword)}
                          disabled={scrapeStatus[kw.keyword] === "loading"}
                          title="Scrape keyword"
                        >
                          {scrapeStatus[kw.keyword] === "loading" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : scrapeStatus[kw.keyword] === "done" ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Zap className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget({ id: kw.id, keyword: kw.keyword })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === kw.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30 p-4">
                        <div className="text-sm font-medium mb-2">
                          Accounts tracking &quot;{kw.keyword}&quot;
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
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No keywords found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Keyword"
        description={`"${deleteTarget?.keyword}" keyword and all related data (snapshots, rankings, ad sightings, account trackings) will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteKeyword(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
