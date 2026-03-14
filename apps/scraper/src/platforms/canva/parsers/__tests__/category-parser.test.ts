import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCanvaCategoryPage, CATEGORY_TOPIC_MAP } from "../category-parser.js";

/**
 * Build a minimal Canva /apps page HTML with embedded app JSON.
 * Each app entry follows the {"A":"<id>","B":"SDK_APP",...} pattern
 * that extractCanvaApps() parses.
 */
function buildCanvaHtml(
  apps: { id: string; name: string; topics: string[]; urlSlug?: string; type?: string }[]
): string {
  const entries = apps.map((app) => {
    const obj = {
      A: app.id,
      B: app.type || "SDK_APP",
      C: app.name,
      D: `${app.name} short desc`,
      E: `${app.name} tagline`,
      F: `${app.name} Dev`,
      G: { A: `https://cdn.canva.com/${app.id}/icon.png`, B: 128, C: 128 },
      H: "",
      I: app.topics,
    };
    const json = JSON.stringify(obj);
    const slug = app.urlSlug || app.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    // Include the URL pattern that extractCanvaApps uses to derive urlSlug
    return `<a href="/apps/${app.id}/${slug}">${json}</a>`;
  });

  return `<html><body>${entries.join("")}</body></html>`;
}

// Sample apps for testing — mix of SDK_APP and EXTENSION types, various ID prefixes
const sampleApps = [
  { id: "AAF_forms1", name: "Jotform", topics: ["marketplace_topic.forms"], urlSlug: "jotform" },
  { id: "AAF_forms2", name: "Typeform", topics: ["marketplace_topic.forms"], urlSlug: "typeform" },
  { id: "AAF_tasks1", name: "Asana", topics: ["marketplace_topic.tasks_and_workflows"], urlSlug: "asana" },
  { id: "AAF_docs1", name: "Google Docs", topics: ["marketplace_topic.documents", "marketplace_topic.forms"], urlSlug: "google-docs" },
  { id: "AAF_inter1", name: "Mentimeter", topics: ["marketplace_topic.interactivity"], urlSlug: "mentimeter" },
  { id: "AAF_aiimg1", name: "DALL-E", topics: ["marketplace_topic.ai_images"], urlSlug: "dall-e" },
  { id: "AAF_music1", name: "Soundful", topics: ["marketplace_topic.music"], urlSlug: "soundful" },
  { id: "AAD_ext1", name: "Slack", topics: ["marketplace_topic.social_networking"], urlSlug: "slack", type: "EXTENSION" },
  { id: "AAH_new1", name: "NewApp", topics: ["marketplace_topic.forms"], urlSlug: "new-app" },
];

const testHtml = buildCanvaHtml(sampleApps);

