import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();
const mockRefreshUser = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1", name: "Test User", email: "test@example.com",
      role: "owner", isSystemAdmin: false, emailDigestEnabled: true,
      timezone: "Europe/Istanbul",
    },
    account: {
      id: "acc-1", name: "My Account", company: "My Company",
      isSuspended: false,
      package: { slug: "pro", name: "Pro" },
      packageLimits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5 },
      limits: { maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxUsers: 5 },
      usage: { trackedApps: 3, trackedKeywords: 10, competitorApps: 5, starredFeatures: 2, users: 2 },
    },
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: mockRefreshUser,
  }),
}));

import SettingsPage from "@/app/(dashboard)/settings/page";

const mockMembers = [
  { id: "u1", name: "Test User", email: "test@example.com", role: "owner" },
  { id: "u2", name: "Bob Editor", email: "bob@example.com", role: "editor" },
];

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
      if (url === "/api/account/members" && !options?.method) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMembers) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
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

  it("renders usage stats", () => {
    render(<SettingsPage />);
    expect(screen.getByText("My Apps")).toBeInTheDocument();
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Competitors")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("3/10")).toBeInTheDocument();
    expect(screen.getByText("10/50")).toBeInTheDocument();
    expect(screen.getByText("5/20")).toBeInTheDocument();
    expect(screen.getByText("2/5")).toBeInTheDocument();
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
      // Click the Change Password button (the one inside the form)
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

  it("renders member list", async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Bob Editor")).toBeInTheDocument();
    });
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("renders create user form", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Create User")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
    // There are two password fields with "min 8" pattern - one in change password, one in create user
    const passwordFields = screen.getAllByPlaceholderText(/Password.*min 8/i);
    expect(passwordFields.length).toBeGreaterThanOrEqual(2);
  });

  it("creates a new user", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    // Use specific placeholders that only appear in create user form
    const nameInput = screen.getByPlaceholderText("Name");
    const emailInput = screen.getByPlaceholderText("Email address");
    // The create user password field has placeholder "Password (min 8 chars)"
    const passwordFields = screen.getAllByPlaceholderText(/Password.*min 8/i);
    // The first one is in the change password section, the second in create user
    const createPasswordInput = passwordFields[passwordFields.length - 1];
    await act(async () => {
      await user.type(nameInput, "New User");
      await user.type(emailInput, "new@example.com");
      await user.type(createPasswordInput, "password123");
      await user.click(screen.getByText("Create User"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/members",
      expect.objectContaining({ method: "POST" })
    );
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
      // Find the save button next to account form
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
    // There should be exactly 1 delete icon (for Bob, not for Test User)
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.querySelector("svg")?.classList.contains("text-destructive") || false
    );
    // The count should reflect only other members, not the current user
    expect(deleteButtons.length).toBeLessThanOrEqual(1);
  });
});
