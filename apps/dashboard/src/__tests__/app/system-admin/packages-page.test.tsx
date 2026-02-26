import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", email: "a@b.com", role: "owner", isSystemAdmin: true, emailDigestEnabled: true, timezone: "UTC" },
    account: null,
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
  }),
}));

import PackagesPage from "@/app/(dashboard)/system-admin/packages/page";

const mockPackages = [
  { id: 1, slug: "starter", name: "Starter", maxTrackedApps: 5, maxTrackedKeywords: 25, maxCompetitorApps: 10, maxTrackedFeatures: 5, maxUsers: 2, sortOrder: 0 },
  { id: 2, slug: "pro", name: "Pro", maxTrackedApps: 10, maxTrackedKeywords: 50, maxCompetitorApps: 20, maxTrackedFeatures: 10, maxUsers: 5, sortOrder: 1 },
];

const mockAccounts = [
  { id: "a1", name: "Acme Corp", company: "Acme", packageId: 2, hasLimitOverrides: true },
  { id: "a2", name: "Beta Inc", company: null, packageId: 2, hasLimitOverrides: false },
  { id: "a3", name: "Gamma LLC", company: null, packageId: null, hasLimitOverrides: false },
];

describe("PackagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/packages") && !url.includes("/packages/")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPackages) });
      if (url.includes("/accounts")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAccounts) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders page title", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText(/Packages \(2\)/)).toBeInTheDocument();
    });
  });

  it("renders breadcrumb", () => {
    render(<PackagesPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders package cards", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Starter")).toBeInTheDocument();
    });
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("shows package slugs", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText("starter")).toBeInTheDocument();
    });
    expect(screen.getByText("pro")).toBeInTheDocument();
  });

  it("shows limit values", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Apps").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Competitors").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Users").length).toBeGreaterThanOrEqual(1);
  });

  it("shows account count per package", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText("0 accounts")).toBeInTheDocument(); // Starter
      expect(screen.getByText("2 accounts")).toBeInTheDocument(); // Pro
    });
  });

  it("shows accounts linked to a package", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
  });

  it("shows override indicator on accounts with overrides", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText(/with overrides/)).toBeInTheDocument();
    });
  });

  it("shows New Package button", () => {
    render(<PackagesPage />);
    expect(screen.getByText("New Package")).toBeInTheDocument();
  });

  it("opens create form when New Package is clicked", async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await act(async () => {
      await user.click(screen.getByText("New Package"));
    });
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. business")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Business")).toBeInTheDocument();
  });

  it("creates a package when form is submitted", async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await act(async () => {
      await user.click(screen.getByText("New Package"));
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    await act(async () => {
      await user.type(screen.getByPlaceholderText("e.g. business"), "enterprise");
      await user.type(screen.getByPlaceholderText("e.g. Business"), "Enterprise");
      await user.click(screen.getByText("Create"));
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/packages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows unassigned accounts section", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText(/Unassigned Accounts/)).toBeInTheDocument();
    });
    expect(screen.getByText("Gamma LLC")).toBeInTheDocument();
  });

  it("shows empty state when no packages exist", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/packages")) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes("/accounts")) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText("No packages defined yet.")).toBeInTheDocument();
    });
  });

  it("disables delete button when accounts use the package", async () => {
    render(<PackagesPage />);
    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    // The Pro package has 2 accounts so its delete button should be disabled
    const deleteButtons = screen.getAllByTitle(/delete|Cannot delete/i);
    const disabledBtn = deleteButtons.find((btn) => (btn as HTMLButtonElement).disabled);
    expect(disabledBtn).toBeDefined();
  });
});
