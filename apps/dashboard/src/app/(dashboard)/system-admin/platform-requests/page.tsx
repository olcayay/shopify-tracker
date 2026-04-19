"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  CheckCircle,
  XCircle,
  Undo2,
} from "lucide-react";
import { ExternalLink } from "@/components/ui/external-link";
import { useFormatDate } from "@/lib/format-date";

interface PlatformRequest {
  id: string;
  platformName: string;
  marketplaceUrl: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  accountName: string | null;
  userName: string | null;
  userEmail: string | null;
}

type SortKey = "platformName" | "accountName" | "status" | "createdAt";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

export default function PlatformRequestsPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const res = await fetchWithAuth("/api/system-admin/platform-requests");
    if (res.ok) setRequests(await res.json());
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    setMessage("");
    try {
      const res = await fetchWithAuth(`/api/system-admin/platform-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setMessage(`Request ${status}`);
        loadRequests();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Failed to update");
      }
    } catch {
      setMessage("Failed to update");
    } finally {
      setUpdatingId(null);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
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
    let result = requests;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.platformName.toLowerCase().includes(q) ||
          (r.accountName || "").toLowerCase().includes(q) ||
          (r.userName || "").toLowerCase().includes(q) ||
          (r.userEmail || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "platformName":
          cmp = a.platformName.localeCompare(b.platformName);
          break;
        case "accountName":
          cmp = (a.accountName || "").localeCompare(b.accountName || "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [requests, search, statusFilter, sortKey, sortDir]);

  const statusCounts = useMemo(() => {
    const base = search.trim()
      ? requests.filter((r) => {
          const q = search.toLowerCase();
          return (
            r.platformName.toLowerCase().includes(q) ||
            (r.accountName || "").toLowerCase().includes(q) ||
            (r.userName || "").toLowerCase().includes(q) ||
            (r.userEmail || "").toLowerCase().includes(q)
          );
        })
      : requests;
    return {
      all: base.length,
      pending: base.filter((r) => r.status === "pending").length,
      approved: base.filter((r) => r.status === "approved").length,
      rejected: base.filter((r) => r.status === "rejected").length,
    };
  }, [requests, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Platform Requests"}
        </p>
        <h1 className="text-2xl font-bold">
          Platform Requests ({filtered.length})
        </h1>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search platform, account, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["all", "All"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
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
                  onClick={() => toggleSort("platformName")}
                >
                  Platform <SortIcon col="platformName" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("accountName")}
                >
                  Account <SortIcon col="accountName" />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon col="status" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("createdAt")}
                >
                  Created <SortIcon col="createdAt" />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">
                    {req.platformName}
                  </TableCell>
                  <TableCell className="text-sm">
                    {req.accountName || "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{req.userName || "\u2014"}</div>
                    {req.userEmail && (
                      <div className="text-muted-foreground text-xs">
                        {req.userEmail}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {req.marketplaceUrl ? (
                      <ExternalLink
                        href={req.marketplaceUrl}
                        iconSize="sm"
                        className="text-primary text-sm"
                      >
                        Link
                      </ExternalLink>
                    ) : (
                      <span className="text-muted-foreground text-sm">{"\u2014"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {req.notes || "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[req.status] || "outline"}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(req.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {req.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                            disabled={updatingId === req.id}
                            onClick={() => updateStatus(req.id, "approved")}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            disabled={updatingId === req.id}
                            onClick={() => updateStatus(req.id, "rejected")}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(req.status === "approved" || req.status === "rejected") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={updatingId === req.id}
                          onClick={() => updateStatus(req.id, "pending")}
                          title="Revert to pending"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No platform requests found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
