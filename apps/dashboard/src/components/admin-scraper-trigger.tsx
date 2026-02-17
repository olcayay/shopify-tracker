"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, Check } from "lucide-react";

interface AdminScraperTriggerProps {
  scraperType: string;
  label: string;
  slug?: string;
  keyword?: string;
}

export function AdminScraperTrigger({
  scraperType,
  label,
  slug,
  keyword,
}: AdminScraperTriggerProps) {
  const { user, fetchWithAuth } = useAuth();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  if (!user?.isSystemAdmin) return null;

  async function trigger() {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      const body: Record<string, string> = { type: scraperType };
      if (slug) body.slug = slug;
      if (keyword) body.keyword = keyword;
      await fetchWithAuth("/api/system-admin/scraper/trigger", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <Button
      onClick={trigger}
      disabled={status === "loading"}
      variant="outline"
      size="sm"
      title={status === "done" ? "Queued!" : label}
      className="border-amber-500/50 text-amber-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-500"
    >
      {status === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === "done" ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Zap className="h-3.5 w-3.5" />
      )}
      <span className="ml-1">{status === "done" ? "Queued!" : label}</span>
    </Button>
  );
}
