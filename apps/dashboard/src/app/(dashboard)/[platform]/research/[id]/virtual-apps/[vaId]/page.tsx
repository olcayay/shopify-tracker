"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Save,
  Loader2,
  LayoutGrid,
  List,
  Puzzle,
  FileText,
  Globe,
  Search as SearchIcon,
  FolderOpen,
  Check,
  X,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { CategoryFeaturePicker } from "@/components/virtual-app/category-feature-picker";
import { FeaturePicker } from "@/components/virtual-app/feature-picker";
import { IntegrationPicker } from "@/components/virtual-app/integration-picker";

import { getBreadcrumb } from "./helpers";
import { CategoryTreePicker } from "./category-tree-picker";
import { LanguagePicker } from "./language-picker";
import { EditorSidebar } from "./editor-sidebar";
import { BasicInfoSection } from "./basic-info-section";
import { PricingSection } from "./pricing-section";
import { useVirtualAppEditor } from "./use-virtual-app-editor";

// ─── Main Page ───────────────────────────────────────────────

export default function VirtualAppEditorPage() {
  const state = useVirtualAppEditor();

  const {
    platform,
    id,
    isNew,
    canEdit,
    va,
    research,
    categoryTree,
    loading,
    saving,
    showLeaveModal,
    setShowLeaveModal,
    name,
    icon,
    color,
    introduction,
    setIntroduction,
    details,
    setDetails,
    seoTitle,
    setSeoTitle,
    seoMetaDesc,
    setSeoMetaDesc,
    selectedCategorySlugs,
    catSlugMap,
    handleToggleCategorySlug,
    competitorCategoryCounts,
    competitorLanguages,
    pricingPlans,
    deletePlanConfirm,
    setDeletePlanConfirm,
    removePricingPlan,
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
    fetchWithAuth,
    router,
  } = state;

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
      <EditorSidebar state={state} />

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
        <BasicInfoSection state={state} />

        {/* Categories */}
        <Card id="sec-categories" className="scroll-mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" /> Categories
              <Badge variant="secondary" className="text-xs">{selectedCategorySlugs.length}/2</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
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
        <PricingSection state={state} />

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
