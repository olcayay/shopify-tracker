/**
 * Audit rules — Description & Content section.
 * Checks: intro, description, features, SEO title, SEO description, demo store.
 */

import type { AuditSection, AuditCheck } from "../types.js";
import { computeSectionScore } from "../index.js";
import { getMetadataLimits } from "../../metadata-limits.js";
import { COMMON_STOP_WORDS } from "../../keyword-extraction.js";

/** Count unique meaningful keywords in text */
function countKeywords(text: string): number {
  if (!text) return 0;
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !COMMON_STOP_WORDS.has(w));
  return new Set(words).size;
}

export function computeContentSection(snapshot: any, app: any, platform: string): AuditSection {
  const limits = getMetadataLimits(platform);
  const checks: AuditCheck[] = [];

  // 1. Intro presence & length
  const intro = snapshot?.appIntroduction || "";
  const introLen = intro.length;
  const introLimit = limits.introduction;

  if (introLen === 0 && introLimit > 0) {
    checks.push({
      id: "content-intro",
      label: "Introduction",
      status: "fail",
      detail: "Missing",
      recommendation: "Add an app introduction. This is the first text users see — make it compelling.",
      impact: "high",
    });
  } else if (introLimit > 0 && introLen < introLimit * 0.3) {
    checks.push({
      id: "content-intro",
      label: "Introduction",
      status: "warning",
      detail: `${introLen}/${introLimit} chars — too short`,
      recommendation: `Your introduction is only ${introLen} characters. Use closer to ${introLimit} characters to fully describe your app.`,
      impact: "medium",
    });
  } else if (introLimit > 0) {
    checks.push({
      id: "content-intro",
      label: "Introduction",
      status: "pass",
      detail: `${introLen}/${introLimit} chars`,
    });
  }

  // 2. Intro keywords
  if (introLimit > 0) {
    const introKeywords = countKeywords(intro);
    if (introKeywords >= 3) {
      checks.push({
        id: "content-intro-keywords",
        label: "Intro Keywords",
        status: "pass",
        detail: `${introKeywords} unique keywords`,
      });
    } else if (introKeywords > 0) {
      checks.push({
        id: "content-intro-keywords",
        label: "Intro Keywords",
        status: "warning",
        detail: `Only ${introKeywords} keyword(s) — add more`,
        recommendation: "Include at least 3 relevant keywords in your introduction for better search visibility.",
        impact: "medium",
      });
    } else {
      checks.push({
        id: "content-intro-keywords",
        label: "Intro Keywords",
        status: "fail",
        detail: "No keywords in introduction",
        recommendation: "Add descriptive keywords to your introduction that match what users search for.",
        impact: "medium",
      });
    }
  }

  // 3. Description presence & length
  const desc = snapshot?.appDetails || "";
  const descLen = desc.length;
  const descLimit = limits.details;

  if (descLen === 0 && descLimit > 0) {
    checks.push({
      id: "content-description",
      label: "Description",
      status: "fail",
      detail: "Missing",
      recommendation: "Add a detailed app description explaining features, benefits, and use cases.",
      impact: "high",
    });
  } else if (descLimit > 0 && descLen < descLimit * 0.6) {
    checks.push({
      id: "content-description",
      label: "Description",
      status: "warning",
      detail: `${descLen}/${descLimit} chars — under 60% of limit`,
      recommendation: `Your description uses ${descLen} of ${descLimit} characters. Expand it with features, benefits, and use cases.`,
      impact: "high",
    });
  } else if (descLimit > 0) {
    checks.push({
      id: "content-description",
      label: "Description",
      status: "pass",
      detail: `${descLen}/${descLimit} chars`,
    });
  }

  // 4. Description keyword density
  if (descLimit > 0) {
    const descKeywords = countKeywords(desc);
    if (descKeywords >= 5) {
      checks.push({
        id: "content-desc-keywords",
        label: "Description Keywords",
        status: "pass",
        detail: `${descKeywords} unique keywords`,
      });
    } else if (descKeywords > 0) {
      checks.push({
        id: "content-desc-keywords",
        label: "Description Keywords",
        status: "warning",
        detail: `Only ${descKeywords} keyword(s)`,
        recommendation: "Include at least 5 unique keywords in your description for better discoverability.",
        impact: "medium",
      });
    } else {
      checks.push({
        id: "content-desc-keywords",
        label: "Description Keywords",
        status: "fail",
        detail: "No keywords in description",
        recommendation: "Add relevant keywords throughout your description.",
        impact: "medium",
      });
    }
  }

  // 5. Feature list completeness
  const features: string[] = snapshot?.features || snapshot?.platformData?.features || [];
  const featureLimit = limits.feature;
  if (featureLimit > 0) {
    if (features.length >= 5) {
      checks.push({
        id: "content-features",
        label: "Feature List",
        status: "pass",
        detail: `${features.length} features listed`,
      });
    } else if (features.length >= 3) {
      checks.push({
        id: "content-features",
        label: "Feature List",
        status: "warning",
        detail: `${features.length}/5 features — add more`,
        recommendation: "List all 5 features to maximize listing completeness.",
        impact: "medium",
      });
    } else {
      checks.push({
        id: "content-features",
        label: "Feature List",
        status: "fail",
        detail: features.length === 0 ? "No features listed" : `Only ${features.length} feature(s)`,
        recommendation: "Add at least 5 key features to highlight your app's capabilities.",
        impact: "high",
      });
    }

    // 6. Feature clarity (each under char limit)
    if (features.length > 0) {
      const overLimit = features.filter((f: string) => f.length > featureLimit);
      if (overLimit.length === 0) {
        checks.push({
          id: "content-feature-clarity",
          label: "Feature Clarity",
          status: "pass",
          detail: `All features within ${featureLimit} char limit`,
        });
      } else {
        checks.push({
          id: "content-feature-clarity",
          label: "Feature Clarity",
          status: "warning",
          detail: `${overLimit.length} feature(s) exceed ${featureLimit} chars`,
          recommendation: `Keep each feature under ${featureLimit} characters for readability.`,
          impact: "low",
        });
      }
    }
  }

  // 7. SEO title
  if (limits.seoTitle > 0) {
    const seoTitle = snapshot?.seoTitle || "";
    if (seoTitle.length === 0) {
      checks.push({
        id: "content-seo-title",
        label: "SEO Title",
        status: "fail",
        detail: "Missing",
        recommendation: "Add an SEO title to improve search engine visibility.",
        impact: "medium",
      });
    } else if (seoTitle.length > limits.seoTitle) {
      checks.push({
        id: "content-seo-title",
        label: "SEO Title",
        status: "warning",
        detail: `${seoTitle.length}/${limits.seoTitle} chars — over limit`,
        recommendation: `Keep your SEO title under ${limits.seoTitle} characters to avoid truncation in search results.`,
        impact: "low",
      });
    } else {
      checks.push({
        id: "content-seo-title",
        label: "SEO Title",
        status: "pass",
        detail: `${seoTitle.length}/${limits.seoTitle} chars`,
      });
    }
  }

  // 8. SEO meta description
  if (limits.seoMetaDescription > 0) {
    const seoDesc = snapshot?.seoMetaDescription || "";
    if (seoDesc.length === 0) {
      checks.push({
        id: "content-seo-desc",
        label: "SEO Description",
        status: "fail",
        detail: "Missing",
        recommendation: "Add a meta description for better search engine click-through rates.",
        impact: "medium",
      });
    } else if (seoDesc.length > limits.seoMetaDescription) {
      checks.push({
        id: "content-seo-desc",
        label: "SEO Description",
        status: "warning",
        detail: `${seoDesc.length}/${limits.seoMetaDescription} chars — over limit`,
        recommendation: `Keep your meta description under ${limits.seoMetaDescription} characters.`,
        impact: "low",
      });
    } else {
      checks.push({
        id: "content-seo-desc",
        label: "SEO Description",
        status: "pass",
        detail: `${seoDesc.length}/${limits.seoMetaDescription} chars`,
      });
    }
  }

  // 9. Demo store
  const demoUrl = snapshot?.demoStoreUrl || "";
  if (demoUrl) {
    checks.push({
      id: "content-demo",
      label: "Demo Store",
      status: "pass",
      detail: "Demo store URL provided",
    });
  } else {
    checks.push({
      id: "content-demo",
      label: "Demo Store",
      status: "warning",
      detail: "No demo store URL",
      recommendation: "Add a demo store URL so merchants can see your app in action before installing.",
      impact: "low",
    });
  }

  return {
    id: "content",
    name: "Description & Content",
    icon: "FileText",
    score: computeSectionScore(checks),
    checks,
  };
}
