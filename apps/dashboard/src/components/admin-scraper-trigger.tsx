"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, Check } from "lucide-react";
import { ScraperOptionsModal, type ScraperOptions } from "./scraper-options-modal";

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
  const [modalOpen, setModalOpen] = useState(false);

  if (!user?.isSystemAdmin) return null;

  async function trigger(options: ScraperOptions) {
    setModalOpen(false);
    if (status !== "idle") return;
    setStatus("loading");
    try {
      const body: Record<string, any> = { type: scraperType };
      if (slug) body.slug = slug;
      if (keyword) body.keyword = keyword;
      if (Object.keys(options).length > 0) body.options = options;
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
    <>
      <Button
        onClick={() => setModalOpen(true)}
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
      <ScraperOptionsModal
        open={modalOpen}
        scraperType={scraperType}
        label={label}
        onConfirm={trigger}
        onCancel={() => setModalOpen(false)}
      />
    </>
  );
}
