import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "test-token-123" }),
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/invite/accept/test-token-123",
  useSearchParams: () => new URLSearchParams(),
}));

import AcceptInvitePage from "@/app/(auth)/invite/accept/[token]/page";

const validInvitation = {
  email: "test@test.com",
  role: "editor",
  expired: false,
  accepted: false,
  inviterName: "John Owner",
  accountName: "Acme Corp",
  accountCompany: "Acme Inc.",
};

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("shows loading state initially", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<AcceptInvitePage />);
    expect(screen.getByText("Loading invitation...")).toBeInTheDocument();
  });

  it("shows error when invitation is not found", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Invitation not found" }),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Invalid Invitation")).toBeInTheDocument();
    });
    expect(screen.getByText("Invitation not found")).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Invalid Invitation")).toBeInTheDocument();
    });
    expect(screen.getByText("Failed to load invitation")).toBeInTheDocument();
  });

  it("shows expired invitation message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...validInvitation, expired: true }),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Invitation Expired")).toBeInTheDocument();
    });
    expect(screen.getByText(/expired.*new one/i)).toBeInTheDocument();
  });

  it("shows already accepted message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...validInvitation, accepted: true }),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Already Accepted")).toBeInTheDocument();
    });
    expect(screen.getByText(/already been accepted/)).toBeInTheDocument();
  });

  it("renders accept form with inviter and account info", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validInvitation),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Join Acme Corp/).length).toBeGreaterThan(0);
    });
    // Inviter info
    expect(screen.getByText(/John Owner/)).toBeInTheDocument();
    expect(screen.getByText(/editor/)).toBeInTheDocument();
    // Company
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    // Read-only email
    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    expect(emailInput.value).toBe("test@test.com");
    expect(emailInput).toHaveAttribute("readOnly");
    // Form fields
    expect(screen.getByLabelText("Your Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join Acme Corp/ })).toBeInTheDocument();
  });

  it("shows password mismatch error", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validInvitation),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Join Acme Corp/).length).toBeGreaterThan(0);
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "Jane Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.type(screen.getByLabelText("Confirm Password"), "different123");
    });
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("submits and auto-logs in on success", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validInvitation),
      })
      // Accept invitation
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "Invitation accepted" }),
      })
      // Auto-login
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "at", refreshToken: "rt" }),
      });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Join Acme Corp/).length).toBeGreaterThan(0);
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "John Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.type(screen.getByLabelText("Confirm Password"), "securepass123");
      await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
    });
    // Verify accept call
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/invitations/accept/test-token-123"),
      expect.objectContaining({ method: "POST" })
    );
    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeInTheDocument();
    });
    expect(screen.getByText(/Signing you in/)).toBeInTheDocument();
    // Verify auto-login call
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({ method: "POST" })
    );
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("shows error when submission fails", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validInvitation),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Token expired" }),
      });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Join Acme Corp/).length).toBeGreaterThan(0);
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "John Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.type(screen.getByLabelText("Confirm Password"), "securepass123");
      await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
    });
    await waitFor(() => {
      expect(screen.getByText("Token expired")).toBeInTheDocument();
    });
  });

  it("shows network error when fetch rejects during submission", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validInvitation),
      })
      .mockRejectedValueOnce(new Error("Network error"));
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Join Acme Corp/).length).toBeGreaterThan(0);
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "John Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.type(screen.getByLabelText("Confirm Password"), "securepass123");
      await user.click(screen.getByRole("button", { name: /Join Acme Corp/i }));
    });
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("has sign in link on already accepted page", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...validInvitation, accepted: true }),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Sign in")).toBeInTheDocument();
    });
  });

  it("has sign in link on the accept form", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validInvitation),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Join Acme Corp/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });
});
