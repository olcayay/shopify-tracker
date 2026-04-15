"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getMetadataLimits } from "@appranks/shared";
import { CharBadge, EditorField, mod } from "./shared";
import { formatNumber } from "@/lib/format-utils";
import { displayPricingModel } from "@/lib/pricing-display";

export interface SalesforceAppData {
  slug: string;
  name: string;
  iconUrl: string | null;
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
    platformData?: {
      description?: string;
      fullDescription?: string;
      highlights?: { title: string; description: string }[];
      editions?: string[];
      productsRequired?: string[];
      productsSupported?: string[];
      supportedIndustries?: string[];
      publisher?: {
        name?: string | null;
        email?: string | null;
        description?: string | null;
        website?: string | null;
        location?: string | null;
        yearFounded?: number | null;
      } | null;
      pricingModelType?: string | null;
      pricingPlans?: any[];
      languages?: string[];
      technology?: string | null;
      publishedDate?: string | null;
      solution?: {
        manifest?: {
          hasLWC?: boolean;
          tabsCount?: number;
          objectsCount?: number;
          applicationsCount?: number;
          globalComponentsCount?: number;
          cmtyBuilderComponentsCount?: number;
          isCommunityBuilder?: boolean;
          isLightningAppBuilder?: boolean;
          appBuilderComponentsCount?: number;
        } | null;
        latestVersionDate?: string | null;
        packageId?: string | null;
        namespacePrefix?: string | null;
        packageCategory?: string | null;
        createdDate?: string | null;
        lastModifiedDate?: string | null;
      } | null;
      listingCategories?: string[];
    };
    categories: any[];
  } | null;
}

