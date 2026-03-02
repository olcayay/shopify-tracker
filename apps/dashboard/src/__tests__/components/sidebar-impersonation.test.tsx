import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockImpersonation = {
  isImpersonating: true,
  realAdmin: { userId: "admin-1", email: "admin@test.com", name: "Admin" },
  targetUser: { userId: "user-1", email: "bob@test.com", name: "Bob Jones" },
};

let currentImpersonation: typeof mockImpersonation | null = null;

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "admin-1",
      name: "Admin",
      email: "admin@test.com",
      role: "owner",
      isSystemAdmin: true,
      emailDigestEnabled: true,
      timezone: "UTC",
    },
    account: { id: "a1", name: "Test Account", isSuspended: false },
    logout: vi.fn(),
    impersonation: currentImpersonation,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
  }) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

import React from "react";
import { Sidebar } from "@/components/sidebar";

describe("Sidebar — Impersonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    currentImpersonation = null;
  });

  it("does not show impersonation indicator when not impersonating", () => {
    currentImpersonation = null;
    render(<Sidebar />);
    expect(screen.queryByText(/Viewing as/)).not.toBeInTheDocument();
  });

  it("shows impersonation indicator when impersonating", () => {
    currentImpersonation = mockImpersonation;
    render(<Sidebar />);
    expect(screen.getByText(/Viewing as Bob Jones/)).toBeInTheDocument();
  });

  it("system admin nav items remain visible during impersonation", () => {
    currentImpersonation = mockImpersonation;
    render(<Sidebar />);
    // System Admin section should still be visible
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });
});
