import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mockLogin = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

import LoginPage from "@/app/(auth)/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form", () => {
    render(<LoginPage />);
    expect(screen.getByText("AppRanks")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
  });

  it("renders email input", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Min. 8 characters")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<LoginPage />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("renders register link", () => {
    render(<LoginPage />);
    const link = screen.getByText("Register").closest("a");
    expect(link).toHaveAttribute("href", "/register");
  });

  it("calls login with email and password on submit", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByText("Sign in"));

    expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
  });

  it("shows loading state during login", async () => {
    const user = userEvent.setup();
    let resolveLogin: () => void;
    mockLogin.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    render(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByText("Sign in"));

    expect(screen.getByText("Signing in...")).toBeInTheDocument();
    resolveLogin!();
  });

  it("shows error message on login failure", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));

    render(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("clears error on new submit attempt", async () => {
    const user = userEvent.setup();
    mockLogin
      .mockRejectedValueOnce(new Error("Invalid credentials"))
      .mockResolvedValueOnce(undefined);

    render(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    // Submit again
    await user.click(screen.getByText("Sign in"));

    // Error should be cleared during the new submit
    await waitFor(() => {
      expect(screen.queryByText("Invalid credentials")).toBeNull();
    });
  });

  it("has required email field", () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("required");
  });

  it("has required password field", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("required");
  });

  it("email input has type email", () => {
    render(<LoginPage />);
    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("password input has type password", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
