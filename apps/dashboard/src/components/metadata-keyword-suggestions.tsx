"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { buildExternalSearchUrl, getPlatformName } from "@/lib/platform-urls";
import type { PlatformId } from "@appranks/shared";
import { Sparkles, Plus, Check, ExternalLink, ChevronDown, ChevronUp, Brain, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Suggestion {
  keyword: string;
  score: number;
  count: number;
  tracked: boolean;
  sources?: Array<{ field: string; weight: number }>;
}

interface AiKeyword {
  keyword: string;
  tier: number;
  tierLabel: string;
  score: number;
  rationale: string;
  searchIntent: string;
  competitiveness: string;
}

interface AiSuggestionResult {
  cached?: boolean;
  keywords: AiKeyword[];
  insights?: {
    appSummary?: string;
    targetAudience?: string;
    primaryCategory?: string;
  };
  generatedAt?: string;
}

interface SuggestionsResponse {
  suggestions: Suggestion[];
  weights?: Record<string, number>;
  metadata?: { appName: string; totalCandidates: number; afterFiltering: number };
}

type SourceTab = "all" | "ai" | "ngram";

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0">
      <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      <div className="flex-1" />
      <div className="h-4 w-12 bg-muted rounded animate-pulse shrink-0" />
      <div className="h-4 w-8 bg-muted rounded animate-pulse shrink-0" />
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  subtitle: "Subtitle",
  introduction: "Intro",
  categories: "Categories",
  features: "Features",
  description: "Description",
  categoryFeatures: "Cat. Features",
};

const TIER_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  2: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  3: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  4: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  5: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const COMPETITIVENESS_COLORS: Record<string, string> = {
  low: "text-green-500",
  medium: "text-amber-500",
  high: "text-red-500",
};

