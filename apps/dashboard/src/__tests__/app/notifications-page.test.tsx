import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();

const mockUseAuth = vi.fn(() => ({
  user: { id: "u1", name: "Test User", email: "test@example.com", role: "owner", isSystemAdmin: false },
  account: { id: "acc-1", name: "My Account" },
  isLoading: false,
  fetchWithAuth: mockFetchWithAuth,
  refreshUser: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

import React from "react";
import NotificationsPage from "@/app/(dashboard)/notifications/page";

const makeNotification = (overrides: Partial<{
  id: string;
  type: string;
  category: string;
  title: string;
  body: string | null;
  url: string | null;
  icon: string | null;
  priority: string;
  isRead: boolean;
  createdAt: string;
}> = {}) => ({
  id: "n1",
  type: "ranking_change",
  category: "ranking",
  title: "App ranked #1",
  body: "Your app moved up in rankings",
  url: "/apps/my-app",
  icon: null,
  priority: "normal",
  isRead: false,
  createdAt: new Date(Date.now() - 30 * 60000).toISOString(), // 30 min ago
  ...overrides,
});

const mockNotifications = [
  makeNotification({ id: "n1", title: "App ranked #1", priority: "urgent", category: "ranking", isRead: false }),
  makeNotification({ id: "n2", title: "New competitor detected", priority: "high", category: "competitor", isRead: false }),
  makeNotification({ id: "n3", title: "New review posted", priority: "normal", category: "review", isRead: true, body: "A user left a 5-star review" }),
  makeNotification({ id: "n4", title: "Keyword alert", priority: "low", category: "keyword", isRead: true, body: null }),
];

function mockApiSuccess(notifications = mockNotifications, hasMore = false) {
  mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
    if (typeof url === "string" && url.startsWith("/api/notifications") && !options?.method) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          notifications,
          hasMore,
          nextCursor: hasMore ? "cursor-abc" : null,
        }),
      });
    }
    // POST endpoints (mark read, archive, etc.)
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function mockApiEmpty() {
  mockFetchWithAuth.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ notifications: [], hasMore: false, nextCursor: null }),
    })
  );
}

