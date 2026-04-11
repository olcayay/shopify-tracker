import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetFeatureCategoryDetail = vi.fn();
const mockGetAccountStarredFeatures = vi.fn();

vi.mock("@/lib/api", () => ({
  getFeatureCategoryDetail: (...args: any[]) => mockGetFeatureCategoryDetail(...args),
  getAccountStarredFeatures: (...args: any[]) => mockGetAccountStarredFeatures(...args),
}));

vi.mock(
  "@/app/(dashboard)/[platform]/features/[handle]/track-button",
  () => ({
    StarFeatureButton: ({ featureHandle, initialStarred }: any) => (
      <button
        data-testid={`star-${featureHandle}`}
        aria-label={initialStarred ? "Remove bookmark" : "Bookmark feature"}
      >
        {initialStarred ? "starred" : "idle"}
      </button>
    ),
  }),
);

import FeatureCategoryDetailPage from "@/app/(dashboard)/[platform]/features/categories/[slug]/page";

function makeCategory(overrides: any = {}) {
  return {
    slug: "chat",
    title: "Chat",
    url: "https://example.com/chat",
    subcategoryCount: 2,
    featureCount: 3,
    subcategories: [
      { title: "Live Chat", featureCount: 2 },
      { title: "Bots", featureCount: 1 },
    ],
    features: [
      { handle: "live-chat", title: "Live Chat", subcategoryTitle: "Live Chat" },
      { handle: "chatbot", title: "Chatbot", subcategoryTitle: "Bots" },
      { handle: "agent-inbox", title: "Agent Inbox", subcategoryTitle: "Live Chat" },
    ],
    ...overrides,
  };
}

describe("FeatureCategoryDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeatureCategoryDetail.mockResolvedValue(makeCategory());
    mockGetAccountStarredFeatures.mockResolvedValue([
      { featureHandle: "chatbot" },
    ]);
  });

  it("renders the category title and counts", async () => {
    const page = await FeatureCategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "chat" }),
    });
    render(page);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chat");
    expect(screen.getByText("3 features across 2 subcategories")).toBeInTheDocument();
  });

  it("renders breadcrumb back to features", async () => {
    const page = await FeatureCategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "chat" }),
    });
    render(page);

    const featuresLink = screen.getByRole("link", { name: "Features" });
    expect(featuresLink).toHaveAttribute("href", "/shopify/features");
  });

  it("renders subcategory links with platform-aware paths", async () => {
    const page = await FeatureCategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "chat" }),
    });
    render(page);

    expect(screen.getByRole("link", { name: "Live Chat (2)" }))
      .toHaveAttribute("href", "/shopify/features/category?category=Chat&subcategory=Live+Chat");
  });

  it("renders feature links and bookmark state", async () => {
    const page = await FeatureCategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "chat" }),
    });
    render(page);

    expect(screen.getByRole("link", { name: "Chatbot" }))
      .toHaveAttribute("href", "/shopify/features/chatbot");
    expect(screen.getByTestId("star-chatbot")).toHaveAttribute("aria-label", "Remove bookmark");
  });

  it("shows not found copy when the category request fails", async () => {
    mockGetFeatureCategoryDetail.mockRejectedValue(new Error("Not found"));

    const page = await FeatureCategoryDetailPage({
      params: Promise.resolve({ platform: "shopify", slug: "missing" }),
    });
    render(page);

    expect(screen.getByText("Feature category not found.")).toBeInTheDocument();
  });
});
