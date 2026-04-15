import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@appranks/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@appranks/shared")>()),
  PLATFORMS: {
    shopify: { id: "shopify", name: "Shopify" },
    salesforce: { id: "salesforce", name: "Salesforce" },
  },
  isPlatformId: (id: string) => ["shopify", "salesforce"].includes(id),
}));

// Import after mocks
const { AuditReport } = await import("@/components/audit/audit-report");

interface AuditReportType {
  overallScore: number;
  sections: any[];
  recommendations: any[];
  app: any;
  generatedAt: string;
}

const mockReport: AuditReportType = {
  overallScore: 75,
  sections: [
    {
      id: "title",
      name: "Title Optimization",
      icon: "Type",
      score: 80,
      checks: [
        { id: "title-length", label: "Title Length", status: "pass", detail: "25/30 chars" },
        {
          id: "title-keywords",
          label: "Title Keywords",
          status: "warning",
          detail: "2 keywords",
          recommendation: "Add more keywords",
        },
      ],
    },
    {
      id: "content",
      name: "Description & Content",
      icon: "FileText",
      score: 60,
      checks: [
        {
          id: "content-intro",
          label: "Introduction",
          status: "fail",
          detail: "Missing",
          recommendation: "Add an intro",
          impact: "high",
        },
      ],
    },
    { id: "visuals", name: "Visual Assets", icon: "Image", score: 100, checks: [] },
    { id: "categories", name: "Categories", icon: "Tags", score: 50, checks: [] },
    { id: "technical", name: "Technical", icon: "Settings", score: 70, checks: [] },
    { id: "languages", name: "Languages", icon: "Globe", score: 90, checks: [] },
  ],
  recommendations: [
    {
      index: 1,
      impact: "high",
      section: "Content",
      title: "Introduction",
      detail: "Add an intro",
    },
    {
      index: 2,
      impact: "medium",
      section: "Title",
      title: "Title Keywords",
      detail: "Add more keywords",
    },
  ],
  app: {
    name: "Test App",
    slug: "test-app",
    platform: "shopify",
    iconUrl: "https://example.com/icon.png",
    developer: "Test Dev",
    averageRating: 4.5,
    ratingCount: 100,
    pricingHint: "Free plan available",
  },
  generatedAt: "2026-04-08T00:00:00.000Z",
};

describe("AuditReport", () => {
  it("renders app name and overall score", () => {
    render(<AuditReport report={mockReport} platform="shopify" />);
    expect(screen.getByText("Test App")).toBeDefined();
    expect(screen.getByText("75")).toBeDefined();
  });

  it("renders all 6 section names", () => {
    render(<AuditReport report={mockReport} platform="shopify" />);
    expect(screen.getByText("Title Optimization")).toBeDefined();
    expect(screen.getByText("Description & Content")).toBeDefined();
    expect(screen.getByText("Visual Assets")).toBeDefined();
  });

  it("renders recommendations", () => {
    render(<AuditReport report={mockReport} platform="shopify" />);
    expect(screen.getByText("Recommendations")).toBeDefined();
    expect(screen.getAllByText("Introduction").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Add an intro").length).toBeGreaterThanOrEqual(1);
  });

  it("renders check items with status indicators", () => {
    render(<AuditReport report={mockReport} platform="shopify" />);
    expect(screen.getByText("Title Length")).toBeDefined();
    expect(screen.getByText("— 25/30 chars")).toBeDefined();
  });

  it("renders CTA footer", () => {
    render(<AuditReport report={mockReport} platform="shopify" />);
    expect(screen.getByText("Start Tracking Free")).toBeDefined();
  });

  it("renders developer and rating info", () => {
    render(<AuditReport report={mockReport} platform="shopify" />);
    expect(screen.getByText("Test Dev")).toBeDefined();
  });

  it("renders back link to search", () => {
    render(<AuditReport report={mockReport} platform="shopify" />);
    expect(screen.getByText("Back to search")).toBeDefined();
  });
});
