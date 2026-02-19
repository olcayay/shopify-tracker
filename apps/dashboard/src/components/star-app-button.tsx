"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Star, ChevronDown } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function StarAppButton({
  appSlug,
  initialStarred,
  trackedAppSlug,
  competitorForApps,
  size = "default",
}: {
  appSlug: string;
  initialStarred: boolean;
  trackedAppSlug?: string;
  competitorForApps?: string[];
  size?: "default" | "sm";
}) {
  const { fetchWithAuth, refreshUser, account } = useAuth();
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showUnstarConfirm, setShowUnstarConfirm] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [myApps, setMyApps] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Determine the effective trackedAppSlug
  const effectiveTrackedAppSlug = trackedAppSlug;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAppPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadMyApps() {
    const res = await fetchWithAuth("/api/account/tracked-apps");
    if (res.ok) {
      setMyApps(await res.json());
    }
  }

  async function doStar(targetAppSlug: string) {
    setLoading(true);
    setErrorMsg("");
    setShowAppPicker(false);
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(targetAppSlug)}/competitors`,
      {
        method: "POST",
        body: JSON.stringify({ slug: appSlug }),
      }
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
  }

  async function doUnstar() {
    setLoading(true);
    // Remove from all my-apps this is a competitor for
    const forApps = competitorForApps || [];
    if (forApps.length > 0) {
      for (const ta of forApps) {
        await fetchWithAuth(
          `/api/account/tracked-apps/${encodeURIComponent(ta)}/competitors/${encodeURIComponent(appSlug)}`,
          { method: "DELETE" }
        );
      }
      setStarred(false);
      refreshUser();
    } else {
      // Fallback: use flat endpoint
      const res = await fetchWithAuth(
        `/api/account/competitors/${encodeURIComponent(appSlug)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setStarred(false);
        refreshUser();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to remove competitor");
        setShowLimitModal(true);
      }
    }
    setLoading(false);
  }

  async function handleClick() {
    if (starred) {
      setShowUnstarConfirm(true);
      return;
    }

    // If we have a specific tracked app context, star directly
    if (effectiveTrackedAppSlug) {
      doStar(effectiveTrackedAppSlug);
      return;
    }

    // Otherwise need to pick which my-app to add this competitor to
    await loadMyApps();
    if (myApps.length === 0) {
      // Re-check after load
      const res = await fetchWithAuth("/api/account/tracked-apps");
      if (res.ok) {
        const apps = await res.json();
        setMyApps(apps);
        if (apps.length === 0) {
          setErrorMsg("Follow an app first to add competitors");
          setShowLimitModal(true);
          return;
        }
        if (apps.length === 1) {
          doStar(apps[0].appSlug);
          return;
        }
        setShowAppPicker(true);
      }
    } else if (myApps.length === 1) {
      doStar(myApps[0].appSlug);
    } else {
      setShowAppPicker(true);
    }
  }

  const sizeClasses = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconClasses = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  const limitInfo = account
    ? `${account.usage.competitorApps}/${account.limits.maxCompetitorApps}`
    : "";

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={handleClick}
        disabled={loading}
        title={starred ? "Remove from competitors" : "Add as competitor"}
        className={`${sizeClasses} inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50`}
      >
        <Star
          className={`${iconClasses} ${starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
      </button>

      {/* App picker popover */}
      {showAppPicker && myApps.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-popover border rounded-md shadow-md">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b">
            Add as competitor for:
          </div>
          {myApps
            .filter((a) => a.appSlug !== appSlug)
            .map((a) => (
              <button
                key={a.appSlug}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
                onClick={() => doStar(a.appSlug)}
              >
                {a.iconUrl && (
                  <img src={a.iconUrl} alt="" className="h-5 w-5 rounded shrink-0" />
                )}
                {a.appName}
              </button>
            ))}
        </div>
      )}

      <ConfirmModal
        open={showUnstarConfirm}
        title="Remove Competitor"
        description={`Are you sure you want to remove "${appSlug}" from competitors?${competitorForApps && competitorForApps.length > 1 ? ` It will be removed from ${competitorForApps.length} apps.` : ""}`}
        confirmLabel="Remove"
        onConfirm={() => {
          setShowUnstarConfirm(false);
          doUnstar();
        }}
        onCancel={() => setShowUnstarConfirm(false)}
      />

      <ConfirmModal
        open={showLimitModal}
        title="Competitor Limit"
        description={`${errorMsg}${limitInfo ? ` (${limitInfo})` : ""}`}
        confirmLabel="OK"
        cancelLabel="Close"
        destructive={false}
        onConfirm={() => setShowLimitModal(false)}
        onCancel={() => setShowLimitModal(false)}
      />
    </div>
  );
}
