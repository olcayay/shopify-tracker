import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SidebarTrackedApps } from "@/components/sidebar-tracked-apps";

const mockFetchWithAuth = vi.fn();
let mockPathname = "/shopify/apps";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    account: { usage: { trackedApps: 3 } },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/components/app-icon", () => ({
  AppIcon: ({ alt }: any) => <span data-testid={`icon-${alt}`} />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <span data-testid="tooltip">{children}</span>,
}));

vi.mock("@/lib/platform-display", () => ({
  PLATFORM_COLORS: { shopify: "#95BF47", canva: "#00C4CC" },
}));

const apps = [
  { platform: "shopify", slug: "app-one", name: "App One", iconUrl: "/icon1.png" },
  { platform: "shopify", slug: "app-two", name: "App Two", iconUrl: "/icon2.png" },
  { platform: "shopify", slug: "app-three", name: "App Three", iconUrl: null },
  { platform: "canva", slug: "canva-app", name: "Canva App", iconUrl: "/canva.png" },
];

function mockFetch(data: any[]) {
  mockFetchWithAuth.mockImplementation(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  );
}

async function renderAndWait(ui: React.ReactElement) {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(ui);
  });
  return result!;
}

describe("SidebarTrackedApps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/shopify/apps";
    mockFetch(apps);
  });

  it("renders tracked apps for the given platform (expanded)", async () => {
    await renderAndWait(<SidebarTrackedApps platform="shopify" collapsed={false} />);
    expect(screen.getByText("App One")).toBeInTheDocument();
    expect(screen.getByText("App Two")).toBeInTheDocument();
    expect(screen.getByText("App Three")).toBeInTheDocument();
    expect(screen.queryByText("Canva App")).not.toBeInTheDocument();
  });

  it("renders nothing when no tracked apps for platform", async () => {
    mockFetch([]);
    const { container } = await renderAndWait(
      <SidebarTrackedApps platform="shopify" collapsed={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders app links with correct href", async () => {
    await renderAndWait(<SidebarTrackedApps platform="shopify" collapsed={false} />);
    const link = screen.getByText("App One").closest("a");
    expect(link).toHaveAttribute("href", "/shopify/apps/app-one");
  });

  it("highlights active app based on current pathname", async () => {
    mockPathname = "/shopify/apps/app-two/keywords";
    await renderAndWait(<SidebarTrackedApps platform="shopify" collapsed={false} />);
    const activeLink = screen.getByText("App Two").closest("a");
    expect(activeLink?.className).toContain("font-medium");
  });

  it("shows overflow link when more than 6 apps (expanded)", async () => {
    const manyApps = Array.from({ length: 8 }, (_, i) => ({
      platform: "shopify",
      slug: `app-${i}`,
      name: `App ${i}`,
      iconUrl: null,
    }));
    mockFetch(manyApps);
    await renderAndWait(<SidebarTrackedApps platform="shopify" collapsed={false} />);
    expect(screen.getByText("App 0")).toBeInTheDocument();
    expect(screen.getByText(/Show all/)).toBeInTheDocument();
    expect(screen.queryByText("App 7")).not.toBeInTheDocument();
  });

  it("renders icons in collapsed mode", async () => {
    await renderAndWait(<SidebarTrackedApps platform="shopify" collapsed />);
    expect(screen.getByTestId("icon-App One")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it("shows +N overflow chip in collapsed mode when over 5 apps", async () => {
    const manyApps = Array.from({ length: 7 }, (_, i) => ({
      platform: "shopify",
      slug: `app-${i}`,
      name: `App ${i}`,
      iconUrl: null,
    }));
    mockFetch(manyApps);
    await renderAndWait(<SidebarTrackedApps platform="shopify" collapsed />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("fetches from /api/account/tracked-apps/sidebar", async () => {
    await renderAndWait(<SidebarTrackedApps platform="shopify" collapsed={false} />);
    expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/account/tracked-apps/sidebar");
  });
});
