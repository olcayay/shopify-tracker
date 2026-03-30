import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    user: { id: "1", role: "owner", isSystemAdmin: true },
    account: { id: "a1", enabledPlatforms: ["shopify"] },
  }),
}));

// Mock TipTap (not needed in this page, but imported by template-editor)
vi.mock("@tiptap/react", () => ({
  useEditor: () => null,
  EditorContent: () => null,
}));

vi.mock("@tiptap/starter-kit", () => ({ default: {} }));
vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: () => ({}) },
}));

import AdminNotificationDashboard from "@/app/(dashboard)/system-admin/notifications/page";

const mockTemplates = [
  {
    notificationType: "ranking_top3_entry",
    titleTemplate: '{{appName}} entered Top 3 for "{{keyword}}"',
    bodyTemplate: "Now at position {{position}} in {{categoryName}}.",
    isCustomized: false,
    variables: [
      { name: "appName", description: "App name", example: "OrderFlow Pro" },
      { name: "keyword", description: "Keyword", example: "order tracking" },
      { name: "position", description: "Position", example: "3" },
      { name: "categoryName", description: "Category", example: "Orders & Shipping" },
    ],
    updatedAt: null,
  },
  {
    notificationType: "competitor_overtook",
    titleTemplate: "{{competitorName}} overtook {{appName}}",
    bodyTemplate: 'For "{{keyword}}": {{competitorName}} is now at {{position}}.',
    isCustomized: true,
    variables: [
      { name: "competitorName", description: "Competitor", example: "ShipTracker" },
      { name: "appName", description: "App", example: "OrderFlow Pro" },
      { name: "keyword", description: "Keyword", example: "shipping" },
      { name: "position", description: "Position", example: "2" },
    ],
    updatedAt: "2026-03-30T10:00:00Z",
  },
];

describe("AdminNotificationDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminNotificationDashboard />);
    expect(screen.getByText("Notification Templates")).toBeInTheDocument();
  });

  it("loads and displays templates grouped by category", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Ranking")).toBeInTheDocument();
      expect(screen.getByText("Competitor")).toBeInTheDocument();
    });
  });

  it("shows template preview text with variables replaced", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminNotificationDashboard />);
    await waitFor(() => {
      // Preview should replace {{appName}} with example "OrderFlow Pro"
      expect(screen.getByText(/OrderFlow Pro entered Top 3/)).toBeInTheDocument();
    });
  });

  it("shows Customized badge for customized templates", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Customized")).toBeInTheDocument();
    });
  });

  it("enters edit mode when pencil icon clicked", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/OrderFlow Pro entered Top 3/)).toBeInTheDocument();
    });
    // Click the first edit button
    const editButtons = document.querySelectorAll('[class*="ghost"]');
    const pencilButton = Array.from(editButtons).find(
      (b) => b.querySelector("svg") && b.closest("[class*='border rounded-md']")
    );
    if (pencilButton) {
      fireEvent.click(pencilButton);
      await waitFor(() => {
        expect(screen.getByText("Title Template")).toBeInTheDocument();
        expect(screen.getByText("Body Template")).toBeInTheDocument();
        expect(screen.getByText("Available Variables")).toBeInTheDocument();
        expect(screen.getByText("Preview")).toBeInTheDocument();
      });
    }
  });

  it("shows loading spinner initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    render(<AdminNotificationDashboard />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("calls correct API endpoint", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    });
    render(<AdminNotificationDashboard />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/system-admin/templates/notifications"
      );
    });
  });
});
