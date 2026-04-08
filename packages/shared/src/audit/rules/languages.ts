/**
 * Audit rules — Languages section.
 * Stub: will be fully implemented in PLA-883.
 */

import type { AuditSection } from "../types.js";

export function computeLanguagesSection(_snapshot: any, _app: any, _platform: string): AuditSection {
  return {
    id: "languages",
    name: "Languages",
    icon: "Globe",
    score: 0,
    checks: [],
  };
}
