"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Send } from "lucide-react";
import { useFormatDate } from "@/lib/format-date";

type SortKey = "name" | "members" | "apps" | "keywords" | "status" | "createdAt";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "active" | "suspended";

export default function AccountsListPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sendingDigest, setSendingDigest] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    const res = await fetchWithAuth("/api/system-admin/accounts");
    if (res.ok) setAccounts(await res.json());
  }

  async function sendDigest(accountId: string, accountName: string) {
    setSendingDigest(accountId);
    setMessage("");
    try {
      const res = await fetchWithAuth(`/api/system-admin/accounts/${accountId}/send-digest`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(data.message);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Failed to send digest");
      }
    } catch {
      setMessage("Failed to send digest");
    } finally {
      setSendingDigest(null);
    }
  }

  async function updateAccount(id: string, updates: any) {
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setMessage("Account updated");
      loadAccounts();
    }
  }

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

  const filtered = useMemo(() => {
    let result = accounts;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.company || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter === "active") {
      result = result.filter((a) => !a.isSuspended);
    } else if (statusFilter === "suspended") {
      result = result.filter((a) => a.isSuspended);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "members":
          cmp = (a.usage?.members ?? 0) - (b.usage?.members ?? 0);
          break;
        case "apps":
          cmp = (a.usage?.trackedApps ?? 0) - (b.usage?.trackedApps ?? 0);
          break;
        case "keywords":
          cmp = (a.usage?.trackedKeywords ?? 0) - (b.usage?.trackedKeywords ?? 0);
          break;
        case "status":
          cmp = (a.isSuspended ? 1 : 0) - (b.isSuspended ? 1 : 0);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [accounts, search, statusFilter, sortKey, sortDir]);

  const statusCounts = useMemo(() => {
    const base = search.trim()
      ? accounts.filter((a) => {
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q) || (a.company || "").toLowerCase().includes(q);
        })
      : accounts;
    return {
      all: base.length,
      active: base.filter((a) => !a.isSuspended).length,
      suspended: base.filter((a) => a.isSuspended).length,
    };
  }, [accounts, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Accounts"}
        </p>
        <h1 className="text-2xl font-bold">
          Accounts ({filtered.length})
        </h1>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts or company..."
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
              ["suspended", "Suspended"],
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
                  onClick={() => toggleSort("name")}
                >
                  Account <SortIcon col="name" />
                </TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Company</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("members")}
                >
                  Members <SortIcon col="members" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("apps")}
                >
                  Apps <SortIcon col="apps" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("keywords")}
                >
                  Keywords <SortIcon col="keywords" />
                </TableHead>
                <TableHead>Competitors</TableHead>
                <TableHead>Features</TableHead>
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
                <TableHead>Last Seen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((acc: any) => (
                <TableRow key={acc.id}>
                  <TableCell>
                    <Link
                      href={`/system-admin/accounts/${acc.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {acc.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {acc.packageName ? (
                      <Badge variant="outline" className="font-normal">
                        {acc.packageName}
                        {acc.hasLimitOverrides && (
                          <span className="ml-0.5 text-amber-500" title="Custom limit overrides">*</span>
                        )}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">{"\u2014"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {acc.company || "\u2014"}
                  </TableCell>
                  <TableCell>{acc.usage?.members ?? "-"}</TableCell>
                  <TableCell>
                    {acc.usage?.trackedApps ?? 0}/{acc.maxTrackedApps}
                  </TableCell>
                  <TableCell>
                    {acc.usage?.trackedKeywords ?? 0}/
                    {acc.maxTrackedKeywords}
                  </TableCell>
                  <TableCell>
                    {acc.usage?.competitorApps ?? 0}/
                    {acc.maxCompetitorApps}
                  </TableCell>
                  <TableCell>
                    {acc.usage?.trackedFeatures ?? 0}/
                    {acc.maxTrackedFeatures}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={acc.isSuspended ? "destructive" : "default"}
                    >
                      {acc.isSuspended ? "Suspended" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {acc.createdAt ? formatDateTime(acc.createdAt) : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {acc.lastSeen ? formatDateTime(acc.lastSeen) : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={sendingDigest === acc.id}
                        onClick={() => sendDigest(acc.id, acc.name)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateAccount(acc.id, {
                            isSuspended: !acc.isSuspended,
                          })
                        }
                      >
                        {acc.isSuspended ? "Activate" : "Suspend"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-muted-foreground"
                  >
                    No accounts found
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
