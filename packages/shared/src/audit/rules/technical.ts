/**
 * Audit rules — Technical & Support section.
 * Checks: Built for Shopify badge, demo store, privacy policy, FAQ, docs, tutorial, pricing plans.
 */

import type { AuditSection, AuditCheck } from "../types.js";
import { computeSectionScore } from "../index.js";

export function computeTechnicalSection(snapshot: any, app: any, platform: string): AuditSection {
  const checks: AuditCheck[] = [];
  const support = snapshot?.support || {};

  // 1. Built for Shopify badge (Shopify-specific)
  if (platform === "shopify") {
    const isBuiltForShopify = app?.isBuiltForShopify || app?.badges?.includes("built_for_shopify");
    if (isBuiltForShopify) {
      checks.push({
        id: "tech-bfs",
        label: "Built for Shopify",
        status: "pass",
        detail: "Built for Shopify badge earned",
      });
    } else {
      checks.push({
        id: "tech-bfs",
        label: "Built for Shopify",
        status: "warning",
        detail: "No Built for Shopify badge",
        recommendation: "Earn the Built for Shopify badge to increase merchant trust and get priority placement.",
        impact: "medium",
      });
    }
  }

  // 2. Demo store
  const demoUrl = snapshot?.demoStoreUrl || "";
  if (demoUrl) {
    checks.push({
      id: "tech-demo",
      label: "Demo Store",
      status: "pass",
      detail: "Demo store URL provided",
    });
  } else {
    checks.push({
      id: "tech-demo",
      label: "Demo Store",
      status: "warning",
      detail: "No demo store",
      recommendation: "Set up a demo store so merchants can preview your app before installing.",
      impact: "medium",
    });
  }

  // 3. Privacy policy
  const hasPrivacy = support.privacy || support.privacyPolicy || support.privacyUrl;
  if (hasPrivacy) {
    checks.push({
      id: "tech-privacy",
      label: "Privacy Policy",
      status: "pass",
      detail: "Privacy policy link provided",
    });
  } else {
    checks.push({
      id: "tech-privacy",
      label: "Privacy Policy",
      status: "fail",
      detail: "No privacy policy",
      recommendation: "Add a privacy policy link — it's required by most marketplaces and builds trust.",
      impact: "high",
    });
  }

  // 4. FAQ
  const hasFaq = support.faq || support.faqUrl;
  if (hasFaq) {
    checks.push({
      id: "tech-faq",
      label: "FAQ",
      status: "pass",
      detail: "FAQ link provided",
    });
  } else {
    checks.push({
      id: "tech-faq",
      label: "FAQ",
      status: "warning",
      detail: "No FAQ",
      recommendation: "Add a FAQ to reduce support requests and help merchants self-serve.",
      impact: "low",
    });
  }

  // 5. Documentation
  const hasDocs = support.docs || support.documentation || support.docsUrl;
  if (hasDocs) {
    checks.push({
      id: "tech-docs",
      label: "Documentation",
      status: "pass",
      detail: "Documentation link provided",
    });
  } else {
    checks.push({
      id: "tech-docs",
      label: "Documentation",
      status: "warning",
      detail: "No documentation link",
      recommendation: "Link to your documentation — it shows professionalism and reduces churn.",
      impact: "low",
    });
  }

  // 6. Tutorial
  const hasTutorial = support.tutorial || support.tutorialUrl || support.video;
  if (hasTutorial) {
    checks.push({
      id: "tech-tutorial",
      label: "Tutorial",
      status: "pass",
      detail: "Tutorial/video link provided",
    });
  } else {
    checks.push({
      id: "tech-tutorial",
      label: "Tutorial",
      status: "warning",
      detail: "No tutorial or guide",
      recommendation: "Add a getting-started tutorial to help new users succeed quickly.",
      impact: "low",
    });
  }

  // 7. Pricing plans
  const pricingPlans: any[] = snapshot?.pricingPlans || [];
  if (pricingPlans.length >= 1) {
    const hasDetails = pricingPlans.some(
      (p: any) => p?.name && (p?.price || p?.description || p?.features),
    );
    if (hasDetails) {
      checks.push({
        id: "tech-pricing",
        label: "Pricing Plans",
        status: "pass",
        detail: `${pricingPlans.length} plan(s) with details`,
      });
    } else {
      checks.push({
        id: "tech-pricing",
        label: "Pricing Plans",
        status: "warning",
        detail: `${pricingPlans.length} plan(s) — missing details`,
        recommendation: "Add clear pricing details (features, limits) to each plan for transparency.",
        impact: "medium",
      });
    }
  } else {
    checks.push({
      id: "tech-pricing",
      label: "Pricing Plans",
      status: "warning",
      detail: "No pricing plans listed",
      recommendation: "List your pricing plans with clear feature breakdowns.",
      impact: "medium",
    });
  }

  return {
    id: "technical",
    name: "Technical & Support",
    icon: "Settings",
    score: computeSectionScore(checks),
    checks,
  };
}
