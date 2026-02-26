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

vi.mock("@/lib/format-date", () => ({
  useFormatDate: () => ({
    formatDateTime: (d: string) => d,
    formatDateOnly: (d: string) => d,
  }),
}));

import UsersListPage from "@/app/(dashboard)/system-admin/users/page";

const mockUsers = [
  { id: "u1", name: "Alice Smith", email: "alice@test.com", accountId: "a1", accountName: "Acme", accountCompany: "Acme Corp", role: "owner", isSystemAdmin: true, emailDigestEnabled: true, lastDigestSentAt: "2026-02-27T08:00:00Z", createdAt: "2026-01-01T00:00:00Z", lastSeen: "2026-02-27T12:00:00Z" },
  { id: "u2", name: "Bob Jones", email: "bob@test.com", accountId: "a2", accountName: "Beta", accountCompany: null, role: "editor", isSystemAdmin: false, emailDigestEnabled: false, lastDigestSentAt: null, createdAt: "2026-02-01T00:00:00Z", lastSeen: null },
  { id: "u3", name: "Carol White", email: "carol@test.com", accountId: "a1", accountName: "Acme", accountCompany: "Acme Corp", role: "viewer", isSystemAdmin: false, emailDigestEnabled: true, lastDigestSentAt: null, createdAt: "2026-02-15T00:00:00Z", lastSeen: "2026-02-26T10:00:00Z" },
];

describe("UsersListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/users")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockUsers) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("renders the page title with user count", async () => {
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText(/Users \(3\)/)).toBeInTheDocument();
    });
  });

  it("renders breadcrumb", () => {
    render(<UsersListPage />);
    expect(screen.getByText("System Admin")).toBeInTheDocument();
  });

  it("renders all users in the table", async () => {
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Carol White")).toBeInTheDocument();
  });

  it("renders user emails", async () => {
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    });
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
  });

  it("renders role filter buttons", () => {
    render(<UsersListPage />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("filters by role when clicking a filter button", async () => {
    const user = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("Editor"));
    });
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
    expect(screen.queryByText("Carol White")).not.toBeInTheDocument();
  });

  it("filters by Admin (system admin users)", async () => {
    const user = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText("Admin"));
    });
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
  });

  it("filters by search term", async () => {
    const user = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "bob");
    });
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
  });

  it("shows empty state when no users match", async () => {
    const user = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      await user.type(searchInput, "zzzzz");
    });
    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("sends digest email when button is clicked", async () => {
    const user = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const sendButtons = screen.getAllByTitle("Send digest email");
    await act(async () => {
      await user.click(sendButtons[0]);
    });
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/system-admin/users/u1/send-digest",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows success message after sending digest", async () => {
    const user = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    mockFetchWithAuth.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    const sendButtons = screen.getAllByTitle("Send digest email");
    await act(async () => {
      await user.click(sendButtons[0]);
    });
    await waitFor(() => {
      expect(screen.getByText(/Digest email queued for alice@test.com/)).toBeInTheDocument();
    });
  });

  it("shows account name and company name when present", async () => {
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getAllByText("Acme").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1);
  });

  it("renders sortable column headers", () => {
    render(<UsersListPage />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });
});
