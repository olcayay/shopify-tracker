import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/shopify",
  useRouter: () => ({ push: mockPush }),
}));

const mockLogout = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "1",
      name: "Test User",
      email: "test@test.com",
      role: "owner",
      isSystemAdmin: false,
    },
    account: {
      id: "a1",
      name: "Test Account",
      enabledPlatforms: ["shopify", "salesforce"],
    },
    logout: mockLogout,
    impersonation: null,
    globalPlatformVisibility: null,
  }),
}));

import React from "react";
import { TopBar } from "@/components/top-bar";

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AppRanks logo linking to /overview", () => {
    render(<TopBar />);
    const logo = screen.getByText("AppRanks");
    expect(logo).toBeInTheDocument();
    expect(logo.closest("a")).toHaveAttribute("href", "/overview");
  });

  it("shows active platform name", () => {
    render(<TopBar />);
    expect(screen.getByText("Shopify")).toBeInTheDocument();
  });

  it("shows platform count badge with tracked count", () => {
    render(<TopBar trackedCount={1} />);
    expect(screen.getByText("1/2 platforms tracked")).toBeInTheDocument();
  });

  it("shows spinner when tracked count not yet loaded", () => {
    render(<TopBar />);
    // Should not show the text, but a loading spinner instead
    expect(screen.queryByText(/platforms tracked/)).not.toBeInTheDocument();
  });

  it("shows settings link", () => {
    render(<TopBar />);
    const settingsLink = screen.getByTitle("Settings");
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink.closest("a")).toHaveAttribute("href", "/settings");
  });

  it("shows user menu button", () => {
    render(<TopBar />);
    expect(screen.getByTitle("Test User")).toBeInTheDocument();
  });

  it("opens platform dropdown on click", async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    // Click the platform dropdown button
    const dropdownBtn = screen.getByText("Shopify").closest("button")!;
    await user.click(dropdownBtn);
    // Should show Salesforce as another option
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
  });

  it("switches platform preserving section", async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    const dropdownBtn = screen.getByText("Shopify").closest("button")!;
    await user.click(dropdownBtn);
    // Click Salesforce in dropdown
    const salesforceOption = screen.getAllByText("Salesforce").find(
      (el) => el.closest("button") !== dropdownBtn
    )!;
    await user.click(salesforceOption);
    expect(mockPush).toHaveBeenCalledWith("/salesforce");
  });

  it("opens user menu and can sign out", async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    await user.click(screen.getByTitle("Test User"));
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    await user.click(screen.getByText("Sign out"));
    expect(mockLogout).toHaveBeenCalled();
  });

  it("calls onOpenDiscovery when + button clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<TopBar onOpenDiscovery={onOpen} />);
    await user.click(screen.getByTitle("Add platform"));
    expect(onOpen).toHaveBeenCalled();
  });
});
