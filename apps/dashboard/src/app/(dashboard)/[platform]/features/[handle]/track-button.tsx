"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Bookmark } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function StarFeatureButton({
  featureHandle,
  featureTitle,
  initialStarred,
  size = "default",
}: {
  featureHandle: string;
  featureTitle: string;
  initialStarred: boolean;
  size?: "default" | "sm";
}) {
  const { fetchWithAuth, user, refreshUser } = useAuth();
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);
  const [showUnstarConfirm, setShowUnstarConfirm] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";
  if (!canEdit) return null;

  async function doStar() {
    setLoading(true);
    setErrorMsg("");
    const res = await fetchWithAuth("/api/account/starred-features", {
      method: "POST",
      body: JSON.stringify({ handle: featureHandle, title: featureTitle }),
    });
    if (res.ok) {
      setStarred(true);
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Failed to bookmark feature");
      setShowErrorModal(true);
    }
    setLoading(false);
  }

  async function doUnstar() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/account/starred-features/${encodeURIComponent(featureHandle)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setStarred(false);
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || "Failed to remove bookmark");
      setShowErrorModal(true);
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

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        title={starred ? "Remove bookmark" : "Bookmark feature"}
        className={`${sizeClasses} inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50`}
      >
        <Bookmark
          className={`${iconClasses} ${starred ? "fill-amber-500 text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
        />
      </button>

      <ConfirmModal
        open={showUnstarConfirm}
        title="Remove Bookmark"
        description={`Remove bookmark for "${featureTitle}"?`}
        confirmLabel="Remove"
        onConfirm={() => {
          setShowUnstarConfirm(false);
          doUnstar();
        }}
        onCancel={() => setShowUnstarConfirm(false)}
      />

      <ConfirmModal
        open={showErrorModal}
        title="Error"
        description={errorMsg}
        confirmLabel="OK"
        cancelLabel="Close"
        destructive={false}
        onConfirm={() => setShowErrorModal(false)}
        onCancel={() => setShowErrorModal(false)}
      />
    </>
  );
}
