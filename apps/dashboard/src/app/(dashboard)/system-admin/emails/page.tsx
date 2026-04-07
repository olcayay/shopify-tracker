"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Send,
  Eye,
  MousePointer,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  X,
  ListOrdered,
} from "lucide-react";

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  sent24h: number;
  sent7d: number;
  openRate: number;
  clickRate: number;
}

interface EmailLog {
  id: string;
  emailType: string;
  recipientEmail: string;
  subject: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

interface EmailDetail extends EmailLog {
  htmlBody: string | null;
  messageId: string | null;
  dataSnapshot: unknown;
}

export default function AdminEmailDashboard() {
  const { fetchWithAuth } = useAuth();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const LIMIT = 20;

  // Detail panel state
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<"details" | "preview">("details");

  const loadStats = useCallback(async () => {
    const res = await fetchWithAuth("/api/system-admin/emails/stats");
    if (res.ok) setStats(await res.json());
  }, [fetchWithAuth]);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(page * LIMIT) });
    if (search) params.set("recipient", search);
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetchWithAuth(`/api/system-admin/emails?${params}`);
    if (res.ok) {
      const data = await res.json();
      setEmails(data.emails || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [fetchWithAuth, page, search, typeFilter, statusFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadEmails(); }, [loadEmails]);

  // Load email detail on click
  const handleRowClick = useCallback(async (emailId: string) => {
    if (emailId === selectedEmailId) {
      setSelectedEmailId(null);
      setSelectedEmail(null);
      return;
    }
    setSelectedEmailId(emailId);
    setLoadingDetail(true);
    setDetailTab("details");
    try {
      const res = await fetchWithAuth(`/api/system-admin/emails/${emailId}`);
      if (res.ok) {
        setSelectedEmail(await res.json());
      }
    } finally {
      setLoadingDetail(false);
    }
  }, [fetchWithAuth, selectedEmailId]);

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      sent: "default",
      queued: "secondary",
      pending: "secondary",
      failed: "destructive",
      bounced: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" /> Email Management
        </h1>
        <div className="flex items-center gap-2">
          <Link href="/system-admin/queues/email-instant">
            <Button variant="outline" size="sm">
              <ListOrdered className="h-4 w-4 mr-1" /> Email Queue
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => { loadStats(); loadEmails(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Send className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">Total Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Eye className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold">{stats.openRate}%</p>
              <p className="text-xs text-muted-foreground">Open Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <MousePointer className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <p className="text-2xl font-bold">{stats.clickRate}%</p>
              <p className="text-xs text-muted-foreground">Click Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto text-red-500 mb-1" />
              <p className="text-2xl font-bold">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Mail className="h-5 w-5 mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold">{stats.sent24h}</p>
              <p className="text-xs text-muted-foreground">Last 24h</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          <option value="email_daily_digest">Daily Digest</option>
          <option value="email_weekly_summary">Weekly Summary</option>
          <option value="email_ranking_alert">Ranking Alert</option>
          <option value="email_competitor_alert">Competitor Alert</option>
          <option value="email_review_alert">Review Alert</option>
          <option value="email_win_celebration">Win Celebration</option>
          <option value="welcome">Welcome</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
          <option value="pending">Pending</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      {/* Email Table + Detail Panel */}
      <div className={`grid gap-4 ${selectedEmailId ? "lg:grid-cols-5" : "grid-cols-1"}`}>
        <Card className={selectedEmailId ? "lg:col-span-3" : ""}>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Opened</TableHead>
                      <TableHead>Clicked</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No emails found
                        </TableCell>
                      </TableRow>
                    ) : (
                      emails.map((e) => (
                        <TableRow
                          key={e.id}
                          className={`cursor-pointer hover:bg-muted/50 ${selectedEmailId === e.id ? "bg-muted" : ""}`}
                          onClick={() => handleRowClick(e.id)}
                        >
                          <TableCell className="text-xs font-mono">{e.emailType.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-sm truncate max-w-[160px]">{e.recipientEmail}</TableCell>
                          <TableCell className="text-sm truncate max-w-[200px]">{e.subject}</TableCell>
                          <TableCell>{statusBadge(e.status)}</TableCell>
                          <TableCell>{e.openedAt ? <Eye className="h-4 w-4 text-green-500" /> : "—"}</TableCell>
                          <TableCell>{e.clickedAt ? <MousePointer className="h-4 w-4 text-purple-500" /> : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(e.sentAt || e.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    {total} total &middot; Page {page + 1} of {Math.max(1, Math.ceil(total / LIMIT))}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Panel */}
        {selectedEmailId && (
          <EmailDetailPanel
            email={selectedEmail}
            loading={loadingDetail}
            detailTab={detailTab}
            onTabChange={setDetailTab}
            onClose={() => { setSelectedEmailId(null); setSelectedEmail(null); }}
          />
        )}
      </div>
    </div>
  );
}

function EmailDetailPanel({
  email,
  loading,
  detailTab,
  onTabChange,
  onClose,
}: {
  email: EmailDetail | null;
  loading: boolean;
  detailTab: "details" | "preview";
  onTabChange: (tab: "details" | "preview") => void;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="lg:col-span-2 border rounded-lg p-4 min-h-[400px] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="lg:col-span-2 border rounded-lg p-4 min-h-[400px] flex items-center justify-center text-muted-foreground text-sm">
        Click an email to see details
      </div>
    );
  }

  const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    sent: "default",
    queued: "secondary",
    pending: "secondary",
    failed: "destructive",
    bounced: "destructive",
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="lg:col-span-2 border rounded-lg min-h-[400px] max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold truncate max-w-[200px]">{email.subject || "No subject"}</h3>
          <Badge variant={statusVariants[email.status] || "outline"}>{email.status}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange("details")}
            className={`px-2 py-1 text-xs rounded ${detailTab === "details" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Details
          </button>
          {email.htmlBody && (
            <button
              onClick={() => onTabChange("preview")}
              className={`px-2 py-1 text-xs rounded ${detailTab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Preview
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-2 p-1 text-muted-foreground hover:text-foreground rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {detailTab === "preview" && email.htmlBody ? (
          <div className="space-y-3">
            <div className="text-xs">
              <span className="text-muted-foreground">Subject:</span>{" "}
              <span className="font-medium">{email.subject}</span>
            </div>
            <iframe
              srcDoc={email.htmlBody}
              className="w-full border rounded-md bg-white dark:bg-white"
              style={{ minHeight: 500 }}
              sandbox="allow-same-origin"
              title="Email preview"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Type:</span> <span className="font-mono">{email.emailType}</span></div>
              <div><span className="text-muted-foreground">Recipient:</span> <span className="font-medium">{email.recipientEmail}</span></div>
              <div><span className="text-muted-foreground">Subject:</span> <span className="font-medium">{email.subject}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusVariants[email.status] || "outline"} className="text-[10px]">{email.status}</Badge></div>
              <div><span className="text-muted-foreground">Sent:</span> {formatDate(email.sentAt)}</div>
              <div><span className="text-muted-foreground">Created:</span> {formatDate(email.createdAt)}</div>
              {email.openedAt && <div><span className="text-muted-foreground">Opened:</span> {formatDate(email.openedAt)}</div>}
              {email.clickedAt && <div><span className="text-muted-foreground">Clicked:</span> {formatDate(email.clickedAt)}</div>}
              {email.messageId && <div className="col-span-2"><span className="text-muted-foreground">Message ID:</span> <span className="font-mono text-[10px] break-all">{email.messageId}</span></div>}
            </div>

            {email.errorMessage && (
              <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
                <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">{email.errorMessage}</p>
              </div>
            )}

            {email.dataSnapshot != null && (
              <div>
                <p className="text-xs font-medium mb-1">Data Snapshot</p>
                <pre className="text-[10px] font-mono bg-muted p-3 rounded-md overflow-x-auto max-h-60 overflow-y-auto">
                  {JSON.stringify(email.dataSnapshot, null, 2)}
                </pre>
              </div>
            )}

            {!email.htmlBody && (
              <div className="text-xs text-muted-foreground italic">
                No HTML body stored for this email.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
