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
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  Save,
  RotateCcw,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { VariablePicker, TemplatePreview } from "@/components/template-editor";

// ─── Types & helpers ───────────────────────────────────────────────────────

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

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function NotificationTemplatesPage() {
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Notification Templates</h1>
      </div>

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
    </div>
  );
}