export function MetadataKeywordSuggestions({
  appSlug,
  trackedKeywords,
  onKeywordAdded,
  prominent = false,
}: {
  appSlug: string;
  trackedKeywords: Set<string>;
  onKeywordAdded: (keywordId?: number, scraperEnqueued?: boolean) => void;
  prominent?: boolean;
}) {
  const { platform } = useParams();
  const { fetchWithAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [error, setError] = useState("");
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [addingKeyword, setAddingKeyword] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SourceTab>("all");
  const [aiData, setAiData] = useState<AiSuggestionResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keyword-suggestions?debug=true&limit=100`
      );
      if (res.ok) setData(await res.json());
      else setError("Failed to load suggestions");
    } catch (err: any) {
      setError(err.message || "Failed to load");
    }
    setLoading(false);
  }, [appSlug, fetchWithAuth]);

  const generateAiSuggestions = useCallback(async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/ai-keyword-suggestions/generate?platform=${platform}`,
        { method: "POST" }
      );
      if (res.ok) {
        setAiData(await res.json());
      } else {
        const body = await res.json().catch(() => ({}));
        setAiError(body.error || "Failed to generate AI suggestions");
      }
    } catch (err: any) {
      setAiError(err.message || "Failed to generate");
    }
    setAiLoading(false);
  }, [appSlug, platform, fetchWithAuth]);

  useEffect(() => {
    if (prominent && !open) {
      setOpen(true);
      if (!data && !loading) loadSuggestions();
    }
  }, [prominent]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle() {
    if (!open && !data && !loading) loadSuggestions();
    setOpen(!open);
  }

  async function addKeyword(keyword: string) {
    setAddingKeyword(keyword);
    setError("");
    try {
      const res = await fetchWithAuth(
        `/api/account/tracked-apps/${encodeURIComponent(appSlug)}/keywords`,
        { method: "POST", body: JSON.stringify({ keyword }) }
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddedKeywords((prev) => new Set([...prev, keyword.toLowerCase()]));
        onKeywordAdded(data.keywordId, data.scraperEnqueued);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed to add keyword (${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    }
    setAddingKeyword(null);
  }

  const isTracked = (keyword: string, tracked?: boolean) =>
    tracked ||
    trackedKeywords.has(keyword.toLowerCase()) ||
    addedKeywords.has(keyword.toLowerCase());

  // Compute counts for tabs
  const ngramCount = data?.suggestions.length ?? 0;
  const aiCount = aiData?.keywords?.length ?? 0;

  return (
    <div>
      {prominent && !open && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground">No keywords added yet.</p>
          <Button onClick={handleToggle} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Suggest keywords from app metadata
          </Button>
          <p className="text-xs text-muted-foreground">Or use the search above to add keywords manually.</p>
        </div>
      )}
      {!prominent && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          className="gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggest keywords
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      )}

      {open && (
        <div className="mt-2 border rounded-lg overflow-hidden bg-background">
          {/* Header with AI button and source tabs */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {/* Source tabs */}
              {(["all", "ai", "ngram"] as SourceTab[]).map((tab) => {
                const count = tab === "all" ? ngramCount + aiCount : tab === "ai" ? aiCount : ngramCount;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${
                      activeTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {tab === "all" ? "All" : tab === "ai" ? "AI" : "Metadata"}
                    {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateAiSuggestions}
              disabled={aiLoading}
              className="gap-1.5 text-xs"
            >
              {aiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : aiData ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Brain className="h-3.5 w-3.5" />
              )}
              {aiData ? "Regenerate AI" : "Generate AI Suggestions"}
            </Button>
          </div>

          {/* AI Insights Summary */}
          {aiData?.insights && activeTab !== "ngram" && (
            <div className="px-3 py-2 border-b bg-purple-50/50 dark:bg-purple-950/20 text-xs text-muted-foreground space-y-0.5">
              {aiData.insights.appSummary && <p><strong>Summary:</strong> {aiData.insights.appSummary}</p>}
              {aiData.insights.targetAudience && <p><strong>Audience:</strong> {aiData.insights.targetAudience}</p>}
              {aiData.insights.primaryCategory && <p><strong>Category:</strong> {aiData.insights.primaryCategory}</p>}
            </div>
          )}

          {/* AI Error */}
          {aiError && (
            <div className="px-4 py-2 text-xs text-destructive border-b">{aiError}</div>
          )}

          {/* Content */}
          <div className="max-h-[400px] overflow-auto">
            {loading ? (
              <>{Array.from({ length: 5 }).map((_, i) => <ShimmerRow key={i} />)}</>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-destructive">{error}</div>
            ) : (
              <>
                {/* AI keyword results */}
                {(activeTab === "all" || activeTab === "ai") && aiData?.keywords && aiData.keywords.length > 0 && (
                  aiData.keywords.map((kw) => (
                    <div key={`ai-${kw.keyword}`} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <span className="flex-1 text-sm">{kw.keyword}</span>
                      <Badge className={`text-[10px] shrink-0 ${TIER_COLORS[kw.tier] || TIER_COLORS[5]}`}>
                        T{kw.tier}
                      </Badge>
                      <span className={`text-[10px] shrink-0 ${COMPETITIVENESS_COLORS[kw.competitiveness] || ""}`} title={`Competitiveness: ${kw.competitiveness}`}>
                        {kw.competitiveness === "low" ? "Low" : kw.competitiveness === "medium" ? "Med" : "High"}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{kw.score}</span>
                      <a
                        href={buildExternalSearchUrl((platform as PlatformId) || "shopify", kw.keyword)}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-accent shrink-0"
                        title={`Search on ${getPlatformName((platform as PlatformId) || "shopify")}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                      {isTracked(kw.keyword) ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Check className="h-3.5 w-3.5" /> Added
                        </div>
                      ) : (
                        <button onClick={() => addKeyword(kw.keyword)} disabled={addingKeyword === kw.keyword} className="p-1 rounded hover:bg-accent shrink-0" title={`Track "${kw.keyword}"`}>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))
                )}

                {/* AI loading state */}
                {(activeTab === "all" || activeTab === "ai") && aiLoading && (
                  <div className="px-4 py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating AI suggestions...
                  </div>
                )}

                {/* N-gram results */}
                {(activeTab === "all" || activeTab === "ngram") && data && data.suggestions.length > 0 && (
                  data.suggestions.map((s) => (
                    <div key={`ngram-${s.keyword}`} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-accent/50 transition-colors">
                      <span className="flex-1 text-sm">{s.keyword}</span>
                      {s.sources && (
                        <div className="flex items-center gap-1 shrink-0">
                          {s.sources.map((src, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground" title={`${src.field}: ${src.weight}`}>
                              {FIELD_LABELS[src.field] || src.field}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0 text-right" title={`Appears in ${s.count} field${s.count > 1 ? "s" : ""}, score: ${s.score}`}>
                        {s.count}x | {s.score}
                      </span>
                      <a href={buildExternalSearchUrl((platform as PlatformId) || "shopify", s.keyword)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-accent shrink-0" title={`Search on ${getPlatformName((platform as PlatformId) || "shopify")}`}>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                      {isTracked(s.keyword, s.tracked) ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Check className="h-3.5 w-3.5" /> Added
                        </div>
                      ) : (
                        <button onClick={() => addKeyword(s.keyword)} disabled={addingKeyword === s.keyword} className="p-1 rounded hover:bg-accent shrink-0" title={`Track "${s.keyword}"`}>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))
                )}

                {/* Empty states */}
                {activeTab === "ai" && !aiLoading && (!aiData || aiData.keywords.length === 0) && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No AI suggestions yet. Click &ldquo;Generate AI Suggestions&rdquo; to get started.
                  </div>
                )}
                {activeTab === "ngram" && data && data.suggestions.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No metadata suggestions available.
                  </div>
                )}
                {activeTab === "all" && !aiLoading && (!aiData || aiData.keywords.length === 0) && data && data.suggestions.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No suggestions available.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer — weight legend */}
          {data?.weights && activeTab !== "ai" && (
            <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="font-medium">Weights:</span>
              {Object.entries(data.weights).map(([field, weight]) => (
                <span key={field}>{FIELD_LABELS[field] || field}({weight})</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
