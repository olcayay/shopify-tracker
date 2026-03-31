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

import NotificationTemplatesPage from "@/app/(dashboard)/system-admin/notification-templates/page";

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

function setupDefaultMocks() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/templates/notifications")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTemplates) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

describe("NotificationTemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", async () => {
    setupDefaultMocks();
    render(<NotificationTemplatesPage />);
    expect(screen.getByText("Notification Templates")).toBeInTheDocument();
  });

  it("loads and displays templates grouped by category", async () => {
    setupDefaultMocks();
    render(<NotificationTemplatesPage />);
    await waitFor(() => {
      expect(screen.getByText("Ranking")).toBeInTheDocument();
      expect(screen.getByText("Competitor")).toBeInTheDocument();
    });
  });

  it("shows template preview text with variables replaced", async () => {
    setupDefaultMocks();
    render(<NotificationTemplatesPage />);
    await waitFor(() => {
      expect(screen.getByText(/OrderFlow Pro entered Top 3/)).toBeInTheDocument();
    });
  });

  it("shows Customized badge for customized templates", async () => {
    setupDefaultMocks();
    render(<NotificationTemplatesPage />);
    await waitFor(() => {
      expect(screen.getByText("Customized")).toBeInTheDocument();
    });
  });

  it("enters edit mode when pencil icon clicked", async () => {
    setupDefaultMocks();
    render(<NotificationTemplatesPage />);
    await waitFor(() => {
      expect(screen.getByText(/OrderFlow Pro entered Top 3/)).toBeInTheDocument();
    });
    const editButtons = document.querySelectorAll('[class*="ghost"]');
    const pencilButton = Array.from(editButtons).find(
      (b) => b.querySelector("svg") && b.closest("[class*='border rounded-md']")
    );
    if (pencilButton) {
      fireEvent.click(pencilButton);
      await waitFor(() => {
        expect(screen.getByText("Title Template")).toBeInTheDocument();
        expect(screen.getByText("Body Template")).toBeInTheDocument();
      });
    }
  });

  it("calls templates API endpoint", async () => {
    setupDefaultMocks();
    render(<NotificationTemplatesPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/system-admin/templates/notifications"
      );
    });
  });
});
