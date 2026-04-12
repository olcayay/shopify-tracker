"use client";

import { useCallback, useEffect, useState } from "react";
import { Ghost, RotateCcw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format-utils";

interface DelistedApp {
  id: number;
  slug: string;
  name: string;
  platform: PlatformId;
  icon_url: string | null;
  delisted_at: string;
  last_snapshot_at: string | null;
  total_snapshots: number;
}

const PAGE_SIZE = 50;

export default function DelistedAppsPage() {
  const { fetchWithAuth } = useAuth();
  const [apps, setApps] = useState<DelistedApp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [acting, setActing] = useState<number | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      if (platform) params.set("platform", platform);
      if (search) params.set("search", search);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetchWithAuth(
        `/api/system-admin/apps/delisted?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, platform, search, from, to]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const markRelisted = async (id: number) => {
    if (!confirm("Mark this app as re-listed and clear delisted_at?")) return;
    setActing(id);
    try {
      const res = await fetchWithAuth(
        `/api/system-admin/apps/${id}/mark-relisted`,
        { method: "POST" }
      );
      if (res.ok) {
        setApps((prev) => prev.filter((a) => a.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        alert("Failed to mark as re-listed");
      }
    } finally {
      setActing(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delisted Apps"
        description="Apps that returned HTTP 404 during the last scrape — likely removed from the marketplace."
        icon={Ghost}
        breadcrumbs={[
          { label: "System Admin", href: "/system-admin" },
          { label: "Delisted Apps" },
        ]}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Platform</label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={platform}
            onChange={(e) => {
              setPage(1);
              setPlatform(e.target.value);
            }}
          >
            <option value="">All platforms</option>
            {PLATFORM_IDS.map((id) => (
              <option key={id} value={id}>
                {PLATFORMS[id].name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input
            value={search}
            placeholder="name or slug"
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="h-9 w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="h-9 w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            className="h-9 w-40"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>App</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Delisted</TableHead>
            <TableHead>Last Snapshot</TableHead>
            <TableHead className="text-right">Snapshots</TableHead>
            <TableHead className="w-40"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : apps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                No delisted apps match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            apps.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {a.icon_url ? (
                    <Image
                      src={a.icon_url}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded"
                      unoptimized
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted" />
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/apps/${a.slug}`}
                    className="font-medium hover:underline"
                  >
                    {a.name}
                  </Link>
                  <div className="text-xs font-mono text-muted-foreground">
                    {a.slug}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{PLATFORMS[a.platform]?.name ?? a.platform}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{timeAgo(a.delisted_at)}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.delisted_at).toLocaleString()}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.last_snapshot_at ? timeAgo(a.last_snapshot_at) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {a.total_snapshots}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === a.id}
                    onClick={() => markRelisted(a.id)}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Mark re-listed
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
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
              disabled={page >= totalPages}
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
