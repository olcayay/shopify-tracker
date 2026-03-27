import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/shopify/keywords",
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", isSystemAdmin: false },
    account: {
      id: "a1",
      enabledPlatforms: ["shopify", "salesforce", "canva"],
    },
  }),
}));

import React from "react";
import { PlatformSwitcher } from "@/components/platform-switcher";

describe("PlatformSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is not visible by default", () => {
    render(<PlatformSwitcher />);
    expect(screen.queryByPlaceholderText("Switch platform...")).not.toBeInTheDocument();
  });

  it("opens on Cmd+K", () => {
    render(<PlatformSwitcher />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText("Switch platform...")).toBeInTheDocument();
  });

  it("opens on Ctrl+K", () => {
    render(<PlatformSwitcher />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByPlaceholderText("Switch platform...")).toBeInTheDocument();
  });

  it("shows enabled platforms when open", () => {
    render(<PlatformSwitcher />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByText("Shopify")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.getByText("Canva")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<PlatformSwitcher />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText("Switch platform...")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText("Switch platform...")).not.toBeInTheDocument();
  });

  it("filters platforms by typing", async () => {
    const user = userEvent.setup();
    render(<PlatformSwitcher />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await user.type(screen.getByPlaceholderText("Switch platform..."), "sales");
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
    expect(screen.queryByText("Canva")).not.toBeInTheDocument();
  });

  it("navigates on Enter preserving section", async () => {
    render(<PlatformSwitcher />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    // Default selection is first item (shopify)
    fireEvent.keyDown(screen.getByPlaceholderText("Switch platform..."), { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/shopify/keywords");
  });

  it("navigates to selected platform via arrow keys", async () => {
    render(<PlatformSwitcher />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    const input = screen.getByPlaceholderText("Switch platform...");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // salesforce
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/salesforce/keywords");
  });
});
