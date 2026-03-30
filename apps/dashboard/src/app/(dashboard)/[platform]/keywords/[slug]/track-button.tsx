"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Check, Loader2 } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  AssignmentPickerModal,
  type AssignmentItem,
} from "@/components/assignment-picker-modal";

export function TrackKeywordButton({
  keywordId,
  keywordText,
  keywordSlug,
  initialTracked,
  trackedAppSlug,
  trackedForApps,
}: {
  keywordId: number;
  keywordText: string;
  keywordSlug: string;
  initialTracked: boolean;
  trackedAppSlug?: string;
  trackedForApps?: string[];
}) {
  const { fetchWithAuth, user, refreshUser } = useAuth();
  const [tracked, setTracked] = useState(initialTracked);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerItems, setPickerItems] = useState<AssignmentItem[]>([]);
  const [initialChecked, setInitialChecked] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState("");
  const [showError, setShowError] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  async function handleClick() {
    // Fast path: if trackedAppSlug prop and not yet tracked, add directly
    if (trackedAppSlug && !tracked) {
      setLoading(true);
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(trackedAppSlug)}/keywords`,
        { method: "POST", body: JSON.stringify({ keyword: keywordText }) }
      );
      if (res.ok) {
        setTracked(true);
        refreshUser();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to track keyword");
        setShowError(true);
      }
      setLoading(false);
      return;
    }

    // Open picker: fetch apps, research projects, and membership in parallel
    setLoading(true);
    try {
      const [appsRes, projectsRes, membershipRes] = await Promise.all([
        fetchWithAuth("/api/account/tracked-apps"),
        fetchWithAuth("/api/research-projects"),
        fetchWithAuth(`/api/keywords/${encodeURIComponent(keywordSlug)}/membership`),
      ]);

      const apps = appsRes.ok ? await appsRes.json() : [];
      const projects = projectsRes.ok ? await projectsRes.json() : [];
      const membership = membershipRes.ok
        ? await membershipRes.json()
        : { trackedAppSlugs: [], researchProjectIds: [] };

      const items: AssignmentItem[] = [
        ...apps.map((a: any) => ({
          id: a.appSlug,
          label: a.appName,
          iconUrl: a.iconUrl,
          type: "app" as const,
        })),
        ...projects.map((p: any) => ({
          id: p.id,
          label: p.name,
          type: "research" as const,
        })),
      ];

      if (items.length === 0) {
        setErrorMsg("Add an app or create a research project first");
        setShowError(true);
        setLoading(false);
        return;
      }

      const checked = new Set<string>([
        ...membership.trackedAppSlugs,
        ...membership.researchProjectIds,
      ]);

      // Single item: toggle directly without showing picker
      if (items.length === 1) {
        const item = items[0];
        const isChecked = checked.has(item.id);
        await handleSave(
          isChecked ? [] : [item],
          isChecked ? [item] : []
        );
        setLoading(false);
        return;
      }

      setPickerItems(items);
      setInitialChecked(checked);
      setShowPicker(true);
    } catch {
      setErrorMsg("Failed to load data");
      setShowError(true);
    }
    setLoading(false);
  }

  async function handleSave(toAdd: AssignmentItem[], toRemove: AssignmentItem[]) {
    const errors: string[] = [];

    const ops = [
      ...toAdd.map((item) => async () => {
        if (item.type === "app") {
          const res = await fetchWithAuth(
            `/api/account/tracked-apps/${encodeURIComponent(item.id)}/keywords`,
            { method: "POST", body: JSON.stringify({ keyword: keywordText }) }
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            errors.push(data.error || `Failed to add to ${item.label}`);
          }
        } else {
          const res = await fetchWithAuth(
            `/api/research-projects/${item.id}/keywords`,
            { method: "POST", body: JSON.stringify({ keyword: keywordText }) }
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            errors.push(data.error || `Failed to add to ${item.label}`);
          }
        }
      }),
      ...toRemove.map((item) => async () => {
        if (item.type === "app") {
          const res = await fetchWithAuth(
            `/api/account/tracked-apps/${encodeURIComponent(item.id)}/keywords/${keywordId}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            errors.push(data.error || `Failed to remove from ${item.label}`);
          }
        } else {
          const res = await fetchWithAuth(
            `/api/research-projects/${item.id}/keywords/${keywordId}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            errors.push(data.error || `Failed to remove from ${item.label}`);
          }
        }
      }),
    ];

    await Promise.all(ops.map((op) => op()));

    // Update tracked state: check if any app still has this keyword
    const addedApps = toAdd.filter((i) => i.type === "app").length;
    const removedApps = toRemove.filter((i) => i.type === "app").length;
    const currentAppCount = (trackedForApps?.length || 0) + addedApps - removedApps;
    setTracked(currentAppCount > 0);
    refreshUser();

    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
  }

  if (!canEdit) return null;

  return (
    <>
      <Button
        variant={tracked ? "outline" : "default"}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : tracked ? (
          <Check className="h-4 w-4 mr-1" />
        ) : (
          <Plus className="h-4 w-4 mr-1" />
        )}
        {tracked ? "Tracked" : "Track"}
      </Button>

      <AssignmentPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSave={handleSave}
        title={`Assign "${keywordText}"`}
        items={pickerItems}
        initialChecked={initialChecked}
      />

      <ConfirmModal
        open={showError}
        title="Keyword Tracking"
        description={errorMsg}
        confirmLabel="OK"
        cancelLabel="Close"
        destructive={false}
        onConfirm={() => setShowError(false)}
        onCancel={() => setShowError(false)}
      />
    </>
  );
}
