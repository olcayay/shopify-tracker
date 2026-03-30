import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    user: { id: "1", role: "owner", isSystemAdmin: true },
    account: { id: "a1", enabledPlatforms: ["shopify"] },
  }),
}));

vi.mock("@tiptap/react", () => ({
  useEditor: () => null,
  EditorContent: () => null,
}));
vi.mock("@tiptap/starter-kit", () => ({ default: {} }));
vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: () => ({}) },
}));

import AdminEmailTemplates from "@/app/(dashboard)/system-admin/email-templates/page";

const mockTemplates = [
  {
    emailType: "email_ranking_alert",
    subjectTemplate: "Ranking Alert: {{appName}}",
    bodyTemplate: "{{appName}} ranking changed in {{categoryName}}.",
    isCustomized: false,
    variables: [
      { name: "appName", description: "App name", example: "OrderFlow Pro" },
      { name: "categoryName", description: "Category", example: "Orders & Shipping" },
    ],
    updatedAt: null,
  },
  {
    emailType: "email_welcome",
    subjectTemplate: "Welcome to AppRanks",
    bodyTemplate: "Welcome {{name}}! Your account is ready.",
    isCustomized: false,
    variables: [
      { name: "name", description: "User name", example: "Jane Doe" },
    ],
    updatedAt: null,
  },
  {
    emailType: "email_password_reset",
    subjectTemplate: "Reset your password",
    bodyTemplate: "Click the link to reset your password.",
    isCustomized: true,
    variables: [
      { name: "name", description: "User name", example: "Jane Doe" },
      { name: "resetUrl", description: "Reset URL", example: "https://appranks.io/reset" },
    ],
    updatedAt: "2026-03-30T10:00:00Z",
  },
];

describe("AdminEmailTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminEmailTemplates />);
    expect(screen.getByText("Email Templates")).toBeInTheDocument();
  });

  it("loads and displays templates grouped by category", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminEmailTemplates />);
    await waitFor(() => {
      expect(screen.getByText("Alert Emails")).toBeInTheDocument();
      expect(screen.getByText("Lifecycle")).toBeInTheDocument();
      expect(screen.getByText("Transactional")).toBeInTheDocument();
    });
  });

  it("shows preview with variables replaced by examples", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminEmailTemplates />);
    await waitFor(() => {
      expect(screen.getByText("Ranking Alert: OrderFlow Pro")).toBeInTheDocument();
    });
  });

  it("shows Customized badge for customized templates", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminEmailTemplates />);
    await waitFor(() => {
      expect(screen.getByText("Customized")).toBeInTheDocument();
    });
  });

  it("calls correct API endpoint", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminEmailTemplates />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/system-admin/templates/emails"
      );
    });
  });

  it("shows loading spinner initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    render(<AdminEmailTemplates />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
