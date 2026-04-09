"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LifeBuoy, Plus, ChevronRight } from "lucide-react";
import { StatusBadge, PriorityBadge, TypeBadge } from "@/components/support/ticket-badges";

interface Ticket {
  id: string;
  ticketNumber: number;
  type: string;
  subject: string;
  status: string;
  priority: string;
  lastMessageAt: string | null;
  createdAt: string;
  createdByName: string | null;
  createdByEmail: string | null;
}

function timeAgo(date: string | null): string {
  if (!date) return "\u2014";
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const STATUS_TABS = ["all", "open", "awaiting_reply", "in_progress", "resolved", "closed"];
const STATUS_TAB_LABELS: Record<string, string> = {
  all: "All",
  open: "Open",
  awaiting_reply: "Awaiting Reply",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function SupportPage() {
  const { fetchWithAuth } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadTickets = useCallback(async (cursor?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "25" });
    if (activeTab !== "all") params.set("status", activeTab);
    if (cursor) params.set("cursor", cursor);

    const res = await fetchWithAuth(`/api/support-tickets?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (cursor) {
        setTickets((prev) => [...prev, ...data.items]);
      } else {
        setTickets(data.items);
      }
      setNextCursor(data.nextCursor);
    }
    setLoading(false);
  }, [fetchWithAuth, activeTab]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-6 w-6" />
            Support
          </h1>
          <p className="text-sm text-muted-foreground">View and manage your support tickets</p>
        </div>
        <Link href="/support/new">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New Ticket
          </Button>
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setNextCursor(null); }}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {STATUS_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {!loading && tickets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <LifeBuoy className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No tickets yet</p>
          <p className="text-sm mt-1">Create a new ticket to get help from our team.</p>
          <Link href="/support/new">
            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-1" />
              Create Ticket
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-24 text-right">Last Activity</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} className="group">
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    #{ticket.ticketNumber}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/support/${ticket.id}`}
                      className="font-medium hover:underline text-sm"
                    >
                      {ticket.subject}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PriorityBadge priority={ticket.priority} />
                      <span className="text-[10px] text-muted-foreground">
                        by {ticket.createdByName || ticket.createdByEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={ticket.type} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {timeAgo(ticket.lastMessageAt || ticket.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/support/${ticket.id}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTickets(nextCursor)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
