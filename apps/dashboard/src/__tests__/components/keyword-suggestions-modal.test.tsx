import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordSuggestionsModal } from "@/components/keyword-suggestions-modal";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    user: { role: "owner" },
    account: { id: "acc-1" },
  }),
}));

const mockSuggestions = ["live chat app", "customer support", "helpdesk tool"];

function renderModal(props: Partial<Parameters<typeof KeywordSuggestionsModal>[0]> = {}) {
  return render(
    <KeywordSuggestionsModal
      keywordSlug="live-chat"
      keyword="live chat"
      appSlug="test-app"
      open={true}
      onClose={vi.fn()}
      onKeywordAdded={vi.fn()}
      {...props}
    />
  );
}

function mockSuccessfulLoad() {
  mockFetchWithAuth
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: mockSuggestions }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });
}

describe("KeywordSuggestionsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByText(/Suggestions for/)).not.toBeInTheDocument();
  });

  it("renders header with keyword name when open", async () => {
    mockSuccessfulLoad();
    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Suggestions for/)).toBeInTheDocument();
    });
  });

  it("fetches and displays suggestions", async () => {
    mockSuccessfulLoad();
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("live chat app")).toBeInTheDocument();
    });
    expect(screen.getByText("customer support")).toBeInTheDocument();
    expect(screen.getByText("helpdesk tool")).toBeInTheDocument();
  });

  it("shows empty state when no suggestions", async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("No suggestions available yet.")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Failed to load suggestions")).toBeInTheDocument();
    });
  });

  it("passes keywordId and scraperEnqueued to onKeywordAdded", async () => {
    const user = userEvent.setup();
    const onKeywordAdded = vi.fn();

    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: mockSuggestions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    renderModal({ onKeywordAdded });

    await waitFor(() => {
      expect(screen.getByText("customer support")).toBeInTheDocument();
    });

    // Mock the add keyword POST response
    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keywordId: 99, scraperEnqueued: true }),
    });

    const addButtons = screen.getAllByTitle(/Track "/);
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(onKeywordAdded).toHaveBeenCalledWith(99, true);
    });
  });

  it("passes scraperEnqueued false when keyword already scraped", async () => {
    const user = userEvent.setup();
    const onKeywordAdded = vi.fn();

    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: mockSuggestions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    renderModal({ onKeywordAdded });

    await waitFor(() => {
      expect(screen.getByText("customer support")).toBeInTheDocument();
    });

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keywordId: 50, scraperEnqueued: false }),
    });

    const addButtons = screen.getAllByTitle(/Track "/);
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(onKeywordAdded).toHaveBeenCalledWith(50, false);
    });
  });

  it("marks keyword as Added after adding", async () => {
    const user = userEvent.setup();

    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: mockSuggestions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("customer support")).toBeInTheDocument();
    });

    mockFetchWithAuth.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ keywordId: 1, scraperEnqueued: true }),
    });

    const addButtons = screen.getAllByTitle(/Track "/);
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Added")).toBeInTheDocument();
    });
  });

  it("shows already tracked keywords as Added", async () => {
    mockFetchWithAuth
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ suggestions: mockSuggestions }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([{ keyword: "live chat app" }]),
      });

    renderModal();

    await waitFor(() => {
      expect(screen.getByText("live chat app")).toBeInTheDocument();
    });

    expect(screen.getByText("Added")).toBeInTheDocument();
  });
});
