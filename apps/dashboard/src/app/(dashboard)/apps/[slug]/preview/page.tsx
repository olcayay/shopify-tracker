"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw, Plus, X, Check } from "lucide-react";

interface AppData {
  slug: string;
  name: string;
  iconUrl: string | null;
  appCardSubtitle: string | null;
  isBuiltForShopify: boolean;
  latestSnapshot: {
    appIntroduction: string;
    appDetails: string;
    features: string[];
    pricingPlans: any[];
    averageRating: string | null;
    ratingCount: number | null;
    pricing: string;
    developer: { name: string; url: string } | null;
  } | null;
}

// 5-tier character count badge (same logic as compare page)
function CharBadge({ count, max }: { count: number; max: number }) {
  const pct = count / max;
  let colorClass: string;
  if (pct > 1) {
    colorClass = "border-red-600 text-red-600";
  } else if (pct >= 0.9) {
    colorClass = "border-green-600 text-green-600";
  } else if (pct >= 0.8) {
    colorClass = "border-lime-600 text-lime-600";
  } else if (pct >= 0.7) {
    colorClass = "border-yellow-600 text-yellow-600";
  } else if (pct >= 0.6) {
    colorClass = "border-orange-500 text-orange-500";
  } else {
    colorClass = "border-red-600 text-red-600";
  }
  return (
    <Badge variant="outline" className={cn("text-xs shrink-0", colorClass)}>
      {count}/{max} chars
    </Badge>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - (star - 1)));
        return (
          <div key={star} className="relative h-4 w-4">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-muted-foreground/30"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-yellow-500"
                fill="currentColor"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PreviewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { fetchWithAuth } = useAuth();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [details, setDetails] = useState("");
  const [features, setFeatures] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [slug]);

  async function loadData() {
    setLoading(true);
    const res = await fetchWithAuth(
      `/api/apps/${encodeURIComponent(slug)}`
    );
    if (res.ok) {
      const data: AppData = await res.json();
      setAppData(data);
      populateFields(data);
    }
    setLoading(false);
  }

  function populateFields(data: AppData) {
    setName(data.name || "");
    setSubtitle(data.appCardSubtitle || "");
    setIntroduction(data.latestSnapshot?.appIntroduction || "");
    setDetails(data.latestSnapshot?.appDetails || "");
    setFeatures(data.latestSnapshot?.features || []);
  }

  function resetToOriginal() {
    if (appData) populateFields(appData);
  }

  function updateFeature(index: number, value: string) {
    setFeatures((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addFeature() {
    setFeatures((prev) => [...prev, ""]);
  }

  function removeFeature(index: number) {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-center py-8">Loading...</p>
    );
  }

  if (!appData) {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  const snapshot = appData.latestSnapshot;

  // Track which fields changed from original
  const origName = appData.name || "";
  const origSubtitle = appData.appCardSubtitle || "";
  const origIntro = snapshot?.appIntroduction || "";
  const origDetails = snapshot?.appDetails || "";
  const origFeatures = snapshot?.features || [];

  const nameChanged = name !== origName;
  const subtitleChanged = subtitle !== origSubtitle;
  const introChanged = introduction !== origIntro;
  const detailsChanged = details !== origDetails;
  const featuresChanged =
    features.length !== origFeatures.length ||
    features.some((f, i) => f !== origFeatures[i]);

  // Style for modified text in preview
  const modifiedClass = "bg-amber-100 dark:bg-amber-900/40 rounded px-0.5 -mx-0.5";

  const rating = snapshot?.averageRating
    ? Number(snapshot.averageRating)
    : null;
  const reviewCount = snapshot?.ratingCount ?? null;
  const developerName = snapshot?.developer?.name || "";
  const pricing = snapshot?.pricing || "";
  const pricingPlans = snapshot?.pricingPlans || [];

  // Pricing label for listing card
  const pricingLabel = pricingPlans.length > 0
    ? pricingPlans.some((p: any) => !p.price || Number(p.price) === 0)
      ? "Free plan available"
      : `From $${Math.min(...pricingPlans.map((p: any) => Number(p.price) || 0))}/mo`
    : pricing || "Free";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
      {/* Left Side — Shopify App Store Preview */}
      <div className="lg:sticky lg:top-4 space-y-6">
        {/* Listing Card Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Listing Card Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Normal listing card */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Search / Category Result</p>
                <div className="border rounded-xl p-4 bg-white dark:bg-zinc-950 max-w-sm">
                  <div className="flex gap-3">
                    {appData.iconUrl ? (
                      <img
                        src={appData.iconUrl}
                        alt=""
                        className="h-12 w-12 rounded-lg shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-lg font-bold shrink-0">
                        {name.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className={cn("font-semibold text-sm leading-tight truncate", nameChanged && modifiedClass)}>
                          {name || "App Name"}
                        </p>
                        {appData.isBuiltForShopify && (
                          <span title="Built for Shopify" className="shrink-0">💎</span>
                        )}
                      </div>
                      <p className={cn("text-xs text-muted-foreground mt-0.5 line-clamp-2", subtitleChanged && modifiedClass)}>
                        {subtitle || "App subtitle"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {rating != null && (
                          <>
                            <StarRating rating={rating} />
                            <span className="text-xs text-muted-foreground">
                              {reviewCount?.toLocaleString() ?? 0}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pricingLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ad card */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Ad Card</p>
                <div className="border rounded-xl p-4 bg-white dark:bg-zinc-950 max-w-sm relative">
                  <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
                    Ad
                  </Badge>
                  <div className="flex gap-3">
                    {appData.iconUrl ? (
                      <img
                        src={appData.iconUrl}
                        alt=""
                        className="h-12 w-12 rounded-lg shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-lg font-bold shrink-0">
                        {name.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="min-w-0 pr-6">
                      <div className="flex items-center gap-1">
                        <p className={cn("font-semibold text-sm leading-tight truncate", nameChanged && modifiedClass)}>
                          {name || "App Name"}
                        </p>
                        {appData.isBuiltForShopify && (
                          <span title="Built for Shopify" className="shrink-0">💎</span>
                        )}
                      </div>
                      <p className={cn("text-xs text-muted-foreground mt-0.5 line-clamp-2", (introduction ? introChanged : subtitleChanged) && modifiedClass)}>
                        {introduction || subtitle || "App introduction"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {rating != null && (
                          <>
                            <StarRating rating={rating} />
                            <span className="text-xs text-muted-foreground">
                              {reviewCount?.toLocaleString() ?? 0}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pricingLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail Page Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Detail Page Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl p-6 bg-white dark:bg-zinc-950 space-y-4">
              {/* Header */}
              <div className="flex gap-4">
                {appData.iconUrl ? (
                  <img
                    src={appData.iconUrl}
                    alt=""
                    className="h-20 w-20 rounded-2xl shrink-0"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center text-2xl font-bold shrink-0">
                    {name.charAt(0) || "?"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className={cn("text-lg font-bold leading-tight", nameChanged && modifiedClass)}>
                      {name || "App Name"}
                    </h2>
                    {appData.isBuiltForShopify && (
                      <span title="Built for Shopify">💎</span>
                    )}
                  </div>
                  {rating != null && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <StarRating rating={rating} />
                      <span className="text-sm font-medium">{rating}</span>
                      <span className="text-sm text-muted-foreground">
                        ({reviewCount?.toLocaleString() ?? 0} reviews)
                      </span>
                    </div>
                  )}
                  {developerName && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      by {developerName}
                    </p>
                  )}
                </div>
              </div>

              {/* Introduction */}
              {introduction && (
                <p className={cn("text-sm", introChanged && modifiedClass)}>{introduction}</p>
              )}

              {/* CTA */}
              <div>
                <div className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 text-sm font-medium">
                  Add app
                </div>
              </div>

              {/* Separator */}
              <div className="border-t" />

              {/* Description */}
              {details && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Description</h3>
                  <p className={cn("text-sm text-muted-foreground whitespace-pre-line", detailsChanged && modifiedClass)}>
                    {details}
                  </p>
                </div>
              )}

              {/* Features */}
              {features.filter((f) => f.trim()).length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Features</h3>
                  <ul className="space-y-1.5">
                    {features
                      .filter((f) => f.trim())
                      .map((f, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <span className={cn(f !== (origFeatures[i] ?? "") && modifiedClass)}>{f}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Pricing */}
              {pricingPlans.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Pricing</h3>
                  <div className="flex flex-wrap gap-2">
                    {pricingPlans.map((plan: any, i: number) => (
                      <div
                        key={i}
                        className="border rounded-lg px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-muted-foreground ml-1.5">
                          {plan.price ? `$${plan.price}/${plan.period || "mo"}` : "Free"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Side — Editor */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Edit Listing Content</h3>
          <Button variant="outline" size="sm" onClick={resetToOriginal}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to Current
          </Button>
        </div>

        {/* App Name */}
        <EditorField label="App Name" count={name.length} max={30} changed={nameChanged}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="App name"
            className={cn(
              nameChanged && "border-amber-500",
              name.length > 30 && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        {/* App Card Subtitle */}
        <EditorField label="App Card Subtitle" count={subtitle.length} max={62} changed={subtitleChanged}>
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Brief subtitle shown in search results"
            className={cn(
              subtitleChanged && "border-amber-500",
              subtitle.length > 62 && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        {/* App Introduction */}
        <EditorField label="App Introduction" count={introduction.length} max={100} changed={introChanged}>
          <textarea
            value={introduction}
            onChange={(e) => setIntroduction(e.target.value)}
            placeholder="Short introduction paragraph"
            rows={3}
            className={cn(
              "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              introChanged ? "border-amber-500" : "border-input",
              introduction.length > 100 && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        {/* App Details */}
        <EditorField label="App Details" count={details.length} max={500} changed={detailsChanged}>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Full app description"
            rows={8}
            className={cn(
              "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              detailsChanged ? "border-amber-500" : "border-input",
              details.length > 500 && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        {/* Features */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Features <span className="text-muted-foreground">(80 chars each)</span>
            </span>
            <Button variant="outline" size="sm" onClick={addFeature}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
          {features.map((feat, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">
                  {i + 1}.
                </span>
                <Input
                  value={feat}
                  onChange={(e) => updateFeature(i, e.target.value)}
                  placeholder={`Feature ${i + 1}`}
                  className={cn(
                    "flex-1",
                    feat !== (origFeatures[i] ?? "") && "border-amber-500",
                    feat.length > 80 && "border-red-500 focus-visible:ring-red-500/50"
                  )}
                />
                <CharBadge count={feat.length} max={80} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFeature(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {feat.length > 80 && (
                <p className="text-xs text-red-600 ml-7">
                  Exceeds 80 character limit by {feat.length - 80}
                </p>
              )}
            </div>
          ))}
          {features.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No features. Click "Add" to add one.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EditorField({
  label,
  count,
  max,
  changed,
  children,
}: {
  label: string;
  count: number;
  max: number;
  changed?: boolean;
  children: React.ReactNode;
}) {
  const over = count > max;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {changed && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Modified
            </span>
          )}
        </div>
        <CharBadge count={count} max={max} />
      </div>
      {children}
      {over && (
        <p className="text-xs text-red-600">
          Exceeds {max} character limit by {count - max}
        </p>
      )}
    </div>
  );
}
