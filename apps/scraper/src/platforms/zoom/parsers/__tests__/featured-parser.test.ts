import { describe, it, expect } from "vitest";
import { parseZoomFeaturedSections } from "../featured-parser.js";

const SAMPLE_FEATURED_RESPONSE: Record<string, Record<string, any>> = {
  "Bq-h8dDfRTGqJQciACMHhw": {
    id: "Bq-h8dDfRTGqJQciACMHhw",
    groupId: "7GQQQ3SMRnKflyANjAvTDA",
    name: "Document Collaboration",
    seoId: "document-collaboration",
    appCount: 8,
    style: "PRIMARY",
    description: "Access, create, and collaborate on shared documents",
    previewAppList: [
      {
        id: "epJsq-eFTl-O-PIriFckcg",
        displayName: "Google Drive",
        icon: "/path/to/google-drive.png",
      },
      {
        id: "abc123",
        displayName: "Dropbox",
        icon: "/path/to/dropbox.png",
      },
    ],
  },
  "If1dsLRETdii86dc6KuNlA": {
    id: "If1dsLRETdii86dc6KuNlA",
    groupId: "7GQQQ3SMRnKflyANjAvTDA",
    name: "New",
    seoId: "new",
    appCount: 30,
    style: "DEFAULT",
    description: "Newly added apps",
    previewAppList: [
      {
        id: "new-app-1",
        displayName: "New App One",
        icon: "/path/to/new1.png",
      },
    ],
  },
  "unknown-section": {
    id: "unknown-section",
    name: "Unknown Section",
    seoId: "unknown-section-not-in-config",
    appCount: 5,
    previewAppList: [
      {
        id: "unk1",
        displayName: "Unknown App",
        icon: "/path/to/unk.png",
      },
    ],
  },
};

describe("parseZoomFeaturedSections", () => {
  it("should parse known featured sections", () => {
    const result = parseZoomFeaturedSections(SAMPLE_FEATURED_RESPONSE);

    // Only sections matching ZOOM_FEATURED_SECTIONS config should be included
    const handles = result.map((s) => s.sectionHandle);
    expect(handles).toContain("_collection_document_collaboration");
    expect(handles).toContain("_collection_new");
    // Unknown section should NOT appear
    expect(handles).not.toContain("_collection_unknown_section_not_in_config");
  });

  it("should parse section apps correctly", () => {
    const result = parseZoomFeaturedSections(SAMPLE_FEATURED_RESPONSE);
    const docSection = result.find((s) => s.sectionHandle === "_collection_document_collaboration");

    expect(docSection).toBeDefined();
    expect(docSection!.sectionTitle).toBe("Document Collaboration");
    expect(docSection!.surface).toBe("home");
    expect(docSection!.surfaceDetail).toBe("curated_document-collaboration");
    expect(docSection!.apps).toHaveLength(2);
    expect(docSection!.apps[0].slug).toBe("epJsq-eFTl-O-PIriFckcg");
    expect(docSection!.apps[0].name).toBe("Google Drive");
    expect(docSection!.apps[0].position).toBe(1);
    expect(docSection!.apps[0].iconUrl).toBe("https://marketplacecontent-cf.zoom.us/%2Fpath%2Fto%2Fgoogle-drive.png");
  });

  it("should handle empty data", () => {
    const result = parseZoomFeaturedSections({});
    expect(result).toHaveLength(0);
  });

  it("should skip sections with empty previewAppList", () => {
    const emptyApps: Record<string, Record<string, any>> = {
      "empty-section": {
        id: "empty-section",
        name: "Document Collaboration",
        seoId: "document-collaboration",
        appCount: 0,
        previewAppList: [],
      },
    };
    const result = parseZoomFeaturedSections(emptyApps);
    expect(result).toHaveLength(0);
  });
});
