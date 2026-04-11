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

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
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

  it("shows details from metadata with contextual descriptions", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      // App slug shown as link
      const slackLink = screen.getByRole("link", { name: "slack" });
      expect(slackLink).toBeInTheDocument();
      expect(slackLink).toHaveAttribute("href", "/shopify/apps/slack");
      // Member email shown in bold
      expect(screen.getByText("jane@test.com")).toBeInTheDocument();
      // Platform shown as display name
      expect(screen.getAllByText("Salesforce").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows platform badges when metadata includes platform", async () => {
    mockFetchWithAuth.mockResolvedValue(mockApiResponse(MOCK_ENTRIES, 3));
    render(<ActivityLog />);
    await waitFor(() => {
      // Shopify appears in platform badge column
      expect(screen.getByText("Shopify")).toBeInTheDocument();
      // Salesforce appears in both details (display name) and platform badge
      expect(screen.getAllByText("Salesforce").length).toBeGreaterThanOrEqual(1);
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

  it("shows member_role_changed with old and new roles", async () => {
    const roleEntry = {
      id: 10,
      action: "member_role_changed",
      entityType: "user",
      entityId: "u2",
      metadata: { email: "bob@test.com", oldRole: "viewer", newRole: "editor" },
      createdAt: new Date().toISOString(),
      user: { id: "u1", name: "Admin", email: "admin@test.com" },
    };
    mockFetchWithAuth.mockResolvedValue(mockApiResponse([roleEntry], 1));
    render(<ActivityLog />);
    await waitFor(() => {
      // Badge + filter option both say "Changed member role"
      expect(screen.getAllByText("Changed member role").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("bob@test.com")).toBeInTheDocument();
      expect(screen.getByText(/viewer/)).toBeInTheDocument();
      expect(screen.getByText(/editor/)).toBeInTheDocument();
    });
  });

  it("shows competitor details with links to both apps", async () => {
    const compEntry = {
      id: 11,
      action: "competitor_added",
      entityType: "competitor",
      entityId: "rival-app",
      metadata: { competitorSlug: "rival-app", trackedAppSlug: "my-app", platform: "shopify" },
      createdAt: new Date().toISOString(),
      user: { id: "u1", name: "Test", email: "test@test.com" },
    };
    mockFetchWithAuth.mockResolvedValue(mockApiResponse([compEntry], 1));
    render(<ActivityLog />);
    await waitFor(() => {
      const rivalLink = screen.getByRole("link", { name: "rival-app" });
      expect(rivalLink).toHaveAttribute("href", "/shopify/apps/rival-app");
      const myAppLink = screen.getByRole("link", { name: "my-app" });
      expect(myAppLink).toHaveAttribute("href", "/shopify/apps/my-app");
    });
  });

  it("shows keyword with app context", async () => {
    const kwEntry = {
      id: 12,
      action: "keyword_tracked",
      entityType: "keyword",
      entityId: "kw-1",
      metadata: { keyword: "email marketing", appSlug: "mailchimp", platform: "shopify" },
      createdAt: new Date().toISOString(),
      user: { id: "u1", name: "Test", email: "test@test.com" },
    };
    mockFetchWithAuth.mockResolvedValue(mockApiResponse([kwEntry], 1));
    render(<ActivityLog />);
    await waitFor(() => {
      expect(screen.getByText(/email marketing/)).toBeInTheDocument();
      const appLink = screen.getByRole("link", { name: "mailchimp" });
      expect(appLink).toHaveAttribute("href", "/shopify/apps/mailchimp");
    });
  });

  it("has all expected action labels mapped", () => {
    const expectedActions = [
      "app_tracked", "app_untracked",
      "keyword_tracked", "keyword_untracked",
      "competitor_added", "competitor_removed",
      "member_invited", "member_removed", "member_role_changed",
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
