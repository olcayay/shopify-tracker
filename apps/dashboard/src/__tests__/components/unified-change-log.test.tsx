import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnifiedChangeLog, type ChangeEntry } from "@/components/changes/unified-change-log";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

function makeEntry(overrides: Partial<ChangeEntry> = {}): ChangeEntry {
  return {
    appSlug: "test-app",
    appName: "Test App",
    isSelf: false,
    field: "name",
    oldValue: "Old Name",
    newValue: "New Name",
    detectedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("UnifiedChangeLog app links", () => {
  it("renders v1 links when pathname does not contain /v2/", () => {
    mockUsePathname.mockReturnValue("/shopify/apps/v1/my-app/changes");
    render(
      <UnifiedChangeLog
        entries={[makeEntry({ appSlug: "competitor-app", appName: "Competitor" })]}
        platform="shopify"
      />
    );

    const link = screen.getByRole("link", { name: "Competitor" });
    expect(link).toHaveAttribute("href", "/shopify/apps/competitor-app");
  });

  it("renders v2 links when pathname contains /v2/", () => {
    mockUsePathname.mockReturnValue("/shopify/apps/v2/my-app/intel/changes");
    render(
      <UnifiedChangeLog
        entries={[makeEntry({ appSlug: "competitor-app", appName: "Competitor" })]}
        platform="shopify"
      />
    );

    const link = screen.getByRole("link", { name: "Competitor" });
    expect(link).toHaveAttribute("href", "/shopify/apps/v2/competitor-app");
  });

  it("does not include /intel/overview in app links", () => {
    mockUsePathname.mockReturnValue("/shopify/apps/v2/my-app/intel/changes");
    render(
      <UnifiedChangeLog
        entries={[makeEntry({ appSlug: "competitor-app", appName: "Competitor" })]}
        platform="shopify"
      />
    );

    const link = screen.getByRole("link", { name: "Competitor" });
    expect(link.getAttribute("href")).not.toContain("/intel/overview");
  });

  it("defaults platform to shopify when not provided", () => {
    mockUsePathname.mockReturnValue("/shopify/apps/my-app/changes");
    render(
      <UnifiedChangeLog
        entries={[makeEntry({ appSlug: "some-app", appName: "Some App" })]}
      />
    );

    const link = screen.getByRole("link", { name: "Some App" });
    expect(link).toHaveAttribute("href", "/shopify/apps/some-app");
  });

  it("uses correct platform prefix for non-shopify platforms", () => {
    mockUsePathname.mockReturnValue("/salesforce/apps/my-app/changes");
    render(
      <UnifiedChangeLog
        entries={[makeEntry({ appSlug: "sf-app", appName: "SF App" })]}
        platform="salesforce"
      />
    );

    const link = screen.getByRole("link", { name: "SF App" });
    expect(link).toHaveAttribute("href", "/salesforce/apps/sf-app");
  });

  it("renders correct links for self app entries", () => {
    mockUsePathname.mockReturnValue("/shopify/apps/v1/my-app/changes");
    render(
      <UnifiedChangeLog
        entries={[makeEntry({ appSlug: "my-app", appName: "My App", isSelf: true })]}
        platform="shopify"
      />
    );

    const link = screen.getByRole("link", { name: "My App" });
    expect(link).toHaveAttribute("href", "/shopify/apps/my-app");
  });
});
