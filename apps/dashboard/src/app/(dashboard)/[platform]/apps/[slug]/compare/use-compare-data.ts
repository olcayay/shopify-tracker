"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import type { AppData, CategoryRanking } from "./compare-types";

export function useCompareData(slug: string) {
  const { fetchWithAuth } = useAuth();

  const [mainApp, setMainApp] = useState<AppData | null>(null);
  const [competitors, setCompetitors] = useState<
    { slug: string; name: string; iconUrl: string | null }[]
  >([]);
  const [competitorData, setCompetitorData] = useState<Map<string, AppData>>(
    new Map()
  );
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [rankingsData, setRankingsData] = useState<Map<string, CategoryRanking[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [activeDetailSlug, setActiveDetailSlug] = useState<string>("");

  // Track whether initial selection was loaded from localStorage
  const selectionInitialized = useRef(false);
  // Stable ref for fetchWithAuth to avoid re-triggering useEffect
  const fetchRef = useRef(fetchWithAuth);
  useEffect(() => { fetchRef.current = fetchWithAuth; }, [fetchWithAuth]);

  // Persist selected slugs per app
  useEffect(() => {
    if (selectionInitialized.current && competitors.length > 0) {
      localStorage.setItem(
        `compare-selected-${slug}`,
        JSON.stringify([...selectedSlugs])
      );
    }
  }, [selectedSlugs, slug, competitors.length]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    selectionInitialized.current = false;

    const fetch = fetchRef.current;

    (async () => {
      // Fetch main app + competitor list in parallel
      const [appRes, compRes] = await Promise.all([
        fetch(`/api/apps/${encodeURIComponent(slug)}`),
        fetch(`/api/account/tracked-apps/${encodeURIComponent(slug)}/competitors?fields=basic`),
      ]);

      if (cancelled) return;

      let mainAppData: AppData | null = null;
      let compList: { slug: string; name: string; iconUrl: string | null }[] = [];

      if (appRes.ok) {
        mainAppData = await appRes.json();
        setMainApp(mainAppData);
        setActiveDetailSlug(mainAppData!.slug);
      }

      if (compRes.ok) {
        const comps = await compRes.json();
        compList = comps.map((c: any) => ({
          slug: c.appSlug,
          name: c.appName || c.appSlug,
          iconUrl: c.iconUrl,
        }));
        setCompetitors(compList);

        // Restore saved selection or default to all
        try {
          const saved = localStorage.getItem(`compare-selected-${slug}`);
          if (saved) {
            const savedArr: string[] = JSON.parse(saved);
            const validSlugs = new Set(
              savedArr.filter((s) => compList.some((c) => c.slug === s))
            );
            setSelectedSlugs(
              validSlugs.size > 0
                ? validSlugs
                : new Set(compList.map((c) => c.slug))
            );
          } else {
            setSelectedSlugs(new Set(compList.map((c) => c.slug)));
          }
        } catch {
          setSelectedSlugs(new Set(compList.map((c) => c.slug)));
        }
      }

      if (cancelled) return;

      // Fetch competitor app data + all rankings in parallel (single wave)
      const allSlugs = [slug, ...compList.map((c) => c.slug)];
      const [compResults, batchRankingsRes] = await Promise.all([
        compList.length > 0
          ? Promise.all(
              compList.map(async (c) => {
                const res = await fetch(`/api/apps/${encodeURIComponent(c.slug)}`);
                if (res.ok) {
                  const data: AppData = await res.json();
                  return [c.slug, data] as [string, AppData];
                }
                return null;
              })
            )
          : Promise.resolve([]),
        fetch(`/api/apps/batch-rankings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs: allSlugs, days: 7 }),
        }),
      ]);

      if (cancelled) return;

      if (compResults) {
        const map = new Map<string, AppData>();
        for (const r of compResults as ([string, AppData] | null)[]) {
          if (r) map.set(r[0], r[1]);
        }
        setCompetitorData(map);
      }

      const rankMap = new Map<string, CategoryRanking[]>();
      if (batchRankingsRes.ok) {
        const batchData = await batchRankingsRes.json() as Record<string, { categoryRankings: any[] }>;
        for (const s of allSlugs) {
          const appRankings = batchData[s]?.categoryRankings || [];
          const latestPerCat = new Map<string, CategoryRanking>();
          for (const r of appRankings) {
            // First entry per category is latest (ordered by scrapedAt desc)
            if (!latestPerCat.has(r.categorySlug)) {
              latestPerCat.set(r.categorySlug, {
                categorySlug: r.categorySlug,
                categoryTitle: r.categorySlug,
                position: r.position,
              });
            }
          }
          rankMap.set(s, [...latestPerCat.values()]);
        }
      }
      setRankingsData(rankMap);

      selectionInitialized.current = true;
      setLoading(false);
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function toggleCompetitor(compSlug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(compSlug)) {
        next.delete(compSlug);
      } else {
        next.add(compSlug);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedSlugs.size === competitors.length) {
      setSelectedSlugs(new Set());
    } else {
      setSelectedSlugs(new Set(competitors.map((c) => c.slug)));
    }
  }

  // Build ordered list of selected apps (main first, then selected competitors)
  const selectedApps = useMemo(() => {
    const apps: AppData[] = [];
    if (mainApp) apps.push(mainApp);
    for (const c of competitors) {
      if (selectedSlugs.has(c.slug) && competitorData.has(c.slug)) {
        apps.push(competitorData.get(c.slug)!);
      }
    }
    return apps;
  }, [mainApp, competitors, selectedSlugs, competitorData]);

  return {
    mainApp,
    competitors,
    setCompetitors,
    selectedSlugs,
    rankingsData,
    loading,
    activeDetailSlug,
    setActiveDetailSlug,
    selectedApps,
    toggleCompetitor,
    toggleAll,
    fetchWithAuth,
  };
}
