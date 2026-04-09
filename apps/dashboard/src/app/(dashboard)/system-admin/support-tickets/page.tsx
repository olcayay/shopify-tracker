"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LifeBuoy, Search, ChevronRight, Inbox, Clock, MessageSquare, CheckCircle } from "lucide-react";
import { StatusBadge, PriorityBadge, TypeBadge } from "@/components/support/ticket-badges";

interface Ticket {
  id: string;
  ticketNumber: number;
  type: string;
  subject: string;
  status: string;
  priority: string;
  assignedAdminId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  accountName: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
}

interface Stats {
  open: number;
  awaitingReply: number;
  inProgress: number;
  resolved: number;
  closed: number;
  unassigned: number;
  total: number;
}

function timeAgo(date: string | null): string {
  if (!date) return "\u2014";
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function AdminSupportPage() {
  const { fetchWithAuth } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams({ limit: "25" });
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);

    const [ticketsRes, statsRes] = await Promise.all([
      fetchWithAuth(`/api/system-admin/support-tickets?${params}`),
      fetchWithAuth("/api/system-admin/support-tickets/stats"),
    ]);

    if (ticketsRes.ok) {
      const data = await ticketsRes.json();
      setTickets(data.items);
      setNextCursor(data.nextCursor);
    }
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }, [fetchWithAuth, statusFilter, typeFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <LifeBuoy className="h-6 w-6" />
        Support Tickets
      </h1>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="py-3 px-4 flex items-center gap-3">
            <Inbox className="h-5 w-5 text-blue-500" />
            <div><p className="text-2xl font-bold">{stats.open}</p><p className="text-xs text-muted-foreground">Open</p></div>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-500" />
            <div><p className="text-2xl font-bold">{stats.awaitingReply}</p><p className="text-xs text-muted-foreground">Awaiting Reply</p></div>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-purple-500" />
            <div><p className="text-2xl font-bold">{stats.inProgress}</p><p className="text-xs text-muted-foreground">In Progress</p></div>
          </CardContent></Card>
          <Card><CardContent className="py-3 px-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div><p className="text-2xl font-bold">{stats.unassigned}</p><p className="text-xs text-muted-foreground">Unassigned</p></div>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadData()}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background h-9"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="awaiting_reply">Awaiting Reply</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background h-9"
        >
          <option value="">All Types</option>
          <option value="bug_report">Bug Report</option>
          <option value="feature_request">Feature Request</option>
          <option value="general_inquiry">General Inquiry</option>
          <option value="billing_payments">Billing</option>
          <option value="account_access">Account Access</option>
          <option value="security_concern">Security</option>
        </select>
      </div>

      {/* Ticket table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-28">Account</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-20 text-right">Activity</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => (
                <TableRow key={t.id} className="group">
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    #{t.ticketNumber}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/system-admin/support-tickets/${t.id}`}
                      className="font-medium hover:underline text-sm"
                    >
                      {t.subject}
                    </Link>
                    <div className="flex items-center gap-1 mt-0.5">
                      <PriorityBadge priority={t.priority} />
                      <span className="text-[10px] text-muted-foreground">
                        {t.createdByName || t.createdByEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {t.accountName || "\u2014"}
                  </TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell><TypeBadge type={t.type} /></TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {timeAgo(t.lastMessageAt || t.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/system-admin/support-tickets/${t.id}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
