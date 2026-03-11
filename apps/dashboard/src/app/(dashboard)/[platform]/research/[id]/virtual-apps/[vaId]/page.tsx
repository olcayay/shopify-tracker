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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { CategoryFeaturePicker } from "@/components/virtual-app/category-feature-picker";
import { FeaturePicker } from "@/components/virtual-app/feature-picker";
import { IntegrationPicker } from "@/components/virtual-app/integration-picker";

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
  }[];
}

// ─── Constants ──────────────────────────────────────────────

const ICON_SET = ["🚀", "💡", "⚡", "🎯", "🔮", "🌟", "💎", "🎨", "🔥", "🌊", "🦋", "🍀", "🎲", "🪐", "🎸", "🦄"];
const COLOR_SET = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#6366F1", "#D946EF"];

const SECTIONS = [
  { id: "sec-basic", key: "basic", label: "Basic Info", icon: Sparkles },
  { id: "sec-catfeatures", key: "catfeatures", label: "Category Features", icon: LayoutGrid },
  { id: "sec-features", key: "features", label: "Features", icon: List },
  { id: "sec-integrations", key: "integrations", label: "Integrations", icon: Puzzle },
  { id: "sec-text", key: "text", label: "Description", icon: FileText },
  { id: "sec-pricing", key: "pricing", label: "Pricing", icon: DollarSign },
  { id: "sec-languages", key: "languages", label: "Languages", icon: Globe },
  { id: "sec-seo", key: "seo", label: "SEO", icon: SearchIcon },
] as const;

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
  const [languagesStr, setLanguagesStr] = useState("");

  // Active section
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  // ── Load data ─────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      if (isNew) {
        const resRes = await fetchWithAuth(`/api/research-projects/${id}/data`);
        if (resRes.ok) setResearch(await resRes.json());

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
      } else {
        const [vaRes, resRes] = await Promise.all([
          fetchWithAuth(`/api/research-projects/${id}/virtual-apps/${vaId}`),
          fetchWithAuth(`/api/research-projects/${id}/data`),
        ]);

        if (!vaRes.ok) {
          router.push(`/${platform}/research/${id}`);
          return;
        }

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
        setLanguagesStr((vaData.languages || []).join(", "));

        if (resRes.ok) setResearch(await resRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [id, vaId, platform, isNew, newDefaults, fetchWithAuth, router]);

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

  async function saveTextFields() {
    if (!canEdit || !va) return;
    setSaving(true);
    try {
      const langs = languagesStr.split(",").map((s) => s.trim()).filter(Boolean);

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
            languages: langs,
            features: va.features || [],
            integrations: va.integrations || [],
            categories: va.categories || [],
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
            languages: langs,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          setVa(updated);
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

  // ── Competitor data aggregation ────────────────────────────

  const competitorCategories = useMemo(() => {
    if (!research) return [];
    return research.competitors.flatMap((c) => c.categories || []);
  }, [research]);

  const competitorFeatures = useMemo(() => {
    if (!research) return [];
    const set = new Set<string>();
    for (const c of research.competitors) {
      for (const f of c.features || []) set.add(f);
    }
    return Array.from(set).sort();
  }, [research]);

  const competitorIntegrations = useMemo(() => {
    if (!research) return [];
    const set = new Set<string>();
    for (const c of research.competitors) {
      for (const i of c.integrations || []) set.add(i);
    }
    return Array.from(set).sort();
  }, [research]);

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

          {canEdit && (
            <Button
              onClick={saveTextFields}
              disabled={saving}
              className="w-full mt-4"
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
              competitorCategories={competitorCategories}
              selectedCategories={va.categories || []}
              onAdd={handleAddCategoryFeature}
              onRemove={handleRemoveCategoryFeature}
              disabled={!canEdit}
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
              competitorFeatures={competitorFeatures}
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
              competitorIntegrations={competitorIntegrations}
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
              <Badge variant="secondary" className="text-xs">{(va.pricingPlans || []).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pricing plan editor will be available in a future update.
            </p>
          </CardContent>
        </Card>

        {/* Languages */}
        <Card id="sec-languages" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" /> Languages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm font-medium mb-1 block">Languages (comma-separated)</label>
              <Input
                value={languagesStr}
                onChange={(e) => dirty(setLanguagesStr)(e.target.value)}
                disabled={!canEdit}
                placeholder="English, Spanish, French..."
                className="max-w-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {languagesStr.split(",").map((s) => s.trim()).filter(Boolean).length} languages
              </p>
            </div>
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
    </div>
  );
}
