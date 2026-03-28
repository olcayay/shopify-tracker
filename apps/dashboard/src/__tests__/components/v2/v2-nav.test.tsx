import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockPush = vi.fn();
const mockReplace = vi.fn();

let mockPathname = "/shopify/apps/v2/test-app";
let mockParams: Record<string, string> = { platform: "shopify", slug: "test-app" };

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

import { V2Nav } from "@/components/v2/v2-nav";

describe("V2Nav", () => {
  beforeEach(() => {
    mockPathname = "/shopify/apps/v2/test-app";
    mockParams = { platform: "shopify", slug: "test-app" };
    vi.clearAllMocks();
  });

  it("renders all 4 nav items for tracked app", () => {
    render(<V2Nav slug="test-app" isTracked={true} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Visibility")).toBeInTheDocument();
    expect(screen.getByText("Market Intel")).toBeInTheDocument();
    expect(screen.getByText("Listing Studio")).toBeInTheDocument();
  });

  it("hides Listing Studio for untracked apps", () => {
    render(<V2Nav slug="test-app" isTracked={false} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Visibility")).toBeInTheDocument();
    expect(screen.getByText("Market Intel")).toBeInTheDocument();
    expect(screen.queryByText("Listing Studio")).not.toBeInTheDocument();
  });

  it("highlights active section", () => {
    mockPathname = "/shopify/apps/v2/test-app/visibility/keywords";
    render(<V2Nav slug="test-app" isTracked={true} />);
    const visLink = screen.getByText("Visibility").closest("a");
    expect(visLink?.className).toContain("border-primary");
  });

  it("opens dropdown on chevron click", () => {
    render(<V2Nav slug="test-app" isTracked={true} />);
    const dropdownBtn = screen.getByLabelText("Visibility sub-pages");
    fireEvent.click(dropdownBtn);
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Rankings")).toBeInTheDocument();
  });

  it("shows platform-conditional sub-items for shopify", () => {
    render(<V2Nav slug="test-app" isTracked={true} />);
    const dropdownBtn = screen.getByLabelText("Visibility sub-pages");
    fireEvent.click(dropdownBtn);
    // Shopify has Featured and Ads
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getByText("Ads")).toBeInTheDocument();
  });

  it("hides Ads pill for canva platform", () => {
    mockParams = { platform: "canva", slug: "test-app" };
    render(<V2Nav slug="test-app" isTracked={true} />);
    const dropdownBtn = screen.getByLabelText("Visibility sub-pages");
    fireEvent.click(dropdownBtn);
    expect(screen.queryByText("Ads")).not.toBeInTheDocument();
  });

  it("closes dropdown on second click", () => {
    render(<V2Nav slug="test-app" isTracked={true} />);
    const dropdownBtn = screen.getByLabelText("Visibility sub-pages");
    fireEvent.click(dropdownBtn);
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    fireEvent.click(dropdownBtn);
    expect(screen.queryByText("Keywords")).not.toBeInTheDocument();
  });
});
