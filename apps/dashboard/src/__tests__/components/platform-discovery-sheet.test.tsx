import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Request a Platform")).toBeInTheDocument();
  });

  it("shows Tracked Platforms section header", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify", "salesforce"] },
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Tracked Platforms")).toBeInTheDocument();
  });

  it("admin sees Available Platforms section for non-enabled platforms", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: true },
        account: { id: "a1", enabledPlatforms: ["shopify"] },
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Tracked Platforms")).toBeInTheDocument();
    expect(screen.getByText("Available Platforms")).toBeInTheDocument();
  });

  it("shows tracked count in description", async () => {
    vi.doMock("@/lib/auth-context", () => ({
      useAuth: () => ({
        user: { id: "1", isSystemAdmin: false },
        account: { id: "a1", enabledPlatforms: ["shopify", "salesforce"] },
      }),
    }));
    const { PlatformDiscoverySheet } = await import("@/components/platform-discovery-sheet");
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("2 platforms tracked")).toBeInTheDocument();
  });
});
