import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shopify/apps/my-app",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ platform: "shopify", slug: "my-app" }),
}));

import { CategoryRankingsCard } from "@/app/(dashboard)/[platform]/apps/[slug]/category-rankings-card";

describe("CategoryRankingsCard", () => {
  it("renders leader icon when iconUrl is provided (camelCase)", () => {
    const categoryInfoMap = new Map([
      [
        "email",
        {
          leaders: [
            { slug: "leader-app", name: "Leader App", iconUrl: "https://example.com/icon.png", position: 1 },
          ],
          appCount: 50,
        },
      ],
    ]);

    render(
      <CategoryRankingsCard
        platform="shopify"
        slug="my-app"
        catChanges={[{ slug: "email", label: "Email", position: 3, delta: 1 }]}
        categoryInfoMap={categoryInfoMap}
      />
    );

    const img = document.querySelector("img[src='https://example.com/icon.png']");
    expect(img).toBeTruthy();
  });

  it("renders placeholder when iconUrl is null", () => {
    const categoryInfoMap = new Map([
      [
        "tools",
        {
          leaders: [
            { slug: "no-icon-app", name: "No Icon", iconUrl: null, position: 2 },
          ],
          appCount: 30,
        },
      ],
    ]);

    render(
      <CategoryRankingsCard
        platform="shopify"
        slug="my-app"
        catChanges={[{ slug: "tools", label: "Tools", position: 5, delta: 0 }]}
        categoryInfoMap={categoryInfoMap}
      />
    );

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("No Icon")).toBeInTheDocument();
  });

  it("renders empty state when no category changes", () => {
    render(
      <CategoryRankingsCard
        platform="shopify"
        slug="my-app"
        catChanges={[]}
        categoryInfoMap={new Map()}
      />
    );

    expect(screen.getByText(/rankings will appear/)).toBeInTheDocument();
  });
});
