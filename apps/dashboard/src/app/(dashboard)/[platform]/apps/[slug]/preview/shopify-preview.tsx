"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, X as XIcon } from "lucide-react";
import { getMetadataLimits } from "@/lib/metadata-limits";
import { CharBadge, EditorField, mod } from "./shared";

export interface ShopifyAppData {
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

// Shopify-style search result card
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
}) {
  return (
    <div className="border border-[#e3e3e3] rounded-2xl p-4 bg-white text-[#1a1a1a] hover:shadow-md transition-shadow flex-1 min-w-[280px] max-w-[380px]">
      <div className="flex gap-3">
        {icon ? (
          <img src={icon} alt="" className="h-12 w-12 rounded-xl shadow-sm shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center text-lg font-bold shrink-0">
            {name.charAt(0) || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className={cn("text-[14px] font-semibold leading-tight", nameChanged && mod)}>
            {name || "App Name"}
          </p>
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
          <p className={cn("text-[12px] text-[#616161] line-clamp-2 leading-snug", subtitleChanged && mod)}>
            {subtitle || "App description"}
          </p>
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

export function ShopifyPreview({
  appData,
}: {
  appData: ShopifyAppData;
}) {
  const limits = getMetadataLimits("shopify");
  const snapshot = appData.latestSnapshot;

  const [name, setName] = useState(appData.name || "");
  const [subtitle, setSubtitle] = useState(appData.appCardSubtitle || "");
  const [introduction, setIntroduction] = useState(snapshot?.appIntroduction || "");
  const [details, setDetails] = useState(snapshot?.appDetails || "");
  const [features, setFeatures] = useState<string[]>(snapshot?.features || []);

  function resetToOriginal() {
    setName(appData.name || "");
    setSubtitle(appData.appCardSubtitle || "");
    setIntroduction(snapshot?.appIntroduction || "");
    setDetails(snapshot?.appDetails || "");
    setFeatures(snapshot?.features || []);
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

  const origName = appData.name || "";
  const origSubtitle = appData.appCardSubtitle || "";
  const origIntro = snapshot?.appIntroduction || "";
  const origDetails = snapshot?.appDetails || "";
  const origFeatures = snapshot?.features || [];

  const nameChanged = name !== origName;
  const subtitleChanged = subtitle !== origSubtitle;
  const introChanged = introduction !== origIntro;
  const detailsChanged = details !== origDetails;

  const rating = snapshot?.averageRating ? Number(snapshot.averageRating) : null;
  const reviewCount = snapshot?.ratingCount ?? null;
  const developerName = snapshot?.developer?.name || "";
  const pricing = snapshot?.pricing || "";
  const pricingPlans = snapshot?.pricingPlans || [];

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

  return {
    resetToOriginal,
    preview: (
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Search / Category Result Cards */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
            Search / Category Results
          </p>
          <div className="flex gap-4 flex-wrap">
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
            />
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

            {/* Two-column layout */}
            <div className="flex">
              {/* Left — App info sidebar */}
              <div className="w-[260px] shrink-0 p-5 border-r border-[#e3e3e3] space-y-5">
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

                <button className="w-full bg-[#1a1a1a] text-white text-[13px] font-medium py-2.5 rounded-lg hover:bg-[#2a2a2a] transition-colors">
                  Install
                </button>
                <div className="text-center">
                  <span className="text-[12px] text-[#1a1a1a] underline">View demo store</span>
                </div>
              </div>

              {/* Right — Media gallery + content */}
              <div className="flex-1 min-w-0">
                <div className="p-5">
                  <div className="flex gap-2 items-stretch">
                    <div className="flex-[3] aspect-[16/10] bg-gradient-to-br from-[#0d4f4f] to-[#1a7a5a] rounded-xl flex items-center justify-center relative overflow-hidden">
                      <div className="h-12 w-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white ml-0.5" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
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

                <div className="px-5 pb-5 space-y-5">
                  {introduction && (
                    <h3 className={cn("text-[15px] font-bold leading-snug", introChanged && mod)}>
                      {introduction}
                    </h3>
                  )}
                  {details && (
                    <p className={cn("text-[13px] text-[#303030] leading-relaxed whitespace-pre-line", detailsChanged && mod)}>
                      {details}
                    </p>
                  )}
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

            {/* Pricing section */}
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
                              <li key={j} className="text-[12px] text-[#303030]">{f}</li>
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
    ),
    editor: (
      <div className="space-y-5">
        <h3 className="font-semibold text-sm">Edit Listing Content</h3>

        <EditorField label="App Name" count={name.length} max={limits.appName} changed={nameChanged}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="App name"
            className={cn(
              nameChanged && "border-amber-500",
              name.length > limits.appName && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <EditorField label="App Card Subtitle" count={subtitle.length} max={limits.subtitle} changed={subtitleChanged}>
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Brief subtitle shown in search results"
            className={cn(
              subtitleChanged && "border-amber-500",
              subtitle.length > limits.subtitle && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <EditorField label="App Introduction" count={introduction.length} max={limits.introduction} changed={introChanged}>
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
              introduction.length > limits.introduction && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <EditorField label="App Details" count={details.length} max={limits.details} changed={detailsChanged}>
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
              details.length > limits.details && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Features <span className="text-muted-foreground">(max {limits.feature})</span>
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
                    feat.length > limits.feature && "border-red-500 focus-visible:ring-red-500/50"
                  )}
                />
                <CharBadge count={feat.length} max={limits.feature} />
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
                  Exceeds {limits.feature} character limit by {feat.length - limits.feature}
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
    ),
  };
}
