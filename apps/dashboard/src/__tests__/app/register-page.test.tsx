import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mockRegister = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    register: mockRegister,
  }),
}));

import RegisterPage from "@/app/(auth)/register/page";

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registration form", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Create Account")).toBeInTheDocument();
    expect(
      screen.getByText("Register a new account to start tracking apps")
    ).toBeInTheDocument();
  });

  it("renders all form fields", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText("Your Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Account Name")).toBeInTheDocument();
  });

  it("renders company field as optional", () => {
    render(<RegisterPage />);
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Acme Inc.")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Create account")).toBeInTheDocument();
  });

  it("renders login link", () => {
    render(<RegisterPage />);
    const link = screen.getByText("Sign in").closest("a");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("calls register with all fields on submit", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("Your Name"), "John Doe");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Account Name"), "My Team");
    await user.type(screen.getByPlaceholderText("Acme Inc."), "Acme Corp");
    await user.click(screen.getByText("Create account"));

    expect(mockRegister).toHaveBeenCalledWith(
      "john@example.com",
      "password123",
      "John Doe",
      "My Team",
      "Acme Corp"
    );
  });

  it("calls register without company when empty", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterPage />);

    await user.type(screen.getByLabelText("Your Name"), "Jane");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Account Name"), "My Team");
    await user.click(screen.getByText("Create account"));

    expect(mockRegister).toHaveBeenCalledWith(
      "jane@example.com",
      "password123",
      "Jane",
      "My Team",
      undefined
    );
  });

  it("shows loading state during registration", async () => {
    const user = userEvent.setup();
    let resolveRegister: () => void;
    mockRegister.mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      })
    );

    render(<RegisterPage />);
    await user.type(screen.getByLabelText("Your Name"), "John");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Account Name"), "Team");
    await user.click(screen.getByText("Create account"));

    expect(screen.getByText("Creating account...")).toBeInTheDocument();
    resolveRegister!();
  });

  it("shows error message on registration failure", async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValue(new Error("Email already exists"));

    render(<RegisterPage />);
    await user.type(screen.getByLabelText("Your Name"), "John");
    await user.type(screen.getByLabelText("Email"), "john@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Account Name"), "Team");
    await user.click(screen.getByText("Create account"));

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });
  });

  it("has required fields", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText("Your Name")).toHaveAttribute("required");
    expect(screen.getByLabelText("Email")).toHaveAttribute("required");
    expect(screen.getByLabelText("Password")).toHaveAttribute("required");
    expect(screen.getByLabelText("Account Name")).toHaveAttribute("required");
  });

  it("password has minimum length", () => {
    render(<RegisterPage />);
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("minLength", "8");
  });

  it("email input has type email", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("password input has type password", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });
});
