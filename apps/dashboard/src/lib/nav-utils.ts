import {
  LayoutDashboard,
  AppWindow,
  Star,
  Search,
  FolderTree,
  Sparkles,
  Puzzle,
  FlaskConical,
  Code,
  Tag,
  Shield,
  Users,
  User,
  KeyRound,
  Package,
  HeartPulse,
  Bot,
  BrainCircuit,
  MessageSquarePlus,
  Bell,
  BellDot,
  Mail,
  FileText,
  Palette,
  Settings,
  ShieldCheck,
  AlertTriangle,
  Activity,
  GitCompareArrows,
  Ghost,
  ToggleLeft,
  Globe,
  Building2,
  LifeBuoy,
  Sliders,
  type LucideIcon,
} from "lucide-react";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";

const PLATFORM_SET = new Set<string>(PLATFORM_IDS);

/** Extract platform ID from a pathname like /shopify/keywords → "shopify" */
export function extractPlatform(pathname: string): PlatformId {
  const seg = pathname.split("/")[1];
  return seg && PLATFORM_SET.has(seg) ? (seg as PlatformId) : "shopify";
}

/** Check if pathname is a platform-scoped route (e.g. /shopify/..., not /overview or /settings) */
export function isOnPlatformPage(pathname: string): boolean {
  const seg = pathname.split("/")[1];
  return !!seg && PLATFORM_SET.has(seg);
}

/** Extract the section from a pathname like /shopify/keywords/some-slug → "keywords" */
export function extractSection(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && PLATFORM_SET.has(parts[0])) {
    return parts[1];
  }
  return null;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  adminOnly?: boolean;
  exact?: boolean;
}

/** Get navigation items for a platform based on its capabilities */
export function getNavItems(platformId: PlatformId, isAdmin?: boolean, enabledFeatures?: string[]): NavItem[] {
  const p = `/${platformId}`;
  const caps = PLATFORMS[platformId];
  const items: NavItem[] = [
    { href: p, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `${p}/apps`, label: "Apps", icon: AppWindow },
    { href: `${p}/competitors`, label: "Competitors", icon: Star },
  ];
  if (caps.hasKeywordSearch) {
    items.push({ href: `${p}/keywords`, label: "Keywords", icon: Search });
  }
  items.push({
    href: `${p}/categories`,
    label: platformId === "wordpress" ? "Tags" : "Categories",
    icon: platformId === "wordpress" ? Tag : FolderTree,
  });
  if (caps.hasFeaturedSections) {
    items.push({ href: `${p}/featured`, label: "Featured", icon: Sparkles });
  }
  if (caps.hasFeatureTaxonomy) {
    items.push({ href: `${p}/features`, label: "Features", icon: Puzzle });
  }
  // Research is gated behind the market-research feature flag
  if (enabledFeatures?.includes("market-research")) {
    items.push({ href: `${p}/research`, label: "Research", icon: FlaskConical, badge: "Beta" });
  }
  items.push({ href: `${p}/developers`, label: "Developers", icon: Code });
  return items;
}

/** Utility items always visible at the bottom of the sidebar (Support, Organization, Settings) */
export const utilityNavItems: NavItem[] = [
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/organization", label: "Organization", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Global (cross-platform) navigation items for /overview, /apps, /keywords, etc. */
export const globalNavItems: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/apps", label: "All Apps", icon: AppWindow },
  { href: "/keywords", label: "All Keywords", icon: Search },
  { href: "/competitors", label: "All Competitors", icon: Star },
  { href: "/developers", label: "Developers", icon: Code },
  { href: "/notifications", label: "Notifications", icon: Bell },
  ...utilityNavItems,
];

/** Check if pathname is a global (non-platform) page like /overview, /apps, /keywords, etc. */
export function isOnGlobalPage(pathname: string): boolean {
  return globalNavItems.some(
    (item) =>
      item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")
  );
}

export const systemAdminItems: NavItem[] = [
  { href: "/system-admin", label: "Overview", icon: Shield },
  { href: "/system-admin/accounts", label: "Accounts", icon: Users },
  { href: "/system-admin/users", label: "Users", icon: User },
  { href: "/system-admin/apps", label: "Apps", icon: AppWindow },
  { href: "/system-admin/keywords", label: "Keywords", icon: KeyRound },
  { href: "/system-admin/categories", label: "Categories", icon: FolderTree },
  { href: "/system-admin/features", label: "Features", icon: Puzzle },
  { href: "/system-admin/researches", label: "Research", icon: FlaskConical },
  { href: "/system-admin/feature-flags", label: "Feature Flags", icon: ToggleLeft },
  { href: "/system-admin/platform-access", label: "Platform Access", icon: Globe },
  { href: "/system-admin/packages", label: "Packages", icon: Package },
  { href: "/system-admin/scraper-health", label: "Health", icon: HeartPulse },
  { href: "/system-admin/scraper", label: "Scraper", icon: Bot },
  { href: "/system-admin/scraper-management", label: "Scraper Config", icon: Sliders },
  { href: "/system-admin/ai-logs", label: "AI Logs", icon: BrainCircuit },
  { href: "/system-admin/developers", label: "Developers", icon: Code },
  { href: "/system-admin/support-tickets", label: "Support", icon: LifeBuoy },
  { href: "/system-admin/platform-requests", label: "Requests", icon: MessageSquarePlus },
  { href: "/system-admin/notifications", label: "Notifications", icon: Bell },
  { href: "/system-admin/notification-templates", label: "Notification Templates", icon: BellDot },
  { href: "/system-admin/emails", label: "Emails", icon: Mail },
  { href: "/system-admin/email-templates", label: "Email Templates", icon: FileText },
  { href: "/system-admin/queues", label: "Queues", icon: Activity },
  { href: "/system-admin/app-updates", label: "App Updates", icon: GitCompareArrows },
  { href: "/system-admin/delisted-apps", label: "Delisted Apps", icon: Ghost },
  { href: "/system-admin/audit-logs", label: "Audit Logs", icon: ShieldCheck },
  { href: "/system-admin/dlq", label: "Dead Letter Queue", icon: AlertTriangle },
  { href: "/system-admin/design-system", label: "Design", icon: Palette },
];
