import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/platform-request-dialog", () => ({
  PlatformRequestDialog: () => null,
}));

import React from "react";

function mockFetchWithAuth(apps = 0, keywords = 0, competitors = 0) {
  return vi.fn((url: string) => {
    if (url.startsWith("/api/apps")) return Promise.resolve({ ok: true, json: () => Promise.resolve(Array(apps).fill({})) });
    if (url.startsWith("/api/keywords")) return Promise.resolve({ ok: true, json: () => Promise.resolve(Array(keywords).fill({})) });
    if (url.startsWith("/api/account/competitors")) return Promise.resolve({ ok: true, json: () => Promise.resolve(Array(competitors).fill({})) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

describe("PlatformDiscoverySheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("renders nothing when closed", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify"] },
        fetchWithAuth: mockFetchWithAuth(),
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Your Platforms")).not.toBeInTheDocument();
  });

  it("regular user only sees enabled platforms", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify", "salesforce"] },
        fetchWithAuth: mockFetchWithAuth(),
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Your Platforms")).toBeInTheDocument();
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    // Should NOT show non-enabled platforms
    expect(screen.queryByText("Canva")).not.toBeInTheDocument();
    expect(screen.queryByText("HubSpot")).not.toBeInTheDocument();
  });

  it("regular user sees no enable/disable buttons", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify"] },
        fetchWithAuth: mockFetchWithAuth(),
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.queryByText("Enable Platform")).not.toBeInTheDocument();
    expect(screen.queryByText("Disable")).not.toBeInTheDocument();
  });

  it("system admin sees all 11 platforms", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: true },
        account: { id: "a1", enabledPlatforms: ["shopify"] },
        fetchWithAuth: mockFetchWithAuth(),
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("All Platforms")).toBeInTheDocument();
    expect(screen.getByText("HubSpot")).toBeInTheDocument();
    expect(screen.getByText("Zoom")).toBeInTheDocument();
  });

  it("shows Request a Platform link", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify"] },
        fetchWithAuth: mockFetchWithAuth(),
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Request a Platform")).toBeInTheDocument();
  });

  it("separates tracked (has data) from available (no data) platforms", async () => {
    const fetch = vi.fn((url: string) => {
      // Shopify has data, salesforce does not
      if (url === "/api/apps?platform=shopify") return Promise.resolve({ ok: true, json: () => Promise.resolve([{ slug: "app1" }]) });
      if (url === "/api/apps?platform=salesforce") return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify", "salesforce"] },
        fetchWithAuth: fetch,
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Tracked Platforms")).toBeInTheDocument();
      expect(screen.getByText("Available Platforms")).toBeInTheDocument();
    });
  });

  it("admin sees Not Enabled section for non-enabled platforms", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: true },
        account: { id: "a1", enabledPlatforms: ["shopify"] },
        fetchWithAuth: mockFetchWithAuth(1),
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Not Enabled")).toBeInTheDocument();
    });
  });

  it("shows tracked/total count in description", async () => {
    const fetch = vi.fn((url: string) => {
      if (url === "/api/apps?platform=shopify") return Promise.resolve({ ok: true, json: () => Promise.resolve([{ slug: "app1" }]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify", "salesforce"] },
        fetchWithAuth: fetch,
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("1/2 platforms tracked")).toBeInTheDocument();
    });
  });

  it("calls onTrackedCountChange with correct count", async () => {
    const onTrackedCountChange = vi.fn();
    const fetch = vi.fn((url: string) => {
      if (url === "/api/apps?platform=shopify") return Promise.resolve({ ok: true, json: () => Promise.resolve([{ slug: "app1" }]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify", "salesforce"] },
        fetchWithAuth: fetch,
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} onTrackedCountChange={onTrackedCountChange} />);
    await waitFor(() => {
      expect(onTrackedCountChange).toHaveBeenCalledWith(1);
    });
  });
});
