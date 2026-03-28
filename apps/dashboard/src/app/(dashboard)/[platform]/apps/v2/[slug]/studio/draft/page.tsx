"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMetadataLimits } from "@/lib/metadata-limits";
import { cn } from "@/lib/utils";
import { Save, Lock } from "lucide-react";
import { CardSkeleton } from "@/components/skeletons";

interface DraftField {
  key: string;
  label: string;
  current: string;
  draft: string;
  limit: number;
  multiline?: boolean;
}

function CharBar({ count, max }: { count: number; max: number }) {
  if (max <= 0) return null;
  const pct = Math.min(100, (count / max) * 100);
  const color = count === 0 ? "bg-muted" : pct > 100 ? "bg-red-500" : pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="tabular-nums">{count}/{max}</span>
    </div>
  );
}

function KeywordDensity({ text, keywords }: { text: string; keywords: string[] }) {
  const counts = useMemo(() => {
    if (!text || keywords.length === 0) return [];
    const lower = text.toLowerCase();
    return keywords
      .map((kw) => {
        const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = lower.match(regex);
        return { keyword: kw, count: matches?.length || 0 };
      })
      .filter((k) => k.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [text, keywords]);

  if (counts.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Keyword density</p>
      <div className="flex flex-wrap gap-1.5">
        {counts.slice(0, 10).map((k) => (
          <span key={k.keyword} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
            &quot;{k.keyword}&quot;: {k.count}x
          </span>
        ))}
      </div>
    </div>
  );
}

export default function V2DraftEditorPage() {
  const { platform, slug } = useParams();
  const { user, fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [appRes, kwRes] = await Promise.all([
          fetchWithAuth(`/api/apps/${slug}?platform=${platform}`),
          fetchWithAuth(`/api/account/tracked-apps/${slug}/keywords?platform=${platform}`).catch(() => null),
        ]);
        const app = await appRes.json();
        const kwData = kwRes ? await kwRes.json() : [];
        const snapshot = app.latestSnapshot;
        const limits = getMetadataLimits(platform as string);

        // Get draft or use current
        const draftRes = await fetchWithAuth(`/api/account/tracked-apps/${slug}/draft?platform=${platform}`).catch(() => null);
        const draft = draftRes?.ok ? await draftRes.json() : null;

        const appLevelKeys = ["name", "appCardSubtitle"];
        const makeField = (key: string, label: string, limit: number, multiline?: boolean): DraftField => {
          const source = appLevelKeys.includes(key) ? app : snapshot;
          return {
            key,
            label,
            current: source?.[key] || "",
            draft: draft?.[key] ?? source?.[key] ?? "",
            limit,
            multiline,
          };
        };

        setFields([
          makeField("name", "Title", limits.appName),
          makeField("appCardSubtitle", "Subtitle", limits.subtitle),
          makeField("appIntroduction", "Introduction", limits.introduction, true),
          makeField("appDetails", "Description", limits.details, true),
          makeField("seoTitle", "SEO Title", limits.seoTitle),
          makeField("seoMetaDescription", "SEO Description", limits.seoMetaDescription, true),
        ]);
        setKeywords((kwData || []).map((k: any) => k.keyword || k.name).filter(Boolean));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug, platform, fetchWithAuth]);

  function updateDraft(key: string, value: string) {
    setFields((prev) => prev.map((f) => f.key === key ? { ...f, draft: value } : f));
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const draftData: Record<string, string> = {};
      for (const f of fields) {
        if (f.draft !== f.current) draftData[f.key] = f.draft;
      }
      await fetchWithAuth(`/api/account/tracked-apps/${slug}/draft?platform=${platform}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftData),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const allDraftText = fields.map((f) => f.draft).join(" ");
  const hasChanges = fields.some((f) => f.draft !== f.current);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-lg font-medium">Track this app to use the draft editor</h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Draft Editor</h2>
        <Button size="sm" onClick={saveDraft} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save Draft"}
        </Button>
      </div>

      {/* Keyword density for all draft text */}
      {keywords.length > 0 && <KeywordDensity text={allDraftText} keywords={keywords} />}

      {/* Side-by-side fields */}
      {fields.filter((f) => f.limit > 0).map((field) => (
        <Card key={field.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{field.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current</p>
                <div className="rounded-md border bg-muted/30 p-2 text-sm min-h-[2.5rem]">
                  {field.multiline ? (
                    <p className="whitespace-pre-wrap line-clamp-6 text-muted-foreground">{field.current || "—"}</p>
                  ) : (
                    <p className="text-muted-foreground">{field.current || "—"}</p>
                  )}
                </div>
              </div>

              {/* Draft */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Draft</p>
                {field.multiline ? (
                  <textarea
                    className="w-full rounded-md border bg-background p-2 text-sm min-h-[6rem] resize-y"
                    value={field.draft}
                    onChange={(e) => updateDraft(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full rounded-md border bg-background p-2 text-sm"
                    value={field.draft}
                    onChange={(e) => updateDraft(field.key, e.target.value)}
                  />
                )}
                <CharBar count={field.draft.length} max={field.limit} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
