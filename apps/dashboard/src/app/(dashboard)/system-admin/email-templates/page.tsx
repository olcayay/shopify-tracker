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
  Mail,
  RefreshCw,
  Loader2,
  ChevronDown,
  Save,
  RotateCcw,
  Pencil,
  X,
} from "lucide-react";
import { VariablePicker, TemplatePreview } from "@/components/template-editor";

interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

interface EmailTemplate {
  emailType: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isCustomized: boolean;
  variables: TemplateVariable[];
  updatedAt: string | null;
}

const CATEGORY_ORDER = ["transactional", "alert", "digest", "lifecycle"];

function getCategory(type: string): string {
  if (["email_password_reset", "email_verification", "email_invitation", "email_login_alert", "email_2fa_code"].includes(type)) return "transactional";
  if (["email_ranking_alert", "email_competitor_alert", "email_review_alert", "email_win_celebration"].includes(type)) return "alert";
  if (["email_daily_digest", "email_weekly_summary"].includes(type)) return "digest";
  return "lifecycle"; // welcome, onboarding, re_engagement
}

function getCategoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    transactional: "Transactional",
    alert: "Alert Emails",
    digest: "Digest & Summary",
    lifecycle: "Lifecycle",
  };
  return labels[cat] || cat;
}

function formatTypeName(type: string): string {
  return type.replace(/^email_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderPreviewText(template: string, variables: TemplateVariable[]): string {
  let result = template;
  for (const v of variables) {
    result = result.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), v.example);
  }
  return result;
}

export default function AdminEmailTemplates() {
  const { fetchWithAuth } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/templates/emails");
      if (res.ok) setTemplates(await res.json());
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

  function startEditing(t: EmailTemplate) {
    setEditingType(t.emailType);
    setEditSubject(t.subjectTemplate);
    setEditBody(t.bodyTemplate);
  }

  function cancelEditing() {
    setEditingType(null);
    setEditSubject("");
    setEditBody("");
  }

  function insertVariable(varName: string, field: "subject" | "body") {
    const token = `{{${varName}}}`;
    if (field === "subject") {
      setEditSubject((prev) => prev + token);
    } else {
      setEditBody((prev) => prev + token);
    }
  }

  async function saveTemplate() {
    if (!editingType) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/system-admin/templates/emails/${editingType}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectTemplate: editSubject, bodyTemplate: editBody }),
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
    const res = await fetchWithAuth(`/api/system-admin/templates/emails/${type}/reset`, {
      method: "POST",
    });
    if (res.ok) {
      await loadData();
      if (editingType === type) cancelEditing();
    }
  }

  // Group templates by category
  const grouped = new Map<string, EmailTemplate[]>();
  for (const t of templates) {
    const cat = getCategory(t.emailType);
    const list = grouped.get(cat) || [];
    list.push(t);
    grouped.set(cat, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" /> Email Templates
          </h1>
          <p className="text-sm text-muted-foreground">{templates.length} email types across {grouped.size} categories</p>
        </div>
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
                      const isEditing = editingType === t.emailType;
                      const previewSubject = isEditing
                        ? renderPreviewText(editSubject, t.variables)
                        : renderPreviewText(t.subjectTemplate, t.variables);
                      const previewBody = isEditing
                        ? renderPreviewText(editBody, t.variables)
                        : renderPreviewText(t.bodyTemplate, t.variables);

                      return (
                        <div key={t.emailType} className="border rounded-md p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{formatTypeName(t.emailType)}</span>
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
                                  <Button variant="ghost" size="sm" onClick={() => resetTemplate(t.emailType)}>
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
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject Template</label>
                                <Input
                                  value={editSubject}
                                  onChange={(e) => setEditSubject(e.target.value)}
                                  className="font-mono text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Body Template</label>
                                <Textarea
                                  value={editBody}
                                  onChange={(e) => setEditBody(e.target.value)}
                                  className="font-mono text-sm"
                                  rows={4}
                                />
                              </div>
                              <VariablePicker
                                variables={t.variables}
                                onInsert={(name) => insertVariable(name, "body")}
                              />
                              <TemplatePreview title={previewSubject} body={previewBody} />
                            </div>
                          ) : (
                            <div className="text-sm">
                              <p className="font-medium">{previewSubject}</p>
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
