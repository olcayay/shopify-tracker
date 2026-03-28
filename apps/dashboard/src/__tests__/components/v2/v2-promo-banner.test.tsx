import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ platform: "shopify", slug: "test-app" }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import { V2PromoBanner } from "@/components/v2/v2-promo-banner";

describe("V2PromoBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows banner when not dismissed", async () => {
    render(<V2PromoBanner />);
    // useEffect fires after render
    await act(async () => {});
    expect(screen.getByText("Try the new app detail experience!")).toBeInTheDocument();
  });

  it("links to v2 with correct URL", async () => {
    render(<V2PromoBanner />);
    await act(async () => {});
    const link = screen.getByText("Switch to v2 →");
    expect(link.closest("a")?.getAttribute("href")).toBe("/shopify/apps/v2/test-app");
  });

  it("dismisses on X click and persists", async () => {
    render(<V2PromoBanner />);
    await act(async () => {});
    const dismissBtn = screen.getByLabelText("Dismiss v2 banner");
    fireEvent.click(dismissBtn);
    expect(screen.queryByText("Try the new app detail experience!")).not.toBeInTheDocument();
    expect(localStorage.getItem("v2-banner-dismissed")).toBe("true");
  });

  it("stays hidden when previously dismissed", async () => {
    localStorage.setItem("v2-banner-dismissed", "true");
    render(<V2PromoBanner />);
    await act(async () => {});
    expect(screen.queryByText("Try the new app detail experience!")).not.toBeInTheDocument();
  });
});
