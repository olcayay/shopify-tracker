"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
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
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState("");
  const [showError, setShowError] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAppPicker(false);
        setSelectedApps(new Set());
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleApp(slug: string) {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  async function doTrackSelected() {
    setLoading(true);
    setShowAppPicker(false);
    let anyOk = false;
    for (const appSlug of selectedApps) {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`,
        {
          method: "POST",
          body: JSON.stringify({ keyword: keywordText }),
        }
      );
      if (res.ok) {
        anyOk = true;
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to track keyword");
        setShowError(true);
      }
    }
    if (anyOk) {
      setTracked(true);
      refreshUser();
    }
    setSelectedApps(new Set());
    setLoading(false);
  }

  async function doTrackSingle(targetAppSlug: string) {
    setLoading(true);
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
      doTrackSingle(trackedAppSlug);
      return;
    }

    // Need to pick which my-app(s)
    const res = await fetchWithAuth("/api/account/tracked-apps");
    if (res.ok) {
      const apps = await res.json();
      setMyApps(apps);
      if (apps.length === 0) {
        setErrorMsg("Follow an app first to track keywords");
        setShowError(true);
      } else if (apps.length === 1) {
        doTrackSingle(apps[0].appSlug);
      } else {
        // Pre-select all apps that don't already track this keyword
        const alreadyTracked = new Set(trackedForApps || []);
        const preSelected = new Set<string>(
          apps
            .map((a: any) => a.appSlug as string)
            .filter((s: string) => !alreadyTracked.has(s))
        );
        setSelectedApps(preSelected);
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
          {myApps.map((a) => {
            const alreadyTracked = (trackedForApps || []).includes(a.appSlug);
            const isSelected = selectedApps.has(a.appSlug);
            return (
              <button
                key={a.appSlug}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  alreadyTracked
                    ? "opacity-50 cursor-default"
                    : "hover:bg-accent"
                }`}
                onClick={() => {
                  if (!alreadyTracked) toggleApp(a.appSlug);
                }}
              >
                <div
                  className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${
                    isSelected || alreadyTracked
                      ? "bg-primary border-primary"
                      : "border-input"
                  }`}
                >
                  {(isSelected || alreadyTracked) && (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  )}
                </div>
                {a.iconUrl && (
                  <img
                    src={a.iconUrl}
                    alt=""
                    className="h-5 w-5 rounded shrink-0"
                  />
                )}
                <span className="flex-1 truncate">{a.appName}</span>
                {alreadyTracked && (
                  <span className="text-[10px] text-muted-foreground">
                    Tracked
                  </span>
                )}
              </button>
            );
          })}
          <div className="px-3 py-2 border-t flex justify-end">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={selectedApps.size === 0}
              onClick={doTrackSelected}
            >
              Track ({selectedApps.size})
            </Button>
          </div>
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
