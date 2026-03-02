import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();
const mockStartImpersonation = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      name: "Admin",
      email: "admin@test.com",
      role: "owner",
      isSystemAdmin: true,
      emailDigestEnabled: true,
      timezone: "UTC",
    },
    account: null,
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
    startImpersonation: mockStartImpersonation,
    impersonation: null,
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
  {
    id: "u1",
    name: "Admin User",
    email: "admin@test.com",
    accountId: "a1",
    accountName: "Acme",
    accountCompany: null,
    role: "owner",
    isSystemAdmin: true,
    emailDigestEnabled: true,
    lastDigestSentAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    lastSeen: null,
  },
  {
    id: "u2",
    name: "Bob Jones",
    email: "bob@test.com",
    accountId: "a2",
    accountName: "Beta",
    accountCompany: null,
    role: "editor",
    isSystemAdmin: false,
    emailDigestEnabled: false,
    lastDigestSentAt: null,
    createdAt: "2026-02-01T00:00:00Z",
    lastSeen: null,
  },
  {
    id: "u3",
    name: "Carol White",
    email: "carol@test.com",
    accountId: "a1",
    accountName: "Acme",
    accountCompany: null,
    role: "viewer",
    isSystemAdmin: false,
    emailDigestEnabled: true,
    lastDigestSentAt: null,
    createdAt: "2026-02-15T00:00:00Z",
    lastSeen: null,
  },
];

describe("UsersListPage — Impersonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/users"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers),
        });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it("does NOT show impersonate button for system admin users", async () => {
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
    // Admin User row should not have an impersonate button
    const adminRow = screen.getByText("Admin User").closest("tr")!;
    expect(
      adminRow.querySelector('[title="Impersonate Admin User"]')
    ).not.toBeInTheDocument();
  });

  it("does NOT show impersonate button for current user", async () => {
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
    // Current user is u1 (Admin User), no impersonate button
    const adminRow = screen.getByText("Admin User").closest("tr")!;
    const buttons = adminRow.querySelectorAll("button");
    const impersonateBtn = Array.from(buttons).find((b) =>
      b.getAttribute("title")?.includes("Impersonate")
    );
    expect(impersonateBtn).toBeFalsy();
  });

  it("shows impersonate button for non-admin users", async () => {
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });
    expect(
      screen.getByTitle("Impersonate Bob Jones")
    ).toBeInTheDocument();
    expect(
      screen.getByTitle("Impersonate Carol White")
    ).toBeInTheDocument();
  });

  it("clicking impersonate button shows confirmation dialog", async () => {
    const ue = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    await ue.click(screen.getByTitle("Impersonate Bob Jones"));

    await waitFor(() => {
      expect(screen.getByText("Start impersonation")).toBeInTheDocument();
      expect(
        screen.getByText(/You are about to impersonate Bob Jones/)
      ).toBeInTheDocument();
    });
  });

  it("confirming dialog calls startImpersonation", async () => {
    const ue = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    await ue.click(screen.getByTitle("Impersonate Bob Jones"));

    await waitFor(() => {
      expect(screen.getByText("Impersonate")).toBeInTheDocument();
    });

    await ue.click(screen.getByText("Impersonate"));

    await waitFor(() => {
      expect(mockStartImpersonation).toHaveBeenCalledWith("u2");
    });
  });

  it("canceling dialog does not call startImpersonation", async () => {
    const ue = userEvent.setup();
    render(<UsersListPage />);
    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    await ue.click(screen.getByTitle("Impersonate Bob Jones"));

    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    await ue.click(screen.getByText("Cancel"));

    expect(mockStartImpersonation).not.toHaveBeenCalled();
  });
});
