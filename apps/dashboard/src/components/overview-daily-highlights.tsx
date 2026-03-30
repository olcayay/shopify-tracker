"use client";

import Link from "next/link";
import { Trophy, MessageSquare, RefreshCw, Star, Eye, Megaphone, Calendar } from "lucide-react";
import type { PlatformId } from "@appranks/shared";

interface AppRef {
  slug: string;
  name: string;
  platform: string;
  iconUrl: string | null;
}

interface HighlightData {
  keywordMovers: { app: AppRef | null; keyword: string; oldPosition: number; newPosition: number; delta: number }[];
  categoryMovers: { app: AppRef | null; category: string; oldPosition: number; newPosition: number; delta: number }[];
  reviewPulse: { app: AppRef | null; v7d: number; v30d: number; momentum: string; latestRating: number | null }[];
  recentChanges: { app: AppRef | null; field: string; oldValue: string; newValue: string; detectedAt: string }[];
  featuredSightings: { app: AppRef | null; sectionTitle: string; position: number; seenDate: string }[];
  competitorAlerts: { competitor: { slug: string; name: string; platform: string }; field: string; oldValue: string; newValue: string; detectedAt: string }[];
  adActivity: { app: AppRef | null; keyword: string; seenDate: string }[];
}

interface HighlightCard {
  type: string;
  icon: typeof Trophy;
  title: string;
  detail: string;
  color: string;
  href: string;
  score: number;
  appSlug?: string;
}

/**
 * Select up to maxCards highlights, prioritized by score and deduplicated by app.
 */
export function selectHighlights(highlights: HighlightData, platformId: string, maxCards = 3): HighlightCard[] {
  const cards: HighlightCard[] = [];

  // 1. Biggest keyword movers
  for (const m of highlights.keywordMovers) {
    if (!m.app) continue;
    const direction = m.delta > 0 ? "jumped" : "dropped";
    const color = m.delta > 0 ? "border-green-500" : "border-red-500";
    cards.push({
      type: "keyword-mover",
      icon: Trophy,
      title: "Biggest Mover",
      detail: `${m.app.name} ${direction} #${m.oldPosition} → #${m.newPosition} for "${m.keyword}"`,
      color,
      href: `/${platformId}/apps/${m.app.slug}/keywords`,
      score: Math.abs(m.delta) * 10,
      appSlug: m.app.slug,
    });
  }

  // 2. Category movers
  for (const m of highlights.categoryMovers) {
    if (!m.app) continue;
    const direction = m.delta > 0 ? "rose" : "fell";
    const color = m.delta > 0 ? "border-green-500" : "border-red-500";
    cards.push({
      type: "category-mover",
      icon: Trophy,
      title: "Category Movement",
      detail: `${m.app.name} ${direction} #${m.oldPosition} → #${m.newPosition} in ${m.category}`,
      color,
      href: `/${platformId}/apps/${m.app.slug}`,
      score: Math.abs(m.delta) * 8,
      appSlug: m.app.slug,
    });
  }

  // 3. Review pulse
  for (const r of highlights.reviewPulse) {
    if (!r.app) continue;
    const momentum = r.momentum === "accelerating" ? " (accelerating)" : r.momentum === "decelerating" ? " (slowing)" : "";
    cards.push({
      type: "review-pulse",
      icon: MessageSquare,
      title: "Review Pulse",
      detail: `${r.app.name}: ${r.v7d} new reviews this week${momentum}`,
      color: "border-blue-500",
      href: `/${platformId}/apps/${r.app.slug}/reviews`,
      score: r.v7d * 5,
      appSlug: r.app.slug,
    });
  }

  // 4. Featured sightings
  for (const f of highlights.featuredSightings) {
    if (!f.app) continue;
    cards.push({
      type: "featured",
      icon: Star,
      title: "Featured Spotlight",
      detail: `${f.app.name} spotted in "${f.sectionTitle}" at #${f.position}`,
      color: "border-amber-500",
      href: `/${platformId}/apps/${f.app.slug}/featured`,
      score: 30 - (f.position || 0),
      appSlug: f.app.slug,
    });
  }

  // 5. Competitor alerts
  for (const c of highlights.competitorAlerts) {
    cards.push({
      type: "competitor-alert",
      icon: Eye,
      title: "Competitor Alert",
      detail: `${c.competitor.name} updated their ${c.field}`,
      color: "border-orange-500",
      href: `/${platformId}/apps/${c.competitor.slug}`,
      score: 20,
      appSlug: c.competitor.slug,
    });
  }

  // 6. Recent listing changes
  for (const ch of highlights.recentChanges) {
    if (!ch.app) continue;
    cards.push({
      type: "listing-update",
      icon: RefreshCw,
      title: "Listing Update",
      detail: `${ch.app.name} updated their ${ch.field}`,
      color: "border-purple-500",
      href: `/${platformId}/apps/${ch.app.slug}/changes`,
      score: 15,
      appSlug: ch.app.slug,
    });
  }

  // 7. Ad activity
  for (const a of highlights.adActivity) {
    if (!a.app) continue;
    cards.push({
      type: "ad-sighting",
      icon: Megaphone,
      title: "Ad Sighting",
      detail: `${a.app.name} is running ads on "${a.keyword}"`,
      color: "border-cyan-500",
      href: `/${platformId}/apps/${a.app.slug}/ads`,
      score: 10,
      appSlug: a.app.slug,
    });
  }

  // Sort by score descending, deduplicate by app slug
  cards.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const selected: HighlightCard[] = [];
  for (const card of cards) {
    if (card.appSlug && seen.has(card.appSlug)) continue;
    if (card.appSlug) seen.add(card.appSlug);
    selected.push(card);
    if (selected.length >= maxCards) break;
  }

  return selected;
}

interface DailyHighlightsProps {
  highlights: HighlightData;
  platformId: PlatformId;
}

export function DailyHighlights({ highlights, platformId }: DailyHighlightsProps) {
  const cards = selectHighlights(highlights, platformId);

  if (cards.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        No activity in the last 24h
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Calendar className="h-3.5 w-3.5" />
        <span>Today&apos;s Activity</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link
              key={i}
              href={card.href}
              className={`flex items-start gap-2.5 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border-l-2 ${card.color}`}
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">{card.title}</div>
                <div className="text-sm leading-snug">{card.detail}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
