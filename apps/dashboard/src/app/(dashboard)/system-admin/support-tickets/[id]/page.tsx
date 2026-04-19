"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { ArrowLeft, Send, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, PriorityBadge, TypeBadge, STATUS_LABELS } from "@/components/support/ticket-badges";
import { cn } from "@/lib/utils";

interface TicketDetail {
  id: string;
  ticketNumber: number;
  accountId: string;
  type: string;
  subject: string;
  status: string;
  priority: string;
  assignedAdminId: string | null;
  lastMessageAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  accountName: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
}

interface Message {
  id: string;
  body: string;
  isInternalNote: boolean;
  isSystemMessage: boolean;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  userId: string;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminTicketDetailPage() {
  const { id: ticketId } = useParams<{ id: string }>();
  const { fetchWithAuth, user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTicket = useCallback(async () => {
    const res = await fetchWithAuth(`/api/system-admin/support-tickets/${ticketId}`);
    if (res.ok) {
      const data = await res.json();
      setTicket(data.ticket);
      setMessages(data.messages);
    }
    setLoading(false);
  }, [fetchWithAuth, ticketId]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);

    const res = await fetchWithAuth(`/api/system-admin/support-tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: replyBody.trim(), isInternalNote }),
    });

    if (res.ok) {
      setReplyBody("");
      await loadTicket();
      toast.success(isInternalNote ? "Internal note added" : "Reply sent");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to send");
    }
    setSubmitting(false);
  }

  async function handleStatusChange(status: string) {
    const res = await fetchWithAuth(`/api/system-admin/support-tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Status changed to ${STATUS_LABELS[status] || status}`);
      await loadTicket();
    }
  }

  async function handlePriorityChange(priority: string) {
    const res = await fetchWithAuth(`/api/system-admin/support-tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ priority }),
    });
    if (res.ok) {
      toast.success(`Priority changed to ${priority}`);
      await loadTicket();
    }
  }

  if (loading) {
    return <div className="h-32 bg-muted animate-pulse rounded" />;
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found</p>
        <Link href="/system-admin/support-tickets">
          <Button variant="outline" className="mt-4">Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/system-admin/support-tickets">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">#{ticket.ticketNumber}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <TypeBadge type={ticket.type} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>Account: {ticket.accountName || "\u2014"}</span>
            <span>&middot;</span>
            <span>By: {ticket.createdByName || ticket.createdByEmail}</span>
            <span>&middot;</span>
            <span>Created: {formatDate(ticket.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Status/Priority controls */}
      <div className="flex gap-3 items-center">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Status</label>
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs bg-background"
          >
            <option value="open">Open</option>
            <option value="awaiting_reply">Awaiting Reply</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Priority</label>
          <select
            value={ticket.priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="border rounded-md px-2 py-1 text-xs bg-background"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {messages.map((msg) => {
          if (msg.isSystemMessage) {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {msg.body} &middot; {formatDate(msg.createdAt)}
                </span>
              </div>
            );
          }

          const isAdmin = msg.userId === user?.id;

          return (
            <Card
              key={msg.id}
              className={cn(
                msg.isInternalNote && "border-yellow-300 bg-yellow-50/50 dark:border-yellow-700 dark:bg-yellow-900/10"
              )}
            >
              <CardHeader className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {msg.userName || msg.userEmail}
                    </span>
                    {msg.isInternalNote && (
                      <span className="text-[10px] bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                        <StickyNote className="h-2.5 w-2.5" />
                        Internal Note
                      </span>
                    )}
                    {isAdmin && !msg.isInternalNote && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reply form */}
      <form onSubmit={handleReply} className="space-y-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={!isInternalNote ? "default" : "outline"}
            size="sm"
            onClick={() => setIsInternalNote(false)}
          >
            Reply to Customer
          </Button>
          <Button
            type="button"
            variant={isInternalNote ? "default" : "outline"}
            size="sm"
            onClick={() => setIsInternalNote(true)}
            className={isInternalNote ? "bg-yellow-500 hover:bg-yellow-600" : ""}
          >
            <StickyNote className="h-3.5 w-3.5 mr-1" />
            Internal Note
          </Button>
        </div>
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder={isInternalNote ? "Write an internal note (not visible to customer)..." : "Write your reply..."}
          rows={4}
          className={cn(
            "w-full border rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[80px]",
            isInternalNote && "border-yellow-300 bg-yellow-50/30 dark:border-yellow-700 dark:bg-yellow-900/10"
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || !replyBody.trim()}>
            <Send className="h-4 w-4 mr-1" />
            {submitting ? "Sending..." : isInternalNote ? "Add Note" : "Send Reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
