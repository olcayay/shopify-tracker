import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();
const mockRefreshUser = vi.fn();

const ownerUser = {
  id: "u1", name: "Test User", email: "test@example.com",
  role: "owner", isSystemAdmin: false, emailDigestEnabled: true,
  timezone: "Europe/Istanbul",
};

const mockAccount = {
  id: "acc-1", name: "My Account", company: "My Company",
  isSuspended: false,
  package: { slug: "pro", name: "Pro" },
  packageLimits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxResearchProjects: 3, maxUsers: 5 },
  limits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxResearchProjects: 3, maxUsers: 5, maxPlatforms: 3 },
  usage: { trackedApps: 3, trackedKeywords: 10, competitorApps: 5, starredFeatures: 2, researchProjects: 1, users: 2, platforms: 2 },
  enabledPlatforms: ["shopify"],
};

const mockUseAuth = vi.fn(() => ({
  user: ownerUser,
  account: mockAccount,
  isLoading: false,
  fetchWithAuth: mockFetchWithAuth,
  refreshUser: mockRefreshUser,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

vi.mock("@/contexts/feature-flags-context", () => ({
  useFeatureFlag: () => true,
  useFeatureFlags: () => ({ enabledFeatures: ["notifications"], hasFeature: () => true }),
}));

import React from "react";
import SettingsPage from "@/app/(dashboard)/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: ownerUser,
      account: mockAccount,
      isLoading: false,
      fetchWithAuth: mockFetchWithAuth,
      refreshUser: mockRefreshUser,
    });
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    mockRefreshUser.mockResolvedValue(undefined);
  });

  it("renders page title", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders Profile card", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Update your personal information")).toBeInTheDocument();
  });

  it("renders profile form with current values", () => {
    render(<SettingsPage />);
    const nameInput = screen.getByDisplayValue("Test User");
    expect(nameInput).toBeInTheDocument();
    const emailInput = screen.getByDisplayValue("test@example.com");
    expect(emailInput).toBeInTheDocument();
  });

  it("renders password change form", () => {
    render(<SettingsPage />);
    expect(screen.getByPlaceholderText("Current password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("New password (min 8 chars)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm new password")).toBeInTheDocument();
  });

  it("shows password mismatch error", async () => {
    render(<SettingsPage />);

    await userEvent.type(screen.getByPlaceholderText("Current password"), "oldpass123");
    await userEvent.type(screen.getByPlaceholderText("New password (min 8 chars)"), "newpass123");
    await userEvent.type(screen.getByPlaceholderText("Confirm new password"), "differentpass");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("submits password change when passwords match", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(<SettingsPage />);

    await userEvent.type(screen.getByPlaceholderText("Current password"), "oldpass123");
    await userEvent.type(screen.getByPlaceholderText("New password (min 8 chars)"), "newpass123");
    await userEvent.type(screen.getByPlaceholderText("Confirm new password"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({
        method: "PATCH",
      }));
    });
  });

  it("renders Email Notifications card", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    expect(screen.getByText("Daily Ranking Digest")).toBeInTheDocument();
  });

  it("toggles email digest", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(<SettingsPage />);

    await userEvent.click(screen.getByText("Enabled"));

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({
        method: "PATCH",
      }));
    });
  });

  it("renders Data & Privacy card", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Data & Privacy")).toBeInTheDocument();
    expect(screen.getByText("Download My Data")).toBeInTheDocument();
  });

  it("submits profile update", async () => {
    mockFetchWithAuth.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(<SettingsPage />);

    const nameInput = screen.getByDisplayValue("Test User");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "New Name");
    await userEvent.click(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({
        method: "PATCH",
      }));
    });
  });

  it("does not render Account, Team Members, or Billing (moved to /organization)", () => {
    render(<SettingsPage />);
    expect(screen.queryByText("Team Members")).not.toBeInTheDocument();
    expect(screen.queryByText("Send Invitation")).not.toBeInTheDocument();
  });
});
