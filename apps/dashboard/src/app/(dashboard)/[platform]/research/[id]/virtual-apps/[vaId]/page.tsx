"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Sparkles,
  Save,
  Loader2,
  LayoutGrid,
  List,
  Puzzle,
  FileText,
  DollarSign,
  Globe,
  Search as SearchIcon,
  Link as LinkIcon,
  FolderOpen,
  Folder,
  Eye,
  Check,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { CategoryFeaturePicker } from "@/components/virtual-app/category-feature-picker";
import { FeaturePicker } from "@/components/virtual-app/feature-picker";
import { IntegrationPicker } from "@/components/virtual-app/integration-picker";
import { CompetitorCountBadge } from "@/components/virtual-app/competitor-count-badge";

// ─── Types ───────────────────────────────────────────────────

interface VirtualApp {
  id: string;
  researchProjectId: string;
  name: string;
  icon: string;
  color: string;
  iconUrl: string | null;
  appCardSubtitle: string;
  appIntroduction: string;
  appDetails: string;
  seoTitle: string;
  seoMetaDescription: string;
  features: string[];
  integrations: string[];
  languages: string[];
  categories: any[];
  pricingPlans: any[];
  createdAt: string;
  updatedAt: string;
}

interface ResearchData {
  project: { id: string; name: string };
  competitors: {
    slug: string;
    name: string;
    categories: any[];
    features: string[];
    integrations: string[];
    languages: string[];
    pricingPlans: any[];
  }[];
}

interface PricingPlan {
  name: string;
  price: string | null;
  period: string | null;
  trial_text: string | null;
  features: string[];
}

interface CategoryTreeNode {
  slug: string;
  title: string;
  parentSlug: string | null;
  categoryLevel: number;
  isListingPage: boolean;
  appCount: number | null;
  children: CategoryTreeNode[];
}

// ─── Constants ──────────────────────────────────────────────

const ICON_SET = ["🚀", "💡", "⚡", "🎯", "🔮", "🌟", "💎", "🎨", "🔥", "🌊", "🦋", "🍀", "🎲", "🪐", "🎸", "🦄"];
const COLOR_SET = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#6366F1", "#D946EF"];

const SECTIONS = [
  { id: "sec-basic", key: "basic", label: "Basic Info", icon: Sparkles },
  { id: "sec-categories", key: "categories", label: "Categories", icon: FolderOpen },
  { id: "sec-catfeatures", key: "catfeatures", label: "Category Features", icon: LayoutGrid },
  { id: "sec-features", key: "features", label: "Features", icon: List },
  { id: "sec-integrations", key: "integrations", label: "Integrations", icon: Puzzle },
  { id: "sec-text", key: "text", label: "Description", icon: FileText },
  { id: "sec-pricing", key: "pricing", label: "Pricing", icon: DollarSign },
  { id: "sec-languages", key: "languages", label: "Languages", icon: Globe },
  { id: "sec-seo", key: "seo", label: "SEO", icon: SearchIcon },
] as const;

// ─── Helpers ─────────────────────────────────────────────────

/** Build slug→node map from category tree */
function buildSlugMap(nodes: CategoryTreeNode[]): Map<string, CategoryTreeNode> {
  const map = new Map<string, CategoryTreeNode>();
  function walk(list: CategoryTreeNode[]) {
    for (const n of list) {
      map.set(n.slug, n);
      walk(n.children);
    }
  }
  walk(nodes);
  return map;
}

/** Get breadcrumb path for a category slug */
function getBreadcrumb(slug: string, slugMap: Map<string, CategoryTreeNode>): string {
  const parts: string[] = [];
  let node = slugMap.get(slug);
  while (node) {
    parts.unshift(node.title);
    node = node.parentSlug ? slugMap.get(node.parentSlug) : undefined;
  }
  return parts.join(" > ");
}

// ─── Main Page ───────────────────────────────────────────────

