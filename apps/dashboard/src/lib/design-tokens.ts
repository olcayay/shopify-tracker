/**
 * Design system spacing and layout tokens.
 *
 * Usage standards:
 *
 * PAGE-LEVEL SPACING:
 *   space-y-6  — between major page sections (cards, tables, form groups)
 *   space-y-4  — between content blocks within a section
 *   space-y-2  — between tight content items (form fields, list items)
 *
 * CARD INTERNAL PADDING:
 *   CardHeader: use defaults (py-4 px-6)
 *   CardContent: use defaults, avoid extra padding
 *   Within CardContent: space-y-3 for content blocks
 *
 * GRID/FLEX GAPS:
 *   gap-6  — major grid layout (card grids, stat card grids)
 *   gap-4  — medium grids (filter rows, action groups)
 *   gap-2  — tight inline elements (badges, buttons, icon+text)
 *   gap-1.5 — very tight (tag groups, platform dots)
 *
 * RESPONSIVE PATTERNS:
 *   grid-cols-1 sm:grid-cols-2 lg:grid-cols-3  — standard card grid
 *   grid-cols-2 sm:grid-cols-3 lg:grid-cols-4  — compact card grid
 *   max-w-md  — search input width
 *   max-w-4xl — content sections
 */

/** Standard Tailwind class presets for common layouts */
export const SPACING = {
  /** Between major page sections */
  pageSections: "space-y-6",
  /** Between content blocks within a section */
  sectionContent: "space-y-4",
  /** Between tight items (form fields, list items) */
  tightContent: "space-y-2",
  /** Within CardContent */
  cardContent: "space-y-3",
  /** Major grid gap */
  gridMajor: "gap-6",
  /** Medium grid gap */
  gridMedium: "gap-4",
  /** Tight inline gap */
  gridTight: "gap-2",
} as const;

/**
 * ICON SIZE SCALE:
 *
 *   | Context                              | Size | Class          |
 *   |--------------------------------------|------|----------------|
 *   | Inside badges, xs buttons            | 12px | h-3 w-3        |
 *   | Dense UI (breadcrumbs, chips)        | 14px | h-3.5 w-3.5    |
 *   | Inline (buttons, table cells, text)  | 16px | h-4 w-4        |
 *   | Section headers, navigation          | 20px | h-5 w-5        |
 *   | Page headers, feature icons          | 24px | h-6 w-6        |
 *   | Stat cards, hero elements            | 32px | h-8 w-8        |
 *
 * BUTTON SIZE RULES:
 *   - Table actions, filter toggles, inline: size="sm"
 *   - Primary page CTAs, forms: default size
 *   - Icon-only buttons in header: h-8 w-8 wrapper
 *   - Dense pill-style: size="sm" with h-7 px-2 text-xs
 *
 * RESPONSIVE GRID PRESETS:
 *   Cards:   grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
 *   Compact: grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
 *   Stats:   grid-cols-2 md:grid-cols-3 lg:grid-cols-6
 *   Mini:    grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
 */
export const GRID = {
  cards: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
  compact: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3",
  stats: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4",
  mini: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3",
} as const;

export const ICON = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
  "2xl": "h-8 w-8",
} as const;
