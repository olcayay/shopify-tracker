"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/confirm-modal";

export function TrackFeatureButton({
  featureHandle,
  featureTitle,
  initialTracked,
}: {
  featureHandle: string;
  featureTitle: string;
  initialTracked: boolean;
}) {
  const { fetchWithAuth, user } = useAuth();
  const [tracked, setTracked] = useState(initialTracked);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "editor";
  if (!canEdit) return null;

  async function doTrack() {
    setLoading(true);
    const res = await fetchWithAuth("/api/account/tracked-features", {
      method: "POST",
      body: JSON.stringify({ handle: featureHandle, title: featureTitle }),
    });
    if (res.ok) setTracked(true);
    setLoading(false);
  }

  async function doUntrack() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/account/tracked-features/${encodeURIComponent(featureHandle)}`,
      { method: "DELETE" }
    );
    if (res.ok) setTracked(false);
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
        size="sm"
        onClick={handleClick}
        disabled={loading}
      >
        {tracked ? "Untrack Feature" : "Track Feature"}
      </Button>

      <ConfirmModal
        open={showConfirm}
        title="Untrack Feature"
        description={`Are you sure you want to stop tracking "${featureTitle}"?`}
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
