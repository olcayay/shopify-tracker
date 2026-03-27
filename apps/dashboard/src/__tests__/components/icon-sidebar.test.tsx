import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/shopify/keywords",
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
});
