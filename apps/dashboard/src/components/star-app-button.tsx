"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Star } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function StarAppButton({
  appSlug,
  initialStarred,
  size = "default",
}: {
  appSlug: string;
  initialStarred: boolean;
  size?: "default" | "sm";
}) {
  const { fetchWithAuth, refreshUser, account } = useAuth();
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showUnstarConfirm, setShowUnstarConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function doStar() {
    setLoading(true);
    setErrorMsg("");
    const res = await fetchWithAuth("/api/account/competitors", {
      method: "POST",
      body: JSON.stringify({ slug: appSlug }),
    });
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
    const res = await fetchWithAuth(`/api/account/competitors/${encodeURIComponent(appSlug)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setStarred(false);
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Failed to remove competitor");
      setShowLimitModal(true);
    }
    setLoading(false);
  }

  function handleClick() {
    if (starred) {
      setShowUnstarConfirm(true);
    } else {
      doStar();
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
        title={starred ? "Remove from competitors" : "Add as competitor"}
        className={`${sizeClasses} inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50`}
      >
        <Star
          className={`${iconClasses} ${starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
        />
      </button>

      <ConfirmModal
        open={showUnstarConfirm}
        title="Remove Competitor"
        description={`Are you sure you want to remove "${appSlug}" from competitors?`}
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
    </>
  );
}
