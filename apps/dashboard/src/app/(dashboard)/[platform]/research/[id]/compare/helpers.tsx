"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppData } from "./types";

// ─── CharBadge ──────────────────────────────────────────────

export function CharBadge({ count, max }: { count: number; max?: number }) {
  let colorClass = "border-muted-foreground text-muted-foreground";
  if (max) {
    if (count === 0) {
      colorClass = "border-muted-foreground/50 text-muted-foreground/50";
    } else {
      const pct = count / max;
      if (pct > 1) colorClass = "border-red-600 text-red-600";
      else if (pct >= 0.9) colorClass = "border-green-600 text-green-600";
      else if (pct >= 0.8) colorClass = "border-lime-600 text-lime-600";
      else if (pct >= 0.7) colorClass = "border-yellow-600 text-yellow-600";
      else if (pct >= 0.6) colorClass = "border-orange-500 text-orange-500";
      else colorClass = "border-red-600 text-red-600";
    }
  }
  return (
    <Badge variant="outline" className={cn("text-xs ml-2 shrink-0", colorClass)}>
      {count}{max ? `/${max}` : ""}
    </Badge>
  );
}

// ─── Stop Words & Keyword Density ───────────────────────────

export const STOP_WORDS = new Set([
  "the","a","an","is","are","am","was","were","be","been","being",
  "in","on","at","to","for","of","and","or","but","not","with",
  "by","from","as","it","its","this","that","these","those",
  "i","you","he","she","we","they","my","your","our","his","her","their",
  "me","us","him","them","do","does","did","have","has","had",
  "will","would","can","could","shall","should","may","might","must",
  "so","if","then","than","no","all","any","each","every","some",
  "such","very","just","about","up","out","how","what","which","who",
  "when","where","also","more","other","into","over","after","before",
]);

export function useKeywordDensity(text: string) {
  return useMemo(() => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);
    const totalWords = words.length;
    if (totalWords === 0) return [];
    const counts = new Map<string, number>();
    for (const w of words) {
      if (w.length < 2 || STOP_WORDS.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    for (let i = 0; i < words.length - 1; i++) {
      if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
      if (words[i].length < 2 || words[i + 1].length < 2) continue;
      const phrase = `${words[i]} ${words[i + 1]}`;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
    for (let i = 0; i < words.length - 2; i++) {
      if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 2])) continue;
      if (words[i].length < 2 || words[i + 2].length < 2) continue;
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 30)
      .map(([keyword, count]) => ({
        keyword,
        count,
        n: keyword.split(" ").length as 1 | 2 | 3,
        density: ((count / totalWords) * 100).toFixed(2),
      }));
  }, [text]);
}

export const N_GRAM_COLORS = {
  1: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  2: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  3: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
} as const;

// ─── StarRating ─────────────────────────────────────────────

export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(Math.max(rating - star + 1, 0), 1);
        return (
          <Star
            key={star}
            className={cn("h-4 w-4", fill >= 0.5 ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30")}
          />
        );
      })}
    </div>
  );
}

// ─── App Link & Icon ────────────────────────────────────────

export function getAppLink(slug: string, id: string) {
  if (slug.startsWith("__virtual__")) {
    const vaId = slug.replace("__virtual__", "");
    return `/research/${id}/virtual-apps/${vaId}`;
  }
  return `/apps/${slug}`;
}

export function AppIcon({ app, size = "sm" }: { app: AppData; size?: "sm" | "md" }) {
  const isVirtual = app.slug.startsWith("__virtual__");
  const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const emojiSize = size === "sm" ? "text-sm" : "text-base";
  if (isVirtual) {
    const color = app.color || "#3B82F6";
    return (
      <div
        className={cn(dim, "rounded flex items-center justify-center")}
        style={{ backgroundColor: `${color}20` }}
      >
        <span className={emojiSize}>{app.icon || "🚀"}</span>
      </div>
    );
  }
  if (app.iconUrl) {
    return <img src={app.iconUrl} alt="" className={cn(dim, "rounded")} />;
  }
  return <div className={cn(dim, "rounded bg-muted flex items-center justify-center text-xs font-bold")}>{app.name.charAt(0)}</div>;
}
