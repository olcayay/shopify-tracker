"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  MousePointerClick,
  AlertTriangle,
  Clock,
  Check,
  Search,
} from "lucide-react";

// ─── Types & helpers ───────────────────────────────────────────────────────

interface NotificationStats {
  total: number;
  readCount: number;
  readRate: number;
  pushSent: number;
  pushClicked: number;
  pushClickRate: number;
  failed: number;
  last24h: number;
  last7d: number;
}

interface NotificationRow {
  id: string;
  type: string;
  category: string;
  userId: string;
  title: string;
  isRead: boolean;
  pushSent: boolean;
  pushClicked: boolean;
  priority: string;
  createdAt: string;
}

function getCategoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function formatTypeName(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AdminNotificationDashboard() {
  const { fetchWithAuth } = useAuth();
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 20;

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/api/system-admin/notifications/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, [fetchWithAuth]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetchWithAuth(`/api/system-admin/notifications?${params}`);
      if (res.ok) {
        const body = await res.json();
        setNotifications(body.notifications);
        setTotal(body.total);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, search, typeFilter, statusFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Notification Management</h1>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Bell, color: "text-blue-600" },
            { label: "Read Rate", value: `${stats.readRate}%`, icon: Eye, color: "text-green-600" },
            { label: "Push Sent", value: stats.pushSent, icon: Send, color: "text-purple-600" },
            { label: "Push Click Rate", value: `${stats.pushClickRate}%`, icon: MousePointerClick, color: "text-indigo-600" },
            { label: "Failed", value: stats.failed, icon: AlertTriangle, color: "text-red-600" },
            { label: "Last 24h", value: stats.last24h, icon: Clock, color: "text-amber-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3 px-4 flex flex-col items-center gap-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-2xl font-bold">{value}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">All Status</option>
          <option value="read">Read</option>
          <option value="unread">Unread</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => { loadStats(); loadNotifications(); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Notification table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[90px]">ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Push</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No notifications found.
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((n) => (
                <TableRow key={n.id}>
                  <TableCell
                    className="text-xs font-mono text-muted-foreground cursor-pointer hover:text-foreground"
                    title={`Click to copy: ${n.id}`}
                    onClick={() => navigator.clipboard.writeText(n.id)}
                  >
                    {n.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-xs">{formatTypeName(n.type)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {getCategoryLabel(n.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{n.title}</TableCell>
                  <TableCell>
                    {n.isRead ? (
                      <Badge variant="secondary" className="text-[10px]">Read</Badge>
                    ) : (
                      <Badge variant="default" className="text-[10px]">Unread</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {n.pushSent && <Send className="h-3 w-3 text-muted-foreground" />}
                      {n.pushClicked && <Check className="h-3 w-3 text-green-600" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({total} notifications)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