function mockApiError() {
  mockFetchWithAuth.mockImplementation(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "Server error" }) })
  );
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", name: "Test User", email: "test@example.com", role: "owner", isSystemAdmin: false },
      account: { id: "acc-1", name: "My Account" },
      isLoading: false,
      fetchWithAuth: mockFetchWithAuth,
      refreshUser: vi.fn(),
    });
  });

  it("renders page title and description", async () => {
    mockApiSuccess();
    render(<NotificationsPage />);
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText(/Stay updated on ranking changes/)).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    // Never resolve the fetch so we stay in loading
    mockFetchWithAuth.mockImplementation(() => new Promise(() => {}));
    render(<NotificationsPage />);
    // The Loader2 spinner is rendered as an SVG with animate-spin class
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    mockApiEmpty();
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("No notifications to show")).toBeInTheDocument();
    });
  });

  it("renders notifications list with correct data", async () => {
    mockApiSuccess();
    render(<NotificationsPage />);
    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });
    expect(screen.getByText("New competitor detected")).toBeInTheDocument();
    expect(screen.getByText("New review posted")).toBeInTheDocument();
    expect(screen.getByText("Keyword alert")).toBeInTheDocument();
    // Body text
    expect(screen.getByText("A user left a 5-star review")).toBeInTheDocument();
  });

  it("renders category filter chips", async () => {
    mockApiSuccess();
    render(<NotificationsPage />);
    const categories = ["All", "Ranking", "Competitor", "Review", "Keyword", "Featured", "System", "Account"];
    for (const cat of categories) {
      expect(screen.getByText(cat)).toBeInTheDocument();
    }
    expect(screen.getByText("Unread only")).toBeInTheDocument();
  });

  it("filters by category when chip is clicked", async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    mockFetchWithAuth.mockClear();
    mockApiSuccess();

    await act(async () => {
      await user.click(screen.getByText("Ranking"));
    });

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("category=ranking")
      );
    });
  });

  it("toggles unread only filter", async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    mockFetchWithAuth.mockClear();
    mockApiSuccess();

    await act(async () => {
      await user.click(screen.getByText("Unread only"));
    });

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("unreadOnly=true")
      );
    });
  });

  it("mark as read button calls API and updates UI", async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    // Find the "Mark as read" buttons (unread notifications have them)
    const markReadButtons = screen.getAllByTitle("Mark as read");
    expect(markReadButtons.length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(markReadButtons[0]);
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/notifications/n1/read",
      { method: "POST" }
    );
  });

  it("mark all as read calls API and updates all notifications", async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    await act(async () => {
      await user.click(screen.getByText("Mark all read"));
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/notifications/read-all",
      { method: "POST" }
    );

    // After marking all read, no "Mark as read" buttons should remain
    await waitFor(() => {
      expect(screen.queryAllByTitle("Mark as read")).toHaveLength(0);
    });
  });

  it("archive notification calls API and removes from list", async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    const archiveButtons = screen.getAllByTitle("Archive");
    expect(archiveButtons.length).toBe(4);

    await act(async () => {
      await user.click(archiveButtons[0]);
    });

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/notifications/n1/archive",
      { method: "POST" }
    );

    // Notification should be removed
    await waitFor(() => {
      expect(screen.queryByText("App ranked #1")).not.toBeInTheDocument();
    });
    // Others remain
    expect(screen.getByText("New competitor detected")).toBeInTheDocument();
  });

  it("shows load more button when hasMore is true", async () => {
    mockApiSuccess(mockNotifications, true);
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });
  });

  it("does not show load more button when hasMore is false", async () => {
    mockApiSuccess(mockNotifications, false);
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });

  it("load more fetches additional notifications", async () => {
    mockApiSuccess(mockNotifications, true);
    const user = userEvent.setup();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Load more")).toBeInTheDocument();
    });

    mockFetchWithAuth.mockClear();
    mockApiSuccess([
      makeNotification({ id: "n5", title: "Extra notification" }),
    ], false);

    await act(async () => {
      await user.click(screen.getByText("Load more"));
    });

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("cursor=cursor-abc")
      );
    });
  });

  it("handles API failure gracefully (empty list on error)", async () => {
    mockApiError();
    render(<NotificationsPage />);

    // On fetch failure, loading finishes and list stays empty
    await waitFor(() => {
      expect(screen.queryByText("App ranked #1")).not.toBeInTheDocument();
    });
    // The page still renders (no crash)
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("renders correct priority colors", async () => {
    mockApiSuccess();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    // Each notification row has a priority dot
    const priorityDots = document.querySelectorAll(".rounded-full");
    const classes = Array.from(priorityDots).map((el) => el.className);

    // urgent = bg-red-500, high = bg-orange-500, normal = bg-blue-500, low = bg-gray-400
    expect(classes.some((c) => c.includes("bg-red-500"))).toBe(true);
    expect(classes.some((c) => c.includes("bg-orange-500"))).toBe(true);
    expect(classes.some((c) => c.includes("bg-blue-500"))).toBe(true);
    expect(classes.some((c) => c.includes("bg-gray-400"))).toBe(true);
  });

  it("clicking a notification navigates to its URL and marks as read", async () => {
    mockApiSuccess();
    const user = userEvent.setup();
    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    // Click the notification body area
    await act(async () => {
      await user.click(screen.getByText("App ranked #1"));
    });

    // Should call mark as read (since n1 is unread)
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/notifications/n1/read",
      { method: "POST" }
    );

    // Should navigate
    expect(window.location.href).toBe("/apps/my-app");

    // Restore
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("renders category badges on each notification", async () => {
    mockApiSuccess();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    // Category labels in the notification items
    expect(screen.getByText("ranking")).toBeInTheDocument();
    expect(screen.getByText("competitor")).toBeInTheDocument();
    expect(screen.getByText("review")).toBeInTheDocument();
    expect(screen.getByText("keyword")).toBeInTheDocument();
  });

  it("unread notifications have visual distinction", async () => {
    mockApiSuccess();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    // Unread notification titles have font-semibold
    const unreadTitle = screen.getByText("App ranked #1");
    expect(unreadTitle.className).toContain("font-semibold");

    // Read notification titles do not
    const readTitle = screen.getByText("Keyword alert");
    expect(readTitle.className).not.toContain("font-semibold");
  });

  it("mark as read button only shows on unread notifications", async () => {
    mockApiSuccess();
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("App ranked #1")).toBeInTheDocument();
    });

    // n1 and n2 are unread, n3 and n4 are read
    const markReadButtons = screen.getAllByTitle("Mark as read");
    expect(markReadButtons).toHaveLength(2);
  });
});
