"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function TrackKeywordButton({
  keywordId,
  keywordText,
  initialTracked,
}: {
  keywordId: number;
  keywordText: string;
  initialTracked: boolean;
}) {
  const { fetchWithAuth, user, refreshUser } = useAuth();
  const [tracked, setTracked] = useState(initialTracked);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "editor";
  if (!canEdit) return null;

  async function doTrack() {
    setLoading(true);
    const res = await fetchWithAuth("/api/account/tracked-keywords", {
      method: "POST",
      body: JSON.stringify({ keyword: keywordText }),
    });
    if (res.ok) {
      setTracked(true);
      refreshUser();
    }
    setLoading(false);
  }

  async function doUntrack() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/account/tracked-keywords/${keywordId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setTracked(false);
      refreshUser();
    }
    setLoading(false);
  }

  function handleClick() {
    if (tracked) {
      setShowConfirm(true);
    } else {
      doTrack();
    }
  }

  return (
    <>
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

      <ConfirmModal
        open={showConfirm}
        title="Stop Tracking Keyword"
        description={`Are you sure you want to stop tracking "${keywordText}"? You will lose access to ranking history for this keyword.`}
        confirmLabel="Untrack"
        onConfirm={() => {
          setShowConfirm(false);
          doUntrack();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
