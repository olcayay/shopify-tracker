"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/confirm-modal";
import { Star } from "lucide-react";

export function StarFeatureButton({
  featureHandle,
  featureTitle,
  initialStarred,
}: {
  featureHandle: string;
  featureTitle: string;
  initialStarred: boolean;
}) {
  const { fetchWithAuth, user, refreshUser } = useAuth();
  const [starred, setStarred] = useState(initialStarred);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "editor";
  if (!canEdit) return null;

  async function doStar() {
    setLoading(true);
    const res = await fetchWithAuth("/api/account/starred-features", {
      method: "POST",
      body: JSON.stringify({ handle: featureHandle, title: featureTitle }),
    });
    if (res.ok) {
      setStarred(true);
      refreshUser();
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
    }
    setLoading(false);
  }

  function handleClick() {
    if (starred) {
      setShowConfirm(true);
    } else {
      doStar();
    }
  }

  return (
    <>
      <Button
        variant={starred ? "outline" : "default"}
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="gap-1.5"
      >
        <Star className={`h-4 w-4 ${starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
        {starred ? "Starred" : "Star Feature"}
      </Button>

      <ConfirmModal
        open={showConfirm}
        title="Unstar Feature"
        description={`Are you sure you want to unstar "${featureTitle}"?`}
        confirmLabel="Unstar"
        onConfirm={() => {
          setShowConfirm(false);
          doUnstar();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