export default function VirtualAppEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { fetchWithAuth, user } = useAuth();

  const id = params.id as string;
  const vaId = params.vaId as string;
  const platform = params.platform as string;
  const canEdit = user?.role === "owner" || user?.role === "editor";

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

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!va) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-4">Virtual app not found</p>
        <Button variant="outline" onClick={() => router.push(`/${platform}/research/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Project
        </Button>
      </div>
    );
  }

  const totalCompetitors = research?.competitors?.length || 0;

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <div className="hidden lg:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Project
          </button>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="h-6 w-6 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}20` }}
            >
              <span className="text-xs">{icon}</span>
            </div>
            <span className="font-semibold text-sm truncate">{name || "My App"}</span>
            {isNew && <Badge variant="secondary" className="text-[10px] px-1 py-0">New</Badge>}
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={cn(
                  "flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                  activeSection === s.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {s.label}
              </button>
            );
          })}

          {/* Preview button */}
          {!isNew ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => router.push(`/${platform}/research/${id}/virtual-apps/${vaId}/preview`)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 opacity-50 cursor-not-allowed"
              disabled
              title="Save first to preview"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
          )}

          {canEdit && (
            <Button
              onClick={saveTextFields}
              disabled={saving}
              className="w-full mt-2"
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isNew ? "Create" : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3">
          <button onClick={handleBack} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}20` }}
            >
              <span className="text-xs">{icon}</span>
            </div>
            <h1 className="text-xl font-bold truncate">{name || "My App"}</h1>
            {isNew && <Badge variant="secondary" className="text-[10px] px-1 py-0">New</Badge>}
          </div>
          {canEdit && (
            <Button onClick={saveTextFields} disabled={saving} size="sm" className="ml-auto">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>

        {/* Basic Info */}
        <Card id="sec-basic" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" /> Basic Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">App Name</label>
              <Input
                value={name}
                onChange={(e) => dirty(setName)(e.target.value)}
                disabled={!canEdit}
                className="max-w-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subtitle</label>
              <Input
                value={subtitle}
                onChange={(e) => dirty(setSubtitle)(e.target.value)}
                disabled={!canEdit}
                className="max-w-lg"
                placeholder="Short tagline..."
              />
              <p className="text-xs text-muted-foreground mt-1">{subtitle.length}/62 characters</p>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="text-sm font-medium mb-2 block">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_SET.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => dirty(setIcon)(emoji)}
                    disabled={!canEdit}
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-all",
                      icon === emoji
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-muted"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SET.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => dirty(setColor)(c)}
                    disabled={!canEdit}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      color === c
                        ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                        : "hover:scale-110"
                    )}
                    style={{
                      backgroundColor: c,
                      ...(color === c ? { ["--tw-ring-color" as any]: c } : {}),
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Custom Icon URL */}
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Custom Icon URL
              </label>
              <Input
                value={iconUrl}
                onChange={(e) => dirty(setIconUrl)(e.target.value)}
                disabled={!canEdit}
                className="max-w-lg"
                placeholder="https://... (overrides emoji icon)"
              />
              {iconUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={iconUrl}
                    alt="preview"
                    className="h-8 w-8 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Preview</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card id="sec-categories" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" /> Categories
              <Badge variant="secondary" className="text-xs">{selectedCategorySlugs.length}/2</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Selected categories with breadcrumb */}
            {selectedCategorySlugs.length > 0 && (
              <div className="space-y-1 mb-3 pb-3 border-b">
                {selectedCategorySlugs.map((slug) => (
                  <div key={slug} className="flex items-center gap-2 py-1 px-2 rounded bg-blue-50 dark:bg-blue-950/30">
                    <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      {getBreadcrumb(slug, catSlugMap)}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => handleToggleCategorySlug(slug)}
                        className="ml-auto text-blue-400 hover:text-red-500 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {selectedCategorySlugs.length >= 2 && (
                  <p className="text-xs text-muted-foreground mt-1">Maximum 2 categories selected.</p>
                )}
              </div>
            )}

            {/* Category tree */}
            {categoryTree.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No categories available.</p>
            ) : (
              <CategoryTreePicker
                tree={categoryTree}
                selectedSlugs={selectedCategorySlugs}
                onToggle={handleToggleCategorySlug}
                disabled={!canEdit}
                maxSelected={2}
                competitorCategoryCounts={competitorCategoryCounts}
                totalCompetitors={totalCompetitors}
              />
            )}
          </CardContent>
        </Card>

        {/* Category Features */}
        <Card id="sec-catfeatures" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4" /> Category Features
              <Badge variant="secondary" className="text-xs">
                {(va.categories || []).reduce(
                  (acc: number, cat: any) =>
                    acc +
                    (cat.subcategories || []).reduce(
                      (a2: number, sub: any) => a2 + (sub.features?.length || 0),
                      0
                    ),
                  0
                )}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryFeaturePicker
              selectedCategorySlugs={selectedCategorySlugs}
              competitors={research?.competitors || []}
              selectedFeatures={va.categories || []}
              onAdd={handleAddCategoryFeature}
              onRemove={handleRemoveCategoryFeature}
              disabled={!canEdit}
              fetchWithAuth={fetchWithAuth}
            />
          </CardContent>
        </Card>

        {/* Features */}
        <Card id="sec-features" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <List className="h-4 w-4" /> Features
              <Badge variant="secondary" className="text-xs">{(va.features || []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeaturePicker
              competitors={research?.competitors || []}
              selectedFeatures={va.features || []}
              onAdd={handleAddFeature}
              onRemove={handleRemoveFeature}
              disabled={!canEdit}
            />
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card id="sec-integrations" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Puzzle className="h-4 w-4" /> Integrations
              <Badge variant="secondary" className="text-xs">{(va.integrations || []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IntegrationPicker
              competitors={research?.competitors || []}
              selectedIntegrations={va.integrations || []}
              onAdd={handleAddIntegration}
              onRemove={handleRemoveIntegration}
              disabled={!canEdit}
            />
          </CardContent>
        </Card>

        {/* Description / Text */}
        <Card id="sec-text" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Description
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Introduction
                <span className="text-xs text-muted-foreground ml-2">{introduction.length}/100</span>
              </label>
              <textarea
                value={introduction}
                onChange={(e) => dirty(setIntroduction)(e.target.value)}
                disabled={!canEdit}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Brief introduction..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                App Details
                <span className="text-xs text-muted-foreground ml-2">{details.length} chars</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => dirty(setDetails)(e.target.value)}
                disabled={!canEdit}
                rows={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Detailed description of your app..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card id="sec-pricing" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" /> Pricing Plans
              <Badge variant="secondary" className="text-xs">{pricingPlans.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Competitor Pricing Reference */}
            {research && research.competitors.some((c) => (c.pricingPlans || []).length > 0) && (
              <CompetitorPricingReference competitors={research.competitors} />
            )}

            {/* Plan cards row */}
            {sortedPricingPlans.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {sortedPricingPlans.map(({ plan, originalIdx }) => {
                  const isEditing = editingPlanIndex === originalIdx;
                  return (
                    <div
                      key={originalIdx}
                      className="border rounded-lg p-4 min-w-[240px] max-w-[280px] shrink-0 space-y-3 relative"
                    >
                      {isEditing ? (
                        /* ── Edit mode ── */
                        <>
                          {canEdit && (
                            <button
                              onClick={() => setDeletePlanConfirm(originalIdx)}
                              className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                              title="Delete plan"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <Input
                            value={plan.name}
                            onChange={(e) => updatePricingPlan(originalIdx, { name: e.target.value })}
                            disabled={!canEdit}
                            placeholder="Plan name"
                            className="h-8 text-sm font-medium"
                          />
                          <div className="flex gap-2">
                            <Input
                              value={plan.price || ""}
                              onChange={(e) => updatePricingPlan(originalIdx, { price: e.target.value || null })}
                              disabled={!canEdit}
                              placeholder="0 = Free"
                              className="h-8 text-sm flex-1"
                              type="number"
                              min="0"
                              step="0.01"
                            />
                            <select
                              value={plan.period || "month"}
                              onChange={(e) => updatePricingPlan(originalIdx, { period: e.target.value })}
                              disabled={!canEdit}
                              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="month">/ month</option>
                              <option value="year">/ year</option>
                            </select>
                          </div>
                          <Input
                            value={plan.trial_text || ""}
                            onChange={(e) => updatePricingPlan(originalIdx, { trial_text: e.target.value || null })}
                            disabled={!canEdit}
                            placeholder="Trial text (optional)"
                            className="h-8 text-sm"
                          />
                          <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1">Features</p>
                            <div className="space-y-1">
                              {plan.features.map((feat, fi) => (
                                <div key={fi} className="flex gap-1">
                                  <Input
                                    value={feat}
                                    onChange={(e) => updatePlanFeature(originalIdx, fi, e.target.value)}
                                    disabled={!canEdit}
                                    placeholder={`Feature ${fi + 1}`}
                                    className="h-7 text-xs flex-1"
                                  />
                                  {canEdit && (
                                    <button
                                      onClick={() => removePlanFeature(originalIdx, fi)}
                                      className="text-muted-foreground hover:text-destructive shrink-0"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addPlanFeature(originalIdx)}
                                className="text-xs mt-1 h-6 px-2"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add feature
                              </Button>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full mt-1"
                            onClick={() => setEditingPlanIndex(null)}
                          >
                            Done
                          </Button>
                        </>
                      ) : (
                        /* ── View mode ── */
                        <>
                          {canEdit && (
                            <div className="absolute top-2 right-2 flex gap-1">
                              <button
                                onClick={() => setEditingPlanIndex(originalIdx)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Edit plan"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletePlanConfirm(originalIdx)}
                                className="text-muted-foreground hover:text-destructive"
                                title="Delete plan"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <p className="text-sm font-medium pr-12">{plan.name || "Unnamed Plan"}</p>
                          <p className="text-xl font-bold">
                            {plan.price && parseFloat(plan.price) > 0 ? `$${plan.price}` : "Free"}
                            {plan.price && parseFloat(plan.price) > 0 && plan.period && (
                              <span className="text-xs font-normal text-muted-foreground"> / {plan.period}</span>
                            )}
                          </p>
                          {plan.trial_text && (
                            <p className="text-xs text-emerald-600">{plan.trial_text}</p>
                          )}
                          {plan.features.length > 0 && (
                            <div className="border-t pt-2 space-y-1">
                              {plan.features.filter(Boolean).map((feat, fi) => (
                                <p key={fi} className="text-xs text-muted-foreground">{feat}</p>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {/* Add plan button */}
                {canEdit && (
                  <button
                    onClick={addPricingPlan}
                    className="border-2 border-dashed rounded-lg min-w-[120px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-xs">Add Plan</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No pricing plans yet.</p>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={addPricingPlan}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Pricing Plan
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Languages */}
        <Card id="sec-languages" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" /> Languages
              <Badge variant="secondary" className="text-xs">{(va.languages || []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LanguagePicker
              competitorLanguages={competitorLanguages}
              totalCompetitors={totalCompetitors}
              selectedLanguages={va.languages || []}
              onToggle={handleToggleLanguage}
              onAddCustom={handleAddCustomLanguage}
              disabled={!canEdit}
            />
          </CardContent>
        </Card>

        {/* SEO */}
        <Card id="sec-seo" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchIcon className="h-4 w-4" /> SEO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                SEO Title
                <span className="text-xs text-muted-foreground ml-2">{seoTitle.length}/60</span>
              </label>
              <Input
                value={seoTitle}
                onChange={(e) => dirty(setSeoTitle)(e.target.value)}
                disabled={!canEdit}
                className="max-w-lg"
                placeholder="Page title for search engines..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Meta Description
                <span className="text-xs text-muted-foreground ml-2">{seoMetaDesc.length}/160</span>
              </label>
              <textarea
                value={seoMetaDesc}
                onChange={(e) => dirty(setSeoMetaDesc)(e.target.value)}
                disabled={!canEdit}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-w-lg"
                placeholder="Description for search results..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmModal
        open={showLeaveModal}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={confirmLeave}
        onCancel={() => setShowLeaveModal(false)}
        destructive
      />

      <ConfirmModal
        open={deletePlanConfirm !== null}
        title="Delete Pricing Plan"
        description={`Are you sure you want to delete the "${deletePlanConfirm !== null ? pricingPlans[deletePlanConfirm]?.name || "Unnamed Plan" : ""}" plan? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (deletePlanConfirm !== null) removePricingPlan(deletePlanConfirm);
        }}
        onCancel={() => setDeletePlanConfirm(null)}
        destructive
      />
    </div>
  );
}

