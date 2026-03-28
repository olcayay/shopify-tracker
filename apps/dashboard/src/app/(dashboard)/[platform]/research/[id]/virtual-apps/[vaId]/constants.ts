import {
  Sparkles,
  LayoutGrid,
  List,
  Puzzle,
  FileText,
  DollarSign,
  Globe,
  Search as SearchIcon,
  FolderOpen,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────

export const ICON_SET = ["🚀", "💡", "⚡", "🎯", "🔮", "🌟", "💎", "🎨", "🔥", "🌊", "🦋", "🍀", "🎲", "🪐", "🎸", "🦄"];
export const COLOR_SET = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4", "#6366F1", "#D946EF"];

export const SECTIONS = [
  { id: "sec-basic", key: "basic", label: "Basic Info", icon: Sparkles },
  { id: "sec-categories", key: "categories", label: "Categories", icon: FolderOpen },
  { id: "sec-catfeatures", key: "catfeatures", label: "Category Features", icon: LayoutGrid },
  { id: "sec-features", key: "features", label: "Features", icon: List },
  { id: "sec-integrations", key: "integrations", label: "Integrations", icon: Puzzle },
  { id: "sec-text", key: "text", label: "Description", icon: FileText },
  { id: "sec-pricing", key: "pricing", label: "Pricing", icon: DollarSign },
  { id: "sec-languages", key: "languages", label: "Languages", icon: Globe },
  { id: "sec-seo", key: "seo", label: "SEO", icon: SearchIcon },
] as const;
