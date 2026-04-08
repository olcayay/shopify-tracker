import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
  opened: 200,
  clicked: 50,
  sent24h: 25,
  sent7d: 150,
  openRate: 50,
  clickRate: 12.5,
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
      expect(screen.getByText("25")).toBeInTheDocument();
    });
  });

  it("clicking a stat card applies the corresponding filter", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("400")).toBeInTheDocument());

    // Click the "Total Sent" card
    const sentCard = screen.getByTestId("card-sent");
    fireEvent.click(sentCard);

    // Should have ring class indicating active state
    await waitFor(() => {
      expect(sentCard).toHaveClass("ring-2");
    });

    // The next fetch should include status=sent
    await waitFor(() => {
      const emailsCalls = mockFetchWithAuth.mock.calls.filter(
        (c: string[]) => c[0].includes("/api/system-admin/emails?")
      );
      const lastCall = emailsCalls[emailsCalls.length - 1][0];
      expect(lastCall).toContain("status=sent");
    });
  });

  it("clicking the Failed card filters by status=failed", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("10")).toBeInTheDocument());

    const failedCard = screen.getByTestId("card-failed");
    fireEvent.click(failedCard);

    await waitFor(() => {
      expect(failedCard).toHaveClass("ring-2");
      const emailsCalls = mockFetchWithAuth.mock.calls.filter(
        (c: string[]) => c[0].includes("/api/system-admin/emails?")
      );
      const lastCall = emailsCalls[emailsCalls.length - 1][0];
      expect(lastCall).toContain("status=failed");
    });
  });

  it("clicking the Opened card filters by opened=true", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());

    const openedCard = screen.getByTestId("card-opened");
    fireEvent.click(openedCard);

    await waitFor(() => {
      expect(openedCard).toHaveClass("ring-2");
      const emailsCalls = mockFetchWithAuth.mock.calls.filter(
        (c: string[]) => c[0].includes("/api/system-admin/emails?")
      );
      const lastCall = emailsCalls[emailsCalls.length - 1][0];
      expect(lastCall).toContain("opened=true");
    });
  });

  it("clicking the Clicked card filters by clicked=true", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("12.5%")).toBeInTheDocument());

    const clickedCard = screen.getByTestId("card-clicked");
    fireEvent.click(clickedCard);

    await waitFor(() => {
      expect(clickedCard).toHaveClass("ring-2");
      const emailsCalls = mockFetchWithAuth.mock.calls.filter(
        (c: string[]) => c[0].includes("/api/system-admin/emails?")
      );
      const lastCall = emailsCalls[emailsCalls.length - 1][0];
      expect(lastCall).toContain("clicked=true");
    });
  });

  it("clicking the Last 24h card filters by sent24h=true", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("25")).toBeInTheDocument());

    const sent24hCard = screen.getByTestId("card-sent24h");
    fireEvent.click(sent24hCard);

    await waitFor(() => {
      expect(sent24hCard).toHaveClass("ring-2");
      const emailsCalls = mockFetchWithAuth.mock.calls.filter(
        (c: string[]) => c[0].includes("/api/system-admin/emails?")
      );
      const lastCall = emailsCalls[emailsCalls.length - 1][0];
      expect(lastCall).toContain("sent24h=true");
      expect(lastCall).toContain("status=sent");
    });
  });

  it("clicking the same card again clears the filter (toggle)", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("400")).toBeInTheDocument());

    const sentCard = screen.getByTestId("card-sent");

    // Click to activate
    fireEvent.click(sentCard);
    await waitFor(() => expect(sentCard).toHaveClass("ring-2"));

    // Click again to deactivate
    fireEvent.click(sentCard);
    await waitFor(() => expect(sentCard).not.toHaveClass("ring-2"));
  });

  it("only one card can be active at a time", async () => {
    render(<AdminEmailDashboard />);
    await waitFor(() => expect(screen.getByText("400")).toBeInTheDocument());

    const sentCard = screen.getByTestId("card-sent");
    const failedCard = screen.getByTestId("card-failed");

    // Click sent
    fireEvent.click(sentCard);
    await waitFor(() => expect(sentCard).toHaveClass("ring-2"));

    // Click failed — sent should lose ring
    fireEvent.click(failedCard);
    await waitFor(() => {
      expect(failedCard).toHaveClass("ring-2");
      expect(sentCard).not.toHaveClass("ring-2");
    });
  });
});
