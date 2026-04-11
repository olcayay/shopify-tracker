"use client";

import { useState, useEffect, useCallback } from "react";
import { GitCompareArrows, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PAGE_SIZE = 50;

const FIELD_COLORS: Record<string, string> = {
  name: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  appIntroduction: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  appDetails: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  features: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  seoTitle: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  seoMetaDescription: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  appCardSubtitle: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
  pricingPlans: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
};

interface AppUpdate {
  id: number;
  appName: string;
  appSlug: string;
  platform: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
}

interface ApiResponse {
  data: AppUpdate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    fields: string[];
    platforms: string[];
  };
}

function truncate(text: string | null, max: number): string {
  if (!text) return "—";
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function ExpandableValue({ value, label }: { value: string | null; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!value) return <span className="text-muted-foreground">—</span>;

  const isLong = value.length > 100;
  if (!isLong) return <span className="text-xs break-all">{value}</span>;

  return (
    <div>
      <span className="text-xs break-all">{expanded ? value : truncate(value, 100)}</span>
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 inline-flex items-center text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span className="sr-only">{expanded ? "Collapse" : `Expand ${label}`}</span>
      </button>
    </div>
  );
}

export default function AppUpdatesPage() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<AppUpdate[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [field, setField] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      params.set("sortOrder", sortOrder);
      if (platform) params.set("platform", platform);
      if (field) params.set("field", field);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetchWithAuth(`/api/system-admin/app-updates?${params}`);
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json.data);
        setPagination(json.pagination);
        setAvailableFields(json.filters.fields);
        setAvailablePlatforms(json.filters.platforms);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, sortOrder, platform, field, debouncedSearch, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [platform, field, dateFrom, dateTo]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setPage(1);
  };

  const SortIcon = sortOrder === "desc" ? ArrowDown : ArrowUp;

  return (
    <div className="space-y-6">
      <PageHeader
        title="App Updates"
        description="Global view of all app field changes across platforms"
        icon={GitCompareArrows}
        breadcrumbs={[
          { label: "System Admin", href: "/system-admin" },
          { label: "App Updates" },
        ]}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by app name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Platforms</option>
              {availablePlatforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Properties</option>
              {availableFields.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">App Name</TableHead>
                  <TableHead className="w-[100px]">Platform</TableHead>
                  <TableHead className="w-[140px]">Property</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                  <TableHead className="w-[140px]">
                    <button
                      onClick={toggleSort}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Detection Date
                      <SortIcon className="h-3.5 w-3.5" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No app updates found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/${row.platform}/apps/v2/${row.appSlug}/intel/changes`}
                          className="text-sm font-medium hover:underline text-blue-600 dark:text-blue-400"
                        >
                          {row.appName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {row.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", FIELD_COLORS[row.field] || "")}
                        >
                          {row.field}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <ExpandableValue value={row.oldValue} label="before" />
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <ExpandableValue value={row.newValue} label="after" />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(row.detectedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
