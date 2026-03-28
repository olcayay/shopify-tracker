import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

let mockPathname = "/shopify/apps/v2/test-app/visibility";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import { SubNavPills } from "@/components/v2/sub-nav-pills";

describe("SubNavPills", () => {
  it("renders pill items", () => {
    const items = [
      { label: "Overview", href: "/shopify/apps/v2/test-app/visibility" },
      { label: "Keywords", href: "/shopify/apps/v2/test-app/visibility/keywords" },
      { label: "Rankings", href: "/shopify/apps/v2/test-app/visibility/rankings" },
    ];
    render(<SubNavPills items={items} />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Rankings")).toBeInTheDocument();
  });

  it("highlights active pill", () => {
    mockPathname = "/shopify/apps/v2/test-app/visibility";
    const items = [
      { label: "Overview", href: "/shopify/apps/v2/test-app/visibility" },
      { label: "Keywords", href: "/shopify/apps/v2/test-app/visibility/keywords" },
    ];
    render(<SubNavPills items={items} />);
    const activeLink = screen.getByText("Overview").closest("a");
    expect(activeLink?.className).toContain("bg-primary");
  });

  it("returns null for single item", () => {
    const items = [{ label: "Overview", href: "/test" }];
    const { container } = render(<SubNavPills items={items} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null for empty items", () => {
    const { container } = render(<SubNavPills items={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
