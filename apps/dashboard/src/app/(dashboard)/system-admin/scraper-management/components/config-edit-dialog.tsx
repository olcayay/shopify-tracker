"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface KnobDef {
  type: "number" | "ms" | "boolean" | "string" | "string[]";
  min?: number;
  max?: number;
  description: string;
  defaultFrom: "platform" | "global";
  path: string;
}

interface SingleConfigResponse {
  platform: string;
  scraperType: string;
  enabled: boolean;
  overrides: Record<string, unknown>;
  updatedAt: string | null;
  updatedBy: string | null;
  schema: Record<string, KnobDef> | null;
}

interface Props {
  platform: string;
  scraperType: string;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Dynamic form for editing a single (platform, scraper_type) config.
 * The set of fields is driven by the `schema` payload from the API — which
 * pulls from `SCRAPER_CONFIG_SCHEMA` in @appranks/shared. Unknown knob =
 * no UI; the user must rely on the schema registry being up to date.
 */
export function ConfigEditDialog({ platform, scraperType, onClose, onSaved }: Props) {
  const { fetchWithAuth } = useAuth();
  const [config, setConfig] = useState<SingleConfigResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth(`/api/system-admin/scraper-configs/${platform}/${scraperType}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SingleConfigResponse;
        setConfig(data);
        // Seed draft with current override values as strings (or empty string for not-overridden)
        const d: Record<string, string> = {};
        if (data.schema) {
          for (const key of Object.keys(data.schema)) {
            const v = data.overrides[key];
            d[key] = v === undefined ? "" : String(v);
          }
        }
        setDraft(d);
      })
      .catch((err) => setError(String(err)));
  }, [platform, scraperType, fetchWithAuth]);

  async function save() {
    if (!config?.schema) return;
    setSaving(true);
    setError("");

    // Convert draft strings into typed values; blank = "not overridden"
    const overrides: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(draft)) {
      if (raw.trim() === "") continue;
      const def = config.schema[key];
      if (!def) continue;
      if (def.type === "number" || def.type === "ms") {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          setError(`"${key}" must be a number`);
          setSaving(false);
          return;
        }
        overrides[key] = n;
      } else if (def.type === "boolean") {
        overrides[key] = raw === "true";
      } else {
        overrides[key] = raw;
      }
    }

    const res = await fetchWithAuth(
      `/api/system-admin/scraper-configs/${platform}/${scraperType}`,
      {
        method: "PATCH",
        body: JSON.stringify({ overrides }),
      },
    );
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Save failed");
    }
  }

  async function resetAll() {
    if (!window.confirm(`Reset all overrides for ${platform} / ${scraperType} to defaults?`)) return;
    setSaving(true);
    const res = await fetchWithAuth(
      `/api/system-admin/scraper-configs/${platform}/${scraperType}/reset`,
      { method: "POST" },
    );
    setSaving(false);
    if (res.ok) onSaved();
    else setError("Reset failed");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Configure scraper</h2>
            <p className="text-xs text-muted-foreground mt-1">
              <code className="font-mono">{platform}</code> / <code className="font-mono">{scraperType}</code>
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {!config ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !config.schema ? (
            <p className="text-sm text-muted-foreground">
              No knobs registered for scraper type <code className="font-mono">{scraperType}</code>.
              See <code>packages/shared/src/scraper-config-schema.ts</code>.
            </p>
          ) : (
            <>
              {Object.entries(config.schema).map(([key, def]) => {
                const isOverridden = key in config.overrides;
                const currentVal = draft[key];
                return (
                  <div key={key} className="space-y-1">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <code className="font-mono text-xs">{key}</code>
                      {isOverridden && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-4 bg-orange-50 text-orange-600 border-orange-200"
                        >
                          Override
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                        {def.type}
                        {def.min != null && def.max != null ? ` (${def.min}–${def.max})` : ""}
                      </span>
                    </label>
                    {def.type === "boolean" ? (
                      <select
                        value={currentVal}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm bg-background"
                      >
                        <option value="">(use default)</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type={def.type === "number" || def.type === "ms" ? "number" : "text"}
                        placeholder="(leave blank to use default)"
                        value={currentVal}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        min={def.min}
                        max={def.max}
                        className="w-full border rounded px-2 py-1 text-sm bg-background"
                      />
                    )}
                    <p className="text-xs text-muted-foreground">{def.description}</p>
                  </div>
                );
              })}
              {error && (
                <div className="p-2 bg-destructive/10 text-destructive text-sm rounded">{error}</div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center p-4 border-t bg-muted/30">
          <Button variant="ghost" size="sm" onClick={resetAll} disabled={saving || !config?.schema}>
            Reset all to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !config?.schema}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
