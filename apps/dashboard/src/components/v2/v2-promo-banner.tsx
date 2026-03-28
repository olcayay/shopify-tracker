"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { X, Sparkles } from "lucide-react";

const STORAGE_KEY = "v2-banner-dismissed";

export function V2PromoBanner() {
  const { platform, slug } = useParams();
  const [dismissed, setDismissed] = useState(true); // default hidden until checked

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Try the new app detail experience!</span>
        <Link
          href={`/${platform}/apps/v2/${slug}`}
          className="font-medium text-primary hover:underline"
        >
          Switch to v2 →
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss v2 banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
