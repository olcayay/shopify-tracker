import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();
const mockRefreshUser = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", name: "Test", isSystemAdmin: false },
    account: {
      id: "a1",
      enabledPlatforms: ["shopify"],
    },
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: mockRefreshUser,
  }),
}));

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
import { PlatformDiscoverySheet } from "@/components/platform-discovery-sheet";

describe("PlatformDiscoverySheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<PlatformDiscoverySheet open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Platform Catalog")).not.toBeInTheDocument();
  });

  it("renders platform catalog when open", () => {
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Platform Catalog")).toBeInTheDocument();
  });

  it("shows all 11 platforms", () => {
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("HubSpot")).toBeInTheDocument();
  });

  it("shows Active status for enabled platforms", () => {
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Enable Platform for disabled platforms", () => {
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    const enableButtons = screen.getAllByText("Enable Platform");
    expect(enableButtons.length).toBe(10); // 11 - 1 enabled
  });

  it("shows search input", () => {
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByPlaceholderText("Search platforms...")).toBeInTheDocument();
  });

  it("filters platforms by search", async () => {
    const user = userEvent.setup();
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText("Search platforms..."), "hub");
    expect(screen.getByText("HubSpot")).toBeInTheDocument();
    expect(screen.queryByText("Shopify")).not.toBeInTheDocument();
  });

  it("shows Request a Platform link", () => {
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Request a Platform")).toBeInTheDocument();
  });

  it("calls API to enable platform", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<PlatformDiscoverySheet open={true} onOpenChange={() => {}} />);
    const enableButtons = screen.getAllByText("Enable Platform");
    await user.click(enableButtons[0]);
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/platforms",
      expect.objectContaining({ method: "POST" })
    );
  });
});
