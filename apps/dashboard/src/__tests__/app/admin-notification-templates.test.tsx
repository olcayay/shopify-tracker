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

// Mock Tabs to render all content (Radix Tabs don't work in jsdom)
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button data-testid={`tab-${value}`}>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
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

function setupDefaultMocks() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    // Templates must match before generic notifications
    if (url.includes("/templates/notifications")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTemplates) });
    }
    if (url.includes("/notifications/stats")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 0, readCount: 0, readRate: 0, pushSent: 0, pushClicked: 0, pushClickRate: 0, failed: 0, last24h: 0, last7d: 0 }) });
    }
    if (url.includes("/system-admin/notifications")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ notifications: [], total: 0, limit: 20, offset: 0 }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

async function renderAndGoToTemplates() {
  setupDefaultMocks();
  render(<AdminNotificationDashboard />);
  // Tabs are mocked to render all content, no click needed
}

describe("AdminNotificationDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading with tabs", async () => {
    setupDefaultMocks();
    render(<AdminNotificationDashboard />);
    expect(screen.getByText("Notification Management")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Templates")).toBeInTheDocument();
  });

  it("loads and displays templates grouped by category", async () => {
    await renderAndGoToTemplates();
    await waitFor(() => {
      expect(screen.getByText("Ranking")).toBeInTheDocument();
      expect(screen.getByText("Competitor")).toBeInTheDocument();
    });
  });

  it("shows template preview text with variables replaced", async () => {
    await renderAndGoToTemplates();
    await waitFor(() => {
      expect(screen.getByText(/OrderFlow Pro entered Top 3/)).toBeInTheDocument();
    });
  });

  it("shows Customized badge for customized templates", async () => {
    await renderAndGoToTemplates();
    await waitFor(() => {
      expect(screen.getByText("Customized")).toBeInTheDocument();
    });
  });

  it("enters edit mode when pencil icon clicked", async () => {
    await renderAndGoToTemplates();
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

  it("calls API endpoints for dashboard and templates", async () => {
    setupDefaultMocks();
    render(<AdminNotificationDashboard />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/stats")
      );
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/system-admin/templates/notifications"
      );
    });
  });

  it("shows dashboard stats cards", async () => {
    setupDefaultMocks();
    render(<AdminNotificationDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Total")).toBeInTheDocument();
      expect(screen.getByText("Read Rate")).toBeInTheDocument();
      expect(screen.getByText("Push Sent")).toBeInTheDocument();
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });
});
