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
  Mail,
  Send,
  Users,
  Loader2,
  Plus,
  Clock,
  Trash2,
  ArrowLeft,
  Eye,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalProspects: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  createdAt: string;
  config?: {
    subject?: string;
    htmlBody?: string;
    audience?: string;
    scheduledAt?: string;
    useLocalTime?: boolean;
    localTimeHour?: number;
  };
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

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  cancelled: "destructive",
};

// ─── Component ───────────────────────────────────────────────────────

export default function EmailCampaignDashboard() {
  const { fetchWithAuth } = useAuth();

  // List state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [scheduledAt, setScheduledAt] = useState("");
  const [useLocalTime, setUseLocalTime] = useState(false);
  const [localTimeHour, setLocalTimeHour] = useState(9);
  const [creating, setCreating] = useState(false);

  // Preview
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ─── Load campaigns ─────────────────────────────────────────────

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/email/campaigns?limit=50");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // ─── Preview audience ───────────────────────────────────────────

  const previewAudience = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/email/campaigns/preview-audience", {
        method: "POST",
        body: JSON.stringify({ audience }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewCount(data.recipientCount);
      }
    } catch {
      toast.error("Failed to preview audience");
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─── Create campaign ───────────────────────────────────────────

  const createCampaign = async () => {
    if (!name.trim() || !subject.trim() || !htmlBody.trim()) {
      toast.error("Name, subject, and body are required");
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        subject: subject.trim(),
        htmlBody: htmlBody.trim(),
        audience,
      };
      if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();
      if (useLocalTime) {
        payload.useLocalTime = true;
        payload.localTimeHour = localTimeHour;
      }

      const res = await fetchWithAuth("/api/system-admin/email/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Campaign created as draft");
        setName("");
        setSubject("");
        setHtmlBody("");
        setScheduledAt("");
        setPreviewCount(null);
        setShowForm(false);
        loadCampaigns();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to create campaign");
      }
    } catch {
      toast.error("Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  // ─── Send campaign ────────────────────────────────────────────

  const sendCampaign = async (id: string) => {
    const res = await fetchWithAuth(`/api/system-admin/email/campaigns/${id}/send`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Enqueued ${data.enqueued} emails`);
      loadCampaigns();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to send campaign");
    }
  };

  // ─── Delete campaign ──────────────────────────────────────────

  const deleteCampaign = async (id: string) => {
    const res = await fetchWithAuth(`/api/system-admin/email/campaigns/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Campaign deleted");
      loadCampaigns();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Failed to delete campaign");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/system-admin/emails">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Mail className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">Email Campaigns</h1>
            <p className="text-sm text-muted-foreground">Create and manage email campaigns</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold">New Email Campaign</h2>

            <div>
              <label className="text-sm font-medium">Campaign Name</label>
              <Input placeholder="e.g. March Newsletter" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium">Subject Line</label>
              <Input placeholder="Email subject..." value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium">HTML Body</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder="<h1>Hello {{name}}</h1>..."
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
              />
            </div>

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
                <label className="text-sm font-medium">Schedule (optional)</label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>

              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={useLocalTime} onChange={(e) => setUseLocalTime(e.target.checked)} className="rounded" />
                  Recipient&apos;s local time
                </label>
                {useLocalTime && (
                  <Input type="number" min={0} max={23} value={localTimeHour} onChange={(e) => setLocalTimeHour(parseInt(e.target.value) || 9)} className="w-20" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={previewAudience} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                Preview Audience
              </Button>

              {previewCount !== null && (
                <span className="text-sm text-muted-foreground">
                  {previewCount.toLocaleString()} recipients
                </span>
              )}

              <div className="flex-1" />

              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={createCampaign} disabled={creating || !name.trim() || !subject.trim() || !htmlBody.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign List */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Campaigns</h2>
            <Button variant="outline" size="sm" onClick={loadCampaigns} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Opens</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No campaigns yet
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={(STATUS_COLORS[c.status] as any) || "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.totalProspects}</TableCell>
                    <TableCell>{c.sentCount}</TableCell>
                    <TableCell>{c.openCount}</TableCell>
                    <TableCell>{c.clickCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.status === "draft" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => sendCampaign(c.id)}
                              title="Send campaign"
                            >
                              <Play className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => deleteCampaign(c.id)}
                              title="Delete draft"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
