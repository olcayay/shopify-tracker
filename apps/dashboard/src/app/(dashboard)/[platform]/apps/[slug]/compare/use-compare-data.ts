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
    loadData();
  }, [slug]);

  async function loadData() {
    setLoading(true);
    selectionInitialized.current = false;

    // Fetch main app + competitor list in parallel
    const [appRes, compRes] = await Promise.all([
      fetchWithAuth(`/api/apps/${encodeURIComponent(slug)}`),
      fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(slug)}/competitors`
      ),
    ]);

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

    // Fetch full data for all competitors in parallel
    if (compList.length > 0) {
      const results = await Promise.all(
        compList.map(async (c) => {
          const res = await fetchWithAuth(
            `/api/apps/${encodeURIComponent(c.slug)}`
          );
          if (res.ok) {
            const data: AppData = await res.json();
            return [c.slug, data] as [string, AppData];
          }
          return null;
        })
      );

      const map = new Map<string, AppData>();
      for (const r of results) {
        if (r) map.set(r[0], r[1]);
      }
      setCompetitorData(map);
    }

    // Fetch category rankings for all apps in parallel
    const allSlugs = [slug, ...compList.map((c) => c.slug)];
    const rankingResults = await Promise.all(
      allSlugs.map(async (s) => {
        const res = await fetchWithAuth(
          `/api/apps/${encodeURIComponent(s)}/rankings?days=7`
        );
        if (res.ok) {
          const data = await res.json();
          // Get latest position per category (ordered asc by scrapedAt, so last wins)
          const latestPerCat = new Map<string, CategoryRanking>();
          for (const r of data.categoryRankings || []) {
            latestPerCat.set(r.categorySlug, {
              categorySlug: r.categorySlug,
              categoryTitle: r.categoryTitle,
              position: r.position,
            });
          }
          return [s, [...latestPerCat.values()]] as [string, CategoryRanking[]];
        }
        return [s, []] as [string, CategoryRanking[]];
      })
    );
    const rankMap = new Map<string, CategoryRanking[]>();
    for (const [s, rankings] of rankingResults) {
      rankMap.set(s, rankings);
    }
    setRankingsData(rankMap);

    selectionInitialized.current = true;
    setLoading(false);
  }

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