describe("parseCanvaCategoryPage", () => {
  describe("hub page (filter category)", () => {
    it("returns null appCount for a filter category", () => {
      const result = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      assert.equal(result.appCount, null);
    });

    it("returns empty apps array for a hub page", () => {
      const result = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      assert.equal(result.apps.length, 0);
    });

    it("populates subcategoryLinks with simple slugs and parentSlug", () => {
      const result = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      assert.equal(result.subcategoryLinks.length, 4);
      const slugs = result.subcategoryLinks.map((s) => s.slug);
      assert.deepEqual(slugs, [
        "content-schedulers",
        "forms",
        "social-networking",
        "tasks-and-workflows",
      ]);
      // Each subcategory link includes the parent slug
      for (const link of result.subcategoryLinks) {
        assert.equal(link.parentSlug, "project-management");
      }
    });

    it("generates correct titles for subcategories", () => {
      const result = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      const titles = result.subcategoryLinks.map((s) => s.title);
      assert.deepEqual(titles, [
        "Content Schedulers",
        "Forms",
        "Social Networking",
        "Tasks and Workflows",
      ]);
    });

    it("uses filter label as hub page title", () => {
      const result = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      assert.equal(result.title, "Project management");
    });

    it("sets hasNextPage to false", () => {
      const result = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      assert.equal(result.hasNextPage, false);
    });

    it("works for all 10 filter categories", () => {
      for (const filterSlug of Object.keys(CATEGORY_TOPIC_MAP)) {
        const result = parseCanvaCategoryPage(testHtml, filterSlug, 1, 0);
        assert.equal(result.appCount, null, `${filterSlug} should be hub page`);
        assert.ok(result.subcategoryLinks.length > 0, `${filterSlug} should have subcategories`);
        // Verify all subcategory slugs are simple slugs with parentSlug
        for (const link of result.subcategoryLinks) {
          assert.ok(
            !link.slug.includes("--"),
            `${link.slug} should be a simple slug (no --)`,
          );
          assert.equal(link.parentSlug, filterSlug);
        }
      }
    });
  });

  describe("listing page (simple slug sub-category)", () => {
    it("returns non-null appCount for a simple topic slug", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      assert.equal(result.appCount, 4); // Jotform, Typeform, Google Docs, NewApp
    });

    it("returns ranked apps for a simple topic slug", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      assert.equal(result.apps.length, 4);
      const names = result.apps.map((a) => a.name);
      assert.ok(names.includes("Jotform"));
      assert.ok(names.includes("Typeform"));
      assert.ok(names.includes("Google Docs"));
      assert.ok(names.includes("NewApp"));
    });

    it("returns empty subcategoryLinks for listing page", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      assert.equal(result.subcategoryLinks.length, 0);
    });

    it("assigns correct positions starting from 1", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      const positions = result.apps.map((a) => a.position);
      assert.deepEqual(positions, [1, 2, 3, 4]);
    });

    it("applies organicOffset to positions", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 10);
      const positions = result.apps.map((a) => a.position);
      assert.deepEqual(positions, [11, 12, 13, 14]);
    });

    it("uses subcategory label as title", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      assert.equal(result.title, "Forms");
    });

    it("constructs correct app slugs", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      assert.equal(result.apps[0].slug, "AAF_forms1--jotform");
      assert.equal(result.apps[1].slug, "AAF_forms2--typeform");
    });

    it("filters by exact single topic tag", () => {
      const result = parseCanvaCategoryPage(testHtml, "ai-images", 1, 0);
      assert.equal(result.apps.length, 1);
      assert.equal(result.apps[0].name, "DALL-E");
    });

    it("returns 0 apps for a topic with no matching apps", () => {
      const result = parseCanvaCategoryPage(testHtml, "flipbooks", 1, 0);
      assert.equal(result.apps.length, 0);
      assert.equal(result.appCount, 0);
    });

    it("sets hasNextPage to false", () => {
      const result = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      assert.equal(result.hasNextPage, false);
    });

    it("assigns canva_extension badge to EXTENSION type apps", () => {
      const result = parseCanvaCategoryPage(testHtml, "social-networking", 1, 0);
      assert.equal(result.apps.length, 1);
      assert.equal(result.apps[0].name, "Slack");
      assert.deepEqual(result.apps[0].badges, ["canva_extension"]);
    });

    it("assigns empty badges to SDK_APP type apps", () => {
      const result = parseCanvaCategoryPage(testHtml, "ai-images", 1, 0);
      assert.equal(result.apps.length, 1);
      assert.equal(result.apps[0].name, "DALL-E");
      assert.deepEqual(result.apps[0].badges, []);
    });
  });

  describe("shared topics (same topic under multiple parents)", () => {
    it("forms appears under both project-management and text-styling with same slug", () => {
      const pmResult = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      const tsResult = parseCanvaCategoryPage(testHtml, "text-styling", 1, 0);

      const pmSlugs = pmResult.subcategoryLinks.map((s) => s.slug);
      const tsSlugs = tsResult.subcategoryLinks.map((s) => s.slug);

      // Both parents reference the same simple slug "forms"
      assert.ok(pmSlugs.includes("forms"));
      assert.ok(tsSlugs.includes("forms"));
    });

    it("shared topic simple slugs produce the same app results", () => {
      // With simple slugs, "forms" is the same slug regardless of parent
      const forms = parseCanvaCategoryPage(testHtml, "forms", 1, 0);
      assert.equal(forms.appCount, 4);
      assert.equal(forms.apps.length, 4);
    });

    it("subcategory links carry different parentSlug per hub page", () => {
      const pmResult = parseCanvaCategoryPage(testHtml, "project-management", 1, 0);
      const tsResult = parseCanvaCategoryPage(testHtml, "text-styling", 1, 0);

      const pmFormsLink = pmResult.subcategoryLinks.find((s) => s.slug === "forms");
      const tsFormsLink = tsResult.subcategoryLinks.find((s) => s.slug === "forms");

      // Same slug, different parentSlug
      assert.equal(pmFormsLink?.slug, tsFormsLink?.slug);
      assert.equal(pmFormsLink?.parentSlug, "project-management");
      assert.equal(tsFormsLink?.parentSlug, "text-styling");
    });
  });
});
