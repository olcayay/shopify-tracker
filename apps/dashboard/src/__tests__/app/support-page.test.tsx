import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import SupportPage from "@/app/(dashboard)/support/page";

describe("SupportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows generic empty state when 'all' tab has no tickets", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], nextCursor: null }),
    });

    render(<SupportPage />);

    await waitFor(() => {
      expect(screen.getByText("No tickets yet")).toBeInTheDocument();
    });
    expect(screen.getByText("Create a new ticket to get help from our team.")).toBeInTheDocument();
    expect(screen.getByText("Create Ticket")).toBeInTheDocument();
  });

  it("shows tab-specific empty state when a filtered tab has no tickets", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], nextCursor: null }),
    });

    render(<SupportPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalled();
    });

    // Click on "Closed" tab
    const closedTab = screen.getByText("Closed");
    await userEvent.click(closedTab);

    await waitFor(() => {
      expect(screen.getByText("No closed tickets")).toBeInTheDocument();
    });
    expect(screen.getByText("There are no tickets with this status.")).toBeInTheDocument();
    // Should NOT show the "Create Ticket" button
    expect(screen.queryByText("Create Ticket")).not.toBeInTheDocument();
  });

  it("shows correct empty message for each status tab", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], nextCursor: null }),
    });

    render(<SupportPage />);

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalled();
    });

    const tabTests = [
      { tab: "Open", expected: "No open tickets" },
      { tab: "Awaiting Reply", expected: "No awaiting reply tickets" },
      { tab: "In Progress", expected: "No in progress tickets" },
      { tab: "Resolved", expected: "No resolved tickets" },
      { tab: "Closed", expected: "No closed tickets" },
    ];

    for (const { tab, expected } of tabTests) {
      await userEvent.click(screen.getByText(tab));
      await waitFor(() => {
        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    }
  });
});
