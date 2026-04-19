"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
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
  Megaphone,
  Send,
  Users,
  Loader2,
  Eye,
  Check,
  Clock,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Link from "@/components/ui/link";

// ─── Types ───────────────────────────────────────────────────────────

interface BroadcastRow {
  batch_id: string;
  title: string;
  body: string;
  category: string;
  recipient_count: number;
  read_count: number;
  created_at: string;
}

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All active users" },
  { value: "active_last_7d", label: "Active in last 7 days" },
  { value: "active_last_30d", label: "Active in last 30 days" },
  { value: "platform:shopify", label: "Shopify users" },
  { value: "platform:salesforce", label: "Salesforce users" },
  { value: "platform:atlassian", label: "Atlassian users" },
  { value: "platform:wix", label: "Wix users" },
  { value: "platform:wordpress", label: "WordPress users" },
  { value: "platform:canva", label: "Canva users" },
  { value: "platform:google_workspace", label: "Google Workspace users" },
  { value: "platform:zoom", label: "Zoom users" },
  { value: "platform:zoho", label: "Zoho users" },
  { value: "platform:zendesk", label: "Zendesk users" },
  { value: "platform:hubspot", label: "HubSpot users" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ─── Component ───────────────────────────────────────────────────────

export default function NotificationBroadcastPage() {
  const { fetchWithAuth } = useAuth();

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState("all");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("system");
  const [scheduledAt, setScheduledAt] = useState("");
  const [useLocalTime, setUseLocalTime] = useState(false);
  const [localTimeHour, setLocalTimeHour] = useState(9);

  // Preview state
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);

  // History state
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Load broadcast history ─────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/notifications/broadcasts?limit=20");
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ─── Preview audience ───────────────────────────────────────────

  const previewAudience = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/notifications/broadcast/preview", {
        method: "POST",
        body: JSON.stringify({ audience }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewCount(data.recipientCount);
      } else {
        toast.error("Failed to preview audience");
      }
    } catch {
      toast.error("Failed to preview audience");
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─── Send broadcast ────────────────────────────────────────────

  const sendBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }

    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body: body.trim(),
        audience,
        priority,
        category,
      };
      if (url.trim()) payload.url = url.trim();
      if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();
      if (useLocalTime) {
        payload.useLocalTime = true;
        payload.localTimeHour = localTimeHour;
      }

      const res = await fetchWithAuth("/api/system-admin/notifications/broadcast", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.status === "scheduled" ? "Scheduled" : "Sent"} to ${data.inserted} users`);
        setTitle("");
        setBody("");
        setUrl("");
        setPreviewCount(null);
        setScheduledAt("");
        loadHistory();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to send broadcast");
      }
    } catch {
      toast.error("Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  // ─── Cancel broadcast ──────────────────────────────────────────

  const cancelBroadcast = async (batchId: string) => {
    const res = await fetchWithAuth(`/api/system-admin/notifications/broadcast/${encodeURIComponent(batchId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Cancelled: ${data.deleted} notifications removed`);
      loadHistory();
    } else {
      toast.error("Failed to cancel broadcast");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/system-admin/notifications">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Megaphone className="h-6 w-6 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold">Broadcast Notifications</h1>
          <p className="text-sm text-muted-foreground">Send notifications to targeted audiences</p>
        </div>
      </div>

      {/* Compose Form */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5" /> New Broadcast
          </h2>

          {/* Title */}
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Notification title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-sm font-medium">Body</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Notification body..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {/* URL */}
          <div>
            <label className="text-sm font-medium">URL (optional)</label>
            <Input
              placeholder="/overview or https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          {/* Audience + Priority row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Audience</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={audience}
                onChange={(e) => { setAudience(e.target.value); setPreviewCount(null); }}
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Priority</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="system">System</option>
                <option value="account">Account</option>
                <option value="ranking">Ranking</option>
              </select>
            </div>
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Schedule (optional)</label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLocalTime}
                  onChange={(e) => setUseLocalTime(e.target.checked)}
                  className="rounded"
                />
                Use recipient&apos;s local time
              </label>
            </div>

            {useLocalTime && (
              <div>
                <label className="text-sm font-medium">Deliver at hour</label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={localTimeHour}
                  onChange={(e) => setLocalTimeHour(parseInt(e.target.value) || 9)}
                />
              </div>
            )}
          </div>

          {/* Preview + Send */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={previewAudience} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
              Preview Audience
            </Button>

            {previewCount !== null && (
              <span className="text-sm text-muted-foreground">
                <Users className="h-4 w-4 inline mr-1" />
                {previewCount.toLocaleString()} recipients
              </span>
            )}

            <div className="flex-1" />

            <Button onClick={sendBroadcast} disabled={sending || !title.trim() || !body.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {scheduledAt || useLocalTime ? "Schedule Broadcast" : "Send Now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Broadcast History */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" /> Broadcast History
            </h2>
            <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}>
              {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Read</TableHead>
                <TableHead>Read Rate</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No broadcasts sent yet
                  </TableCell>
                </TableRow>
              ) : (
                broadcasts.map((b) => {
                  const readRate = b.recipient_count > 0
                    ? Math.round((b.read_count / b.recipient_count) * 100)
                    : 0;
                  return (
                    <TableRow key={b.batch_id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {b.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.category}</Badge>
                      </TableCell>
                      <TableCell>{b.recipient_count}</TableCell>
                      <TableCell>{b.read_count}</TableCell>
                      <TableCell>
                        <Badge variant={readRate > 50 ? "default" : "secondary"}>
                          {readRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(b.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => cancelBroadcast(b.batch_id)}
                          title="Cancel unread notifications"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
