"use client";

import type { PlatformId } from "@appranks/shared";

const BADGE_CONFIG: Record<string, Record<string, { icon: string; label: string; className: string }>> = {
  shopify: {
    built_for_shopify: {
      icon: "💎",
      label: "Built for Shopify",
      className: "text-blue-600",
    },
  },
  salesforce: {
    isa_certified: {
      icon: "✓",
      label: "ISA Certified",
      className: "text-green-600",
    },
    security_reviewed: {
      icon: "🔒",
      label: "Security Reviewed",
      className: "text-purple-600",
    },
  },
  canva: {
    premium: {
      icon: "👑",
      label: "Premium",
      className: "text-amber-600",
    },
    canva_extension: {
      icon: "🧩",
      label: "Extension",
      className: "text-indigo-600",
    },
  },
  wix: {},
  google_workspace: {
    editors_choice: {
      icon: "⭐",
      label: "Editor's Choice",
      className: "text-amber-600",
    },
    casa_certified: {
      icon: "🔒",
      label: "CASA Certified",
      className: "text-green-600",
    },
  },
  wordpress: {
    community: {
      icon: "🌐",
      label: "Open Source",
      className: "text-green-600",
    },
    commercial: {
      icon: "💼",
      label: "Commercial",
      className: "text-blue-600",
    },
  },
  atlassian: {
    cloud_fortified: {
      icon: "🛡️",
      label: "Cloud Fortified",
      className: "text-blue-600",
    },
    top_vendor: {
      icon: "⭐",
      label: "Top Vendor",
      className: "text-amber-600",
    },
  },
  zoom: {
    fedramp_authorized: {
      icon: "🏛️",
      label: "FedRAMP",
      className: "text-blue-700",
    },
    essential_app: {
      icon: "⭐",
      label: "Essential App",
      className: "text-amber-600",
    },
  },
  zoho: {},
  zendesk: {},
  hubspot: {},
  woocommerce: {},
};

interface AppBadgesProps {
  platform: PlatformId;
  badges?: string[];
  /** Legacy prop — if true, adds the platform's primary badge (e.g., built_for_shopify) */
  isBuiltForShopify?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function AppBadges({ platform, badges, isBuiltForShopify, showLabel = true, className }: AppBadgesProps) {
  const platformBadges = BADGE_CONFIG[platform] || {};

  // Build effective badge list
  const effectiveBadges: string[] = badges ? [...badges] : [];
  if (isBuiltForShopify && platform === "shopify" && !effectiveBadges.includes("built_for_shopify")) {
    effectiveBadges.push("built_for_shopify");
  }

  if (effectiveBadges.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-1 ${className || ""}`}>
      {effectiveBadges.map((badge) => {
        const config = platformBadges[badge];
        if (!config) return null;
        return (
          <span key={badge} className={`inline-flex items-center gap-0.5 ${config.className}`} title={config.label}>
            <span className="text-xs">{config.icon}</span>
            {showLabel && <span className="text-xs">{config.label}</span>}
          </span>
        );
      })}
    </span>
  );
}

/** Simple inline badge icon (no label) for use in tables/lists */
export function AppBadgeIcon({ platform, badges, isBuiltForShopify }: Pick<AppBadgesProps, "platform" | "badges" | "isBuiltForShopify">) {
  return <AppBadges platform={platform} badges={badges} isBuiltForShopify={isBuiltForShopify} showLabel={false} />;
}
