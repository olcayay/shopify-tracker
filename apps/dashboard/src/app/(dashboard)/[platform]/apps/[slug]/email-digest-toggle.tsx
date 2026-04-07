"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Bell, BellOff } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";

export function EmailDigestToggle({
  appId,
  isTracked,
}: {
  appId: number;
  isTracked: boolean;
}) {
  const { fetchWithAuth } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isTracked) return;
    fetchWithAuth(`/api/email-preferences/apps/${appId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setEnabled(data.dailyDigestEnabled);
        }
      })
      .finally(() => setLoading(false));
  }, [appId, isTracked, fetchWithAuth]);

  if (!isTracked) return null;

  async function toggle() {
    const newValue = !enabled;
    setEnabled(newValue); // Optimistic

    const res = await fetchWithAuth(`/api/email-preferences/apps/${appId}`, {
      method: "PATCH",
      body: JSON.stringify({ dailyDigestEnabled: newValue }),
    });

    if (res.ok) {
      toast.success(
        newValue ? "Daily email report enabled" : "Daily email report disabled"
      );
    } else {
      setEnabled(!newValue); // Revert
      toast.error("Failed to update email preference");
    }
  }

  if (loading) return null;

  const Icon = enabled ? Bell : BellOff;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggle}
          className={`inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors ${
            enabled
              ? "hover:bg-accent text-foreground"
              : "hover:bg-accent text-muted-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled ? "Daily email report enabled" : "Daily email report disabled"}
      </TooltipContent>
    </Tooltip>
  );
}
