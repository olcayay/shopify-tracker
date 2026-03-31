"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight, Palette, Check, X, AlertTriangle, Info, Sun, Moon, Monitor, Search, Users, Settings, Inbox,
  // Icon showcase imports
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronUp, ExternalLink as ExternalLinkIcon, Globe, Home, Menu,
  CheckCheck, CheckCircle, CheckCircle2, Copy, Download, Eraser, Pencil, Play, Plus, RefreshCw, RotateCcw, Save, Send, Trash2,
  Bug, Loader2, ShieldCheck, Shield, Eye, EyeOff,
  Activity, BarChart3, Calendar, Clock, DollarSign, FileCode, FileText, Folder, History, LayoutList, Star, Tag, Target, TrendingDown, TrendingUp,
  Bell, BellDot, Mail, MailX, Megaphone, MessageSquare, MessageSquarePlus,
  Bookmark, Columns3, GitCompare, Group, Lightbulb, PanelLeftClose, PanelLeftOpen,
  AppWindow, Award, Blocks, Brain, BrainCircuit, Building2, Code, Flame, FlaskConical, Lock, Package, Pin, PinOff, Rocket, Trophy,
  UserCheck, UserPlus, User, Settings2,
  Minus, Sparkles, Zap,
  KeyRound, HeartPulse, Bot, Puzzle, FolderTree, MousePointerClick, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TAG_COLORS } from "@/lib/tag-colors";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { FilterButtonGroup } from "@/components/ui/filter-button-group";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ViewModeToggle, useViewMode } from "@/components/view-mode-toggle";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { PLATFORM_IDS, type PlatformId } from "@appranks/shared";

/* ---------- semantic color tokens ---------- */
const SEMANTIC_COLORS = [
  { name: "background", var: "--background", tw: "bg-background", fgTw: "text-foreground" },
  { name: "foreground", var: "--foreground", tw: "bg-foreground", fgTw: "text-background" },
  { name: "card", var: "--card", tw: "bg-card", fgTw: "text-card-foreground" },
  { name: "popover", var: "--popover", tw: "bg-popover", fgTw: "text-popover-foreground" },
  { name: "primary", var: "--primary", tw: "bg-primary", fgTw: "text-primary-foreground" },
  { name: "secondary", var: "--secondary", tw: "bg-secondary", fgTw: "text-secondary-foreground" },
  { name: "muted", var: "--muted", tw: "bg-muted", fgTw: "text-muted-foreground" },
  { name: "accent", var: "--accent", tw: "bg-accent", fgTw: "text-accent-foreground" },
  { name: "destructive", var: "--destructive", tw: "bg-destructive", fgTw: "text-white" },
  { name: "border", var: "--border", tw: "bg-border", fgTw: "text-foreground" },
  { name: "input", var: "--input", tw: "bg-input", fgTw: "text-foreground" },
  { name: "ring", var: "--ring", tw: "bg-ring", fgTw: "text-background" },
];

const CHART_COLORS = [
  { name: "chart-1", var: "--chart-1", tw: "bg-chart-1" },
  { name: "chart-2", var: "--chart-2", tw: "bg-chart-2" },
  { name: "chart-3", var: "--chart-3", tw: "bg-chart-3" },
  { name: "chart-4", var: "--chart-4", tw: "bg-chart-4" },
  { name: "chart-5", var: "--chart-5", tw: "bg-chart-5" },
];

const SIDEBAR_COLORS = [
  { name: "sidebar", var: "--sidebar", tw: "bg-sidebar" },
  { name: "sidebar-foreground", var: "--sidebar-foreground", tw: "bg-sidebar-foreground" },
  { name: "sidebar-primary", var: "--sidebar-primary", tw: "bg-sidebar-primary" },
  { name: "sidebar-accent", var: "--sidebar-accent", tw: "bg-sidebar-accent" },
  { name: "sidebar-border", var: "--sidebar-border", tw: "bg-sidebar-border" },
];

