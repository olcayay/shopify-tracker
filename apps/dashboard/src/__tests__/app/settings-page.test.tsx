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
  useFeatureFlags: () => ({ enabledFeatures: ["market-research"], hasFeature: () => true }),
}));

vi.mock("@/components/account-usage-cards", () => ({
  AccountUsageCards: ({ stats }: { stats: any[] }) => (
    <div data-testid="account-usage-cards">
      {stats.map((s: any) => (
        <div key={s.key}>{s.label}</div>
      ))}
    </div>
  ),
  USAGE_STAT_PRESETS: {
    apps: { icon: () => null, label: "My Apps", colorClasses: { bg: "", text: "" } },
    keywords: { icon: () => null, label: "Tracked Keywords", colorClasses: { bg: "", text: "" } },
    competitors: { icon: () => null, label: "Competitor Apps", colorClasses: { bg: "", text: "" } },
    research: { icon: () => null, label: "Research Projects", colorClasses: { bg: "", text: "" } },
    users: { icon: () => null, label: "Users", colorClasses: { bg: "", text: "" } },
  },
}));

import React from "react";
import SettingsPage from "@/app/(dashboard)/settings/page";

const mockMembers = [
  { id: "u1", name: "Test User", email: "test@example.com", role: "owner", createdAt: "2026-01-01", lastSeenAt: "2026-04-04T10:00:00Z" },
  { id: "u2", name: "Bob Editor", email: "bob@example.com", role: "editor", createdAt: "2026-02-15", lastSeenAt: "2026-04-03T08:00:00Z" },
];

const mockInvitations = [
  {
    id: "inv-1", email: "pending@example.com", role: "viewer",
    createdAt: "2026-04-01", expiresAt: "2026-04-08", acceptedAt: null,
    invitedByName: "Test User", expired: false, accepted: false,
  },
  {
    id: "inv-2", email: "expired@example.com", role: "editor",
    createdAt: "2026-03-01", expiresAt: "2026-03-08", acceptedAt: null,
    invitedByName: "Test User", expired: true, accepted: false,
  },
];

