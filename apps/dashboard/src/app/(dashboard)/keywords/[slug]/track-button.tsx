"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Check, ChevronDown } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function TrackKeywordButton({
  keywordId,
  keywordText,
  initialTracked,
  trackedAppSlug,
  trackedForApps,
}: {
  keywordId: number;
  keywordText: string;
  initialTracked: boolean;
  trackedAppSlug?: string;
  trackedForApps?: string[];
}) {
  const { fetchWithAuth, user, refreshUser } = useAuth();
  const [tracked, setTracked] = useState(initialTracked);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [myApps, setMyApps] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [showError, setShowError] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAppPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function doTrack(targetAppSlug: string) {
    setLoading(true);
    setShowAppPicker(false);
    const res = await fetchWithAuth(
      `/api/account/tracked-apps/${encodeURIComponent(targetAppSlug)}/keywords`,
      {
        method: "POST",
        body: JSON.stringify({ keyword: keywordText }),
      }
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
  }

  async function doUntrack() {
    setLoading(true);
    const forApps = trackedForApps || [];
    if (forApps.length > 0) {
      for (const ta of forApps) {
        await fetchWithAuth(
          `/api/account/tracked-apps/${encodeURIComponent(ta)}/keywords/${keywordId}`,
          { method: "DELETE" }
        );
      }
      setTracked(false);
      refreshUser();
    } else {
      const res = await fetchWithAuth(
        `/api/account/tracked-keywords/${keywordId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setTracked(false);
        refreshUser();
      }
    }
    setLoading(false);
  }

  async function handleClick() {
    if (tracked) {
      setShowConfirm(true);
      return;
    }

    if (trackedAppSlug) {
      doTrack(trackedAppSlug);
      return;
    }

    // Need to pick which my-app
    const res = await fetchWithAuth("/api/account/tracked-apps");
    if (res.ok) {
      const apps = await res.json();
      setMyApps(apps);
      if (apps.length === 0) {
        setErrorMsg("Follow an app first to track keywords");
        setShowError(true);
      } else if (apps.length === 1) {
        doTrack(apps[0].appSlug);
      } else {
        setShowAppPicker(true);
      }
    }
  }

  if (!canEdit) return null;

  return (
    <div className="relative" ref={pickerRef}>
      <Button
        variant={tracked ? "outline" : "default"}
        onClick={handleClick}
        disabled={loading}
      >
        {tracked ? (
          <>
            <Check className="h-4 w-4 mr-1" /> Tracked
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" /> Track
          </>
        )}
      </Button>

      {showAppPicker && myApps.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-popover border rounded-md shadow-md">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b">
            Track keyword for:
          </div>
          {myApps.map((a) => (
            <button
              key={a.appSlug}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center gap-2"
              onClick={() => doTrack(a.appSlug)}
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
        open={showConfirm}
        title="Stop Tracking Keyword"
        description={`Are you sure you want to stop tracking "${keywordText}"?${trackedForApps && trackedForApps.length > 1 ? ` It will be removed from ${trackedForApps.length} apps.` : ""}`}
        confirmLabel="Untrack"
        onConfirm={() => {
          setShowConfirm(false);
          doUntrack();
        }}
        onCancel={() => setShowConfirm(false)}
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
    </div>
  );
}
