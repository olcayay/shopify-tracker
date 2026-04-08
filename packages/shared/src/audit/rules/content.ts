/**
 * Audit rules — Description & Content section.
 * Stub: will be fully implemented in PLA-879.
 */

import type { AuditSection } from "../types.js";

export function computeContentSection(_snapshot: any, _app: any, _platform: string): AuditSection {
  return {
    id: "content",
    name: "Description & Content",
    icon: "FileText",
    score: 0,
    checks: [],
  };
}
