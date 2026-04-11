"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  GitCompareArrows,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  X,
  Tag,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PAGE_SIZE = 50;
const APP_NAME_MAX_LENGTH = 30;

const FIELD_COLORS: Record<string, string> = {
  name: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  appIntroduction:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  appDetails:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  features:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  seoTitle:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  seoMetaDescription:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  appCardSubtitle:
    "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
  pricingPlans:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
};

// Date presets
type DatePreset = { label: string; from: string; to: string };

function getDatePresets(): { key: string; label: string }[] {
  return [
    { key: "", label: "All Time" },
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "last3days", label: "Last 3 Days" },
    { key: "thisWeek", label: "This Week" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "custom", label: "Custom Range" },
  ];
}

function computeDateRange(
  key: string
): { from: string; to: string } | null {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const today = fmt(now);

  switch (key) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "last3days": {
      const d = new Date(now);
      d.setDate(d.getDate() - 2);
      return { from: fmt(d), to: today };
    }
    case "thisWeek": {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday
      return { from: fmt(d), to: today };
    }
    case "thisMonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(d), to: today };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(start), to: fmt(end) };
    }
    default:
      return null;
  }
}

// Label colors for the color picker
const LABEL_COLOR_OPTIONS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

interface UpdateLabel {
  id: number;
  name: string;
  color: string;
}

interface AppUpdate {
  id: number;
  appName: string;
  appSlug: string;
  platform: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
  labels: UpdateLabel[];
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
    labels: UpdateLabel[];
  };
}

function truncateText(text: string | null, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max) + "\u2026";
}

function ExpandableValue({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!value)
    return <span className="text-muted-foreground italic text-xs">(empty)</span>;

  const isLong = value.length > 120;
  if (!isLong) return <span className="text-xs whitespace-pre-wrap break-words">{value}</span>;

  return (
    <div className="space-y-1">
      <span className="text-xs whitespace-pre-wrap break-words">
        {expanded ? value : truncateText(value, 120)}
      </span>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center text-[10px] text-blue-600 hover:text-blue-800 dark:text-blue-400 gap-0.5"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3" /> Less
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" /> More
          </>
        )}
      </button>
    </div>
  );
}

