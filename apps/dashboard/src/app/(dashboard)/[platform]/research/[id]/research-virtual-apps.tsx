"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Check,
  Loader2,
  Eye,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/format-utils";
import { ConfirmModal } from "@/components/confirm-modal";

// ─── Constants ────────────────────────────────────────────────

const AI_GENERATION_STEPS = [
  { icon: "🔍", label: "Analyzing competitor data", detail: "Scanning features, pricing, and market positioning..." },
  { icon: "📊", label: "Building market summary", detail: "Compressing research into actionable insights..." },
  { icon: "🧠", label: "AI is strategizing", detail: "Identifying niches, gaps, and opportunities..." },
  { icon: "✨", label: "Generating app concepts", detail: "Crafting differentiated positioning for each app..." },
  { icon: "🎯", label: "Selecting features & integrations", detail: "Matching capabilities to each app's strategy..." },
  { icon: "💰", label: "Designing pricing plans", detail: "Building competitive pricing tiers..." },
  { icon: "🔎", label: "Optimizing SEO & metadata", detail: "Writing titles, descriptions, and keywords..." },
  { icon: "✅", label: "Validating & saving", detail: "Cross-checking against real market data..." },
];

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  width: 8 + (((i * 7 + 3) % 11) / 10) * 16,
  height: 8 + (((i * 13 + 5) % 11) / 10) * 16,
  left: ((i * 17 + 7) % 100),
  top: ((i * 23 + 11) % 100),
  duration: 2 + (((i * 9 + 1) % 11) / 10) * 2,
}));

// ─── Types ────────────────────────────────────────────────────

type VirtualApp = {
  id: string; researchProjectId: string; name: string;
  icon: string; color: string; iconUrl: string | null;
  appCardSubtitle: string; appIntroduction: string; appDetails: string;
  seoTitle: string; seoMetaDescription: string;
  features: string[]; integrations: string[]; languages: string[];
  categories: any[]; pricingPlans: any[];
  generatedByAi?: boolean;
  creatorName?: string | null;
  createdAt: string; updatedAt: string;
};

// ─── AiGenerationOverlay (internal) ──────────────────────────

