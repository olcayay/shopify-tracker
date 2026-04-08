import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// cmdk uses scrollIntoView which isn't available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

import { CommandPalette } from "@/components/command-palette";

const mockFetchWithAuth = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    user: { role: "owner" },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useParams: () => ({ platform: "shopify" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const MOCK_APPS = [
  {
    slug: "slack",
    name: "Slack",
    iconUrl: "https://cdn.example.com/slack.png",
    platform: "shopify",
    averageRating: 4.5,
    ratingCount: 1200,
    pricingHint: "Free",
  },
  {
    slug: "mailchimp",
    name: "Mailchimp",
    iconUrl: null,
    platform: "salesforce",
    averageRating: 3.8,
    ratingCount: 500,
    pricingHint: "$9.99/mo",
  },
];

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_APPS),
    });
  });

  it("does not render when not open", () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText("Search apps across all platforms...")).not.toBeInTheDocument();
  });

  it("opens on Cmd+K", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText("Search apps across all platforms...")).toBeInTheDocument();
  });

  it("shows page results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("searches apps across platforms with results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText("Search apps across all platforms...");
    await userEvent.type(input, "slack");

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/public/apps/search?q=slack")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Slack")).toBeInTheDocument();
      expect(screen.getByText("Mailchimp")).toBeInTheDocument();
    });
  });

  it("shows platform badges on results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText("Search apps across all platforms...");
    await userEvent.type(input, "test");

    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
      expect(screen.getByText("Salesforce")).toBeInTheDocument();
    });
  });

  it("shows ratings on results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText("Search apps across all platforms...");
    await userEvent.type(input, "slack");

    await waitFor(() => {
      expect(screen.getByText("Slack")).toBeInTheDocument();
    });

    // Rating should be present in the DOM
    const ratingText = screen.getByText("4.5");
    expect(ratingText).toBeInTheDocument();
  });

  it("shows track button for editors/owners", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText("Search apps across all platforms...");
    await userEvent.type(input, "test");

    await waitFor(() => {
      const trackButtons = screen.getAllByTitle("Track app");
      expect(trackButtons.length).toBe(2);
    });
  });

  it("fetches from public search with limit=10", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText("Search apps across all platforms...");
    await userEvent.type(input, "test");

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("limit=10")
      );
    });
  });

  it("clears results when query is too short", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText("Search apps across all platforms...");
    await userEvent.type(input, "a");

    // Should not trigger search
    await new Promise((r) => setTimeout(r, 400));
    // fetchWithAuth should not be called for single char
    const searchCalls = mockFetchWithAuth.mock.calls.filter(
      (c: any[]) => c[0].includes("/public/apps/search")
    );
    expect(searchCalls.length).toBe(0);
  });
});
