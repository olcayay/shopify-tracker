"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { ArrowLeft, Send, Lock } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, PriorityBadge, TypeBadge } from "@/components/support/ticket-badges";

interface TicketDetail {
  id: string;
  ticketNumber: number;
  type: string;
  subject: string;
  status: string;
  priority: string;
  lastMessageAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
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
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { fetchWithAuth, user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTicket = useCallback(async () => {
    const res = await fetchWithAuth(`/api/support-tickets/${ticketId}`);
    if (res.ok) {
      const data = await res.json();
      setTicket(data.ticket);
      setMessages(data.messages);
    }
    setLoading(false);
  }, [fetchWithAuth, ticketId]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setSubmitting(true);
    const res = await fetchWithAuth(`/api/support-tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: replyBody.trim() }),
    });

    if (res.ok) {
      setReplyBody("");
      await loadTicket();
      toast.success("Reply sent");
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to send reply");
    }
    setSubmitting(false);
  }

  async function handleClose() {
    const res = await fetchWithAuth(`/api/support-tickets/${ticketId}/close`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Ticket closed");
      await loadTicket();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to close ticket");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ticket not found</p>
        <Link href="/support">
          <Button variant="outline" className="mt-4">Back to Support</Button>
        </Link>
      </div>
    );
  }

  const isClosed = ticket.status === "closed";
  const canClose = (user?.role === "owner" || user?.role === "editor") && !isClosed;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link href="/support">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{ticket.subject}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">#{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <TypeBadge type={ticket.type} />
              <span className="text-xs text-muted-foreground">
                Created {formatDate(ticket.createdAt)}
              </span>
            </div>
          </div>
        </div>
        {canClose && (
          <Button variant="outline" size="sm" onClick={handleClose}>
            <Lock className="h-3.5 w-3.5 mr-1" />
            Close Ticket
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.map((msg) => {
          const isSystem = msg.isSystemMessage;
          const isCurrentUser = msg.userId === user?.id;

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {msg.body} &middot; {formatDate(msg.createdAt)}
                </span>
              </div>
            );
          }

          return (
            <Card key={msg.id} className={isCurrentUser ? "ml-8" : "mr-8"}>
              <CardHeader className="py-2 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {msg.userName || msg.userEmail || "Unknown"}
                    </span>
                    {!isCurrentUser && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                        Support
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
      {!isClosed ? (
        <form onSubmit={handleReply} className="space-y-3">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write your reply..."
            rows={4}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !replyBody.trim()}>
              <Send className="h-4 w-4 mr-1" />
              {submitting ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 text-sm text-muted-foreground border rounded-md bg-muted/30">
          <Lock className="h-4 w-4 inline-block mr-1" />
          This ticket is closed. No further replies can be sent.
        </div>
      )}
    </div>
  );
}
