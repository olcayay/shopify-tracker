"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
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
  const { platform } = useParams();
  const { fetchWithAuth, user, refreshUser } = useAuth();
  const [tracked, setTracked] = useState(initialTracked);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hovered, setHovered] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";
  if (!canEdit) return null;

  async function doTrack() {
    setLoading(true);
    const res = await fetchWithAuth(`/api/account/tracked-apps?platform=${platform}`, {
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
      `/api/account/tracked-apps/${encodeURIComponent(appSlug)}?platform=${platform}`,
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
      {tracked ? (
        <Button
          variant="outline"
          onClick={handleClick}
          disabled={loading}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title="Managing — click to remove"
          className={
            hovered
              ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 hover:text-red-700 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
          }
        >
          <Check className="h-4 w-4 mr-1" /> My App
        </Button>
      ) : (
        <Button
          variant="default"
          onClick={handleClick}
          disabled={loading}
          title="Add to My Apps"
        >
          <Plus className="h-4 w-4 mr-1" /> My App
        </Button>
      )}

      <ConfirmModal
        open={showConfirm}
        title="Remove from My Apps"
        description={`Are you sure you want to remove "${appName}" from your apps? Its competitors and keywords will also be removed.`}
        confirmLabel="Remove"
        onConfirm={() => {
          setShowConfirm(false);
          doUntrack();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
