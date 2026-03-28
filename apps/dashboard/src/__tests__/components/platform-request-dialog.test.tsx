import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    account: { enabledPlatforms: ["shopify", "salesforce"] },
  }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

import React from "react";
import { PlatformRequestDialog } from "@/components/platform-request-dialog";

describe("PlatformRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    render(<PlatformRequestDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Request a Platform")).not.toBeInTheDocument();
  });

  it("renders form when open", () => {
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText("Request a Platform")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search marketplaces/)).toBeInTheDocument();
  });

  it("shows submit button disabled when platform name is empty", () => {
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    const submitBtn = screen.getByText("Submit Request");
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when platform name is filled", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Search marketplaces/), "Stripe");
    const submitBtn = screen.getByText("Submit Request");
    expect(submitBtn).not.toBeDisabled();
  });

  it("submits request and shows success", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "ok", id: "1" }),
    });
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Search marketplaces/), "Stripe");
    await user.click(screen.getByText("Submit Request"));
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/platform-requests",
      expect.objectContaining({ method: "POST" })
    );
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
  });

  it("shows suggestion list on focus", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.click(screen.getByPlaceholderText(/Search marketplaces/));
    // Should show some marketplace suggestions (not Shopify/Salesforce since they're enabled)
    expect(screen.getByText("Monday.com Apps")).toBeInTheDocument();
    expect(screen.getByText("Slack App Directory")).toBeInTheDocument();
  });

  it("filters suggestions based on input", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Search marketplaces/), "Hub");
    // HubSpot should show
    expect(screen.getByText("HubSpot App Marketplace")).toBeInTheDocument();
    // Unrelated ones should not show
    expect(screen.queryByText("Monday.com Apps")).not.toBeInTheDocument();
  });

  it("excludes enabled platforms from suggestions", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.click(screen.getByPlaceholderText(/Search marketplaces/));
    // Shopify and Salesforce are enabled — should not appear
    expect(screen.queryByText("Shopify App Store")).not.toBeInTheDocument();
    expect(screen.queryByText("Salesforce AppExchange")).not.toBeInTheDocument();
  });

  it("shows 'Use custom' option for non-matching input", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Search marketplaces/), "MyCustomPlatform");
    expect(screen.getByText(/Use custom/)).toBeInTheDocument();
    expect(screen.getByText(/MyCustomPlatform/)).toBeInTheDocument();
  });

  it("selects suggestion on click", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Search marketplaces/), "Monday");
    await user.click(screen.getByText("Monday.com Apps"));
    expect(screen.getByPlaceholderText(/Search marketplaces/)).toHaveValue("Monday.com Apps");
  });

  it("shows Supported badge for implemented platforms", async () => {
    const user = userEvent.setup();
    render(<PlatformRequestDialog open={true} onOpenChange={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Search marketplaces/), "HubSpot");
    // HubSpot has platformId set, should show "Supported" badge
    expect(screen.getByText("Supported")).toBeInTheDocument();
  });
});
