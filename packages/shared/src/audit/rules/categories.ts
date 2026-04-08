/**
 * Audit rules — Categories & Discoverability section.
 * Stub: will be fully implemented in PLA-881.
 */

import type { AuditSection } from "../types.js";

export function computeCategoriesSection(_snapshot: any, _app: any, _platform: string): AuditSection {
  return {
    id: "categories",
    name: "Categories & Discoverability",
    icon: "Tags",
    score: 0,
    checks: [],
  };
}
