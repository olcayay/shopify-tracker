"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  Eye,
  Pencil,
  X,
  Send,
  MousePointerClick,
  AlertTriangle,
  Clock,
  Check,
  Search,
} from "lucide-react";
import { VariablePicker, TemplatePreview } from "@/components/template-editor";

// ─── Shared types & helpers ─────────────────────────────────────────────────

interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

interface NotificationTemplate {
  notificationType: string;
  titleTemplate: string;
  bodyTemplate: string;
  isCustomized: boolean;
  variables: TemplateVariable[];
  updatedAt: string | null;
}

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

const CATEGORY_ORDER = ["ranking", "competitor", "review", "keyword", "featured", "system", "account"];

function getCategory(type: string): string {
  const prefix = type.split("_")[0];
  return CATEGORY_ORDER.includes(prefix) ? prefix : "other";
}

function getCategoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function formatTypeName(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderPreviewText(template: string, variables: TemplateVariable[]): string {
  let result = template;
  for (const v of variables) {
    result = result.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), v.example);
  }
  return result;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminNotificationDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Notification Management</h1>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <NotificationDashboardTab />
        </TabsContent>

        <TabsContent value="templates">
          <NotificationTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────

function NotificationDashboardTab() {
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
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No notifications found.
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((n) => (
                <TableRow key={n.id}>
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

// ─── Templates Tab ──────────────────────────────────────────────────────────

function NotificationTemplatesTab() {
  const { fetchWithAuth } = useAuth();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/templates/notifications");
      if (res.ok) {
        setTemplates(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function startEditing(t: NotificationTemplate) {
    setEditingType(t.notificationType);
    setEditTitle(t.titleTemplate);
    setEditBody(t.bodyTemplate);
  }

  function cancelEditing() {
    setEditingType(null);
    setEditTitle("");
    setEditBody("");
  }

  function insertVariable(name: string, _target: string) {
    setEditBody((prev) => prev + `{{${name}}}`);
  }

  async function saveTemplate() {
    if (!editingType) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/system-admin/templates/notifications/${editingType}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleTemplate: editTitle, bodyTemplate: editBody }),
      });
      if (res.ok) {
        await loadData();
        cancelEditing();
      }
    } finally {
      setSaving(false);
    }
  }

  async function resetTemplate(type: string) {
    const res = await fetchWithAuth(`/api/system-admin/templates/notifications/${type}/reset`, {
      method: "POST",
    });
    if (res.ok) {
      await loadData();
      if (editingType === type) cancelEditing();
    }
  }

  // Group templates by category
  const grouped = new Map<string, NotificationTemplate[]>();
  for (const t of templates) {
    const cat = getCategory(t.notificationType);
    const list = grouped.get(cat) || [];
    list.push(t);
    grouped.set(cat, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} notification types across {grouped.size} categories</p>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading && templates.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const catTemplates = grouped.get(cat);
            if (!catTemplates || catTemplates.length === 0) return null;
            const isCollapsed = collapsedCategories.has(cat);

            return (
              <Card key={cat}>
                <button
                  onClick={() => toggleCategory(cat)}
                  className="flex items-center gap-2 w-full p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  <span className="font-semibold">{getCategoryLabel(cat)}</span>
                  <Badge variant="secondary">{catTemplates.length}</Badge>
                </button>

                {!isCollapsed && (
                  <CardContent className="pt-0 space-y-3">
                    {catTemplates.map((t) => {
                      const isEditing = editingType === t.notificationType;
                      const previewTitle = isEditing
                        ? renderPreviewText(editTitle, t.variables)
                        : renderPreviewText(t.titleTemplate, t.variables);
                      const previewBody = isEditing
                        ? renderPreviewText(editBody, t.variables)
                        : renderPreviewText(t.bodyTemplate, t.variables);

                      return (
                        <div
                          key={t.notificationType}
                          className="border rounded-md p-3 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{formatTypeName(t.notificationType)}</span>
                              {t.isCustomized && (
                                <Badge variant="outline" className="text-[10px]">Customized</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {!isEditing ? (
                                <Button variant="ghost" size="sm" onClick={() => startEditing(t)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <>
                                  <Button variant="ghost" size="sm" onClick={cancelEditing}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => resetTemplate(t.notificationType)}>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="sm" onClick={saveTemplate} disabled={saving}>
                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                    <span className="ml-1">Save</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title Template</label>
                                <Input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  className="font-mono text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Body Template</label>
                                <Textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  className="font-mono text-sm"
                                  rows={3}
                                />
                              </div>
                              <VariablePicker
                                variables={t.variables}
                                onInsert={(name) => insertVariable(name, "body")}
                              />
                              <TemplatePreview title={previewTitle} body={previewBody} />
                            </div>
                          ) : (
                            <div className="text-sm">
                              <p className="font-medium">{previewTitle}</p>
                              <p className="text-muted-foreground">{previewBody}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