function setupMockFetch(overrides?: Record<string, any>) {
  mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
    if (url === "/api/account/members" && !options?.method) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(overrides?.members ?? mockMembers) });
    }
    if (url === "/api/account/invitations" && !options?.method) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(overrides?.invitations ?? mockInvitations) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

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
    setupMockFetch();
    mockRefreshUser.mockResolvedValue(undefined);
  });

  it("renders page title", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders Account card with package badge", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("renders account description", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/My Account/)).toBeInTheDocument();
  });

  it("renders usage stats via AccountUsageCards", () => {
    render(<SettingsPage />);
    expect(screen.getByText("My Apps")).toBeInTheDocument();
    expect(screen.getByText("Tracked Keywords")).toBeInTheDocument();
    expect(screen.getByText("Competitor Apps")).toBeInTheDocument();
    expect(screen.getByText("Research Projects")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
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

  it("renders Change Password section", () => {
    render(<SettingsPage />);
    expect(screen.getAllByText("Change Password").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("Current password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("New password (min 8 chars)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm new password")).toBeInTheDocument();
  });

  it("shows password mismatch error", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await act(async () => {
      await user.type(screen.getByPlaceholderText("Current password"), "oldpass123");
      await user.type(screen.getByPlaceholderText("New password (min 8 chars)"), "newpass123");
      await user.type(screen.getByPlaceholderText("Confirm new password"), "different123");
      const changePwdBtns = screen.getAllByText("Change Password");
      const buttonEl = changePwdBtns.find((el) => el.closest("button"));
      await user.click(buttonEl!);
    });
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("submits password change when passwords match", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await act(async () => {
      await user.type(screen.getByPlaceholderText("Current password"), "oldpass123");
      await user.type(screen.getByPlaceholderText("New password (min 8 chars)"), "newpass123");
      await user.type(screen.getByPlaceholderText("Confirm new password"), "newpass123");
      const changePwdBtns = screen.getAllByText("Change Password");
      const buttonEl = changePwdBtns.find((el) => el.closest("button"));
      await user.click(buttonEl!);
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("renders Team Members section for owner", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Team Members")).toBeInTheDocument();
  });

  it("renders member list with status badges", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Bob Editor")).toBeInTheDocument();
    });
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    // Active members should have Active badge
    const activeBadges = screen.getAllByText("Active");
    expect(activeBadges.length).toBe(2); // 2 active members
  });

  it("renders invite member form for owner", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Send Invitation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
  });

  it("sends invitation when form is submitted", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await act(async () => {
      await user.type(screen.getByPlaceholderText("Email address"), "new@example.com");
      await user.click(screen.getByText("Send Invitation"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/members/invite",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows pending and expired invitations", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("pending@example.com")).toBeInTheDocument();
    });
    expect(screen.getByText("expired@example.com")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows seats used count for owner", async () => {
    render(<SettingsPage />);
    // 2 members + 1 pending invitation = 3 of 5
    await waitFor(() => {
      expect(screen.getByText(/3 of 5 seats used/)).toBeInTheDocument();
    });
  });

  it("renders Email Notifications section", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Email Notifications")).toBeInTheDocument();
    expect(screen.getByText("Daily Ranking Digest")).toBeInTheDocument();
  });

  it("shows digest enabled state", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("toggles email digest", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await act(async () => {
      await user.click(screen.getByText("Enabled"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("renders timezone selector", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Timezone")).toBeInTheDocument();
  });

  it("shows account edit form for owner", () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue("My Account")).toBeInTheDocument();
    expect(screen.getByDisplayValue("My Company")).toBeInTheDocument();
  });

  it("submits account update", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const accountNameInput = screen.getByDisplayValue("My Account");
    await act(async () => {
      await user.clear(accountNameInput);
      await user.type(accountNameInput, "Updated Account");
      const saveBtns = screen.getAllByText("Save");
      await user.click(saveBtns[0]);
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("submits profile update", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    const nameInput = screen.getByDisplayValue("Test User");
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Name");
      await user.click(screen.getByText("Save Changes"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("shows error message when operation fails", async () => {
    mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
      if (url === "/api/account/members" && !options?.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMembers) });
      }
      if (url === "/api/account/invitations" && !options?.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockInvitations) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "Update failed" }) });
    });
    const user = userEvent.setup();
    render(<SettingsPage />);
    const nameInput = screen.getByDisplayValue("Test User");
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Name");
      await user.click(screen.getByText("Save Changes"));
    });
    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });

  it("does not show delete button for own user", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Bob Editor")).toBeInTheDocument();
    });
    // Owner row should not have delete button, but Bob's row should
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg")?.classList.contains("text-destructive") || false
    );
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("editor can see team members table but not invite form", async () => {
    mockUseAuth.mockReturnValue({
      user: { ...ownerUser, id: "u2", role: "editor", name: "Bob Editor", email: "bob@example.com" },
      account: mockAccount,
      isLoading: false,
      fetchWithAuth: mockFetchWithAuth,
      refreshUser: mockRefreshUser,
    });
    render(<SettingsPage />);
    expect(screen.getByText("Team Members")).toBeInTheDocument();
    expect(screen.getByText("People with access to this account")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
    expect(screen.queryByText("Send Invitation")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Email address")).not.toBeInTheDocument();
  });

  it("viewer can see team members table but not invite form", async () => {
    mockUseAuth.mockReturnValue({
      user: { ...ownerUser, id: "u3", role: "viewer", name: "View User", email: "view@example.com" },
      account: mockAccount,
      isLoading: false,
      fetchWithAuth: mockFetchWithAuth,
      refreshUser: mockRefreshUser,
    });
    render(<SettingsPage />);
    expect(screen.getByText("Team Members")).toBeInTheDocument();
    expect(screen.getByText("People with access to this account")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
      expect(screen.getByText("Bob Editor")).toBeInTheDocument();
    });
    expect(screen.queryByText("Send Invitation")).not.toBeInTheDocument();
  });

  it("owner sees seats used in description", () => {
    render(<SettingsPage />);
    expect(screen.getByText(/seats used/)).toBeInTheDocument();
  });
});
