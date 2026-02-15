"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";

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

  const canEdit = user?.role === "owner" || user?.role === "editor";
  if (!canEdit) return null;

  async function toggle() {
    setLoading(true);
    if (tracked) {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${appSlug}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setTracked(false);
        refreshUser();
      }
    } else {
      const res = await fetchWithAuth("/api/account/tracked-apps", {
        method: "POST",
        body: JSON.stringify({ slug: appSlug }),
      });
      if (res.ok) {
        setTracked(true);
        refreshUser();
      }
    }
    setLoading(false);
  }

  return (
    <Button
      variant={tracked ? "outline" : "default"}
      onClick={toggle}
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
  );
}
