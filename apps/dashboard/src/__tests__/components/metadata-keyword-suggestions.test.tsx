import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetadataKeywordSuggestions } from "@/components/metadata-keyword-suggestions";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    user: { role: "owner" },
    account: { id: "acc-1" },
  }),
}));

const mockSuggestionsResponse = {
  suggestions: [
    {
      keyword: "live chat",
      score: 18,
      tracked: false,
      sources: [
        { field: "name", weight: 10 },
        { field: "subtitle", weight: 8 },
      ],
    },
    {
      keyword: "customer support",
      score: 8,
      tracked: false,
      sources: [{ field: "categories", weight: 5 }],
    },
    {
      keyword: "chatbot",
      score: 6,
      tracked: false,
      sources: [{ field: "introduction", weight: 6 }],
    },
  ],
  weights: {
    name: 10,
    subtitle: 8,
    introduction: 6,
    categories: 5,
    features: 4,
    description: 3,
    categoryFeatures: 3,
  },
  metadata: { appName: "Test App", totalCandidates: 50, afterFiltering: 3 },
};

describe("MetadataKeywordSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the suggest keywords button", () => {
    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );
    expect(screen.getByText("Suggest keywords")).toBeInTheDocument();
  });

  it("does not show suggestions panel initially", () => {
    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );
    expect(screen.queryByText("Keyword Suggestions from App Metadata")).not.toBeInTheDocument();
  });

  it("fetches and shows suggestions when clicked", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestionsResponse),
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(screen.getByText("live chat")).toBeInTheDocument();
    });

    expect(screen.getByText("customer support")).toBeInTheDocument();
    expect(screen.getByText("chatbot")).toBeInTheDocument();
  });

  it("shows source badges for each suggestion", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestionsResponse),
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(screen.getByText("Name")).toBeInTheDocument();
    });
    expect(screen.getByText("Subtitle")).toBeInTheDocument();
  });

  it("shows weight legend in footer", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestionsResponse),
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(screen.getByText("Weights:")).toBeInTheDocument();
    });
  });

  it("shows 'Added' for already tracked keywords", async () => {
    const user = userEvent.setup();
    const responseWithTracked = {
      ...mockSuggestionsResponse,
      suggestions: mockSuggestionsResponse.suggestions.map((s) =>
        s.keyword === "live chat" ? { ...s, tracked: true } : s
      ),
    };
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseWithTracked),
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(screen.getByText("live chat")).toBeInTheDocument();
    });
    expect(screen.getByText("Added")).toBeInTheDocument();
  });

  it("calls onKeywordAdded after adding a keyword", async () => {
    const user = userEvent.setup();
    const onKeywordAdded = vi.fn();

    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuggestionsResponse),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={onKeywordAdded}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(screen.getByText("customer support")).toBeInTheDocument();
    });

    const addButtons = screen.getAllByTitle(/Track "/);
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(onKeywordAdded).toHaveBeenCalled();
    });
  });

  it("shows error state on fetch failure", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(screen.getByText("Failed to load suggestions")).toBeInTheDocument();
    });
  });

  it("auto-opens and fetches in prominent mode", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestionsResponse),
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
        prominent
      />
    );

    // Should auto-fetch without user clicking
    await waitFor(() => {
      expect(screen.getByText("live chat")).toBeInTheDocument();
    });
    expect(mockFetchWithAuth).toHaveBeenCalledTimes(1);
  });

  it("shows empty suggestions message", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ suggestions: [], weights: {}, metadata: {} }),
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(
        screen.getByText("No suggestions available. The app may not have enough metadata.")
      ).toBeInTheDocument();
    });
  });

  it("toggles panel closed when clicking button again", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuggestionsResponse),
    });

    render(
      <MetadataKeywordSuggestions
        appSlug="test-app"
        trackedKeywords={new Set()}
        onKeywordAdded={vi.fn()}
      />
    );

    await user.click(screen.getByText("Suggest keywords"));

    await waitFor(() => {
      expect(screen.getByText("live chat")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Suggest keywords"));

    expect(screen.queryByText("Keyword Suggestions from App Metadata")).not.toBeInTheDocument();
  });
});
