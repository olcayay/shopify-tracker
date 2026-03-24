import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppBadges, AppBadgeIcon } from "@/components/app-badges";

describe("AppBadges", () => {
  it("renders badges for given badge types on shopify", () => {
    render(
      <AppBadges platform="shopify" badges={["built_for_shopify"]} />
    );
    expect(screen.getByText("Built for Shopify")).toBeInTheDocument();
  });

  it("renders cloud_fortified badge for atlassian", () => {
    render(
      <AppBadges platform="atlassian" badges={["cloud_fortified"]} />
    );
    expect(screen.getByText("Cloud Fortified")).toBeInTheDocument();
  });

  it("renders top_vendor badge for atlassian", () => {
    render(
      <AppBadges platform="atlassian" badges={["top_vendor"]} />
    );
    expect(screen.getByText("Top Vendor")).toBeInTheDocument();
  });

  it("renders multiple badges at once", () => {
    render(
      <AppBadges
        platform="atlassian"
        badges={["cloud_fortified", "top_vendor"]}
      />
    );
    expect(screen.getByText("Cloud Fortified")).toBeInTheDocument();
    expect(screen.getByText("Top Vendor")).toBeInTheDocument();
  });

  it("returns null for empty badges array", () => {
    const { container } = render(
      <AppBadges platform="shopify" badges={[]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when badges prop is undefined and isBuiltForShopify is false", () => {
    const { container } = render(
      <AppBadges platform="shopify" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders tooltip via title attribute", () => {
    render(
      <AppBadges platform="shopify" badges={["built_for_shopify"]} />
    );
    const badge = screen.getByTitle("Built for Shopify");
    expect(badge).toBeInTheDocument();
  });

  it("hides label when showLabel is false (AppBadgeIcon)", () => {
    render(
      <AppBadgeIcon platform="shopify" badges={["built_for_shopify"]} />
    );
    expect(screen.queryByText("Built for Shopify")).not.toBeInTheDocument();
    // The icon should still render
    expect(screen.getByTitle("Built for Shopify")).toBeInTheDocument();
  });

  it("adds built_for_shopify via legacy isBuiltForShopify prop", () => {
    render(
      <AppBadges platform="shopify" isBuiltForShopify={true} />
    );
    expect(screen.getByText("Built for Shopify")).toBeInTheDocument();
  });

  it("ignores unknown badge types gracefully", () => {
    render(
      <AppBadges platform="shopify" badges={["unknown_badge"]} />
    );
    // Should render the wrapper span but no badge content
    expect(screen.queryByText("unknown_badge")).not.toBeInTheDocument();
  });
});
