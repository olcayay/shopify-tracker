"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { VirtualApp, ResearchData, PricingPlan, CategoryTreeNode } from "./types";
import { ICON_SET, COLOR_SET, SECTIONS } from "./constants";
import { buildSlugMap } from "./helpers";

export function useVirtualAppEditor() {
  const params = useParams();
  const router = useRouter();
  const { fetchWithAuth, user } = useAuth();

  const id = params.id as string;
  const vaId = params.vaId as string;
  const platform = params.platform as string;
  const canEdit = user?.role === "owner" || user?.role === "admin" || user?.role === "editor";

  const isNew = vaId === "new";

  const [va, setVa] = useState<VirtualApp | null>(null);
  const [research, setResearch] = useState<ResearchData | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Stable random defaults for new mode
  const [newDefaults] = useState(() => ({
    icon: ICON_SET[Math.floor(Math.random() * ICON_SET.length)],
    color: COLOR_SET[Math.floor(Math.random() * COLOR_SET.length)],
  }));

  // Local form state
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [details, setDetails] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoMetaDesc, setSeoMetaDesc] = useState("");

  // Selected category slugs (max 2, leaf nodes only)
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState<string[]>([]);

  // Pricing plans local state
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
  const [deletePlanConfirm, setDeletePlanConfirm] = useState<number | null>(null);

  // Active section
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  // Slug map for breadcrumbs
  const catSlugMap = useMemo(() => buildSlugMap(categoryTree), [categoryTree]);


  // ── Load data ─────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const catTreeRes = fetchWithAuth(`/api/categories?format=tree&platform=${platform}`);

      if (isNew) {
        const [resRes, treeRes] = await Promise.all([
          fetchWithAuth(`/api/research-projects/${id}/data`),
          catTreeRes,
        ]);
        if (resRes.ok) setResearch(await resRes.json());
        if (treeRes.ok) setCategoryTree(await treeRes.json());

        const defaultVa: VirtualApp = {
          id: "new",
          researchProjectId: id,
          name: "My App",
          icon: newDefaults.icon,
          color: newDefaults.color,
          iconUrl: null,
          appCardSubtitle: "",
          appIntroduction: "",
          appDetails: "",
          seoTitle: "",
          seoMetaDescription: "",
          features: [],
          integrations: [],
          languages: [],
          categories: [],
          pricingPlans: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setVa(defaultVa);
        setName(defaultVa.name);
        setIcon(defaultVa.icon);
        setColor(defaultVa.color);
        setPricingPlans([]);
      } else {
        const [vaRes, resRes, treeRes] = await Promise.all([
          fetchWithAuth(`/api/research-projects/${id}/virtual-apps/${vaId}`),
          fetchWithAuth(`/api/research-projects/${id}/data`),
          catTreeRes,
        ]);

        if (!vaRes.ok) {
          router.push(`/${platform}/research/${id}`);
          return;
        }

        if (treeRes.ok) setCategoryTree(await treeRes.json());

        const vaData: VirtualApp = await vaRes.json();
        setVa(vaData);
        setName(vaData.name);
        setIcon(vaData.icon || "🚀");
        setColor(vaData.color || "#3B82F6");
        setIconUrl(vaData.iconUrl || "");
        setSubtitle(vaData.appCardSubtitle);
        setIntroduction(vaData.appIntroduction);
        setDetails(vaData.appDetails);
        setSeoTitle(vaData.seoTitle);
        setSeoMetaDesc(vaData.seoMetaDescription);
        setPricingPlans(
          (vaData.pricingPlans || []).map((p: any) => ({
            name: p.name || "",
            price: p.price ?? null,
            period: p.period ?? null,
            trial_text: p.trial_text ?? null,
            features: p.features || [],
          }))
        );

        if (resRes.ok) setResearch(await resRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [id, vaId, platform, isNew, newDefaults, fetchWithAuth, router]);

  // After category tree loads, derive selected slugs from VA categories
  useEffect(() => {
    if (categoryTree.length === 0 || !va) return;
    const slugMap = buildSlugMap(categoryTree);
    const vaCats = va.categories || [];
    // Extract slugs from VA category urls and titles
    const vaCatSlugs = new Set<string>();
    const vaCatTitles = new Set<string>();
    for (const cat of vaCats) {
      if (cat.url) {
        const slug = cat.url.replace(/.*\/categories\//, "").replace(/\?.*/, "");
        if (slug) vaCatSlugs.add(slug);
      }
      if (cat.title) vaCatTitles.add(cat.title);
    }
    const matchedSlugs: string[] = [];
    for (const [slug, node] of slugMap) {
      // Match by slug from URL, or by title (leaf nodes only for title match)
      if (vaCatSlugs.has(slug) || (vaCatTitles.has(node.title) && node.children.length === 0)) {
        matchedSlugs.push(slug);
      }
    }
    setSelectedCategorySlugs(matchedSlugs.slice(0, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryTree]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Unsaved changes guard ──────────────────────────────────

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleBack() {
    if (isDirty) {
      setShowLeaveModal(true);
      return;
    }
    router.push(`/${platform}/research/${id}`);
  }

  function confirmLeave() {
    setShowLeaveModal(false);
    setIsDirty(false);
    router.push(`/${platform}/research/${id}`);
  }

  // ── Dirty field wrapper ────────────────────────────────────

  function dirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setIsDirty(true);
    };
  }

  // ── Save ───────────────────────────────────────────────────

  /** Build categories array for saving: merge feature data + ensure entries for selected slugs */
  function buildCategoriesForSave(): any[] {
    const existingCats = va?.categories || [];
    // Map of title (lowercase) → category object with features
    const catByTitle = new Map<string, any>();
    for (const cat of existingCats) {
      catByTitle.set(cat.title.toLowerCase(), cat);
    }
    // Ensure each selected category slug has an entry
    for (const slug of selectedCategorySlugs) {
      const node = catSlugMap.get(slug);
      if (node && !catByTitle.has(node.title.toLowerCase())) {
        catByTitle.set(node.title.toLowerCase(), { title: node.title, url: "", subcategories: [] });
      }
    }
    // Only keep categories that are in selectedCategorySlugs (by title match)
    const selectedTitlesLower = new Set(
      selectedCategorySlugs.map((s) => catSlugMap.get(s)?.title?.toLowerCase()).filter(Boolean)
    );
    return Array.from(catByTitle.values()).filter(
      (cat) => selectedTitlesLower.has(cat.title.toLowerCase())
    );
  }

  async function saveTextFields() {
    if (!canEdit || !va) return;
    setSaving(true);
    try {
      const sortedPlans = [...pricingPlans].sort((a, b) => {
        const aPrice = parseFloat(a.price || "0") || 0;
        const bPrice = parseFloat(b.price || "0") || 0;
        return aPrice - bPrice;
      });

      const categoriesToSave = buildCategoriesForSave();

      if (isNew) {
        const res = await fetchWithAuth(`/api/research-projects/${id}/virtual-apps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            icon,
            color,
            iconUrl: iconUrl || null,
            appCardSubtitle: subtitle,
            appIntroduction: introduction,
            appDetails: details,
            seoTitle,
            seoMetaDescription: seoMetaDesc,
            languages: va.languages || [],
            features: va.features || [],
            integrations: va.integrations || [],
            categories: categoriesToSave,
            pricingPlans: sortedPlans,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setIsDirty(false);
          router.replace(`/${platform}/research/${id}/virtual-apps/${created.id}`);
        }
      } else {
        const res = await fetchWithAuth(`/api/research-projects/${id}/virtual-apps/${vaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            icon,
            color,
            iconUrl: iconUrl || null,
            appCardSubtitle: subtitle,
            appIntroduction: introduction,
            appDetails: details,
            seoTitle,
            seoMetaDescription: seoMetaDesc,
            languages: va.languages || [],
            categories: categoriesToSave,
            pricingPlans: sortedPlans,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setVa(updated);
          setPricingPlans(
            (updated.pricingPlans || []).map((p: any) => ({
              name: p.name || "",
              price: p.price ?? null,
              period: p.period ?? null,
              trial_text: p.trial_text ?? null,
              features: p.features || [],
            }))
          );
          setIsDirty(false);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Feature / Integration / Category handlers ─────────────

  async function handleAddCategoryFeature(catTitle: string, subTitle: string, feature: any) {
    if (isNew) {
      if (!va) return;
      const newCats = JSON.parse(JSON.stringify(va.categories || []));
      let cat = newCats.find((c: any) => c.title === catTitle);
      if (!cat) {
        cat = { title: catTitle, subcategories: [] };
        newCats.push(cat);
      }
      let sub = (cat.subcategories || []).find((s: any) => s.title === subTitle);
      if (!sub) {
        sub = { title: subTitle, features: [] };
        cat.subcategories.push(sub);
      }
      if (!(sub.features || []).some((f: any) => f.feature_handle === feature.feature_handle)) {
        sub.features = [
          ...(sub.features || []),
          { title: feature.title, feature_handle: feature.feature_handle, url: feature.url },
        ];
      }
      setVa({ ...va, categories: newCats });
      setIsDirty(true);
    } else {
      const res = await fetchWithAuth(
        `/api/research-projects/${id}/virtual-apps/${vaId}/add-category-feature`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryTitle: catTitle,
            subcategoryTitle: subTitle,
            featureTitle: feature.title,
            featureHandle: feature.feature_handle,
            featureUrl: feature.url,
          }),
        }
      );
      if (res.ok) setVa(await res.json());
    }
  }

  async function handleRemoveCategoryFeature(catTitle: string, subTitle: string, featureHandle: string) {
    if (isNew) {
      if (!va) return;
      const newCats = JSON.parse(JSON.stringify(va.categories || []));
      const cat = newCats.find((c: any) => c.title === catTitle);
      if (!cat) return;
      const sub = (cat.subcategories || []).find((s: any) => s.title === subTitle);
      if (!sub) return;
      sub.features = (sub.features || []).filter((f: any) => f.feature_handle !== featureHandle);
      if (sub.features.length === 0) {
        cat.subcategories = cat.subcategories.filter((s: any) => s.title !== subTitle);
      }
      if (cat.subcategories.length === 0) {
        const idx = newCats.indexOf(cat);
        if (idx !== -1) newCats.splice(idx, 1);
      }
      setVa({ ...va, categories: newCats });
      setIsDirty(true);
    } else {
      const res = await fetchWithAuth(
        `/api/research-projects/${id}/virtual-apps/${vaId}/remove-category-feature`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryTitle: catTitle, subcategoryTitle: subTitle, featureHandle }),
        }
      );
      if (res.ok) setVa(await res.json());
    }
  }

  async function handleAddFeature(feature: string) {
    if (isNew) {
      if (!va || (va.features || []).includes(feature)) return;
      setVa({ ...va, features: [...(va.features || []), feature] });
      setIsDirty(true);
    } else {
      const res = await fetchWithAuth(
        `/api/research-projects/${id}/virtual-apps/${vaId}/add-feature`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature }),
        }
      );
      if (res.ok) setVa(await res.json());
    }
  }

  async function handleRemoveFeature(feature: string) {
    if (isNew) {
      if (!va) return;
      setVa({ ...va, features: (va.features || []).filter((f) => f !== feature) });
      setIsDirty(true);
    } else {
      const res = await fetchWithAuth(
        `/api/research-projects/${id}/virtual-apps/${vaId}/remove-feature`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feature }),
        }
      );
      if (res.ok) setVa(await res.json());
    }
  }

  async function handleAddIntegration(integration: string) {
    if (isNew) {
      if (!va || (va.integrations || []).includes(integration)) return;
      setVa({ ...va, integrations: [...(va.integrations || []), integration] });
      setIsDirty(true);
    } else {
      const res = await fetchWithAuth(
        `/api/research-projects/${id}/virtual-apps/${vaId}/add-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ integration }),
        }
      );
      if (res.ok) setVa(await res.json());
    }
  }

  async function handleRemoveIntegration(integration: string) {
    if (isNew) {
      if (!va) return;
      setVa({ ...va, integrations: (va.integrations || []).filter((i) => i !== integration) });
      setIsDirty(true);
    } else {
      const res = await fetchWithAuth(
        `/api/research-projects/${id}/virtual-apps/${vaId}/remove-integration`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ integration }),
        }
      );
      if (res.ok) setVa(await res.json());
    }
  }

  // ── Language handlers ───────────────────────────────────────

  function handleToggleLanguage(lang: string) {
    if (!va) return;
    const langs = va.languages || [];
    if (langs.includes(lang)) {
      setVa({ ...va, languages: langs.filter((l) => l !== lang) });
    } else {
      setVa({ ...va, languages: [...langs, lang] });
    }
    setIsDirty(true);
  }

  function handleAddCustomLanguage(lang: string) {
    if (!va || !lang.trim()) return;
    const trimmed = lang.trim();
    if ((va.languages || []).includes(trimmed)) return;
    setVa({ ...va, languages: [...(va.languages || []), trimmed] });
    setIsDirty(true);
  }

  // ── Category selection handlers ────────────────────────────

  function handleToggleCategorySlug(slug: string) {
    setSelectedCategorySlugs((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= 2) return prev; // max 2
      return [...prev, slug];
    });
    setIsDirty(true);
  }

  // ── Pricing plan handlers ──────────────────────────────────

  function addPricingPlan() {
    setPricingPlans((prev) => [
      ...prev,
      { name: "", price: null, period: "month", trial_text: null, features: [] },
    ]);
    const newIdx = pricingPlans.length;
    setEditingPlanIndex(newIdx);
    setIsDirty(true);
  }

  function updatePricingPlan(index: number, updates: Partial<PricingPlan>) {
    setPricingPlans((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    setIsDirty(true);
  }

  function removePricingPlan(index: number) {
    setPricingPlans((prev) => prev.filter((_, i) => i !== index));
    setEditingPlanIndex(null);
    setDeletePlanConfirm(null);
    setIsDirty(true);
  }

  function addPlanFeature(planIndex: number) {
    setPricingPlans((prev) => {
      const next = [...prev];
      next[planIndex] = { ...next[planIndex], features: [...next[planIndex].features, ""] };
      return next;
    });
    setIsDirty(true);
  }

  function updatePlanFeature(planIndex: number, featIndex: number, value: string) {
    setPricingPlans((prev) => {
      const next = [...prev];
      const features = [...next[planIndex].features];
      features[featIndex] = value;
      next[planIndex] = { ...next[planIndex], features };
      return next;
    });
    setIsDirty(true);
  }

  function removePlanFeature(planIndex: number, featIndex: number) {
    setPricingPlans((prev) => {
      const next = [...prev];
      next[planIndex] = {
        ...next[planIndex],
        features: next[planIndex].features.filter((_, i) => i !== featIndex),
      };
      return next;
    });
    setIsDirty(true);
  }

  // ── Competitor data aggregation ────────────────────────────

  const competitorLanguages = useMemo(() => {
    if (!research) return [];
    const map = new Map<string, { count: number; names: string[] }>();
    for (const comp of research.competitors) {
      for (const lang of comp.languages || []) {
        if (!map.has(lang)) map.set(lang, { count: 0, names: [] });
        const entry = map.get(lang)!;
        if (!entry.names.includes(comp.name)) {
          entry.count++;
          entry.names.push(comp.name);
        }
      }
    }
    return Array.from(map.entries())
      .map(([lang, { count, names }]) => ({ lang, count, names }))
      .sort((a, b) => b.count - a.count || a.lang.localeCompare(b.lang));
  }, [research]);

  // Competitor category counts: map of slug (from URL) → { count, names }
  const competitorCategoryCounts = useMemo(() => {
    if (!research) return new Map<string, { count: number; names: string[] }>();
    const map = new Map<string, { count: number; names: string[] }>();
    for (const comp of research.competitors) {
      for (const cat of comp.categories || []) {
        const m = cat.url?.match(/\/categories\/([^/?#]+)/);
        const slug = m ? m[1] : cat.title.toLowerCase();
        if (!map.has(slug)) map.set(slug, { count: 0, names: [] });
        const entry = map.get(slug)!;
        if (!entry.names.includes(comp.name)) {
          entry.count++;
          entry.names.push(comp.name);
        }
      }
    }
    return map;
  }, [research]);

  // Sorted pricing plans for display (free first, then ascending)
  const sortedPricingPlans = useMemo(() => {
    return pricingPlans.map((plan, idx) => ({ plan, originalIdx: idx })).sort((a, b) => {
      const aPrice = parseFloat(a.plan.price || "0") || 0;
      const bPrice = parseFloat(b.plan.price || "0") || 0;
      return aPrice - bPrice;
    });
  }, [pricingPlans]);

  // ── Intersection observer ──────────────────────────────────

  useEffect(() => {
    if (!va) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [va]);

  function scrollToSection(sectionId: string) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
  }

  return {
    // Params
    id,
    vaId,
    platform,
    isNew,
    canEdit,

    // State
    va,
    research,
    categoryTree,
    loading,
    saving,
    isDirty,
    showLeaveModal,
    setShowLeaveModal,

    // Form fields
    name,
    setName,
    icon,
    setIcon,
    color,
    setColor,
    iconUrl,
    setIconUrl,
    subtitle,
    setSubtitle,
    introduction,
    setIntroduction,
    details,
    setDetails,
    seoTitle,
    setSeoTitle,
    seoMetaDesc,
    setSeoMetaDesc,

    // Categories
    selectedCategorySlugs,
    catSlugMap,
    handleToggleCategorySlug,
    competitorCategoryCounts,

    // Pricing
    pricingPlans,
    editingPlanIndex,
    setEditingPlanIndex,
    deletePlanConfirm,
    setDeletePlanConfirm,
    sortedPricingPlans,
    addPricingPlan,
    updatePricingPlan,
    removePricingPlan,
    addPlanFeature,
    updatePlanFeature,
    removePlanFeature,

    // Competitor data
    competitorLanguages,

    // Section navigation
    activeSection,
    scrollToSection,

    // Actions
    handleBack,
    confirmLeave,
    dirty,
    saveTextFields,
    handleAddCategoryFeature,
    handleRemoveCategoryFeature,
    handleAddFeature,
    handleRemoveFeature,
    handleAddIntegration,
    handleRemoveIntegration,
    handleToggleLanguage,
    handleAddCustomLanguage,

    // Auth
    fetchWithAuth,

    // Router
    router,
  };
}

export type VirtualAppEditorState = ReturnType<typeof useVirtualAppEditor>;
