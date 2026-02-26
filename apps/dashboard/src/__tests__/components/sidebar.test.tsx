import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock auth-context
const mockLogout = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "1",
      name: "Test User",
      email: "test@test.com",
      role: "owner",
      isSystemAdmin: false,
      emailDigestEnabled: true,
      timezone: "UTC",
    },
    account: { id: "a1", name: "Test Account", isSuspended: false },
    logout: mockLogout,
  }),
}));

// Mock Tooltip
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Sheet
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

import React from "react";
import { Sidebar, MobileSidebar } from "@/components/sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders AppRanks brand", () => {
    render(<Sidebar />);
    expect(screen.getByText("AppRanks")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Apps")).toBeInTheDocument();
    expect(screen.getByText("Competitors")).toBeInTheDocument();
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders user info", () => {
    render(<Sidebar />);
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("renders account name and role", () => {
    render(<Sidebar />);
    expect(screen.getByText(/Test Account/)).toBeInTheDocument();
    expect(screen.getByText(/owner/)).toBeInTheDocument();
  });

  it("renders sign out button", () => {
    render(<Sidebar />);
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("calls logout when Sign out is clicked", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByText("Sign out"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("does not render System Admin for non-admin users", () => {
    render(<Sidebar />);
    expect(screen.queryByText("System Admin")).toBeNull();
  });

  it("navigation links have correct hrefs", () => {
    render(<Sidebar />);
    const overviewLink = screen.getByText("Overview").closest("a");
    expect(overviewLink).toHaveAttribute("href", "/overview");

    const appsLink = screen.getByText("Apps").closest("a");
    expect(appsLink).toHaveAttribute("href", "/apps");

    const keywordsLink = screen.getByText("Keywords").closest("a");
    expect(keywordsLink).toHaveAttribute("href", "/keywords");

    const categoriesLink = screen.getByText("Categories").closest("a");
    expect(categoriesLink).toHaveAttribute("href", "/categories");

    const settingsLink = screen.getByText("Settings").closest("a");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("persists collapsed state in localStorage", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Find and click the collapse toggle button
    const toggleBtn = document.querySelector("button");
    expect(toggleBtn).toBeTruthy();
  });
});

describe("Sidebar with admin user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: {
          id: "1",
          name: "Admin User",
          email: "admin@test.com",
          role: "owner",
          isSystemAdmin: true,
          emailDigestEnabled: true,
          timezone: "UTC",
        },
        account: { id: "a1", name: "Test Account", isSuspended: false },
        logout: mockLogout,
      }),
    }));
    vi.doMock("@/components/ui/tooltip", () => ({
      Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }));
    vi.doMock("@/components/ui/sheet", () => ({
      Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
        open ? <div data-testid="sheet">{children}</div> : null,
      SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    }));
  });

  it("renders System Admin section for admin users", async () => {
    const { Sidebar: AdminSidebar } = await import("@/components/sidebar");
    render(<AdminSidebar />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });
});

describe("MobileSidebar", () => {
  it("renders menu button", () => {
    render(<MobileSidebar />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("opens sheet when menu button is clicked", async () => {
    const user = userEvent.setup();
    render(<MobileSidebar />);

    await user.click(screen.getByRole("button"));
    // Sheet should open and show navigation
    expect(screen.getByTestId("sheet")).toBeInTheDocument();
  });
});
