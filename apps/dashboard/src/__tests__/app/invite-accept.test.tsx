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
      json: () => Promise.resolve({ email: "test@test.com", role: "editor", expired: true, accepted: false }),
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
      json: () => Promise.resolve({ email: "test@test.com", role: "editor", expired: false, accepted: true }),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Already Accepted")).toBeInTheDocument();
    });
    expect(screen.getByText(/already been accepted/)).toBeInTheDocument();
  });

  it("renders accept form for valid invitation", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ email: "test@test.com", role: "editor", expired: false, accepted: false }),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Accept Invitation")).toBeInTheDocument();
    });
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.getByText("test@test.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Your Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Accept & Create Account")).toBeInTheDocument();
  });

  it("submits the form successfully", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "test@test.com", role: "editor", expired: false, accepted: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Accept Invitation")).toBeInTheDocument();
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "John Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.click(screen.getByText("Accept & Create Account"));
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/invitations/accept/test-token-123"),
      expect.objectContaining({ method: "POST" })
    );
    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeInTheDocument();
    });
    expect(screen.getByText(/Redirecting to login/)).toBeInTheDocument();
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "test@test.com", role: "editor", expired: false, accepted: false }),
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSubmit = resolve;
      }));
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Accept Invitation")).toBeInTheDocument();
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "John Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.click(screen.getByText("Accept & Create Account"));
    });
    expect(screen.getByText("Creating account...")).toBeInTheDocument();
    // Cleanup: resolve the pending promise
    await act(async () => {
      resolveSubmit!({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("shows error when submission fails", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "test@test.com", role: "editor", expired: false, accepted: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Token expired" }),
      });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Accept Invitation")).toBeInTheDocument();
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "John Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.click(screen.getByText("Accept & Create Account"));
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
        json: () => Promise.resolve({ email: "test@test.com", role: "viewer", expired: false, accepted: false }),
      })
      .mockRejectedValueOnce(new Error("Network error"));
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Accept Invitation")).toBeInTheDocument();
    });
    await act(async () => {
      await user.type(screen.getByLabelText("Your Name"), "John Doe");
      await user.type(screen.getByLabelText("Password"), "securepass123");
      await user.click(screen.getByText("Accept & Create Account"));
    });
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("has sign in link on already accepted page", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ email: "test@test.com", role: "editor", expired: false, accepted: true }),
    });
    render(<AcceptInvitePage />);
    await waitFor(() => {
      expect(screen.getByText("Sign in")).toBeInTheDocument();
    });
  });
});