// Fractional gold star rating
function SalesforceStars({ rating }: { rating: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const fill = Math.min(1, Math.max(0, rating - (i - 1)));
    stars.push(
      <svg key={i} viewBox="0 0 24 24" className="h-6 w-6">
        <defs>
          <linearGradient id={`sf-star-${i}-${rating}`}>
            <stop offset={`${fill * 100}%`} stopColor="#F59E0B" />
            <stop offset={`${fill * 100}%`} stopColor="#D1D5DB" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={`url(#sf-star-${i}-${rating})`}
        />
      </svg>
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

// Salesforce search/category result card
function SalesforceSearchCard({
  icon,
  name,
  developerName,
  description,
  rating,
  reviewCount,
  categoryNames,
  nameChanged,
  descChanged,
}: {
  icon: string | null;
  name: string;
  developerName: string;
  description: string;
  rating: number | null;
  reviewCount: number | null;
  categoryNames: string[];
  nameChanged: boolean;
  descChanged: boolean;
}) {
  return (
    <div className="border border-[#E5E5E5] rounded-2xl p-5 bg-white text-[#181818] hover:shadow-md transition-shadow min-w-[320px] max-w-[420px]">
      {/* Icon + Name + Developer + Rating */}
      <div className="flex gap-3.5 mb-3">
        {icon ? (
          <img src={icon} alt="" aria-hidden="true" className="h-14 w-14 rounded-xl shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-[#032D60] flex items-center justify-center text-xl font-bold text-white shrink-0">
            {name.charAt(0) || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-[16px] font-bold leading-tight truncate", nameChanged && mod)}>
            {name || "App Name"}
          </p>
          {developerName && (
            <p className="text-[13px] text-[#666] mt-0.5">{developerName}</p>
          )}
          {rating != null && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const fill = Math.min(1, Math.max(0, rating - i));
                  return (
                    <svg key={i} viewBox="0 0 24 24" className="h-4 w-4">
                      <defs>
                        <linearGradient id={`sf-card-star-${i}-${rating}`}>
                          <stop offset={`${fill * 100}%`} stopColor="#F59E0B" />
                          <stop offset={`${fill * 100}%`} stopColor="#D1D5DB" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={`url(#sf-card-star-${i}-${rating})`}
                      />
                    </svg>
                  );
                })}
              </div>
              <span className="text-[13px] text-[#444] font-medium">
                {rating.toFixed(2)} ({reviewCount != null ? formatNumber(reviewCount) : 0})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className={cn("text-[13px] text-[#444] leading-relaxed line-clamp-3 mb-3", descChanged && mod)}>
        {description || "App description"}
      </p>

      {/* Category badges */}
      {categoryNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categoryNames.map((cat, i) => (
            <span
              key={i}
              className="inline-block bg-[#EEF4FF] text-[#032D60] rounded-md px-3 py-1 text-[12px] font-medium"
            >
              {cat}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Metadata badge pill (used in sidebar and More Details tab)
const metaBadge = "inline-block bg-[#F4F6F9] border border-[#d8dde6] rounded px-2.5 py-1 text-[12px] text-[#444]";

// Section heading style (serif-like, navy)
const sectionHeading = "text-[24px] font-bold text-[#032D60]";

// Highlight card gradient bar colors — alternating
const highlightBarColors = [
  "from-[#0176D3] to-[#1B96FF]",
  "from-[#FF5D2D] to-[#FE9339]",
  "from-[#0176D3] to-[#1B96FF]",
  "from-[#FF5D2D] to-[#FE9339]",
  "from-[#0176D3] to-[#1B96FF]",
  "from-[#FF5D2D] to-[#FE9339]",
];

// Small info circle icon (matching AppExchange style)
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-[#999] shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/** Approximate a star distribution from average rating + total count */
function approximateStarDistribution(avg: number, total: number): Record<number, number> {
  if (total === 0) return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  // Weight distribution based on average — skew toward the average star
  const weights: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (let star = 1; star <= 5; star++) {
    const distance = Math.abs(avg - star);
    weights[star] = Math.max(0.02, 1 / (1 + distance * 1.8));
  }
  const wSum = Object.values(weights).reduce((a, b) => a + b, 0);
  const dist: Record<number, number> = {};
  let remaining = total;
  for (let star = 5; star >= 2; star--) {
    dist[star] = Math.round(total * (weights[star] / wSum));
    remaining -= dist[star];
  }
  dist[1] = Math.max(0, remaining);
  return dist;
}

/** Generate sample review cards for visual preview */
function generateSampleReviews(avg: number, total: number, devName: string) {
  const samples = [
    {
      name: "Sarah M.",
      initials: "SM",
      badge: "MVP" as string | null,
      stars: Math.min(5, Math.round(avg + 0.3)),
      title: "Great solution for our team",
      body: "This app has been instrumental in improving our workflow. The integration with Salesforce is seamless and the support team is very responsive.",
      date: "Jan 15, 2025",
      likes: 12,
      devResponse: "Thank you for your kind words, Sarah! We're glad the integration has been working well for your team.",
    },
    {
      name: "James K.",
      initials: "JK",
      badge: null,
      stars: Math.min(5, Math.max(1, Math.round(avg))),
      title: "Solid functionality with room to grow",
      body: "We've been using this for about 6 months now. The core features work well and the recent updates have addressed most of our initial concerns. Would love to see more customization options.",
      date: "Dec 3, 2024",
      likes: 5,
      devResponse: null as string | null,
    },
    {
      name: "Alex R.",
      initials: "AR",
      badge: "Ranger" as string | null,
      stars: Math.min(5, Math.max(1, Math.round(avg - 0.5))),
      title: "Does what it promises",
      body: "Setup was straightforward and the documentation is comprehensive. Performance has been consistent across our org.",
      date: "Nov 18, 2024",
      likes: 3,
      devResponse: null as string | null,
    },
  ];
  return samples.slice(0, Math.min(3, total));
}

export function SalesforcePreview({
  appData,
}: {
  appData: SalesforceAppData;
}) {
  const limits = getMetadataLimits("salesforce");
  const snapshot = appData.latestSnapshot;
  const pd = snapshot?.platformData;

  const [name, setName] = useState(appData.name || "");
  const [description, setDescription] = useState(snapshot?.appIntroduction || pd?.description || "");
  const [fullDescription, setFullDescription] = useState(snapshot?.appDetails || pd?.fullDescription || "");
  const [features, setFeatures] = useState<string[]>(snapshot?.features || []);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "more-details">("overview");

  const origName = appData.name || "";
  const origDescription = snapshot?.appIntroduction || pd?.description || "";
  const origFullDescription = snapshot?.appDetails || pd?.fullDescription || "";
  const origFeatures = snapshot?.features || [];

  function resetToOriginal() {
    setName(origName);
    setDescription(origDescription);
    setFullDescription(origFullDescription);
    setFeatures([...origFeatures]);
  }

  function updateFeatureTitle(index: number, newTitle: string) {
    setFeatures((prev) => {
      const next = [...prev];
      const parts = next[index].split("\n");
      parts[0] = newTitle;
      next[index] = parts.join("\n");
      return next;
    });
  }

  function updateFeatureDesc(index: number, newDesc: string) {
    setFeatures((prev) => {
      const next = [...prev];
      const [title] = next[index].split("\n");
      next[index] = title + "\n" + newDesc;
      return next;
    });
  }

  const nameChanged = name !== origName;
  const descChanged = description !== origDescription;
  const fullDescChanged = fullDescription !== origFullDescription;

  const rating = snapshot?.averageRating ? Number(snapshot.averageRating) : null;
  const reviewCount = snapshot?.ratingCount ?? null;
  const editions = pd?.editions || [];
  const publisher = pd?.publisher;
  const developerName = snapshot?.developer?.name || publisher?.name || "";
  const pricingModelType = pd?.pricingModelType || snapshot?.pricing || "";
  const sfPlans = pd?.pricingPlans || [];
  const industries = pd?.supportedIndustries || [];
  const productsRequired = pd?.productsRequired || [];
  const integrations = snapshot?.integrations || pd?.productsSupported || [];
  const languages = pd?.languages || snapshot?.languages || [];
  const categories = snapshot?.categories || [];
  const businessNeeds = (pd as any)?.businessNeeds || [];
  const solution = pd?.solution;
  const manifest = solution?.manifest;
  const technology = pd?.technology || null;
  const publishedDate = pd?.publishedDate || null;
  const icon = appData.iconUrl;

  // Parse features into title/description pairs
  const parsedFeatures = features.map((f) => {
    const [title, ...rest] = f.split("\n");
    return { title, description: rest.join("\n").trim() };
  });

  // PLA-1109: use canonical label instead of ad-hoc charAt-uppercase.
  const normalizedPricing = displayPricingModel(pricingModelType);
  const isFreemium = normalizedPricing === "Freemium" || normalizedPricing === "Free Trial";
  const pricingLabel = normalizedPricing === "\u2014" ? "Free" : normalizedPricing;

  // Build pricing description text
  let pricingDescription = "";
  if (isFreemium) {
    pricingDescription = "Payment required to increase usage, users, or features. Discounts available for nonprofits.";
  } else if (normalizedPricing === "Paid") {
    pricingDescription = "This listing requires payment.";
  }

  // Category names for card badges
  const categoryNames = categories
    .map((c: any) => c.title || c.name || c.categoryTitle)
    .filter(Boolean)
    .slice(0, 3);

  return {
    resetToOriginal,
    preview: (
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* ── Search / Category Card Preview ── */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
            Search / Category Results
          </p>
          <div className="flex gap-4 flex-wrap">
            <SalesforceSearchCard
              icon={icon}
              name={name}
              developerName={developerName}
              description={description}
              rating={rating}
              reviewCount={reviewCount}
              categoryNames={categoryNames}
              nameChanged={nameChanged}
              descChanged={descChanged}
            />
          </div>
        </div>

        {/* ── Detail Page Preview ── */}
        <div className="border rounded-2xl overflow-hidden bg-white text-[#181818]">
          {/* ── Header: Icon + Title + Publisher + Description + Badge + Rating ── */}
          <div className="px-8 pt-7 pb-0">
            <div className="flex items-start gap-5">
              {icon ? (
                <img src={icon} alt="" aria-hidden="true" className="h-14 w-14 rounded-xl shrink-0" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-[#032D60] flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {name.charAt(0) || "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className={cn("text-[26px] font-bold text-[#181818] leading-tight", nameChanged && mod)}>
                  {name || "App Name"}
                </h1>
                {developerName && (
                  <p className="text-[14px] text-[#666] mt-0.5">By {developerName}</p>
                )}
                {description && (
                  <p className={cn("text-[14px] text-[#444] mt-1.5 leading-snug", descChanged && mod)}>
                    {description}
                  </p>
                )}
                {/* Badge + Stars + Rating */}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 border border-[#d8dde6] rounded-full px-3.5 py-1.5 text-[13px] text-[#444] font-medium">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0176D3]" fill="currentColor">
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                    </svg>
                    Salesforce App
                  </span>
                  {rating != null && (
                    <div className="flex items-center gap-2">
                      <SalesforceStars rating={rating} />
                      <span className="text-[14px] text-[#444]">{rating.toFixed(2)} Average Rating</span>
                      <span className="text-[14px] text-[#0176D3] underline cursor-pointer">
                        ({reviewCount != null ? formatNumber(reviewCount) : 0} Reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* ── 3-column hero: Sidebar | Content (description + video + screenshot) ── */}
          <div className="flex border-t border-[#E5E5E5]">
            {/* Left sidebar — metadata */}
            <div className="w-1/4 shrink-0 px-6 py-6 space-y-5 text-[13px]">
              {/* CTA buttons */}
              <div className="flex items-center gap-3">
                <button className="bg-[#0176D3] hover:bg-[#014486] text-white text-[14px] font-bold px-6 py-2.5 rounded-md transition-colors">
                  Get It Now
                </button>
                <button className="border-2 border-[#0176D3] text-[#0176D3] hover:bg-[#EEF4FF] text-[14px] font-bold px-6 py-2.5 rounded-md transition-colors">
                  Try It
                </button>
                <button className="text-[#E4002B] hover:text-[#c62828] transition-colors">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>

              <div>
                <p className="text-[20px] font-bold text-[#032D60]">{pricingLabel}</p>
                {pricingDescription && (
                  <p className="text-[12px] text-[#666] mt-1.5 leading-snug">{pricingDescription}</p>
                )}
                <button
                  onClick={() => setActiveTab("overview")}
                  className="text-[12px] text-[#0176D3] mt-1 underline text-left"
                >
                  Pricing Details
                </button>
              </div>

              {industries.length > 0 && (
                <div>
                  <p className="font-bold text-[#181818] mb-2">Industries</p>
                  <div className="flex flex-wrap gap-1.5">
                    {industries.map((ind, i) => (
                      <span key={i} className={metaBadge}>{ind}</span>
                    ))}
                  </div>
                </div>
              )}

              {businessNeeds.length > 0 && (
                <div>
                  <p className="font-bold text-[#181818] mb-2">Business Need</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(businessNeeds) ? businessNeeds : []).map((need: string, i: number) => (
                      <span key={i} className={metaBadge}>{need}</span>
                    ))}
                  </div>
                </div>
              )}

              {productsRequired.length > 0 && (
                <div>
                  <p className="font-bold text-[#181818] mb-2">Requires</p>
                  <div className="flex flex-wrap gap-1.5">
                    {productsRequired.map((p, i) => (
                      <span key={i} className={metaBadge}>{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {integrations.length > 0 && (
                <div>
                  <p className="font-bold text-[#181818] mb-2">Compatible With</p>
                  <div className="flex flex-wrap gap-1.5">
                    {integrations.map((item, i) => (
                      <span key={i} className={metaBadge}>{item}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setActiveTab("more-details")}
                className="text-[12px] text-[#0176D3] underline text-left"
              >
                More Details
              </button>
            </div>

            {/* Center + Right — description paragraph above, then video + screenshot side-by-side */}
            <div className="flex-1 min-w-0 py-5 pr-6 space-y-4">
              {/* Full description paragraph spanning full width */}
              <p className={cn("text-[14px] text-[#444] leading-relaxed pl-2", fullDescChanged && mod)}>
                {fullDescription || description || "App description goes here."}
              </p>

              {/* Video + Screenshot side by side */}
              <div className="flex gap-4 pl-2">
                {/* Video placeholder */}
                <div className="flex-[3] min-w-0">
                  <div className="aspect-[16/10] bg-gradient-to-b from-[#87CEEB] via-[#B0C4DE] to-[#2E4F3F] rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-12 w-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="h-6 w-6 text-white ml-0.5" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <svg viewBox="0 0 24 24" className="h-10 w-10 text-white/80" fill="currentColor">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                      </svg>
                    </div>
                    <p className="text-white text-lg font-medium flex items-center gap-1.5">
                      Watch Demo
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </p>
                  </div>
                </div>

                {/* Screenshot placeholder */}
                <div className="flex-[2] min-w-0">
                  <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white h-full flex flex-col">
                    <div className="flex-1 bg-gradient-to-br from-[#F0F4FF] to-[#E8ECF4] flex items-center justify-center min-h-[160px]">
                      <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#ccc]" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                    </div>
                    <p className="text-[12px] text-[#666] text-center py-3 px-4 leading-snug border-t border-[#E5E5E5]">
                      App screenshot preview
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="border-t border-[#E5E5E5] px-8">
            <div className="flex gap-0">
              {([
                { key: "overview", label: "Overview" },
                { key: "reviews", label: "Reviews" },
                { key: "more-details", label: "More Details" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "text-[15px] py-3.5 px-6 border-b-[3px] transition-colors",
                    activeTab === tab.key
                      ? "border-[#032D60] text-[#181818] font-bold"
                      : "border-transparent text-[#666] hover:text-[#444] font-medium"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── TAB: Overview ── */}
          {activeTab === "overview" && (
            <>
              {/* Highlights */}
              {parsedFeatures.filter((f) => f.title.trim()).length > 0 && (
                <div className="px-8 pt-8 pb-6 border-t border-[#E5E5E5]">
                  <h2 className={cn(sectionHeading, "mb-6")}>Highlights</h2>
                  <div className="grid grid-cols-3 gap-x-10 gap-y-8">
                    {parsedFeatures
                      .filter((f) => f.title.trim())
                      .map((feat, i) => {
                        const origFeat = origFeatures[i] ?? "";
                        const [origTitle, ...origRest] = origFeat.split("\n");
                        const origDesc = origRest.join("\n").trim();
                        const titleChanged = feat.title !== origTitle;
                        const featureDescChanged = feat.description !== origDesc;
                        const barColor = highlightBarColors[i % highlightBarColors.length];
                        return (
                          <div key={i}>
                            <div className={cn("h-1 w-20 rounded-full bg-gradient-to-r mb-4", barColor)} />
                            <p className={cn("text-[14px] font-semibold text-[#181818] leading-snug", titleChanged && mod)}>
                              {feat.title}
                            </p>
                            {feat.description && (
                              <p className={cn("text-[13px] text-[#444] mt-2 leading-relaxed", featureDescChanged && mod)}>
                                {feat.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Provider Details + Pricing Details */}
              <div className="border-t border-[#E5E5E5] flex">
                <div className="flex-1 px-8 py-8 border-r border-[#E5E5E5]">
                  <h2 className={cn(sectionHeading, "mb-5")}>Provider Details</h2>
                  {publisher && (
                    <div>
                      <div className="flex items-center gap-4 mb-5">
                        {icon ? (
                          <img src={icon} alt="" aria-hidden="true" className="h-12 w-12 rounded shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-[#F4F6F9] flex items-center justify-center text-base font-bold text-[#0176D3] shrink-0 border border-[#E5E5E5]">
                            {(publisher.name || "P").charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-[16px] font-bold text-[#181818]">{publisher.name || developerName}</p>
                          {publisher.location && (
                            <p className="text-[13px] text-[#666] font-medium">{publisher.location}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px] mb-5">
                        {publisher.yearFounded && (
                          <div>
                            <p className="font-bold text-[#181818]">Founded</p>
                            <p className="text-[#444]">{publisher.yearFounded}</p>
                          </div>
                        )}
                        {publisher.website && (
                          <div>
                            <p className="font-bold text-[#181818]">Website</p>
                            <p className="text-[#0176D3] underline break-all">{publisher.website}</p>
                          </div>
                        )}
                        {publisher.email && (
                          <div>
                            <p className="font-bold text-[#181818]">Email</p>
                            <p className="text-[#0176D3] underline break-all">{publisher.email}</p>
                          </div>
                        )}
                      </div>
                      {publisher.description && (
                        <p className="text-[13px] text-[#444] leading-relaxed whitespace-pre-line">
                          {publisher.description}
                        </p>
                      )}
                    </div>
                  )}
                  {!publisher && developerName && (
                    <p className="text-[14px] text-[#444]">{developerName}</p>
                  )}
                </div>

                <div className="flex-1 px-8 py-8">
                  <h2 className={cn(sectionHeading, "mb-5")}>Pricing Details</h2>
                  <p className="text-[17px] font-bold text-[#181818] mb-2">{pricingLabel}</p>
                  {pricingDescription && (
                    <p className="text-[13px] text-[#444] mb-5 leading-relaxed">{pricingDescription}</p>
                  )}
                  {sfPlans.length > 0 && (
                    <div className="space-y-3 mt-5">
                      {sfPlans.map((plan: any, i: number) => {
                        const planName = plan.plan_name || `Plan ${i + 1}`;
                        let priceLabel = "Free";
                        if (plan.price) {
                          const parts = [plan.currency_code || "USD", plan.units, plan.frequency]
                            .filter(Boolean)
                            .join("/");
                          priceLabel = `$${plan.price} ${parts}`;
                        }
                        return (
                          <div
                            key={i}
                            className="border border-[#E5E5E5] rounded-lg px-5 py-4 flex items-center justify-between"
                          >
                            <span className="text-[15px] font-bold text-[#0176D3]">{planName}</span>
                            <span className="text-[14px] text-[#444]">{priceLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              {fullDescription && (
                <div className="border-t border-[#E5E5E5] px-8 py-8">
                  <h2 className={cn(sectionHeading, "mb-5")}>Additional Details</h2>
                  <p className={cn("text-[13px] text-[#444] leading-relaxed whitespace-pre-line columns-2 gap-10", fullDescChanged && mod)}>
                    {fullDescription}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── TAB: Reviews ── */}
          {activeTab === "reviews" && (() => {
            // Approximate star distribution from average + count
            const totalReviews = reviewCount ?? 0;
            const avg = rating ?? 0;
            const dist = approximateStarDistribution(avg, totalReviews);

            return (
              <div className="border-t border-[#E5E5E5] flex">
                {/* Left sidebar — filters */}
                <div className="w-[220px] shrink-0 border-r border-[#E5E5E5] px-5 py-6 space-y-6">
                  <div>
                    <p className="text-[13px] font-bold text-[#181818] mb-3">Rating</p>
                    {[5, 4, 3, 2, 1].map((star) => (
                      <label key={star} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input type="checkbox" className="rounded border-[#ccc] h-3.5 w-3.5 accent-[#0176D3]" disabled />
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: star }).map((_, i) => (
                            <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#F59E0B">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                          {Array.from({ length: 5 - star }).map((_, i) => (
                            <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#D1D5DB">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#181818] mb-3">Badges</p>
                    {["MVP", "Ranger", "Top Reviewer"].map((badge) => (
                      <label key={badge} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input type="checkbox" className="rounded border-[#ccc] h-3.5 w-3.5 accent-[#0176D3]" disabled />
                        <span className="text-[13px] text-[#444]">{badge}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 px-8 py-6">
                  {/* Rating summary */}
                  <div className="flex items-start gap-8 mb-8">
                    {/* Large rating number + stars */}
                    <div className="text-center shrink-0">
                      <p className="text-[48px] font-bold text-[#181818] leading-none">
                        {avg ? avg.toFixed(1) : "0.0"}
                      </p>
                      <div className="flex items-center gap-0.5 mt-2 justify-center">
                        <SalesforceStars rating={avg} />
                      </div>
                    </div>

                    {/* Star distribution bars */}
                    <div className="flex-1 min-w-0 pt-1 max-w-[320px]">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = dist[star] ?? 0;
                        const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 py-0.5">
                            <span className="text-[12px] text-[#0176D3] w-10 text-right shrink-0 cursor-pointer">
                              {star} star{star !== 1 ? "s" : ""}
                            </span>
                            <div className="flex-1 h-3 bg-[#E5E5E5] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#F59E0B] rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[12px] text-[#666] w-8 shrink-0">{count}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Write Review button */}
                    <div className="shrink-0 pt-2">
                      <button className="bg-[#0176D3] text-white text-[14px] font-bold px-6 py-2.5 rounded-md hover:bg-[#014486] transition-colors">
                        Write Review
                      </button>
                    </div>
                  </div>

                  {/* Review count + sort */}
                  <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3 mb-5">
                    <p className="text-[14px] text-[#444]">
                      Showing {totalReviews > 0 ? `1-${Math.min(totalReviews, 10)}` : "0"} of{" "}
                      <span className="font-bold">{formatNumber(totalReviews)}</span> Reviews
                    </p>
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="text-[#666]">Sort by</span>
                      <select className="border border-[#d8dde6] rounded px-2.5 py-1.5 text-[13px] bg-white text-[#444]" disabled>
                        <option>Most Recent</option>
                        <option>Most Helpful</option>
                        <option>Highest Rating</option>
                        <option>Lowest Rating</option>
                      </select>
                    </div>
                  </div>

                  {/* Sample review cards */}
                  {totalReviews > 0 ? (
                    <div className="space-y-0">
                      {generateSampleReviews(avg, totalReviews, developerName).map((review, i) => (
                        <div key={i} className="border-b border-[#E5E5E5] py-5">
                          <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="h-10 w-10 rounded-full bg-[#032D60] flex items-center justify-center text-white text-[14px] font-bold shrink-0">
                              {review.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Name + rating + date row */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-[14px] font-bold text-[#181818]">{review.name}</span>
                                {review.badge && (
                                  <span className="text-[11px] bg-[#EEF4FF] text-[#0176D3] px-2 py-0.5 rounded font-medium">
                                    {review.badge}
                                  </span>
                                )}
                                <span className="text-[12px] text-[#888]">{review.date}</span>
                              </div>
                              {/* Stars */}
                              <div className="flex items-center gap-0.5 mt-1">
                                {Array.from({ length: 5 }).map((_, s) => (
                                  <svg key={s} viewBox="0 0 24 24" className="h-4 w-4" fill={s < review.stars ? "#F59E0B" : "#D1D5DB"}>
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                  </svg>
                                ))}
                              </div>
                              {/* Title */}
                              <p className="text-[14px] font-bold text-[#181818] mt-2">{review.title}</p>
                              {/* Body */}
                              <p className="text-[13px] text-[#444] mt-1 leading-relaxed">{review.body}</p>
                              {/* Actions */}
                              <div className="flex items-center gap-4 mt-3">
                                <button className="text-[12px] text-[#0176D3] font-medium flex items-center gap-1">
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                  </svg>
                                  Comment
                                </button>
                                <button className="text-[12px] text-[#0176D3] font-medium flex items-center gap-1">
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                  </svg>
                                  Like ({review.likes})
                                </button>
                                <button className="text-[12px] text-[#888] ml-auto">Report Abuse</button>
                              </div>

                              {/* Developer response (on some reviews) */}
                              {review.devResponse && (
                                <div className="mt-4 ml-6 border-l-2 border-[#0176D3] pl-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-bold text-[#181818]">{developerName || "Developer"}</span>
                                    <span className="text-[11px] bg-[#E8FAE5] text-[#2E844A] px-2 py-0.5 rounded font-medium">
                                      Publisher
                                    </span>
                                  </div>
                                  <p className="text-[13px] text-[#444] mt-1 leading-relaxed">{review.devResponse}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Pagination indicator */}
                      {totalReviews > 3 && (
                        <div className="flex items-center justify-center gap-2 py-6">
                          <button className="h-8 w-8 rounded bg-[#0176D3] text-white text-[13px] font-bold">1</button>
                          <button className="h-8 w-8 rounded text-[#0176D3] text-[13px] font-medium hover:bg-[#F4F6F9]">2</button>
                          {totalReviews > 20 && (
                            <button className="h-8 w-8 rounded text-[#0176D3] text-[13px] font-medium hover:bg-[#F4F6F9]">3</button>
                          )}
                          <span className="text-[#888] text-[13px]">...</span>
                          <button className="text-[#0176D3] text-[13px] font-medium hover:underline">Next</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-[16px] font-medium text-[#444]">No reviews yet</p>
                      <p className="text-[13px] text-[#888] mt-1">Be the first to review this app.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── TAB: More Details ── */}
          {activeTab === "more-details" && (
            <div className="border-t border-[#E5E5E5]">
              <div className="grid grid-cols-3 divide-x divide-[#E5E5E5]">
                {/* Column 1: Compatibility */}
                <div className="px-7 py-7 text-[13px] space-y-5">
                  <h3 className="text-[18px] font-bold text-[#181818]">Compatibility</h3>

                  {productsRequired.length > 0 && (
                    <div>
                      <p className="font-bold text-[#181818] mb-2 flex items-center gap-1.5">
                        Requires <InfoIcon />
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {productsRequired.map((p, i) => (
                          <span key={i} className={metaBadge}>{p}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {integrations.length > 0 && (
                    <div>
                      <p className="font-bold text-[#181818] mb-2 flex items-center gap-1.5">
                        Compatible With <InfoIcon />
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {integrations.map((item, i) => (
                          <span key={i} className={metaBadge}>{item}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {editions.length > 0 && (
                    <div>
                      <p className="font-bold text-[#181818] mb-2">Salesforce Editions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {editions.map((ed, i) => (
                          <span key={i} className={metaBadge}>{ed}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: App Details */}
                <div className="px-7 py-7 text-[13px] space-y-5">
                  <h3 className="text-[18px] font-bold text-[#181818]">App Details</h3>

                  {(solution?.namespacePrefix || publishedDate || solution?.latestVersionDate) && (
                    <div className="grid grid-cols-3 gap-4">
                      {solution?.namespacePrefix && (
                        <div>
                          <p className="font-bold text-[#181818]">Version</p>
                          <p className="text-[#444] mt-0.5">{solution.namespacePrefix}</p>
                        </div>
                      )}
                      {publishedDate && (
                        <div>
                          <p className="font-bold text-[#181818]">Listed On</p>
                          <p className="text-[#444] mt-0.5">{formatDate(publishedDate)}</p>
                        </div>
                      )}
                      {solution?.latestVersionDate && (
                        <div>
                          <p className="font-bold text-[#181818]">Latest Release</p>
                          <p className="text-[#444] mt-0.5">{formatDate(solution.latestVersionDate)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(() => {
                    const supportedFeatures: string[] = [];
                    if (manifest) {
                      if (manifest.isLightningAppBuilder) supportedFeatures.push("Lightning App Builder");
                      if (manifest.hasLWC) supportedFeatures.push("Lightning Ready");
                      if (manifest.isCommunityBuilder) supportedFeatures.push("Community Builder");
                    }
                    if (solution?.packageCategory) supportedFeatures.push(solution.packageCategory);
                    if (technology) supportedFeatures.push(technology);
                    if (supportedFeatures.length === 0) return null;
                    return (
                      <div>
                        <p className="font-bold text-[#181818] mb-2 flex items-center gap-1.5">
                          Supported Features <InfoIcon />
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {supportedFeatures.map((f, i) => (
                            <span key={i} className={metaBadge}>{f}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {manifest && (manifest.objectsCount || manifest.tabsCount || manifest.applicationsCount) && (
                    <div>
                      <p className="font-bold text-[#181818] mb-2 flex items-center gap-1.5">
                        Package Contents <InfoIcon />
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {manifest.objectsCount != null && manifest.objectsCount > 0 && (
                          <span className={metaBadge}>Custom Objects: {manifest.objectsCount}</span>
                        )}
                        {manifest.tabsCount != null && manifest.tabsCount > 0 && (
                          <span className={metaBadge}>Custom Tabs: {manifest.tabsCount}</span>
                        )}
                        {manifest.applicationsCount != null && manifest.applicationsCount > 0 && (
                          <span className={metaBadge}>Custom Apps: {manifest.applicationsCount}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {manifest && (manifest.globalComponentsCount != null || manifest.appBuilderComponentsCount != null || manifest.cmtyBuilderComponentsCount != null) && (
                    <div>
                      <p className="font-bold text-[#181818] mb-2">Lightning Components</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={metaBadge}>Global: {manifest.globalComponentsCount ?? 0}</span>
                        <span className={metaBadge}>App Builder: {manifest.appBuilderComponentsCount ?? 0}</span>
                        <span className={metaBadge}>Community Builder: {manifest.cmtyBuilderComponentsCount ?? 0}</span>
                      </div>
                    </div>
                  )}

                  {languages.length > 0 && (
                    <div>
                      <p className="font-bold text-[#181818] mb-2">Languages</p>
                      <div className="flex flex-wrap gap-1.5">
                        {languages.map((lang, i) => (
                          <span key={i} className={metaBadge}>{lang}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 3: Security */}
                <div className="px-7 py-7 text-[13px] space-y-4">
                  <h3 className="text-[18px] font-bold text-[#181818]">Security</h3>
                  <p className="text-[#444] leading-relaxed">
                    Learn more about the{" "}
                    <span className="text-[#0176D3] underline cursor-pointer">
                      Security Requirements for AppExchange Partners and Solutions
                    </span>
                    .
                  </p>
                  <p className="text-[#444] leading-relaxed">
                    {solution?.packageCategory
                      ? `This solution is a ${solution.packageCategory} as defined in Salesforce's `
                      : "This solution is published on Salesforce AppExchange. Notwithstanding these Security Requirements or any security review of a Partner Application, Salesforce makes no guarantees about the quality or security of this solution. You're responsible for evaluating this solution's quality, security, and functionality."}
                    {solution?.packageCategory && (
                      <span className="text-[#0176D3] underline cursor-pointer">Main Services Agreement</span>
                    )}
                    {solution?.packageCategory && "."}
                  </p>
                  {solution?.lastModifiedDate && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <p className="font-bold text-[#181818] flex items-center gap-1.5">
                          Last Reviewed Version <InfoIcon />
                        </p>
                        <p className="text-[#444] mt-0.5">{solution.namespacePrefix || "—"}</p>
                      </div>
                      <div>
                        <p className="font-bold text-[#181818] flex items-center gap-1.5">
                          Last Reviewed Date <InfoIcon />
                        </p>
                        <p className="text-[#444] mt-0.5">{formatDate(solution.lastModifiedDate)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Details + Need help */}
              <div className="border-t border-[#E5E5E5] flex">
                <div className="flex-[2] px-8 py-8">
                  <h2 className={cn(sectionHeading, "mb-5")}>Additional Details</h2>
                  {fullDescription && (
                    <p className={cn("text-[13px] text-[#444] leading-relaxed whitespace-pre-line columns-2 gap-10", fullDescChanged && mod)}>
                      {fullDescription}
                    </p>
                  )}
                </div>
                {publisher && (
                  <div className="flex-1 px-7 py-8 border-l border-[#E5E5E5]">
                    <h3 className="text-[16px] font-bold text-[#666] mb-4">Need help?</h3>
                    <div className="flex items-center gap-3 mb-4">
                      {icon ? (
                        <img src={icon} alt="" aria-hidden="true" className="h-10 w-10 rounded shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-[#F4F6F9] flex items-center justify-center text-sm font-bold text-[#0176D3] shrink-0 border border-[#E5E5E5]">
                          {(publisher.name || "P").charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-[14px] font-bold text-[#181818]">{publisher.name || developerName}</p>
                        {publisher.location && (
                          <p className="text-[13px] text-[#666] font-medium">{publisher.location}</p>
                        )}
                      </div>
                    </div>
                    {publisher.website && (
                      <div className="text-[13px]">
                        <p className="font-bold text-[#181818]">Other Resources</p>
                        <p className="text-[#0176D3] underline mt-1">{publisher.website}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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

        <EditorField label="Description" count={description.length} max={limits.introduction} changed={descChanged}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description shown in header"
            rows={4}
            className={cn(
              "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              descChanged ? "border-amber-500" : "border-input",
              description.length > limits.introduction && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        <EditorField label="Full Description" count={fullDescription.length} max={limits.details} changed={fullDescChanged}>
          <textarea
            value={fullDescription}
            onChange={(e) => setFullDescription(e.target.value)}
            placeholder="Detailed app description"
            rows={8}
            className={cn(
              "w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              fullDescChanged ? "border-amber-500" : "border-input",
              fullDescription.length > limits.details && "border-red-500 focus-visible:ring-red-500/50"
            )}
          />
        </EditorField>

        {/* Highlights editor */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Highlights</span>
          {features.map((feat, i) => {
            const [title, ...rest] = feat.split("\n");
            const desc = rest.join("\n").trim();
            const origFeat = origFeatures[i] ?? "";
            const [origTitle, ...origRest] = origFeat.split("\n");
            const origDesc = origRest.join("\n").trim();
            const titleChanged = title !== origTitle;
            const featureDescChanged = desc !== origDesc;
            return (
              <div key={i} className="space-y-1.5 border border-[#E5E5E5] rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 shrink-0 text-right font-medium">
                    {i + 1}.
                  </span>
                  <span className="text-xs text-muted-foreground">Title</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => updateFeatureTitle(i, e.target.value)}
                    placeholder={`Highlight ${i + 1} title`}
                    className={cn(
                      "flex-1",
                      titleChanged && "border-amber-500",
                      title.length > limits.feature && "border-red-500 focus-visible:ring-red-500/50"
                    )}
                  />
                  <CharBadge count={title.length} max={limits.feature} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground w-5 shrink-0" />
                  <span className="text-xs text-muted-foreground">Description</span>
                </div>
                <div className="flex items-start gap-2">
                  <textarea
                    value={desc}
                    onChange={(e) => updateFeatureDesc(i, e.target.value)}
                    placeholder={`Highlight ${i + 1} description`}
                    rows={2}
                    className={cn(
                      "flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none resize-none",
                      "placeholder:text-muted-foreground",
                      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                      featureDescChanged ? "border-amber-500" : "border-input",
                      desc.length > 200 && "border-red-500 focus-visible:ring-red-500/50"
                    )}
                  />
                  <CharBadge count={desc.length} max={200} />
                </div>
              </div>
            );
          })}
          {features.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No highlights available.</p>
          )}
        </div>
      </div>
    ),
  };
}
