"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Target, Loader2 } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  AssignmentPickerModal,
  type AssignmentItem,
} from "@/components/assignment-picker-modal";

export function CompetitorButton({
  appSlug,
  appName,
  initialStarred,
  trackedAppSlug,
  competitorForApps,
  size = "default",
}: {
  appSlug: string;
  appName?: string;
  initialStarred: boolean;
  trackedAppSlug?: string;
  competitorForApps?: string[];
  size?: "default" | "sm";
}) {
  const { fetchWithAuth, refreshUser, account } = useAuth();
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerItems, setPickerItems] = useState<AssignmentItem[]>([]);
  const [pickerTitle, setPickerTitle] = useState("");
  const [initialChecked, setInitialChecked] = useState<Set<string>>(new Set());
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleClick() {
    // Fast path: if trackedAppSlug prop is provided and not yet starred, add directly
    if (trackedAppSlug && !starred) {
      setLoading(true);
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(trackedAppSlug)}/competitors`,
        { method: "POST", body: JSON.stringify({ slug: appSlug }) }
      );
      if (res.ok) {
        setStarred(true);
        refreshUser();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to add competitor");
        setShowLimitModal(true);
      }
      setLoading(false);
      return;
    }

    // Open picker: fetch apps, research projects, and membership in parallel
    setLoading(true);
    try {
      const fetches: Promise<Response>[] = [
        fetchWithAuth("/api/account/tracked-apps"),
        fetchWithAuth("/api/research-projects"),
        fetchWithAuth(`/api/apps/${encodeURIComponent(appSlug)}/membership`),
      ];
      // Fetch app detail for name if not provided via prop
      if (!appName) {
        fetches.push(fetchWithAuth(`/api/apps/${encodeURIComponent(appSlug)}`));
      }

      const responses = await Promise.all(fetches);
      const [appsRes, projectsRes, membershipRes] = responses;

      const apps = appsRes.ok ? await appsRes.json() : [];
      const projects = projectsRes.ok ? await projectsRes.json() : [];
      const membership = membershipRes.ok
        ? await membershipRes.json()
        : { competitorForApps: [], researchProjectIds: [] };

      let displayName = appName || appSlug;
      if (!appName && responses[3]?.ok) {
        const appDetail = await responses[3].json();
        displayName = appDetail.name || appSlug;
      }

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

      const availableItems = items.filter((i) => i.id !== appSlug);

      if (availableItems.length === 0) {
        setErrorMsg("Add your own app first to track competitors against it");
        setShowLimitModal(true);
        setLoading(false);
        return;
      }

      const checked = new Set<string>([
        ...membership.competitorForApps,
        ...membership.researchProjectIds,
      ]);

      // Single item: toggle directly without showing picker
      if (availableItems.length === 1) {
        const item = availableItems[0];
        const isChecked = checked.has(item.id);
        await handleSave(
          isChecked ? [] : [item],
          isChecked ? [item] : []
        );
        setLoading(false);
        return;
      }

      setPickerTitle(`Assign "${displayName}" as Competitor`);
      setPickerItems(items);
      setInitialChecked(checked);
      setShowPicker(true);
    } catch {
      setErrorMsg("Failed to load data");
      setShowLimitModal(true);
    }
    setLoading(false);
  }

  async function handleSave(toAdd: AssignmentItem[], toRemove: AssignmentItem[]) {
    const errors: string[] = [];

    const ops = [
      ...toAdd.map((item) => async () => {
        if (item.type === "app") {
          const res = await fetchWithAuth(
            `/api/account/tracked-apps/${encodeURIComponent(item.id)}/competitors`,
            { method: "POST", body: JSON.stringify({ slug: appSlug }) }
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            errors.push(data.error || `Failed to add to ${item.label}`);
          }
        } else {
          const res = await fetchWithAuth(
            `/api/research-projects/${item.id}/competitors`,
            { method: "POST", body: JSON.stringify({ slug: appSlug }) }
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
            `/api/account/tracked-apps/${encodeURIComponent(item.id)}/competitors/${encodeURIComponent(appSlug)}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            errors.push(data.error || `Failed to remove from ${item.label}`);
          }
        } else {
          const res = await fetchWithAuth(
            `/api/research-projects/${item.id}/competitors/${encodeURIComponent(appSlug)}`,
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

    // Update starred state: check if any app still has this as competitor
    const addedApps = toAdd.filter((i) => i.type === "app").length;
    const removedApps = toRemove.filter((i) => i.type === "app").length;
    const currentAppCount = (competitorForApps?.length || (starred ? 1 : 0)) + addedApps - removedApps;
    setStarred(currentAppCount > 0);
    refreshUser();

    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
  }

  const sizeClasses = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconClasses = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  const limitInfo = account
    ? `${account.usage.competitorApps}/${account.limits.maxCompetitorApps}`
    : "";

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        title={starred ? "Competitor — click to manage" : "Add as Competitor"}
        className={`${sizeClasses} inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className={`${iconClasses} animate-spin text-muted-foreground`} />
        ) : (
          <Target
            className={`${iconClasses} ${starred ? "fill-orange-500 text-orange-500" : "text-muted-foreground hover:text-orange-500"}`}
          />
        )}
      </button>

      <AssignmentPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSave={handleSave}
        title={pickerTitle}
        items={pickerItems}
        initialChecked={initialChecked}
        excludeId={appSlug}
      />

      <ConfirmModal
        open={showLimitModal}
        title="Competitor"
        description={`${errorMsg}${limitInfo ? ` (${limitInfo})` : ""}`}
        confirmLabel="OK"
        cancelLabel="Close"
        destructive={false}
        onConfirm={() => setShowLimitModal(false)}
        onCancel={() => setShowLimitModal(false)}
      />
    </>
  );
}

/** @deprecated Use CompetitorButton instead */
export const StarAppButton = CompetitorButton;
