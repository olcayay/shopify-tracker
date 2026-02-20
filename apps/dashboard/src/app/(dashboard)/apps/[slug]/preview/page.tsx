"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw, Plus, X as XIcon } from "lucide-react";

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
    languages: string[];
    integrations: string[];
    categories: any[];
  } | null;
}

// 5-tier character count badge
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

// Shopify-style green star
function ShopifyStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-3.5 w-3.5 text-[#6a9e41]", className)} fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}


// Built for Shopify badge
function BuiltForShopifyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e0f0ff] text-[#1a1a1a] text-[11px] font-medium px-2 py-0.5 border border-[#b3d9f7]">
      <span className="text-[12px]">💎</span>
      Built for Shopify
    </span>
  );
}

export default function PreviewPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
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
    // Lock body scroll when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
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

  function closePreview() {
    router.push(`/apps/${slug}`);
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
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

  // Style for modified text in preview
  const mod = "bg-amber-100 dark:bg-amber-900/40 rounded px-0.5 -mx-0.5 transition-colors";

  const rating = snapshot?.averageRating
    ? Number(snapshot.averageRating)
    : null;
  const reviewCount = snapshot?.ratingCount ?? null;
  const developerName = snapshot?.developer?.name || "";
  const pricing = snapshot?.pricing || "";
  const pricingPlans = snapshot?.pricingPlans || [];

  // Pricing label
  const pricingLabel = pricingPlans.length > 0
    ? pricingPlans.some((p: any) => !p.price || Number(p.price) === 0)
      ? "Free plan available"
      : `From $${Math.min(...pricingPlans.map((p: any) => Number(p.price) || 0))}/mo`
    : pricing || "Free";

  const hasTrial = pricingPlans.some((p: any) => p.trial_text);
  const pricingLine = [pricingLabel, hasTrial && "Free trial available"].filter(Boolean).join(". ") + ".";

  const languages = snapshot?.languages || [];
  const integrations = snapshot?.integrations || [];
  const categories = snapshot?.categories || [];

  const icon = appData.iconUrl;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header bar */}
      <div className="shrink-0 border-b px-4 py-2.5 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          {icon && <img src={icon} alt="" className="h-6 w-6 rounded" />}
          <h2 className="font-semibold text-sm">{appData.name}</h2>
          <span className="text-xs text-muted-foreground">App Store Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToOriginal}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closePreview}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content: Preview left, Editor right */}
      <div className="flex-1 flex min-h-0">
        {/* Left — Preview (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
          {/* Search / Category Result Cards — side by side */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
              Search / Category Results
            </p>
            <div className="flex gap-4 flex-wrap">
              {/* Organic card */}
              <SearchResultCard
                icon={icon}
                name={name}
                subtitle={subtitle}
                rating={rating}
                reviewCount={reviewCount}
                pricingLabel={pricingLabel}
                isBuiltForShopify={appData.isBuiltForShopify}
                nameChanged={nameChanged}
                subtitleChanged={subtitleChanged}
                mod={mod}
              />
              {/* Ad card */}
              <SearchResultCard
                icon={icon}
                name={name}
                subtitle={introduction || subtitle}
                rating={rating}
                reviewCount={reviewCount}
                pricingLabel={pricingLabel}
                isBuiltForShopify={appData.isBuiltForShopify}
                isAd
                nameChanged={nameChanged}
                subtitleChanged={introduction ? introChanged : subtitleChanged}
                mod={mod}
              />
            </div>
          </div>

          {/* App Detail Page Preview */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
              App Detail Page
            </p>
            <div className="border rounded-2xl overflow-hidden bg-white text-[#1a1a1a]">
              {/* Top bar — Shopify nav */}
              <div className="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2">
                <svg viewBox="0 0 40 40" className="h-5 w-5" fill="none">
                  <path d="M27.8 9.7s-.5-.1-.7-.1c-.3 0-1.2.3-1.2.3s-1-3.4-1.1-3.6c-.1-.2-.4-.3-.4-.3l-.7-.1-1.4-.2c0-.1-.3-.9-.8-1.5C20.6 3 19.5 3 19.2 3c-.1 0-.2 0-.3 0C18.5 2.5 18 2.3 17.5 2.3c-2.8 0-4.2 3.5-4.6 5.3-.7.2-1.2.4-1.2.4-.9.3-.9.3-1 1.2L8.5 24l14.7 2.5 6.3-1.5c0 0-1.5-15.1-1.7-15.3z" fill="#95BF47"/>
                  <path d="M26.1 9.6c0 0-.5-.1-.7-.1-.3 0-1.2.3-1.2.3s-1-3.4-1.1-3.6c0-.1-.1-.2-.2-.2l-1 15.4 6.3-1.5c0 0-1.5-15-1.7-15.2-.1-.1-.2-.1-.4-.1z" fill="#5E8E3E"/>
                  <path d="M19.3 13.7l-.6 1.7s-.5-.3-1.2-.3c-1 0-1 .6-1 .8 0 .8 2.2 1.2 2.2 3.2 0 1.5-1 2.6-2.3 2.6-1.6 0-2.4-1-2.4-1l.4-1.4s.8.7 1.5.7c.5 0 .6-.4.6-.6 0-1.1-1.8-1.2-1.8-3 0-1.5 1.1-3 3.3-3 .8 0 1.3.3 1.3.3z" fill="white"/>
                </svg>
                <span className="text-white/60 text-xs">Shopify App Store</span>
              </div>

              {/* Two-column layout: info sidebar left, media+content right */}
              <div className="flex">
                {/* Left — App info sidebar */}
                <div className="w-[260px] shrink-0 p-5 border-r border-[#e3e3e3] space-y-5">
                  {/* Icon + Name */}
                  <div className="flex items-start gap-2.5">
                    {icon ? (
                      <img src={icon} alt="" className="h-12 w-12 rounded-lg shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold shrink-0">
                        {name.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className={cn("text-[15px] font-semibold leading-snug", nameChanged && mod)}>
                        {name || "App Name"}
                      </h2>
                      {appData.isBuiltForShopify && (
                        <div className="mt-1.5"><BuiltForShopifyBadge /></div>
                      )}
                    </div>
                  </div>

                  {/* Pricing / Rating / Developer — stacked rows */}
                  <div className="divide-y divide-[#e3e3e3] border-t border-[#e3e3e3]">
                    <div className="py-3">
                      <p className="text-[12px] font-semibold mb-0.5">Pricing</p>
                      <p className="text-[12px] text-[#616161]">{pricingLine}</p>
                    </div>
                    {rating != null && (
                      <div className="py-3">
                        <p className="text-[12px] font-semibold mb-0.5">Rating</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[12px]">{rating}</span>
                          <ShopifyStar className="h-3 w-3" />
                          <span className="text-[12px] text-[#616161]">({reviewCount?.toLocaleString() ?? 0})</span>
                        </div>
                      </div>
                    )}
                    {developerName && (
                      <div className="py-3">
                        <p className="text-[12px] font-semibold mb-0.5">Developer</p>
                        <p className="text-[12px]">{developerName}</p>
                      </div>
                    )}
                  </div>

                  {/* Install button — full width */}
                  <button className="w-full bg-[#1a1a1a] text-white text-[13px] font-medium py-2.5 rounded-lg hover:bg-[#2a2a2a] transition-colors">
                    Install
                  </button>
                  <div className="text-center">
                    <span className="text-[12px] text-[#1a1a1a] underline">View demo store</span>
                  </div>
                </div>

                {/* Right — Media gallery + content */}
                <div className="flex-1 min-w-0">
                  {/* Media gallery */}
                  <div className="p-5">
                    <div className="flex gap-2 items-stretch">
                      {/* Main video thumbnail */}
                      <div className="flex-[3] aspect-[16/10] bg-gradient-to-br from-[#0d4f4f] to-[#1a7a5a] rounded-xl flex items-center justify-center relative overflow-hidden">
                        <div className="h-12 w-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                          <svg viewBox="0 0 24 24" className="h-6 w-6 text-white ml-0.5" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      {/* 3 thumbnails filling full height of video */}
                      <div className="flex-1 flex flex-col gap-1.5">
                        {["Build engaging forms in a few moments.", "More possibilities with file and image uploads.", "Integrate with MailChimp, Klaviyo, and Stripe."].map((caption, i) => (
                          <div key={i} className="flex-1 bg-gray-100 rounded-lg flex flex-col items-center justify-center p-2 relative overflow-hidden">
                            <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-300 mb-1" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                            </svg>
                            <span className="text-[9px] text-gray-500 text-center leading-tight">{caption}</span>
                            {i === 2 && (
                              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                                <span className="text-[13px] text-[#303030] font-medium">+ 5 more</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Content: intro, details, features, metadata */}
                  <div className="px-5 pb-5 space-y-5">
                    {/* Introduction — bold heading */}
                    {introduction && (
                      <h3 className={cn("text-[15px] font-bold leading-snug", introChanged && mod)}>
                        {introduction}
                      </h3>
                    )}

                    {/* App details */}
                    {details && (
                      <p className={cn("text-[13px] text-[#303030] leading-relaxed whitespace-pre-line", detailsChanged && mod)}>
                        {details}
                      </p>
                    )}

                    {/* Features as bullet list */}
                    {features.filter((f) => f.trim()).length > 0 && (
                      <ul className="space-y-1.5 list-disc pl-5">
                        {features
                          .filter((f) => f.trim())
                          .map((f, i) => (
                            <li key={i} className="text-[13px] text-[#303030]">
                              <span className={cn(f !== (origFeatures[i] ?? "") && mod)}>{f}</span>
                            </li>
                          ))}
                      </ul>
                    )}

                    {/* Languages / Works with / Categories */}
                    {(languages.length > 0 || integrations.length > 0 || categories.length > 0) && (
                      <div className="border-t border-[#e3e3e3] pt-4 space-y-0">
                        {languages.length > 0 && (
                          <div className="flex gap-6 py-3 border-b border-[#e3e3e3]">
                            <p className="text-[13px] font-semibold w-[120px] shrink-0">Languages</p>
                            <p className="text-[13px] text-[#303030] flex-1">{languages.join(", ")}</p>
                          </div>
                        )}
                        {integrations.length > 0 && (
                          <div className="flex gap-6 py-3 border-b border-[#e3e3e3]">
                            <p className="text-[13px] font-semibold w-[120px] shrink-0">Works with</p>
                            <p className="text-[13px] text-[#303030] flex-1">{integrations.join(", ")}</p>
                          </div>
                        )}
                        {categories.length > 0 && (
                          <div className="flex gap-6 py-3 border-b border-[#e3e3e3] last:border-0">
                            <p className="text-[13px] font-semibold w-[120px] shrink-0">Categories</p>
                            <div className="flex-1 space-y-2">
                              {categories.map((cat: any, i: number) => (
                                <div key={i} className="flex items-center justify-between">
                                  <span className="text-[13px] text-[#303030] underline">{cat.title}</span>
                                  <span className="text-[12px] text-[#616161] underline">Show features</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing section — full width, gray background */}
              {pricingPlans.length > 0 && (
                <div className="bg-[#f7f7f7] border-t border-[#e3e3e3] px-5 py-6">
                  <h3 className="text-[20px] font-bold mb-4">Pricing</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {pricingPlans.map((plan: any, i: number) => (
                      <div key={i} className="bg-white border border-[#e3e3e3] rounded-xl p-5 flex flex-col">
                        <p className="text-[13px] text-[#616161]">{plan.name}</p>
                        <p className="text-[22px] font-bold mt-1">
                          {plan.price ? `$${plan.price}` : "Free"}
                          {plan.price && plan.period && (
                            <span className="text-[13px] font-normal text-[#616161]"> / {plan.period}</span>
                          )}
                        </p>
                        {plan.trial_text && (
                          <p className="text-[12px] text-[#2a6e23] mt-1">{plan.trial_text}</p>
                        )}
                        {plan.features?.length > 0 && (
                          <>
                            <div className="border-t border-[#e3e3e3] my-3" />
                            <ul className="space-y-1.5 flex-1">
                              {plan.features.map((f: string, j: number) => (
                                <li key={j} className="text-[12px] text-[#303030]">
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        {plan.trial_text && (
                          <p className="text-[12px] text-[#616161] mt-3 pt-3 border-t border-[#e3e3e3]">
                            {plan.trial_text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — Editor (scrollable) */}
        <div className="w-[400px] shrink-0 border-l overflow-y-auto p-5 space-y-5 bg-background">
          <h3 className="font-semibold text-sm">Edit Listing Content</h3>

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
                    <XIcon className="h-3.5 w-3.5" />
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
                No features. Click &quot;Add&quot; to add one.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Shopify-style search result card ---
function SearchResultCard({
  icon,
  name,
  subtitle,
  rating,
  reviewCount,
  pricingLabel,
  isBuiltForShopify,
  isAd,
  nameChanged,
  subtitleChanged,
  mod,
}: {
  icon: string | null;
  name: string;
  subtitle: string;
  rating: number | null;
  reviewCount: number | null;
  pricingLabel: string;
  isBuiltForShopify: boolean;
  isAd?: boolean;
  nameChanged: boolean;
  subtitleChanged: boolean;
  mod: string;
}) {
  return (
    <div className="border border-[#e3e3e3] rounded-2xl p-4 bg-white text-[#1a1a1a] hover:shadow-md transition-shadow flex-1 min-w-[280px] max-w-[380px]">
      <div className="flex gap-3">
        {/* Icon on the left */}
        {icon ? (
          <img src={icon} alt="" className="h-12 w-12 rounded-xl shadow-sm shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center text-lg font-bold shrink-0">
            {name.charAt(0) || "?"}
          </div>
        )}
        {/* Content on the right */}
        <div className="min-w-0 flex-1 space-y-0.5">
          {/* App name */}
          <p className={cn("text-[14px] font-semibold leading-tight", nameChanged && mod)}>
            {name || "App Name"}
          </p>
          {/* Rating line: Ad badge + rating + star + count + bullet + pricing */}
          <div className="flex items-center gap-1 flex-wrap text-[12px] text-[#616161]">
            {isAd && (
              <span className="text-[11px] text-[#616161] border border-[#c1c1c1] rounded px-1 py-px mr-0.5">Ad</span>
            )}
            {rating != null && (
              <>
                <span className="font-semibold text-[#1a1a1a]">{rating}</span>
                <ShopifyStar className="h-3 w-3" />
                <span>({reviewCount?.toLocaleString() ?? 0})</span>
                <span>•</span>
              </>
            )}
            <span>{pricingLabel}</span>
          </div>
          {/* Subtitle / description */}
          <p className={cn("text-[12px] text-[#616161] line-clamp-2 leading-snug", subtitleChanged && mod)}>
            {subtitle || "App description"}
          </p>
          {/* Built for Shopify badge at bottom */}
          {isBuiltForShopify && (
            <div className="pt-1.5">
              <BuiltForShopifyBadge />
            </div>
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