function AiGenerationOverlay({ currentStep, error, onClose }: {
  currentStep: number; error: string | null; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-300">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border">
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 px-6 pt-6 pb-8 text-white">
          <div className="absolute inset-0 overflow-hidden">
            {PARTICLES.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full opacity-10 animate-pulse"
                style={{
                  width: `${p.width}px`,
                  height: `${p.height}px`,
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  backgroundColor: "white",
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: `${p.duration}s`,
                }}
              />
            ))}
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI App Generator</h3>
                <p className="text-sm text-white/70">Creating your app concepts</p>
              </div>
            </div>
            {/* Progress bar */}
            {!error && (
              <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(((currentStep + 1) / AI_GENERATION_STEPS.length) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 max-h-[340px] overflow-y-auto">
          {error ? (
            <div className="text-center py-4">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center mx-auto mb-3">
                <X className="h-6 w-6 text-red-500" />
              </div>
              <p className="font-medium text-sm mb-1">Generation failed</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <div className="space-y-1">
              {AI_GENERATION_STEPS.map((step, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                const isPending = i > currentStep;

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-all duration-500 ${
                      isActive ? "bg-purple-50 dark:bg-purple-950/30" : ""
                    } ${isPending ? "opacity-30" : ""}`}
                  >
                    {/* Step indicator */}
                    <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all duration-500 ${
                      isDone ? "bg-green-100 dark:bg-green-950" :
                      isActive ? "bg-purple-100 dark:bg-purple-900 shadow-sm shadow-purple-200 dark:shadow-purple-900" :
                      "bg-muted"
                    }`}>
                      {isDone ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : isActive ? (
                        <span className="animate-bounce">{step.icon}</span>
                      ) : (
                        <span>{step.icon}</span>
                      )}
                    </div>
                    {/* Label */}
                    <div className="min-w-0 pt-0.5">
                      <p className={`text-sm font-medium leading-tight ${isDone ? "text-green-700 dark:text-green-400" : isActive ? "text-purple-700 dark:text-purple-300" : ""}`}>
                        {step.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                          {step.detail}
                        </p>
                      )}
                    </div>
                    {/* Spinner for active */}
                    {isActive && (
                      <Loader2 className="h-4 w-4 text-purple-500 animate-spin shrink-0 mt-1 ml-auto" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── GenerateVirtualAppsButton ───────────────────────────────

export function GenerateVirtualAppsButton({
  projectId, competitorCount, onGenerated,
}: {
  projectId: string; competitorCount: number; onGenerated: () => void;
}) {
  const { fetchWithAuth } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => { clearInterval(stepIntervalRef.current); };
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setCurrentStep(0);
    setError(null);

    // Animate steps: advance every ~3s, pause at last step until response arrives
    let step = 0;
    stepIntervalRef.current = setInterval(() => {
      step++;
      if (step < AI_GENERATION_STEPS.length - 1) {
        setCurrentStep(step);
      } else {
        setCurrentStep(AI_GENERATION_STEPS.length - 1);
        clearInterval(stepIntervalRef.current);
      }
    }, 3000);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      const res = await fetchWithAuth(`/api/research-projects/${projectId}/virtual-apps/generate`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      clearInterval(stepIntervalRef.current);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Generation failed");
        return;
      }

      // Show completion briefly
      setCurrentStep(AI_GENERATION_STEPS.length);
      await new Promise((r) => setTimeout(r, 800));
      setGenerating(false);
      onGenerated();
    } catch (err: any) {
      clearInterval(stepIntervalRef.current);
      setError(err.name === "AbortError" ? "Request timed out — please try again" : "Generation failed");
    }
  }

  function handleClose() {
    setGenerating(false);
    setError(null);
    clearInterval(stepIntervalRef.current);
  }

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating || competitorCount < 2}
        className="group relative inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25 active:scale-95 ai-btn-bg"
      >
        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ai-btn-shimmer" />
        <Sparkles className="h-3.5 w-3.5 relative" />
        <span className="relative">Generate with AI</span>
      </button>

      {generating && (
        <AiGenerationOverlay currentStep={currentStep} error={error} onClose={handleClose} />
      )}
    </>
  );
}

// ─── CreateVirtualAppButton ──────────────────────────────────

export function CreateVirtualAppButton({ projectId }: { projectId: string }) {
  const { platform } = useParams();
  const router = useRouter();

  return (
    <Button size="sm" variant="outline" onClick={() => router.push(`/${platform}/research/${projectId}/virtual-apps/new`)}>
      <Plus className="h-3.5 w-3.5 mr-1.5" />
      New App
    </Button>
  );
}

// ─── VirtualAppsGrid ─────────────────────────────────────────

export function VirtualAppsGrid({
  virtualApps, projectId, canEdit, fetchWithAuth, onDelete,
}: {
  virtualApps: VirtualApp[]; projectId: string; canEdit: boolean;
  fetchWithAuth: any; onDelete: () => void;
}) {
  const { platform } = useParams();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      const res = await fetchWithAuth(`/api/research-projects/${projectId}/virtual-apps/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) onDelete();
    } finally {
      setDeletingId(null);
    }
  }

  if (virtualApps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No virtual apps yet. Create one to start designing your app.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {virtualApps.map((va) => {
          const featureCount = (va.features?.length || 0) + (va.categories || []).reduce(
            (acc: number, cat: any) => acc + (cat.subcategories || []).reduce(
              (a2: number, sub: any) => a2 + (sub.features?.length || 0), 0
            ), 0
          );
          const integrationCount = va.integrations?.length || 0;
          const languageCount = va.languages?.length || 0;
          const planCount = va.pricingPlans?.length || 0;

          return (
            <Link
              key={va.id}
              href={`/${platform}/research/${projectId}/virtual-apps/${va.id}`}
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full group">
                <CardContent className="pt-4 pb-3 px-4">
                  {/* Header: Icon + Name */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-lg shadow-sm"
                        style={{ backgroundColor: `${va.color || "#3B82F6"}20`, border: `1px solid ${va.color || "#3B82F6"}30` }}
                      >
                        {va.icon || "🚀"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm leading-tight truncate">{va.name}</div>
                        {va.appCardSubtitle && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{va.appCardSubtitle}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.location.href = `/${platform}/research/${projectId}/virtual-apps/${va.id}/preview`;
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTarget({ id: va.id, name: va.name });
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          disabled={deletingId === va.id}
                        >
                          {deletingId === va.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{featureCount} features</span>
                    <span>{integrationCount} integrations</span>
                    {languageCount > 0 && <span>{languageCount} languages</span>}
                    {planCount > 0 && <span>{planCount} plans</span>}
                  </div>

                  {/* Footer: AI badge + creator + time */}
                  <div className="mt-2 pt-2 border-t flex items-center gap-2 text-[10px]">
                    {va.generatedByAi ? (
                      <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        <Sparkles className="h-2.5 w-2.5" /> AI
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        Manual
                      </span>
                    )}
                    {va.creatorName && (
                      <span className="text-muted-foreground truncate">{va.creatorName}</span>
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0">{timeAgo(va.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Virtual App"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </>
  );
}