// ─── Category Tree Picker ────────────────────────────────────

function CategoryTreePicker({
  tree,
  selectedSlugs,
  onToggle,
  disabled,
  maxSelected,
  competitorCategoryCounts,
  totalCompetitors,
}: {
  tree: CategoryTreeNode[];
  selectedSlugs: string[];
  onToggle: (slug: string) => void;
  disabled?: boolean;
  maxSelected: number;
  competitorCategoryCounts: Map<string, { count: number; names: string[] }>;
  totalCompetitors: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selectedSlugs);

  // Filter tree by search query
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();

    function filterNodes(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
      const result: CategoryTreeNode[] = [];
      for (const node of nodes) {
        const matchesSelf = node.title.toLowerCase().includes(q);
        const filteredChildren = filterNodes(node.children);
        if (matchesSelf || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: matchesSelf ? node.children : filteredChildren,
          });
        }
      }
      return result;
    }
    return filterNodes(tree);
  }, [tree, search]);

  // Auto-expand when searching
  useEffect(() => {
    if (search.trim()) {
      const slugsToExpand = new Set<string>();
      function collectParents(nodes: CategoryTreeNode[]) {
        for (const n of nodes) {
          if (n.children.length > 0) {
            slugsToExpand.add(n.slug);
            collectParents(n.children);
          }
        }
      }
      collectParents(filteredTree);
      setExpanded(slugsToExpand);
    }
  }, [filteredTree, search]);

  function toggle(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function renderNode(node: CategoryTreeNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.slug);
    const isLeaf = !hasChildren;
    const isSelected = selectedSet.has(node.slug);
    const isMaxReached = selectedSlugs.length >= maxSelected && !isSelected;

    return (
      <div key={node.slug}>
        <div
          className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-muted/50 group"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggle(node.slug)}
              className="flex items-center justify-center w-5 h-5 shrink-0 text-muted-foreground hover:text-foreground"
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {hasChildren ? (
            isOpen ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : null}

          {isLeaf ? (
            <>
              <button
                onClick={() => {
                  if (disabled || (isMaxReached && !isSelected)) return;
                  onToggle(node.slug);
                }}
                disabled={disabled || (isMaxReached && !isSelected)}
                className={cn(
                  "flex items-center gap-2 text-sm ml-0.5 py-0.5 px-1 rounded transition-colors flex-1 min-w-0 text-left",
                  isSelected ? "text-blue-700 dark:text-blue-300" : "",
                  isMaxReached && !isSelected ? "opacity-40 cursor-not-allowed" : ""
                )}
              >
                <div className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                  isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"
                )}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="truncate">{node.title}</span>
              </button>
              {(() => {
                const catData = competitorCategoryCounts.get(node.slug);
                if (!catData || catData.count === 0) return null;
                return (
                  <CompetitorCountBadge
                    count={catData.count}
                    total={totalCompetitors}
                    names={catData.names}
                  />
                );
              })()}
            </>
          ) : (
            <span className="text-sm ml-1 text-muted-foreground truncate">{node.title}</span>
          )}

          {hasChildren && (
            <span className="text-[10px] text-muted-foreground shrink-0">({node.children.length})</span>
          )}

          {!node.isListingPage && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Hub</Badge>
          )}
        </div>

        {isOpen && hasChildren && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search categories..."
        className="h-8 text-sm"
      />
      <div className="max-h-[400px] overflow-y-auto space-y-0">
        {filteredTree.map((node) => renderNode(node, 0))}
        {filteredTree.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-2 py-4 text-center">
            {search ? `No categories matching "${search}"` : "No categories available"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Language Picker (inline) ────────────────────────────────

function LanguagePicker({
  competitorLanguages,
  totalCompetitors,
  selectedLanguages,
  onToggle,
  onAddCustom,
  disabled,
}: {
  competitorLanguages: { lang: string; count: number; names: string[] }[];
  totalCompetitors: number;
  selectedLanguages: string[];
  onToggle: (lang: string) => void;
  onAddCustom: (lang: string) => void;
  disabled?: boolean;
}) {
  const [customLang, setCustomLang] = useState("");
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selectedLanguages);
  const competitorLangSet = new Set(competitorLanguages.map((l) => l.lang));
  const customLanguages = selectedLanguages.filter((l) => !competitorLangSet.has(l));

  const filtered = (() => {
    let list = competitorLanguages;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => l.lang.toLowerCase().includes(q));
    }
    // Selected items first
    return [...list].sort((a, b) => {
      const aSelected = selectedSet.has(a.lang) ? 0 : 1;
      const bSelected = selectedSet.has(b.lang) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return b.count - a.count || a.lang.localeCompare(b.lang);
    });
  })();

  function handleAddCustom() {
    const l = customLang.trim();
    if (!l || selectedSet.has(l)) return;
    onAddCustom(l);
    setCustomLang("");
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter languages..."
        className="h-8 text-sm"
      />

      <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
        <p className="text-xs text-muted-foreground font-medium px-1 mb-1">
          From competitors ({totalCompetitors}):
        </p>
        {filtered.map(({ lang, count, names }) => {
          const isSelected = selectedSet.has(lang);
          return (
            <button
              key={lang}
              onClick={() => { if (!disabled) onToggle(lang); }}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 w-full text-left py-1 px-2 rounded text-sm transition-colors",
                isSelected ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"
              )}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="truncate">{lang}</span>
              <CompetitorCountBadge count={count} total={totalCompetitors} names={names} className="ml-auto" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-2 py-1">No matching languages</p>
        )}
      </div>

      {customLanguages.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium px-1 mb-1">Custom:</p>
          <div className="flex flex-wrap gap-1.5">
            {customLanguages.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs"
              >
                {l}
                <button onClick={() => onToggle(l)} disabled={disabled} className="hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={customLang}
          onChange={(e) => setCustomLang(e.target.value)}
          placeholder="Add custom language..."
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
        />
        <Button size="sm" variant="secondary" onClick={handleAddCustom} disabled={disabled || !customLang.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Competitor Pricing Reference ────────────────────────────

function CompetitorPricingReference({
  competitors,
}: {
  competitors: { slug: string; name: string; pricingPlans: any[] }[];
}) {
  const [expanded, setExpanded] = useState(false);

  const compsWithPlans = competitors.filter((c) => (c.pricingPlans || []).length > 0);
  if (compsWithPlans.length === 0) return null;

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Competitor Pricing
        <span className="text-xs text-muted-foreground">({compsWithPlans.length} competitors)</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {compsWithPlans.map((comp) => (
            <div key={comp.slug}>
              <p className="text-xs font-medium mb-1">{comp.name}</p>
              <div className="flex gap-2 flex-wrap">
                {(comp.pricingPlans || []).map((plan: any, i: number) => (
                  <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-muted-foreground ml-1">
                      {plan.price ? `$${plan.price}/${plan.period || "mo"}` : "Free"}
                    </span>
                    {plan.features?.length > 0 && (
                      <span className="text-muted-foreground ml-1">({plan.features.length} features)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
