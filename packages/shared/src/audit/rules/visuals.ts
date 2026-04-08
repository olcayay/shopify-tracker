/**
 * Audit rules — Visual Assets section.
 * Stub: will be fully implemented in PLA-880.
 */

import type { AuditSection } from "../types.js";

export function computeVisualsSection(_snapshot: any, _app: any, _platform: string): AuditSection {
  return {
    id: "visuals",
    name: "Visual Assets",
    icon: "Image",
    score: 0,
    checks: [],
  };
}
