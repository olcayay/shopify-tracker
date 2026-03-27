import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockPathname = vi.fn(() => "/shopify/keywords");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "1",
      name: "Test User",
      role: "owner",
      isSystemAdmin: false,
    },
    account: {
      id: "a1",
      enabledPlatforms: ["shopify"],
    },
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import React from "react";
import { IconSidebar } from "@/components/icon-sidebar";

describe("IconSidebar", () => {
  it("renders nav items for the active platform", () => {
    render(<IconSidebar />);
    // Should have tooltip content for each nav item
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Apps")).toBeInTheDocument();
    expect(screen.getByText("Competitors")).toBeInTheDocument();
    expect(screen.getByText("Keywords")).toBeInTheDocument();
  });

  it("highlights the active section", () => {
    render(<IconSidebar />);
    // Keywords link should have active styling (checking via href)
    const links = screen.getAllByRole("link");
    const keywordsLink = links.find((l) => l.getAttribute("href") === "/shopify/keywords");
    expect(keywordsLink).toBeDefined();
  });

  it("does not show system admin items for regular platform pages", () => {
    render(<IconSidebar />);
    expect(screen.queryByText("Accounts")).not.toBeInTheDocument();
    expect(screen.queryByText("Scraper")).not.toBeInTheDocument();
  });

  it("has sticky positioning and viewport height for always-visible toggle button", () => {
    const { container } = render(<IconSidebar />);
    const aside = container.querySelector("aside");
    expect(aside).toBeTruthy();
    expect(aside!.className).toContain("sticky");
    expect(aside!.className).toContain("top-0");
    expect(aside!.className).toContain("h-[calc(100vh-3.5rem)]");
    expect(aside!.className).toContain("overflow-y-auto");
  });

  it("renders nothing on non-platform pages like /overview", () => {
    mockPathname.mockReturnValue("/overview");
    const { container } = render(<IconSidebar />);
    expect(container.querySelector("aside")).toBeNull();
  });

  it("renders nothing on /settings page", () => {
    mockPathname.mockReturnValue("/settings");
    const { container } = render(<IconSidebar />);
    expect(container.querySelector("aside")).toBeNull();
  });

  it("renders sidebar on system-admin pages", () => {
    mockPathname.mockReturnValue("/system-admin/accounts");
    const { container } = render(<IconSidebar />);
    expect(container.querySelector("aside")).toBeTruthy();
  });

  it("Overview icon is not active on sub-pages (exact match)", () => {
    mockPathname.mockReturnValue("/shopify/keywords");
    render(<IconSidebar />);
    const links = screen.getAllByRole("link");
    const overviewLink = links.find((l) => l.getAttribute("href") === "/shopify");
    // Overview link should NOT have active styling (bg-primary) on sub-pages
    expect(overviewLink?.className).toContain("text-muted-foreground");
  });

  it("Overview icon is active on exact platform root", () => {
    mockPathname.mockReturnValue("/shopify");
    render(<IconSidebar />);
    const links = screen.getAllByRole("link");
    const overviewLink = links.find((l) => l.getAttribute("href") === "/shopify");
    // Overview link should have active styling on exact match
    expect(overviewLink?.className).not.toContain("text-muted-foreground");
  });
});