// Label assignment dropdown
function LabelDropdown({
  changeId,
  currentLabels,
  allLabels,
  onAssign,
  onRemove,
}: {
  changeId: number;
  currentLabels: UpdateLabel[];
  allLabels: UpdateLabel[];
  onAssign: (changeId: number, labelId: number) => void;
  onRemove: (changeId: number, labelId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const currentIds = new Set(currentLabels.map((l) => l.id));
  const unassigned = allLabels.filter((l) => !currentIds.has(l.id));

  return (
    <div className="relative inline-flex flex-wrap items-center gap-1" ref={ref}>
      {currentLabels.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-medium text-white"
          style={{ backgroundColor: l.color }}
        >
          {l.name}
          <button
            onClick={() => onRemove(changeId, l.id)}
            className="hover:opacity-70"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" />
      </button>
      {open && unassigned.length > 0 && (
        <div className="absolute top-7 left-0 z-50 bg-popover border rounded-md shadow-md py-1 min-w-[120px]">
          {unassigned.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                onAssign(changeId, l.id);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent text-left"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: l.color }}
              />
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppUpdatesPage() {
  const { fetchWithAuth } = useAuth();
  const [data, setData] = useState<AppUpdate[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const [allLabels, setAllLabels] = useState<UpdateLabel[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [field, setField] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  // Label management
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Compute effective date range from preset or custom
  const effectiveDateRange = (() => {
    if (datePreset === "custom") return { from: customFrom, to: customTo };
    if (datePreset) return computeDateRange(datePreset);
    return null;
  })();

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
      if (effectiveDateRange?.from) params.set("dateFrom", effectiveDateRange.from);
      if (effectiveDateRange?.to) params.set("dateTo", effectiveDateRange.to);
      if (labelFilter) params.set("labelId", labelFilter);

      const res = await fetchWithAuth(
        `/api/system-admin/app-updates?${params}`
      );
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json.data);
        setPagination(json.pagination);
        setAvailableFields(json.filters.fields);
        setAvailablePlatforms(json.filters.platforms);
        setAllLabels(json.filters.labels);
      }
    } finally {
      setLoading(false);
    }
  }, [
    fetchWithAuth,
    page,
    sortOrder,
    platform,
    field,
    debouncedSearch,
    effectiveDateRange?.from,
    effectiveDateRange?.to,
    labelFilter,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [platform, field, datePreset, customFrom, customTo, labelFilter]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setPage(1);
  };

  // Label actions
  const handleAssignLabel = async (changeId: number, labelId: number) => {
    await fetchWithAuth(`/api/system-admin/app-updates/${changeId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelId }),
    });
    // Optimistic update
    setData((prev) =>
      prev.map((row) =>
        row.id === changeId
          ? {
              ...row,
              labels: [
                ...row.labels,
                allLabels.find((l) => l.id === labelId)!,
              ].filter(Boolean),
            }
          : row
      )
    );
  };

  const handleRemoveLabel = async (changeId: number, labelId: number) => {
    await fetchWithAuth(
      `/api/system-admin/app-updates/${changeId}/labels/${labelId}`,
      { method: "DELETE" }
    );
    setData((prev) =>
      prev.map((row) =>
        row.id === changeId
          ? { ...row, labels: row.labels.filter((l) => l.id !== labelId) }
          : row
      )
    );
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    const res = await fetchWithAuth("/api/system-admin/app-update-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }),
    });
    if (res.ok) {
      const label = await res.json();
      setAllLabels((prev) => [...prev, label].sort((a, b) => a.name.localeCompare(b.name)));
      setNewLabelName("");
    }
  };

  const handleDeleteLabel = async (id: number) => {
    await fetchWithAuth(`/api/system-admin/app-update-labels/${id}`, {
      method: "DELETE",
    });
    setAllLabels((prev) => prev.filter((l) => l.id !== id));
    if (labelFilter === String(id)) setLabelFilter("");
    // Remove from all rows
    setData((prev) =>
      prev.map((row) => ({
        ...row,
        labels: row.labels.filter((l) => l.id !== id),
      }))
    );
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
        <CardContent className="pt-6 space-y-3">
          {/* Row 1: search, platform, property, label */}
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
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Properties</option>
              {availableFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Labels</option>
              {allLabels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: date preset + custom range + label management */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {getDatePresets().map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {datePreset === "custom" && (
              <>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    From
                  </label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    To
                  </label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </>
            )}

            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLabelManager(!showLabelManager)}
                className="gap-1.5"
              >
                <Tag className="h-3.5 w-3.5" />
                Manage Labels
              </Button>
            </div>
          </div>

          {/* Label manager panel */}
          {showLabelManager && (
            <div className="border rounded-md p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="New label name..."
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  className="h-8 w-48"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                />
                <div className="flex gap-1">
                  {LABEL_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewLabelColor(c)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-all",
                        newLabelColor === c
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Button size="sm" onClick={handleCreateLabel} className="h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {allLabels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allLabels.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: l.color }}
                    >
                      {l.name}
                      <button
                        onClick={() => handleDeleteLabel(l.id)}
                        className="hover:opacity-70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead className="w-[180px]">App Name</TableHead>
                  <TableHead className="w-[90px]">Platform</TableHead>
                  <TableHead className="w-[130px]">Property</TableHead>
                  <TableHead className="w-[280px]">Before</TableHead>
                  <TableHead className="w-[280px]">After</TableHead>
                  <TableHead className="w-[130px]">
                    <button
                      onClick={toggleSort}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Detected
                      <SortIcon className="h-3.5 w-3.5" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px]">Labels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No app updates found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row) => (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {row.id}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <Link
                          href={`/${row.platform}/apps/v2/${row.appSlug}/intel/changes`}
                          className="text-sm font-medium hover:underline text-blue-600 dark:text-blue-400 block truncate"
                          title={row.appName}
                        >
                          {truncateText(row.appName, APP_NAME_MAX_LENGTH)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {row.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            FIELD_COLORS[row.field] || ""
                          )}
                        >
                          {row.field}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[280px] min-w-[200px]">
                        <ExpandableValue value={row.oldValue} />
                      </TableCell>
                      <TableCell className="w-[280px] min-w-[200px]">
                        <ExpandableValue value={row.newValue} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {timeAgo(row.detectedAt)}
                      </TableCell>
                      <TableCell>
                        <LabelDropdown
                          changeId={row.id}
                          currentLabels={row.labels}
                          allLabels={allLabels}
                          onAssign={handleAssignLabel}
                          onRemove={handleRemoveLabel}
                        />
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
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
