import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockStopImpersonation = vi.fn();

const mockImpersonation = {
  isImpersonating: true,
  realAdmin: { userId: "admin-1", email: "admin@test.com", name: "Admin" },
  targetUser: { userId: "user-1", email: "bob@test.com", name: "Bob Jones" },
};

let currentImpersonation: typeof mockImpersonation | null = mockImpersonation;

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    impersonation: currentImpersonation,
    stopImpersonation: mockStopImpersonation,
  }),
}));

import { ImpersonationBanner } from "@/components/impersonation-banner";

describe("ImpersonationBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentImpersonation = mockImpersonation;
  });

  it("renders nothing when not impersonating", () => {
    currentImpersonation = null;
    const { container } = render(<ImpersonationBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when impersonation.isImpersonating is false", () => {
    currentImpersonation = {
      ...mockImpersonation,
      isImpersonating: false,
    };
    const { container } = render(<ImpersonationBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("shows banner with target user name when impersonating", () => {
    render(<ImpersonationBanner />);
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("shows target user email in the banner", () => {
    render(<ImpersonationBanner />);
    expect(screen.getByText(/bob@test\.com/)).toBeInTheDocument();
  });

  it("shows warning text", () => {
    render(<ImpersonationBanner />);
    expect(
      screen.getByText(/You are currently viewing the site as/)
    ).toBeInTheDocument();
  });

  it("shows Stop Impersonating button", () => {
    render(<ImpersonationBanner />);
    expect(
      screen.getByRole("button", { name: /Stop Impersonating/ })
    ).toBeInTheDocument();
  });

  it("calls stopImpersonation when Stop button is clicked", async () => {
    const user = userEvent.setup();
    render(<ImpersonationBanner />);
    await user.click(
      screen.getByRole("button", { name: /Stop Impersonating/ })
    );
    expect(mockStopImpersonation).toHaveBeenCalledTimes(1);
  });

  it("has amber background styling", () => {
    render(<ImpersonationBanner />);
    const banner = screen.getByText(/You are currently viewing/).closest("div");
    expect(banner?.parentElement?.className).toContain("bg-amber-500");
  });
});
