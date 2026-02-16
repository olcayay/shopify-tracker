"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Play, Loader2, Check } from "lucide-react";

const SCRAPER_MAP: { pattern: RegExp; type: string; label: string }[] = [
  { pattern: /^\/apps/, type: "app_details", label: "App Details Scraper" },
  {
    pattern: /^\/keywords/,
    type: "keyword_search",
    label: "Keyword Search Scraper",
  },
  { pattern: /^\/categories/, type: "category", label: "Category Scraper" },
  { pattern: /^\/competitors/, type: "app_details", label: "App Details Scraper" },
];

function getScraperForPath(pathname: string) {
  for (const entry of SCRAPER_MAP) {
    if (entry.pattern.test(pathname)) {
      return entry;
    }
  }
  return null;
}

export function AdminScraperTrigger() {
  const { user, fetchWithAuth } = useAuth();
  const pathname = usePathname();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  if (!user?.isSystemAdmin) return null;

  const scraper = getScraperForPath(pathname);
  if (!scraper) return null;

  async function trigger() {
    if (status !== "idle") return;
    setStatus("loading");
    try {
      await fetchWithAuth("/api/system-admin/scraper/trigger", {
        method: "POST",
        body: JSON.stringify({ type: scraper!.type }),
      });
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <button
      onClick={trigger}
      disabled={status === "loading"}
      title={status === "done" ? "Triggered!" : `Run ${scraper.label}`}
      className="fixed top-4 right-4 z-50 flex items-center justify-center h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      {status === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : status === "done" ? (
        <Check className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
    </button>
  );
}
