import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
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

const MOCK_DEVELOPERS = [
  { id: 1, slug: "jotform", name: "Jotform", platforms: ["shopify", "wix"] },
  { id: 2, slug: "acme-inc", name: "Acme Inc", platforms: ["salesforce"] },
];

const PLACEHOLDER = "Search apps and developers...";

function mockFetchResponses() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/public/apps/search")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_APPS) });
    }
    if (url.includes("/api/developers")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ developers: MOCK_DEVELOPERS }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResponses();
  });

  afterEach(() => {
    document.body.removeAttribute("data-command-palette-open");
  });

  it("does not render when not open", () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("opens on Cmd+K", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
  });

  it("sets data-command-palette-open on body when open", async () => {
    render(<CommandPalette />);
    expect(document.body.hasAttribute("data-command-palette-open")).toBe(false);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() => {
      expect(document.body.hasAttribute("data-command-palette-open")).toBe(true);
    });
  });

  it("shows page results including Developers", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Developers")).toBeInTheDocument();
  });

  it("hides pages when search results are displayed", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    // Pages visible initially
    expect(screen.getByText("Overview")).toBeInTheDocument();

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "slack");

    await waitFor(() => {
      expect(screen.getByText("Slack")).toBeInTheDocument();
    });

    // Pages should be hidden
    expect(screen.queryByText("Overview")).not.toBeInTheDocument();
  });

  it("searches apps across platforms with results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "slack");

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/public/apps/search?q=slack")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Slack")).toBeInTheDocument();
      expect(screen.getByText("Mailchimp")).toBeInTheDocument();
    });
  });

  it("searches developers alongside apps", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "jotform");

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/api/developers?search=jotform")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Jotform")).toBeInTheDocument();
      expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    });
  });

  it("shows platform badges on results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "test");

    await waitFor(() => {
      // Platform badges appear in both app results and developer results
      expect(screen.getAllByText("Shopify").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Salesforce").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows ratings on results", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText(PLACEHOLDER);
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

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "test");

    await waitFor(() => {
      const trackButtons = screen.getAllByTitle("Track app");
      expect(trackButtons.length).toBe(2);
    });
  });

  it("fetches from public search with limit=10", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const input = screen.getByPlaceholderText(PLACEHOLDER);
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

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "a");

    // Should not trigger search
    await new Promise((r) => setTimeout(r, 400));
    // fetchWithAuth should not be called for single char
    const searchCalls = mockFetchWithAuth.mock.calls.filter(
      (c: any[]) => c[0].includes("/api/public/apps/search")
    );
    expect(searchCalls.length).toBe(0);
  });
});
