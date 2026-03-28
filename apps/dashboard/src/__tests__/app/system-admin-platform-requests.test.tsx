import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      name: "Admin User",
      email: "admin@example.com",
      role: "owner",
      isSystemAdmin: true,
      emailDigestEnabled: true,
      timezone: "UTC",
    },
    account: {
      id: "acc-1",
      name: "Admin Account",
      company: "Test Co",
      isSuspended: false,
      package: { slug: "pro", name: "Pro" },
      packageLimits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5, maxResearchProjects: 3, maxPlatforms: 5 },
      limits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5, maxResearchProjects: 3, maxPlatforms: 5 },
      usage: { trackedApps: 3, trackedKeywords: 10, competitorApps: 5, starredFeatures: 2, users: 2, researchProjects: 1, platforms: 2 },
      enabledPlatforms: ["shopify"],
    },
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
  }),
}));

import PlatformRequestsPage from "@/app/(dashboard)/system-admin/platform-requests/page";

const mockRequests = [
  {
    id: "req-1",
    platformName: "Monday.com",
    marketplaceUrl: "https://monday.com/marketplace",
    notes: "Need this for project management tracking",
    status: "pending",
    createdAt: "2026-03-20T10:00:00Z",
    accountName: "Acme Corp",
    userName: "John Doe",
    userEmail: "john@acme.com",
  },
  {
    id: "req-2",
    platformName: "Freshdesk",
    marketplaceUrl: null,
    notes: null,
    status: "approved",
    createdAt: "2026-03-18T08:00:00Z",
    accountName: "Beta Inc",
    userName: "Jane Smith",
    userEmail: "jane@beta.com",
  },
  {
    id: "req-3",
    platformName: "Pipedrive",
    marketplaceUrl: "https://pipedrive.com/marketplace",
    notes: "CRM marketplace",
    status: "rejected",
    createdAt: "2026-03-15T12:00:00Z",
    accountName: "Gamma LLC",
    userName: "Bob Wilson",
    userEmail: "bob@gamma.com",
  },
];

describe("PlatformRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRequests),
    });
  });

  it("renders page title", async () => {
    render(<PlatformRequestsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Platform Requests");
  });

  it("loads and displays platform requests", async () => {
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
      expect(screen.getByText("Freshdesk")).toBeInTheDocument();
      expect(screen.getByText("Pipedrive")).toBeInTheDocument();
    });
  });

  it("displays account and user info", async () => {
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("john@acme.com")).toBeInTheDocument();
    });
  });

  it("displays status badges", async () => {
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument();
      expect(screen.getByText("approved")).toBeInTheDocument();
      expect(screen.getByText("rejected")).toBeInTheDocument();
    });
  });

  it("filters by search text", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search platform, account, user...");
    await user.type(searchInput, "Monday");

    expect(screen.getByText("Monday.com")).toBeInTheDocument();
    expect(screen.queryByText("Freshdesk")).not.toBeInTheDocument();
    expect(screen.queryByText("Pipedrive")).not.toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
    });

    // Click "Pending" filter button
    const pendingBtn = screen.getByRole("button", { name: /Pending/ });
    await user.click(pendingBtn);

    expect(screen.getByText("Monday.com")).toBeInTheDocument();
    expect(screen.queryByText("Freshdesk")).not.toBeInTheDocument();
    expect(screen.queryByText("Pipedrive")).not.toBeInTheDocument();
  });

  it("shows approve and reject buttons for pending requests", async () => {
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
    });

    // Pending request should have approve/reject buttons
    const approveBtn = screen.getByTitle("Approve");
    const rejectBtn = screen.getByTitle("Reject");
    expect(approveBtn).toBeInTheDocument();
    expect(rejectBtn).toBeInTheDocument();
  });

  it("shows revert button for approved/rejected requests", async () => {
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Freshdesk")).toBeInTheDocument();
    });

    const revertBtns = screen.getAllByTitle("Revert to pending");
    // 2 revert buttons: one for approved (Freshdesk), one for rejected (Pipedrive)
    expect(revertBtns.length).toBe(2);
  });

  it("calls PATCH when approve is clicked", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockRequests) }) // initial load
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "req-1", status: "approved" }) }) // PATCH
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockRequests) }); // reload

    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
    });

    const approveBtn = screen.getByTitle("Approve");
    await user.click(approveBtn);

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/system-admin/platform-requests/req-1",
        { method: "PATCH", body: JSON.stringify({ status: "approved" }) }
      );
    });
  });

  it("displays marketplace URL as a link", async () => {
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
    });

    const links = screen.getAllByText("Link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    const link = links[0].closest("a");
    expect(link).toHaveAttribute("href", "https://monday.com/marketplace");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows empty state when no requests match", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search platform, account, user...");
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("No platform requests found")).toBeInTheDocument();
  });

  it("shows status counts in filter buttons", async () => {
    render(<PlatformRequestsPage />);
    await waitFor(() => {
      expect(screen.getByText("Monday.com")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /All.*\(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pending.*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approved.*\(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rejected.*\(1\)/ })).toBeInTheDocument();
  });
});