/* ---------- typography scale ---------- */
const TYPE_SCALE = [
  { label: "text-xs", class: "text-xs", sample: "Extra small text — captions, labels" },
  { label: "text-sm", class: "text-sm", sample: "Small text — secondary content, descriptions" },
  { label: "text-base", class: "text-base", sample: "Base text — body copy, default size" },
  { label: "text-lg", class: "text-lg", sample: "Large text — subheadings, emphasis" },
  { label: "text-xl", class: "text-xl", sample: "Extra-large text — section headings" },
  { label: "text-2xl", class: "text-2xl", sample: "2XL text — page headings" },
  { label: "text-3xl", class: "text-3xl", sample: "3XL text — hero headings" },
];

const FONT_WEIGHTS = [
  { label: "font-normal", class: "font-normal" },
  { label: "font-medium", class: "font-medium" },
  { label: "font-semibold", class: "font-semibold" },
  { label: "font-bold", class: "font-bold" },
];

/* ---------- radius tokens ---------- */
const RADIUS_TOKENS = [
  { name: "radius-sm", tw: "rounded-sm" },
  { name: "radius-md", tw: "rounded-md" },
  { name: "radius-lg", tw: "rounded-lg" },
  { name: "radius-xl", tw: "rounded-xl" },
  { name: "radius-2xl", tw: "rounded-2xl" },
  { name: "radius-full", tw: "rounded-full" },
];

/* ---------- shadow scale ---------- */
const SHADOW_SCALE = [
  { name: "shadow-xs", tw: "shadow-xs" },
  { name: "shadow-sm", tw: "shadow-sm" },
  { name: "shadow-md", tw: "shadow-md" },
  { name: "shadow-lg", tw: "shadow-lg" },
  { name: "shadow-xl", tw: "shadow-xl" },
  { name: "shadow-2xl", tw: "shadow-2xl" },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ColorSwatch({ name, twClass, fgClass, varName }: { name: string; twClass: string; fgClass?: string; varName?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`h-14 w-14 rounded-lg border border-border ${twClass}`} title={varName} />
      <span className="text-xs text-muted-foreground font-mono">{name}</span>
    </div>
  );
}

/* ---------- icon showcase data ---------- */
interface IconEntry {
  name: string;
  icon: LucideIcon;
  usage: number;
}

