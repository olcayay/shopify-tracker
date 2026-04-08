/**
 * Core types for the app listing audit engine.
 */

export type AuditStatus = "pass" | "warning" | "fail";
export type AuditImpact = "high" | "medium" | "low";

export interface AuditCheck {
  id: string;
  label: string;
  status: AuditStatus;
  detail: string;
  recommendation?: string;
  impact?: AuditImpact;
}

export interface AuditSection {
  id: string;
  name: string;
  icon: string;
  score: number; // 0-100
  checks: AuditCheck[];
}

export interface AuditRecommendation {
  index: number;
  impact: AuditImpact;
  section: string;
  title: string;
  detail: string;
}

export interface AuditAppMeta {
  name: string;
  slug: string;
  platform: string;
  iconUrl: string | null;
  developer?: string;
  averageRating?: number | null;
  ratingCount?: number | null;
  pricingHint?: string | null;
}

export interface AuditReport {
  overallScore: number; // 0-100
  sections: AuditSection[];
  recommendations: AuditRecommendation[];
  app: AuditAppMeta;
  generatedAt: string; // ISO 8601
}

/** Section weight configuration (must sum to 1.0) */
export interface SectionWeights {
  title: number;
  content: number;
  visuals: number;
  categories: number;
  technical: number;
  languages: number;
}

export const DEFAULT_SECTION_WEIGHTS: SectionWeights = {
  title: 0.15,
  content: 0.25,
  visuals: 0.20,
  categories: 0.15,
  technical: 0.15,
  languages: 0.10,
};
