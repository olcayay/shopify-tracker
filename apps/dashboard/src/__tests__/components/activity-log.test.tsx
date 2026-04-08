import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { ActivityLog, ACTION_LABELS } from "@/components/activity-log";

// Mock auth context
const mockFetchWithAuth = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

function mockApiResponse(logs: any[], total: number, page = 1, limit = 25) {
  return {
    ok: true,
    json: async () => ({ logs, total, page, limit }),
  };
}

const MOCK_ENTRIES = [
  {
    id: 1,
    action: "app_tracked",
    entityType: "app",
    entityId: "slack",
    metadata: { platform: "shopify", slug: "slack" },
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    user: { id: "u1", name: "John Doe", email: "john@test.com" },
  },
  {
    id: 2,
    action: "member_invited",
    entityType: "invitation",
    entityId: "jane@test.com",
    metadata: { email: "jane@test.com", role: "editor" },
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    user: { id: "u1", name: "John Doe", email: "john@test.com" },
  },
  {
    id: 3,
    action: "platform_enabled",
    entityType: "platform",
    entityId: "salesforce",
    metadata: { platform: "salesforce" },
    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    user: null, // system action
  },
];

describe("ActivityLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton initially", () => {
    // Never resolve to keep loading state
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    render(<ActivityLog />);
    expect(screen.getByText("Activity Log")).toBeInTheDocument();
    expect(screen.getByText("Track all actions performed by team members")).toBeInTheDocument();
  });

  it("renders empty state when no logs", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse([], 0));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });
  });

  it("renders log entries with human-readable action labels", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText("Tracked app")).toBeInTheDocument();
      expect(screen.getByText("Invited member")).toBeInTheDocument();
      expect(screen.getByText("Enabled platform")).toBeInTheDocument();
    });
  });

  it("shows user names", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getAllByText("John Doe")).toHaveLength(2);
      expect(screen.getByText("System")).toBeInTheDocument();
    });
  });

  it("shows details from metadata", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText("slack")).toBeInTheDocument();
      expect(screen.getByText("jane@test.com")).toBeInTheDocument();
      expect(screen.getByText("salesforce")).toBeInTheDocument();
    });
  });

  it("shows platform badges when metadata includes platform", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
      expect(screen.getByText("Salesforce")).toBeInTheDocument();
    });
  });

  it("shows relative time with full date tooltip", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText("1h ago")).toBeInTheDocument();
      expect(screen.getByText("1d ago")).toBeInTheDocument();
      expect(screen.getByText("2d ago")).toBeInTheDocument();
    });
  });

  it("shows pagination when total exceeds page size", async () => {
    mockFetchWithAuth.mockResolvedValue(
      mockApiResponse(MOCK_ENTRIES, 75) // 75 total = 3 pages
    );
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText("75 total entries")).toBeInTheDocument();
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });
  });

  it("hides pagination when total fits in one page", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.queryByText("total entries")).not.toBeInTheDocument();
    });
  });

  it("navigates pages via next/prev buttons", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 75));
    render(<ActivityLog />);

    await waitFor(() => {
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    // Click next
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 75, 2));
    const nextBtn = screen.getByText("1 / 3").parentElement!.querySelectorAll("button")[1];
    fireEvent.click(nextBtn);

    await waitFor(() => {
      // Should have fetched page 2
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("page=2")
      );
    });
  });

  it("applies action filter", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);

    await waitFor(() => {
      expect(screen.getByText("Activity Log")).toBeInTheDocument();
    });

    // Change filter
    mockFetchWithAuth.mockResolvedValue(mockApiResponse([MOCK_ENTRIES[0]], 1));
    const select = screen.getByDisplayValue("All actions");
    fireEvent.change(select, { target: { value: "app_tracked" } });

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("action=app_tracked")
      );
    });
  });

  it("has all expected action labels mapped", () => {
    const expectedActions = [
      "app_tracked", "app_untracked",
      "keyword_tracked", "keyword_untracked",
      "competitor_added", "competitor_removed",
      "member_invited", "member_removed",
      "invitation_accepted", "invitation_cancelled", "invitation_resent",
      "platform_enabled", "platform_disabled",
      "account_updated",
      "password_reset",
    ];
    for (const action of expectedActions) {
      expect(ACTION_LABELS[action]).toBeDefined();
      expect(typeof ACTION_LABELS[action]).toBe("string");
    }
  });
});