const ICON_CATEGORIES: { category: string; icons: IconEntry[] }[] = [
  {
    category: "Navigation",
    icons: [
      { name: "ArrowDown", icon: ArrowDown, usage: 3 },
      { name: "ArrowLeft", icon: ArrowLeft, usage: 5 },
      { name: "ArrowRight", icon: ArrowRight, usage: 4 },
      { name: "ArrowUp", icon: ArrowUp, usage: 3 },
      { name: "ArrowUpDown", icon: ArrowUpDown, usage: 15 },
      { name: "ChevronDown", icon: ChevronDown, usage: 14 },
      { name: "ChevronLeft", icon: ChevronLeft, usage: 8 },
      { name: "ChevronRight", icon: ChevronRight, usage: 15 },
      { name: "ChevronUp", icon: ChevronUp, usage: 3 },
      { name: "ExternalLink", icon: ExternalLinkIcon, usage: 19 },
      { name: "Globe", icon: Globe, usage: 8 },
      { name: "Home", icon: Home, usage: 2 },
      { name: "Menu", icon: Menu, usage: 2 },
    ],
  },
  {
    category: "Actions",
    icons: [
      { name: "Check", icon: Check, usage: 30 },
      { name: "CheckCheck", icon: CheckCheck, usage: 2 },
      { name: "CheckCircle", icon: CheckCircle, usage: 3 },
      { name: "CheckCircle2", icon: CheckCircle2, usage: 2 },
      { name: "Copy", icon: Copy, usage: 8 },
      { name: "Download", icon: Download, usage: 3 },
      { name: "Eraser", icon: Eraser, usage: 2 },
      { name: "Pencil", icon: Pencil, usage: 5 },
      { name: "Play", icon: Play, usage: 3 },
      { name: "Plus", icon: Plus, usage: 16 },
      { name: "RefreshCw", icon: RefreshCw, usage: 10 },
      { name: "RotateCcw", icon: RotateCcw, usage: 3 },
      { name: "Save", icon: Save, usage: 4 },
      { name: "Search", icon: Search, usage: 28 },
      { name: "Send", icon: Send, usage: 5 },
      { name: "Trash2", icon: Trash2, usage: 6 },
    ],
  },
  {
    category: "Status & Feedback",
    icons: [
      { name: "AlertTriangle", icon: AlertTriangle, usage: 7 },
      { name: "Bug", icon: Bug, usage: 2 },
      { name: "Info", icon: Info, usage: 5 },
      { name: "Loader2", icon: Loader2, usage: 15 },
      { name: "Shield", icon: Shield, usage: 3 },
      { name: "ShieldCheck", icon: ShieldCheck, usage: 2 },
      { name: "X", icon: X, usage: 22 },
      { name: "Eye", icon: Eye, usage: 6 },
      { name: "EyeOff", icon: EyeOff, usage: 3 },
    ],
  },
  {
    category: "Content & Data",
    icons: [
      { name: "Activity", icon: Activity, usage: 3 },
      { name: "BarChart3", icon: BarChart3, usage: 4 },
      { name: "Calendar", icon: Calendar, usage: 5 },
      { name: "Clock", icon: Clock, usage: 7 },
      { name: "DollarSign", icon: DollarSign, usage: 4 },
      { name: "FileCode", icon: FileCode, usage: 2 },
      { name: "FileText", icon: FileText, usage: 3 },
      { name: "Folder", icon: Folder, usage: 2 },
      { name: "FolderTree", icon: FolderTree, usage: 2 },
      { name: "History", icon: History, usage: 4 },
      { name: "LayoutList", icon: LayoutList, usage: 3 },
      { name: "Star", icon: Star, usage: 23 },
      { name: "Tag", icon: Tag, usage: 5 },
      { name: "Target", icon: Target, usage: 4 },
      { name: "TrendingDown", icon: TrendingDown, usage: 5 },
      { name: "TrendingUp", icon: TrendingUp, usage: 8 },
    ],
  },
  {
    category: "Communication",
    icons: [
      { name: "Bell", icon: Bell, usage: 8 },
      { name: "BellDot", icon: BellDot, usage: 2 },
      { name: "Mail", icon: Mail, usage: 4 },
      { name: "MailX", icon: MailX, usage: 2 },
      { name: "Megaphone", icon: Megaphone, usage: 2 },
      { name: "MessageSquare", icon: MessageSquare, usage: 3 },
      { name: "MessageSquarePlus", icon: MessageSquarePlus, usage: 2 },
    ],
  },
  {
    category: "UI Elements",
    icons: [
      { name: "Bookmark", icon: Bookmark, usage: 3 },
      { name: "Columns3", icon: Columns3, usage: 2 },
      { name: "GitCompare", icon: GitCompare, usage: 3 },
      { name: "Group", icon: Group, usage: 2 },
      { name: "Inbox", icon: Inbox, usage: 3 },
      { name: "Lightbulb", icon: Lightbulb, usage: 3 },
      { name: "Monitor", icon: Monitor, usage: 2 },
      { name: "Moon", icon: Moon, usage: 2 },
      { name: "PanelLeftClose", icon: PanelLeftClose, usage: 2 },
      { name: "PanelLeftOpen", icon: PanelLeftOpen, usage: 2 },
      { name: "Sun", icon: Sun, usage: 2 },
      { name: "Palette", icon: Palette, usage: 2 },
    ],
  },
  {
    category: "Domain-Specific",
    icons: [
      { name: "AppWindow", icon: AppWindow, usage: 10 },
      { name: "Award", icon: Award, usage: 4 },
      { name: "Blocks", icon: Blocks, usage: 2 },
      { name: "Brain", icon: Brain, usage: 2 },
      { name: "BrainCircuit", icon: BrainCircuit, usage: 3 },
      { name: "Building2", icon: Building2, usage: 3 },
      { name: "Code", icon: Code, usage: 5 },
      { name: "Flame", icon: Flame, usage: 3 },
      { name: "FlaskConical", icon: FlaskConical, usage: 3 },
      { name: "Lock", icon: Lock, usage: 3 },
      { name: "Package", icon: Package, usage: 3 },
      { name: "Pin", icon: Pin, usage: 2 },
      { name: "PinOff", icon: PinOff, usage: 2 },
      { name: "Rocket", icon: Rocket, usage: 3 },
      { name: "Trophy", icon: Trophy, usage: 4 },
    ],
  },
  {
    category: "People & Settings",
    icons: [
      { name: "User", icon: User, usage: 6 },
      { name: "UserCheck", icon: UserCheck, usage: 2 },
      { name: "UserPlus", icon: UserPlus, usage: 2 },
      { name: "Users", icon: Users, usage: 5 },
      { name: "Settings", icon: Settings, usage: 4 },
      { name: "Settings2", icon: Settings2, usage: 2 },
      { name: "KeyRound", icon: KeyRound, usage: 2 },
      { name: "HeartPulse", icon: HeartPulse, usage: 2 },
      { name: "Bot", icon: Bot, usage: 3 },
      { name: "Puzzle", icon: Puzzle, usage: 2 },
      { name: "MousePointerClick", icon: MousePointerClick, usage: 2 },
    ],
  },
  {
    category: "Decorative",
    icons: [
      { name: "Minus", icon: Minus, usage: 4 },
      { name: "Sparkles", icon: Sparkles, usage: 5 },
      { name: "Zap", icon: Zap, usage: 3 },
    ],
  },
];

