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

import FeaturesListPage from "@/app/(dashboard)/system-admin/features/page";

const mockFeatures = [
  { featureHandle: "email-marketing", featureTitle: "Email Marketing", trackedByCount: 3 },
  { featureHandle: "ab-testing", featureTitle: "A/B Testing", trackedByCount: 1 },
  { featureHandle: "analytics", featureTitle: "Analytics Dashboard", trackedByCount: 0 },
];

describe("FeaturesListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/features") && !url.includes("/accounts")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFeatures) });
      if (url.includes("/accounts")) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ accountId: "a1", accountName: "Acme" }]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders page title with count", async () => {
    render(<FeaturesListPage />);
    await waitFor(() => {
      expect(screen.getByText(/Features \(3\)/)).toBeInTheDocument();
    });
  });

  it("renders breadcrumb", () => {
    render(<FeaturesListPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders all features", async () => {
    render(<FeaturesListPage />);
    await waitFor(() => {
      expect(screen.getByText("Email Marketing")).toBeInTheDocument();
    });
    expect(screen.getByText("A/B Testing")).toBeInTheDocument();
    expect(screen.getByText("Analytics Dashboard")).toBeInTheDocument();
  });

  it("renders feature handles", async () => {
    render(<FeaturesListPage />);
    await waitFor(() => {
      expect(screen.getByText("email-marketing")).toBeInTheDocument();
    });
    expect(screen.getByText("ab-testing")).toBeInTheDocument();
    expect(screen.getByText("analytics")).toBeInTheDocument();
  });

  it("shows tracked by count", async () => {
    render(<FeaturesListPage />);
    await waitFor(() => {
      expect(screen.getByText("3 accounts")).toBeInTheDocument();
    });
    expect(screen.getByText("1 account")).toBeInTheDocument();
  });

  it("shows 0 for features with no trackers", async () => {
    render(<FeaturesListPage />);
    await waitFor(() => {
      const zeros = screen.getAllByText("0");
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("filters by search", async () => {
    const user = userEvent.setup();
    render(<FeaturesListPage />);
    await waitFor(() => {
      expect(screen.getByText("Email Marketing")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "email");
    });
    expect(screen.getByText("Email Marketing")).toBeInTheDocument();
    expect(screen.queryByText("A/B Testing")).not.toBeInTheDocument();
    expect(screen.queryByText("Analytics Dashboard")).not.toBeInTheDocument();
  });

  it("shows empty state when no features match", async () => {
    const user = userEvent.setup();
    render(<FeaturesListPage />);
    await waitFor(() => {
      expect(screen.getByText("Email Marketing")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "zzzzz");
    });
    expect(screen.getByText("No features found")).toBeInTheDocument();
  });

  it("renders sortable column headers", () => {
    render(<FeaturesListPage />);
    expect(screen.getByText("Feature")).toBeInTheDocument();
    expect(screen.getByText("Handle")).toBeInTheDocument();
    expect(screen.getByText("Tracked By")).toBeInTheDocument();
  });

  it("expands row to show accounts when trackedBy link is clicked", async () => {
    const user = userEvent.setup();
    render(<FeaturesListPage />);
    await waitFor(() => {
      expect(screen.getByText("3 accounts")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("3 accounts"));
    });
    await waitFor(() => {
      expect(screen.getByText("Acme")).toBeInTheDocument();
    });
  });
});
