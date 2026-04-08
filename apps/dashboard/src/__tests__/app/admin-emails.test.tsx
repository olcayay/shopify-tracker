import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    user: { id: "1", role: "owner", isSystemAdmin: true },
    account: { id: "a1", enabledPlatforms: ["shopify"] },
  }),
}));

import AdminEmailDashboard from "@/app/(dashboard)/system-admin/emails/page";

const mockStats = {
  total: 500,
  sent: 400,
  failed: 10,
  skipped: 15,
  opened: 200,
  clicked: 50,
  sent24h: 25,
  sent7d: 150,
  openRate: 50,
  clickRate: 12.5,
  last24h: {
    total: 30,
    sent: 25,
    failed: 2,
    skipped: 3,
    queued: 0,
    openRate: 40,
  },
};

const mockEmails = {
  emails: [
    {
      id: "e1",
      emailType: "email_daily_digest",
      recipientEmail: "user@test.com",
      subject: "Daily Digest",
      status: "sent",
      sentAt: "2026-04-07T10:00:00Z",
      openedAt: null,
      clickedAt: null,
      createdAt: "2026-04-07T10:00:00Z",
      errorMessage: null,
    },
  ],
  total: 1,
};

function setupFetchMock() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/stats")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockStats) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEmails) });
  });
}

describe("AdminEmailDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock();
  });

  it("renders stat cards with correct values", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => {
      expect(screen.getByText("400")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
      expect(screen.getByText("12.5%")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      // "25" appears in both all-time and 24h sections
      expect(screen.getAllByText("25").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders all six stat card labels", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Total Sent")).toBeInTheDocument();
      // "Open Rate" appears in all-time and 24h sections
      expect(screen.getAllByText("Open Rate").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Click Rate")).toBeInTheDocument();
      // "Failed" appears in stat label, filter option, and 24h section
      expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
      // "Skipped" appears in stat label, filter option, and 24h section
      expect(screen.getAllByText("Skipped").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Last 24h")).toBeInTheDocument();
    });
  });

  it("renders skipped count in stat card", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => {
      expect(screen.getByText("15")).toBeInTheDocument();
    });
  });

  it("renders email table with log entries", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => {
      // "Daily Digest" appears in both filter dropdown and table — use getAllByText
      expect(screen.getAllByText("Daily Digest").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("user@test.com")).toBeInTheDocument();
    });
  });

  it("renders Last 24 Hours section with per-status cards", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Last 24 Hours")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument(); // total 24h
      expect(screen.getByText("40%")).toBeInTheDocument(); // open rate 24h
    });
  });

  it("renders filter controls", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("400")).toBeInTheDocument());

    expect(screen.getByPlaceholderText("Search by recipient...")).toBeInTheDocument();
  });

  it("renders pagination controls", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/1 total/)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
    });
  });

  it("renders refresh button", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("400")).toBeInTheDocument());

    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("renders email queue link", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("400")).toBeInTheDocument());

    expect(screen.getByText("Email Queue")).toBeInTheDocument();
  });

  it("fetches stats and emails on mount", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("400")).toBeInTheDocument());

    const statsCalls = mockFetchWithAuth.mock.calls.filter(
      (c: string[]) => c[0].includes("/stats")
    );
    const emailsCalls = mockFetchWithAuth.mock.calls.filter(
      (c: string[]) => c[0].includes("/api/system-admin/emails?")
    );
    expect(statsCalls.length).toBeGreaterThanOrEqual(1);
    expect(emailsCalls.length).toBeGreaterThanOrEqual(1);
  });
});
