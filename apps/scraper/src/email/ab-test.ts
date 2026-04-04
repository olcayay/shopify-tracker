/**
 * A/B test infrastructure for emails (PLA-680).
 * Supports variant selection, assignment tracking, and result analysis.
 */
import { createLogger } from "@appranks/shared";

const log = createLogger("email:ab-test");

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number; // 0-100, percentage of traffic
  subject?: string; // Override subject line
  templateOverride?: string; // Override template name
  metadata?: Record<string, unknown>;
}

export interface ABTest {
  id: string;
  name: string;
  emailType: string;
  variants: ABTestVariant[];
  enabled: boolean;
  startDate?: string;
  endDate?: string;
}

export interface ABTestAssignment {
  testId: string;
  variantId: string;
  userId: string;
  assignedAt: string;
}

/** In-memory test registry (can be replaced with DB-backed store) */
const activeTests = new Map<string, ABTest>();
const assignments = new Map<string, ABTestAssignment>(); // key: `${testId}:${userId}`

/**
 * Register an A/B test.
 */
export function registerABTest(test: ABTest): void {
  // Validate weights sum to 100
  const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight !== 100) {
    throw new Error(`Variant weights must sum to 100, got ${totalWeight}`);
  }
  activeTests.set(test.id, test);
  log.info("A/B test registered", { testId: test.id, name: test.name, variants: test.variants.length });
}

/**
 * Get an active A/B test for an email type.
 */
export function getActiveTest(emailType: string): ABTest | null {
  for (const test of activeTests.values()) {
    if (!test.enabled || test.emailType !== emailType) continue;

    // Check date range
    if (test.startDate && new Date(test.startDate) > new Date()) continue;
    if (test.endDate && new Date(test.endDate) < new Date()) continue;

    return test;
  }
  return null;
}

/**
 * Select a variant for a user (deterministic — same user always gets same variant).
 * Uses simple hash-based assignment for consistency.
 */
export function selectVariant(test: ABTest, userId: string): ABTestVariant {
  // Check existing assignment
  const key = `${test.id}:${userId}`;
  const existing = assignments.get(key);
  if (existing) {
    const variant = test.variants.find((v) => v.id === existing.variantId);
    if (variant) return variant;
  }

  // Deterministic hash-based selection
  const hash = simpleHash(`${test.id}:${userId}`);
  const bucket = hash % 100;

  let cumulative = 0;
  for (const variant of test.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      // Record assignment
      assignments.set(key, {
        testId: test.id,
        variantId: variant.id,
        userId,
        assignedAt: new Date().toISOString(),
      });
      return variant;
    }
  }

  // Fallback to last variant
  const fallback = test.variants[test.variants.length - 1];
  assignments.set(key, {
    testId: test.id,
    variantId: fallback.id,
    userId,
    assignedAt: new Date().toISOString(),
  });
  return fallback;
}

/**
 * Get A/B test results summary.
 */
export function getTestResults(testId: string): {
  testId: string;
  totalAssignments: number;
  variantCounts: Record<string, number>;
} {
  const variantCounts: Record<string, number> = {};
  let total = 0;

  for (const [key, assignment] of assignments) {
    if (assignment.testId === testId) {
      variantCounts[assignment.variantId] = (variantCounts[assignment.variantId] || 0) + 1;
      total++;
    }
  }

  return { testId, totalAssignments: total, variantCounts };
}

/** Simple string hash (djb2) */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Reset state (for testing) */
export function _resetABTests(): void {
  activeTests.clear();
  assignments.clear();
}
