import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockPathname = vi.fn(() => "/shopify");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname(),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

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
    account: {
      id: "a1",
      name: "Test Account",
      isSuspended: false,
      enabledPlatforms: ["shopify"],
      enabledFeatures: ["platform-shopify", "notifications"],
    },
    logout: vi.fn(),
    fetchWithAuth: vi.fn(),
  }),
}));

vi.mock("@/components/top-bar", () => ({
  TopBar: () => <div data-testid="top-bar">TopBar</div>,
}));

vi.mock("@/components/icon-sidebar", () => ({
  IconSidebar: () => <div data-testid="icon-sidebar">IconSidebar</div>,
}));

vi.mock("@/components/sidebar", () => ({
  MobileSidebar: () => <button data-testid="mobile-sidebar">Menu</button>,
}));

vi.mock("@/components/platform-discovery-sheet", () => ({
  PlatformDiscoverySheet: () => null,
}));

vi.mock("@/components/platform-switcher", () => ({
  PlatformSwitcher: () => null,
}));

vi.mock("@/components/dashboard-footer", () => ({
  DashboardFooter: () => null,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme</div>,
}));

vi.mock("@/components/animated-logo", () => ({
  AnimatedLogo: () => <span data-testid="logo">Logo</span>,
}));

vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell">Bell</div>,
}));

vi.mock("@/hooks/use-navigation-loading", () => ({
  useNavigationLoading: () => false,
}));

import { DashboardShell } from "@/components/dashboard-shell";

describe("DashboardShell mobile header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/shopify");
  });

  it("renders mobile header with search button", () => {
    render(<DashboardShell>Content</DashboardShell>);
    const searchBtn = screen.getByLabelText("Search apps");
    expect(searchBtn).toBeInTheDocument();
  });

  it("renders mobile header with theme toggle", () => {
    render(<DashboardShell>Content</DashboardShell>);
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("shows platform indicator on platform pages", () => {
    render(<DashboardShell>Content</DashboardShell>);
    expect(screen.getByText("Shopify")).toBeInTheDocument();
  });

  it("does not show platform indicator on non-platform pages", () => {
    mockPathname.mockReturnValue("/overview");
    render(<DashboardShell>Content</DashboardShell>);
    expect(screen.queryByText("Shopify")).not.toBeInTheDocument();
  });

  it("renders notification bell on mobile", () => {
    render(<DashboardShell>Content</DashboardShell>);
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("renders mobile sidebar menu button", () => {
    render(<DashboardShell>Content</DashboardShell>);
    expect(screen.getByTestId("mobile-sidebar")).toBeInTheDocument();
  });

  it("dispatches Cmd+K event when search button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const dispatchSpy = vi.spyOn(document, "dispatchEvent");

    render(<DashboardShell>Content</DashboardShell>);
    const searchBtn = screen.getByLabelText("Search apps");
    await user.click(searchBtn);

    const cmdKEvent = dispatchSpy.mock.calls.find(
      (call) => call[0] instanceof KeyboardEvent && (call[0] as KeyboardEvent).key === "k"
    );
    expect(cmdKEvent).toBeTruthy();
    dispatchSpy.mockRestore();
  });
});
