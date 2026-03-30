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
