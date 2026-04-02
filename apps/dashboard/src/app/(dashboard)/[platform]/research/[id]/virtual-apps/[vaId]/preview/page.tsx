"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface VirtualApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  iconUrl: string | null;
  appCardSubtitle: string;
  appIntroduction: string;
  appDetails: string;
  features: string[];
  integrations: string[];
  languages: string[];
  categories: any[];
  pricingPlans: any[];
}

// ─── Placeholder text ────────────────────────────────────────

const PLACEHOLDER_SUBTITLE = "Streamline your workflow and boost productivity with powerful automation tools.";
const PLACEHOLDER_INTRODUCTION = "The all-in-one solution to manage, automate, and scale your store effortlessly.";
const PLACEHOLDER_DETAILS = `Our app helps merchants save time and grow faster by automating repetitive tasks and providing actionable insights.

Whether you're a small business or a large enterprise, our intuitive dashboard makes it easy to track performance, manage inventory, and engage with customers — all in one place.

Key benefits include real-time analytics, seamless third-party integrations, and a dedicated support team ready to help you succeed.`;
const PLACEHOLDER_FEATURES = [
  "Real-time analytics dashboard with actionable insights",
  "Automated inventory management and low-stock alerts",
  "Seamless integration with popular marketing tools",
  "Customizable email and SMS notifications",
  "One-click bulk product editing",
];
const PLACEHOLDER_LANGUAGES = ["English", "French", "German", "Spanish", "Portuguese (Brazil)", "Italian", "Japanese"];
const PLACEHOLDER_INTEGRATIONS = ["Shopify Admin", "Shopify Flow", "Checkout", "Online Store 2.0"];
const PLACEHOLDER_CATEGORIES = [
  { title: "Store management", subcategories: [{ title: "Inventory", features: [{ title: "Stock tracking" }, { title: "Bulk editing" }] }] },
  { title: "Marketing", subcategories: [{ title: "Email", features: [{ title: "Campaigns" }, { title: "Automation" }] }] },
];
const PLACEHOLDER_PRICING_PLANS = [
  { name: "Free", price: null, period: null, trial_text: null, features: ["Up to 50 products", "Basic analytics", "Email support"] },
  { name: "Basic", price: "9.99", period: "month", trial_text: "7-day free trial", features: ["Up to 500 products", "Advanced analytics", "Priority support", "Custom reports"] },
  { name: "Pro", price: "29.99", period: "month", trial_text: "14-day free trial", features: ["Unlimited products", "AI-powered insights", "Dedicated account manager", "API access", "White-label options"] },
];

// ─── Stable random values (seeded from VA id) ───────────────

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 0x100000000;
  };
}

// ─── Shopify-style star ──────────────────────────────────────

function ShopifyStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 text-[#6a9e41] ${className || ""}`} fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

// ─── Search Result Card ──────────────────────────────────────

function SearchResultCard({
  icon,
  emojiIcon,
  color,
  name,
  subtitle,
  pricingLabel,
  rating,
  reviewCount,
  isAd,
}: {
  icon: string | null;
  emojiIcon: string;
  color: string;
  name: string;
  subtitle: string;
  pricingLabel: string;
  rating: number;
  reviewCount: number;
  isAd?: boolean;
}) {
  return (
    <div className="border border-[#e3e3e3] rounded-2xl p-4 bg-white text-[#1a1a1a] hover:shadow-md transition-shadow flex-1 min-w-[280px] max-w-[380px]">
      <div className="flex gap-3">
        {icon ? (
          <img src={icon} alt="" aria-hidden="true" className="h-12 w-12 rounded-xl shadow-sm shrink-0" />
        ) : (
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            {emojiIcon}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[14px] font-semibold leading-tight">{name || "App Name"}</p>
          <div className="flex items-center gap-1 flex-wrap text-[12px] text-[#616161]">
            {isAd && (
              <span className="text-[11px] text-[#616161] border border-[#c1c1c1] rounded px-1 py-px mr-0.5">Ad</span>
            )}
            <span className="font-semibold text-[#1a1a1a]">{rating.toFixed(1)}</span>
            <ShopifyStar className="h-3 w-3" />
            <span>({reviewCount})</span>
            <span>•</span>
            <span>{pricingLabel}</span>
          </div>
          <p className="text-[12px] text-[#616161] line-clamp-2 leading-snug">
            {subtitle || "App description"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Preview Page ───────────────────────────────────────

export default function VirtualAppPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { fetchWithAuth } = useAuth();

  const id = params.id as string;
  const vaId = params.vaId as string;
  const platform = params.platform as string;

  const [va, setVa] = useState<VirtualApp | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVa = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/research-projects/${id}/virtual-apps/${vaId}`);
      if (!res.ok) {
        router.push(`/${platform}/research/${id}/virtual-apps/${vaId}`);
        return;
      }
      setVa(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id, vaId, platform, fetchWithAuth, router]);

  useEffect(() => {
    fetchVa();
  }, [fetchVa]);

  // Stable random rating/reviews based on VA id
  const { rating, reviewCount } = useMemo(() => {
    const rng = seededRandom(vaId);
    const r = 4.7 + rng() * 0.2; // 4.7 - 4.9
    const rc = Math.floor(100 + rng() * 150); // 100 - 250
    return { rating: Math.round(r * 10) / 10, reviewCount: rc };
  }, [vaId]);

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
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const pricingPlans = va.pricingPlans || [];
  const activePlans = pricingPlans.length > 0 ? pricingPlans : PLACEHOLDER_PRICING_PLANS;
  const hasFree = activePlans.some((p: any) => !p.price || Number(p.price) === 0);
  const pricingLabel = hasFree
    ? "Free plan available"
    : `From $${Math.min(...activePlans.map((p: any) => Number(p.price) || 0))}/mo`;

  const hasTrial = activePlans.some((p: any) => p.trial_text);
  const pricingLine = [pricingLabel, hasTrial && "Free trial available"].filter(Boolean).join(". ") + ".";

  const icon = va.iconUrl;
  const languages = va.languages.length > 0 ? va.languages : PLACEHOLDER_LANGUAGES;
  const integrations = va.integrations.length > 0 ? va.integrations : PLACEHOLDER_INTEGRATIONS;
  const categories = va.categories.length > 0 ? va.categories : PLACEHOLDER_CATEGORIES;
  const features = va.features.length > 0 ? va.features : PLACEHOLDER_FEATURES;

  const displaySubtitle = va.appCardSubtitle || PLACEHOLDER_SUBTITLE;
  const displayIntro = va.appIntroduction || PLACEHOLDER_INTRODUCTION;
  const displayDetails = va.appDetails || PLACEHOLDER_DETAILS;

  const displayPlans = pricingPlans.length > 0 ? pricingPlans : PLACEHOLDER_PRICING_PLANS;
  const sortedPlans = [...displayPlans].sort((a: any, b: any) => {
    const aPrice = parseFloat(a.price || "0") || 0;
    const bPrice = parseFloat(b.price || "0") || 0;
    return aPrice - bPrice;
  });

  const isPlaceholderLanguages = va.languages.length === 0;
  const isPlaceholderIntegrations = va.integrations.length === 0;
  const isPlaceholderCategories = va.categories.length === 0;
  const isPlaceholderPricing = pricingPlans.length === 0;

  // Caption placeholders for media gallery
  const mediaCaptions = [
    displayIntro.slice(0, 60) + (displayIntro.length > 60 ? "..." : ""),
    "Powerful features to grow your business.",
    "Easy setup, instant results.",
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/${platform}/research/${id}/virtual-apps/${vaId}`)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="h-6 w-6 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${va.color}20` }}
          >
            <span className="text-xs">{va.icon}</span>
          </div>
          <h1 className="text-xl font-bold">{va.name}</h1>
          <span className="text-sm text-muted-foreground">Preview</span>
        </div>
      </div>

      {/* Forced light mode for marketplace-authentic preview colors */}
      <div className="max-w-[1400px] mx-auto space-y-6 force-light bg-white rounded-lg p-4 border dark:border-gray-700 dark:shadow-lg">
        {/* Search / Category Result Cards */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wide">
            Search / Category Results
          </p>
          <div className="flex gap-4 flex-wrap">
            <SearchResultCard
              icon={icon}
              emojiIcon={va.icon}
              color={va.color}
              name={va.name}
              subtitle={displaySubtitle}
              pricingLabel={pricingLabel}
              rating={rating}
              reviewCount={reviewCount}
            />
            <SearchResultCard
              icon={icon}
              emojiIcon={va.icon}
              color={va.color}
              name={va.name}
              subtitle={displayIntro}
              pricingLabel={pricingLabel}
              rating={rating}
              reviewCount={reviewCount}
              isAd
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
                    <img src={icon} alt="" aria-hidden="true" className="h-12 w-12 rounded-lg shrink-0" />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-xl font-bold shrink-0"
                      style={{ backgroundColor: `${va.color}20` }}
                    >
                      {va.icon}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold leading-snug">
                      {va.name || "App Name"}
                    </h2>
                  </div>
                </div>

                <div className="divide-y divide-[#e3e3e3] border-t border-[#e3e3e3]">
                  <div className="py-3">
                    <p className="text-[12px] font-semibold mb-0.5">Pricing</p>
                    <p className="text-[12px] text-[#616161]">{pricingLine}</p>
                  </div>
                  <div className="py-3">
                    <p className="text-[12px] font-semibold mb-0.5">Rating</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px]">{rating.toFixed(1)}</span>
                      <ShopifyStar className="h-3 w-3" />
                      <span className="text-[12px] text-[#616161]">({reviewCount})</span>
                    </div>
                  </div>
                  <div className="py-3">
                    <p className="text-[12px] font-semibold mb-0.5">Developer</p>
                    <p className="text-[12px] text-[#616161] underline">&ldquo;Acme Inc&rdquo;</p>
                  </div>
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
                {/* Media gallery placeholder */}
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
                      {mediaCaptions.map((caption, i) => (
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
                  <h3 className="text-[15px] font-bold leading-snug">
                    {displayIntro}
                  </h3>
                  <p className="text-[13px] text-[#303030] leading-relaxed whitespace-pre-line">
                    {displayDetails}
                  </p>
                  {features.length > 0 && (
                    <ul className="space-y-1.5 list-disc pl-5">
                      {features.map((f, i) => (
                        <li key={i} className="text-[13px] text-[#303030]">{f}</li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t border-[#e3e3e3] pt-4 space-y-0">
                    <div className="flex gap-6 py-3 border-b border-[#e3e3e3]">
                      <p className="text-[13px] font-semibold w-[120px] shrink-0">Languages</p>
                      <p className={`text-[13px] flex-1 ${isPlaceholderLanguages ? "text-[#999] italic" : "text-[#303030]"}`}>
                        {languages.join(", ")}
                      </p>
                    </div>
                    <div className="flex gap-6 py-3 border-b border-[#e3e3e3]">
                      <p className="text-[13px] font-semibold w-[120px] shrink-0">Works with</p>
                      <p className={`text-[13px] flex-1 ${isPlaceholderIntegrations ? "text-[#999] italic" : "text-[#303030]"}`}>
                        {integrations.join(", ")}
                      </p>
                    </div>
                    <div className="flex gap-6 py-3 border-b border-[#e3e3e3]">
                      <p className="text-[13px] font-semibold w-[120px] shrink-0">Categories</p>
                      <div className={`flex-1 space-y-2 ${isPlaceholderCategories ? "opacity-60 italic" : ""}`}>
                        {categories.map((cat: any, i: number) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[13px] text-[#303030] underline">{cat.title}</span>
                            <span className="text-[12px] text-[#616161] underline">Show features</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-6 py-3 border-b border-[#e3e3e3] last:border-0">
                      <p className="text-[13px] font-semibold w-[120px] shrink-0">Developer</p>
                      <p className="text-[13px] text-[#303030] flex-1 underline">
                        &ldquo;Acme Inc&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing section */}
            <div className={`bg-[#f7f7f7] border-t border-[#e3e3e3] px-5 py-6 ${isPlaceholderPricing ? "opacity-70" : ""}`}>
              <h3 className="text-[20px] font-bold mb-4">
                Pricing
                {isPlaceholderPricing && <span className="text-[12px] font-normal text-[#999] ml-2 italic">(placeholder)</span>}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedPlans.map((plan: any, i: number) => (
                  <div key={i} className="bg-white border border-[#e3e3e3] rounded-xl p-5 flex flex-col">
                    <p className="text-[13px] text-[#616161]">{plan.name}</p>
                    <p className="text-[22px] font-bold mt-1">
                      {plan.price && Number(plan.price) > 0 ? `$${plan.price}` : "Free"}
                      {plan.price && Number(plan.price) > 0 && plan.period && (
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
