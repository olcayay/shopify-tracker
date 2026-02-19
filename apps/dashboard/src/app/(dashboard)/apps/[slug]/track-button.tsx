"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export function TrackAppButton({
  appSlug,
  appName,
  initialTracked,
}: {
  appSlug: string;
  appName: string;
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
    const res = await fetchWithAuth("/api/account/tracked-apps", {
      method: "POST",
      body: JSON.stringify({ slug: appSlug }),
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
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}`,
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
            <Check className="h-4 w-4 mr-1" /> Following
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-1" /> Follow
          </>
        )}
      </Button>

      <ConfirmModal
        open={showConfirm}
        title="Unfollow App"
        description={`Are you sure you want to unfollow "${appName}"? Its competitors and keywords will also be removed.`}
        confirmLabel="Unfollow"
        onConfirm={() => {
          setShowConfirm(false);
          doUntrack();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