const ALL_ICONS = ICON_CATEGORIES.flatMap((cat) => cat.icons);

function IconShowcase() {
  const [iconSearch, setIconSearch] = useState("");
  const [iconSize, setIconSize] = useState<"h-4 w-4" | "h-5 w-5" | "h-6 w-6" | "h-8 w-8">("h-5 w-5");
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null);

  const filtered = iconSearch.trim()
    ? ALL_ICONS.filter((i) => i.name.toLowerCase().includes(iconSearch.toLowerCase()))
    : null;

  function copyImport(name: string) {
    navigator.clipboard.writeText(`import { ${name} } from "lucide-react";`);
    setCopiedIcon(name);
    setTimeout(() => setCopiedIcon(null), 1500);
  }

  const sizeOptions = ["h-4 w-4", "h-5 w-5", "h-6 w-6", "h-8 w-8"] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search icons..."
            value={iconSearch}
            onChange={(e) => setIconSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {sizeOptions.map((s) => (
            <button
              key={s}
              onClick={() => setIconSize(s)}
              className={`px-2 py-1 text-xs rounded ${iconSize === s ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {s.split(" ")[0]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{ALL_ICONS.length} icons</span>
      </div>

      {filtered ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {filtered.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.name}
                onClick={() => copyImport(entry.name)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg border hover:bg-accent transition-colors group relative"
                title={`${entry.name} — used in ${entry.usage} files. Click to copy import.`}
              >
                <Icon className={iconSize} />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{entry.name}</span>
                {copiedIcon === entry.name && (
                  <span className="absolute inset-0 flex items-center justify-center bg-primary/90 text-primary-foreground text-xs rounded-lg">
                    Copied!
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-8">No icons match &quot;{iconSearch}&quot;</p>
          )}
        </div>
      ) : (
        ICON_CATEGORIES.map((cat) => (
          <div key={cat.category}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">
              {cat.category} <span className="font-normal">({cat.icons.length})</span>
            </h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mb-4">
              {cat.icons.map((entry) => {
                const Icon = entry.icon;
                return (
                  <button
                    key={entry.name}
                    onClick={() => copyImport(entry.name)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg border hover:bg-accent transition-colors relative"
                    title={`${entry.name} — used in ${entry.usage} files. Click to copy import.`}
                  >
                    <Icon className={iconSize} />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{entry.name}</span>
                    <Badge variant="secondary" className="absolute -top-1 -right-1 text-[8px] px-1 py-0 h-3.5">{entry.usage}</Badge>
                    {copiedIcon === entry.name && (
                      <span className="absolute inset-0 flex items-center justify-center bg-primary/90 text-primary-foreground text-xs rounded-lg">
                        Copied!
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ViewModeToggleDemo() {
  const { viewMode, changeViewMode } = useViewMode("ds-demo");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <ViewModeToggle viewMode={viewMode} onChangeViewMode={changeViewMode} />
        <span className="text-sm text-muted-foreground">
          Current: <code className="bg-muted px-1 rounded text-xs">{viewMode}</code>
        </span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p><code className="bg-muted px-1 rounded">useViewMode(storageKey, onChange?)</code> — persists selection in localStorage</p>
        <p>Used in: Competitors, Keywords, Apps, Developers pages</p>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/system-admin" className="hover:text-foreground">System Admin</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Design System</span>
      </div>

      {/* header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Palette className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Design System</h1>
          <p className="text-sm text-muted-foreground">Colors, typography, spacing, and component reference</p>
        </div>
      </div>

      {/* ========== SEMANTIC COLORS ========== */}
      <Section title="Semantic Color Tokens" description="Core design tokens defined as CSS variables in globals.css. These automatically adapt to light/dark mode.">
        <div className="flex flex-wrap gap-4">
          {SEMANTIC_COLORS.map((c) => (
            <ColorSwatch key={c.name} name={c.name} twClass={c.tw} fgClass={c.fgTw} varName={c.var} />
          ))}
        </div>
      </Section>

      {/* ========== CHART COLORS ========== */}
      <Section title="Chart Colors" description="Data visualization palette (--chart-1 through --chart-5)">
        <div className="flex flex-wrap gap-4">
          {CHART_COLORS.map((c) => (
            <ColorSwatch key={c.name} name={c.name} twClass={c.tw} varName={c.var} />
          ))}
        </div>
      </Section>

      {/* ========== SIDEBAR COLORS ========== */}
      <Section title="Sidebar Colors" description="Sidebar-specific tokens">
        <div className="flex flex-wrap gap-4">
          {SIDEBAR_COLORS.map((c) => (
            <ColorSwatch key={c.name} name={c.name} twClass={c.tw} varName={c.var} />
          ))}
        </div>
      </Section>

      {/* ========== PLATFORM COLORS ========== */}
      <Section title="Platform Brand Colors" description="11 platform brand colors defined in platform-display.ts. Used for borders, gradients, and accents.">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {PLATFORM_IDS.map((id: PlatformId) => {
            const p = PLATFORM_DISPLAY[id];
            return (
              <div key={id} className="flex flex-col items-center gap-1.5">
                <div
                  className="h-14 w-14 rounded-lg border border-border"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-xs text-muted-foreground font-medium">{p.label}</span>
                <span className="text-xs text-muted-foreground/60 font-mono">{p.color}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">
            <strong>Gradient pattern:</strong> <code className="text-xs bg-muted px-1 rounded">from-[COLOR]/10 to-transparent</code> — used for platform card headers
          </p>
        </div>
      </Section>

      {/* ========== TAG COLORS ========== */}
      <Section title="Tag Colors" description="10 tag color variants from tag-colors.ts. Used for labels, badges, and category tags.">
        <div className="flex flex-wrap gap-3">
          {TAG_COLORS.map((tag) => (
            <div
              key={tag.key}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${tag.bg} ${tag.text} ${tag.border}`}
            >
              <div className={`h-2 w-2 rounded-full ${tag.dot}`} />
              <span className="text-xs font-medium">{tag.key}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ========== TYPOGRAPHY ========== */}
      <Section title="Typography" description="Font: Geist Sans (--font-geist-sans) / Geist Mono (--font-geist-mono)">
        <div className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Size Scale</h4>
            {TYPE_SCALE.map((t) => (
              <div key={t.label} className="flex items-baseline gap-4 border-b border-border/50 pb-2">
                <code className="text-xs text-muted-foreground font-mono w-24 shrink-0">{t.label}</code>
                <p className={`${t.class} text-foreground`}>{t.sample}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Font Weights</h4>
            <div className="flex flex-wrap gap-6">
              {FONT_WEIGHTS.map((w) => (
                <div key={w.label} className="flex flex-col items-center gap-1">
                  <span className={`text-lg ${w.class}`}>Aa</span>
                  <code className="text-xs text-muted-foreground font-mono">{w.label}</code>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Monospace</h4>
            <p className="font-mono text-sm">The quick brown fox jumps over the lazy dog — <code className="bg-muted px-1 rounded text-xs">font-mono</code></p>
          </div>
        </div>
      </Section>

      {/* ========== BORDER RADIUS ========== */}
      <Section title="Border Radius" description="Base radius: 0.625rem (10px), with calculated variants">
        <div className="flex flex-wrap gap-4">
          {RADIUS_TOKENS.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-1.5">
              <div className={`h-14 w-14 bg-primary/20 border-2 border-primary ${r.tw}`} />
              <code className="text-xs text-muted-foreground font-mono">{r.name}</code>
            </div>
          ))}
        </div>
      </Section>

      {/* ========== SHADOWS ========== */}
      <Section title="Shadows" description="Elevation scale for cards, modals, and overlays">
        <div className="flex flex-wrap gap-6">
          {SHADOW_SCALE.map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-1.5">
              <div className={`h-16 w-16 rounded-lg bg-card border border-border ${s.tw}`} />
              <code className="text-xs text-muted-foreground font-mono">{s.name}</code>
            </div>
          ))}
        </div>
      </Section>

      {/* ========== BUTTONS ========== */}
      <Section title="Buttons" description="Button variants and sizes from components/ui/button.tsx">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Variants</h4>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Sizes</h4>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra Small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">States</h4>
            <div className="flex flex-wrap gap-3">
              <Button>Normal</Button>
              <Button disabled>Disabled</Button>
              <Button variant="outline">
                <Check className="h-4 w-4" /> With Icon
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ========== BADGES ========== */}
      <Section title="Badges" description="Badge variants from components/ui/badge.tsx">
        <div className="flex flex-wrap gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="ghost">Ghost</Badge>
        </div>
      </Section>

      {/* ========== FORM ELEMENTS ========== */}
      <Section title="Form Elements" description="Input and textarea components">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-2">
            <label className="text-sm font-medium">Text Input</label>
            <Input placeholder="Enter text..." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Disabled Input</label>
            <Input placeholder="Disabled..." disabled />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Textarea</label>
            <Textarea placeholder="Enter longer text..." rows={3} />
          </div>
        </div>
      </Section>

      {/* ========== STATUS PATTERNS ========== */}
      <Section title="Status Patterns" description="Common patterns for success, warning, error, and info states used across the dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400">Success state</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-700 dark:text-amber-400">Warning state</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
            <X className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Error / Destructive state</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-blue-500/50 bg-blue-500/10 px-3 py-2">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-400">Info state</span>
          </div>
        </div>
      </Section>

      {/* ========== SPACING ========== */}
      <Section title="Spacing Scale" description="Tailwind default spacing used across the app">
        <div className="flex flex-wrap items-end gap-2">
          {[1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className="bg-primary/30 rounded" style={{ width: `${s * 4}px`, height: `${s * 4}px` }} />
              <code className="text-xs text-muted-foreground font-mono">{s}</code>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Base unit: 4px. Value &times; 4 = pixels. E.g., <code className="bg-muted px-1 rounded">p-4</code> = 16px, <code className="bg-muted px-1 rounded">gap-6</code> = 24px
        </p>
      </Section>

      {/* ========== CSS VARIABLES REFERENCE ========== */}
      <Section title="CSS Variables Reference" description="All design tokens defined in globals.css">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Variable</th>
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Tailwind Class</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Usage</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--background</td>
                <td className="py-2 pr-4">bg-background</td>
                <td className="py-2 font-sans">Page backgrounds</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--foreground</td>
                <td className="py-2 pr-4">text-foreground</td>
                <td className="py-2 font-sans">Primary text</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--card</td>
                <td className="py-2 pr-4">bg-card</td>
                <td className="py-2 font-sans">Card backgrounds</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--primary</td>
                <td className="py-2 pr-4">bg-primary, text-primary</td>
                <td className="py-2 font-sans">Primary actions, links</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--secondary</td>
                <td className="py-2 pr-4">bg-secondary</td>
                <td className="py-2 font-sans">Secondary actions</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--muted</td>
                <td className="py-2 pr-4">bg-muted, text-muted-foreground</td>
                <td className="py-2 font-sans">Neutral backgrounds, secondary text</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--accent</td>
                <td className="py-2 pr-4">bg-accent</td>
                <td className="py-2 font-sans">Hover states, interactive elements</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--destructive</td>
                <td className="py-2 pr-4">bg-destructive, text-destructive</td>
                <td className="py-2 font-sans">Error/delete states</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--border</td>
                <td className="py-2 pr-4">border-border</td>
                <td className="py-2 font-sans">Default borders</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 pr-4">--input</td>
                <td className="py-2 pr-4">border-input</td>
                <td className="py-2 font-sans">Form input borders</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">--ring</td>
                <td className="py-2 pr-4">ring-ring</td>
                <td className="py-2 font-sans">Focus rings</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ========== ICONS ========== */}
      <Section title="Icons" description={`${ALL_ICONS.length} lucide-react icons used across the project. Click any icon to copy its import statement.`}>
        <IconShowcase />
      </Section>

      {/* Shared Components Showcase */}
      <Section title="Shared Components">
        <div className="space-y-8">
          {/* PageHeader */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">PageHeader</h3>
            <div className="border rounded-lg p-4 space-y-6">
              <PageHeader title="Simple Title" />
              <PageHeader title="With Description" description="This is a page description" />
              <PageHeader
                title="With Icon & Actions"
                description="Full featured page header"
                icon={Settings}
                breadcrumbs={[
                  { label: "System Admin", href: "/system-admin" },
                  { label: "Design System" },
                ]}
                actions={<Button size="sm">Action</Button>}
              />
            </div>
          </div>

          {/* SearchInput */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">SearchInput</h3>
            <div className="border rounded-lg p-4 max-w-md">
              <SearchInput placeholder="Search components..." />
            </div>
          </div>

          {/* SortableHeader */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">SortableHeader</h3>
            <div className="border rounded-lg p-4 flex gap-6">
              <SortableHeader label="Name" sortKey="name" currentSort="name" currentDir="asc" onSort={() => {}} />
              <SortableHeader label="Date" sortKey="date" currentSort="name" currentDir="asc" onSort={() => {}} />
              <SortableHeader label="Rating" sortKey="rating" currentSort="rating" currentDir="desc" onSort={() => {}} />
            </div>
          </div>

          {/* FilterButtonGroup */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">FilterButtonGroup</h3>
            <div className="border rounded-lg p-4">
              <FilterButtonGroup
                options={[
                  { value: "all", label: "All", count: 42 },
                  { value: "active", label: "Active", count: 30 },
                  { value: "inactive", label: "Inactive", count: 12 },
                ]}
                value="all"
                onChange={() => {}}
              />
            </div>
          </div>

          {/* StatCard */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">StatCard</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={1234} icon={Users} />
              <StatCard label="Growth" value="23%" icon={Check} change={{ value: 12 }} />
              <StatCard label="Churn" value={5} change={{ value: -3 }} />
              <StatCard label="Revenue" value="$42K" variant="compact" />
            </div>
          </div>

          {/* StatusIndicator */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">StatusIndicator</h3>
            <div className="border rounded-lg p-4 flex flex-wrap gap-4">
              <StatusIndicator variant="success" label="Active" />
              <StatusIndicator variant="warning" label="Warning" />
              <StatusIndicator variant="error" label="Failed" />
              <StatusIndicator variant="info" label="Info" />
              <StatusIndicator variant="neutral" label="Neutral" />
              <StatusIndicator variant="active" label="Running" pulse />
              <StatusIndicator variant="inactive" label="Disabled" size="sm" />
            </div>
          </div>

          {/* EmptyState */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">EmptyState</h3>
            <div className="border rounded-lg">
              <EmptyState
                icon={Inbox}
                title="No results found"
                description="Try adjusting your search or filters"
                action={{ label: "Clear Filters", onClick: () => {} }}
              />
            </div>
          </div>

          {/* ViewModeToggle */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">ViewModeToggle</h3>
            <div className="border rounded-lg p-4">
              <ViewModeToggleDemo />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
