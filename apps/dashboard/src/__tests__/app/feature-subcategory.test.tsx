import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockGetFeaturesByCategory = vi.fn();
const mockGetAccountStarredFeatures = vi.fn();

vi.mock("@/lib/api", () => ({
  getFeaturesByCategory: (...args: any[]) => mockGetFeaturesByCategory(...args),
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

import FeaturesByCategoryPage from "@/app/(dashboard)/[platform]/features/category/page";

const features = [
  { handle: "live-chat", title: "Live Chat", subcategory_title: "Chat", app_count: 10 },
  { handle: "chatbot", title: "Chatbot", subcategory_title: "Chat", app_count: 5 },
  { handle: "agent-inbox", title: "Agent Inbox", subcategory_title: "Support", app_count: 3 },
];

describe("FeaturesByCategoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeaturesByCategory.mockResolvedValue(features);
    mockGetAccountStarredFeatures.mockResolvedValue([
      { featureHandle: "agent-inbox" },
    ]);
  });

  it("sorts starred features to the top", async () => {
    const page = await FeaturesByCategoryPage({
      params: Promise.resolve({ platform: "shopify" }),
      searchParams: Promise.resolve({ category: "Chat" }),
    });
    render(page);

    const rows = screen.getAllByRole("row");
    const featureCells = rows.slice(1).map((r) => r.querySelector("td a")?.textContent);
    // "agent-inbox" is starred → should be first
    expect(featureCells[0]).toBe("Agent Inbox");
  });

  it("preserves original order within starred and unstarred groups", async () => {
    mockGetAccountStarredFeatures.mockResolvedValue([
      { featureHandle: "chatbot" },
      { featureHandle: "agent-inbox" },
    ]);

    const page = await FeaturesByCategoryPage({
      params: Promise.resolve({ platform: "shopify" }),
      searchParams: Promise.resolve({ category: "Chat" }),
    });
    render(page);

    const rows = screen.getAllByRole("row");
    const featureCells = rows.slice(1).map((r) => r.querySelector("td a")?.textContent);
    // Starred: chatbot (idx 1), agent-inbox (idx 2)
    // Unstarred: live-chat (idx 0)
    expect(featureCells).toEqual(["Chatbot", "Agent Inbox", "Live Chat"]);
  });

  it("shows unchanged order when no features are starred", async () => {
    mockGetAccountStarredFeatures.mockResolvedValue([]);

    const page = await FeaturesByCategoryPage({
      params: Promise.resolve({ platform: "shopify" }),
      searchParams: Promise.resolve({ category: "Chat" }),
    });
    render(page);

    const rows = screen.getAllByRole("row");
    const featureCells = rows.slice(1).map((r) => r.querySelector("td a")?.textContent);
    expect(featureCells).toEqual(["Live Chat", "Chatbot", "Agent Inbox"]);
  });
});
