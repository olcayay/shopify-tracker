import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

import React from "react";
import { PlatformRequestDialog } from "@/components/platform-request-dialog";

describe("PlatformRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<PlatformRequestDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Request a Platform")).not.toBeInTheDocument();
  });

  it("renders form when open", () => {
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Request a Platform")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Monday.com/)).toBeInTheDocument();
  });

  it("shows submit button disabled when platform name is empty", () => {
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    const submitBtn = screen.getByText("Submit Request");
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when platform name is filled", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Monday.com/), "Stripe");
    const submitBtn = screen.getByText("Submit Request");
    expect(submitBtn).not.toBeDisabled();
  });

  it("submits request and shows success", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "ok", id: "1" }),
    });
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Monday.com/), "Stripe");
    await user.click(screen.getByText("Submit Request"));
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/platform-requests",
      expect.objectContaining({ method: "POST" })
    );
    // Should show success
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
  });
});
