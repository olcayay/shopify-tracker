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
}

/** Get navigation items for a platform based on its capabilities */
export function getNavItems(platformId: PlatformId, isAdmin?: boolean): NavItem[] {
  const p = `/${platformId}`;
  const caps = PLATFORMS[platformId];
  const items: NavItem[] = [
    { href: `${p}/overview`, label: "Overview", icon: LayoutDashboard },
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
  // Research is only available on Shopify for now
  if (platformId === "shopify") {
    items.push({ href: `${p}/research`, label: "Research", icon: FlaskConical, badge: "Beta" });
  }
  if (isAdmin) {
    items.push({ href: `${p}/developers`, label: "Developers", icon: Code, adminOnly: true });
  }
  return items;
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
  { href: "/system-admin/packages", label: "Packages", icon: Package },
  { href: "/system-admin/scraper-health", label: "Health", icon: HeartPulse },
  { href: "/system-admin/scraper", label: "Scraper", icon: Bot },
  { href: "/system-admin/ai-logs", label: "AI Logs", icon: BrainCircuit },
  { href: "/system-admin/developers", label: "Developers", icon: Code },
];
