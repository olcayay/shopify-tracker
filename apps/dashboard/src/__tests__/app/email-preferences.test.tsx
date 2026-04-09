import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { mockAuthContext } from "../test-utils";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    ...mockAuthContext,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

vi.mock("@/contexts/feature-flags-context", () => ({
  useFeatureFlag: () => true,
  useFeatureFlags: () => ({ enabledFeatures: [], hasFeature: () => true }),
}));

vi.mock("@/lib/platform-display", () => ({
  PLATFORM_DISPLAY: {
    shopify: { label: "Shopify", color: "#96bf48" },
    salesforce: { label: "Salesforce", color: "#00a1e0" },
  },
}));

import EmailPreferencesPage from "@/app/(dashboard)/settings/email-preferences/page";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const mockAppsResponse = {
  apps: [
    { appId: 1, slug: "app-one", name: "App One", platform: "shopify", iconUrl: null, dailyDigestEnabled: true },
    { appId: 2, slug: "app-two", name: "App Two", platform: "shopify", iconUrl: "https://example.com/icon.png", dailyDigestEnabled: false },
    { appId: 3, slug: "sf-app", name: "SF App", platform: "salesforce", iconUrl: null, dailyDigestEnabled: true },
  ],
};

function setupMocks() {
  mockFetchWithAuth.mockImplementation((url: string) => {
    if (url.includes("/api/email-preferences/apps")) {
      return Promise.resolve(makeJsonResponse(mockAppsResponse));
    }
    if (url.includes("/api/email-preferences")) {
      return Promise.resolve(makeJsonResponse({ categories: [] }));
    }
    if (url.includes("/api/notifications/preferences")) {
      return Promise.resolve(makeJsonResponse({ preferences: [] }));
    }
    return Promise.resolve(makeJsonResponse(null));
  });
}

describe("EmailPreferencesPage - App Email Reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", async () => {
    setupMocks();
    render(<EmailPreferencesPage />);
    expect(screen.getByText("Email & Notification Preferences")).toBeInTheDocument();
  });

  it("renders App Email Reports section with tracked apps", async () => {
    setupMocks();
    render(<EmailPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText("App Email Reports")).toBeInTheDocument();
    });
    expect(screen.getByText("App One")).toBeInTheDocument();
    expect(screen.getByText("App Two")).toBeInTheDocument();
    expect(screen.getByText("SF App")).toBeInTheDocument();
  });

  it("groups apps by platform", async () => {
    setupMocks();
    render(<EmailPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText("Shopify")).toBeInTheDocument();
      expect(screen.getByText("Salesforce")).toBeInTheDocument();
    });
  });

  it("shows app count per platform", async () => {
    setupMocks();
    render(<EmailPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText("(2)")).toBeInTheDocument(); // 2 shopify apps
      expect(screen.getByText("(1)")).toBeInTheDocument(); // 1 salesforce app
    });
  });

  it("renders toggle switches for each app", async () => {
    setupMocks();
    render(<EmailPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBe(3); // 3 apps
  });

  it("renders Select All / Deselect All buttons per platform", async () => {
    setupMocks();
    render(<EmailPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });
    // Shopify: both enabled? No (App Two is disabled) → "Select All"
    // Salesforce: all enabled → "Deselect All"
    expect(screen.getByText("Select All")).toBeInTheDocument();
    expect(screen.getByText("Deselect All")).toBeInTheDocument();
  });

  it("calls toggle API when clicking app switch", async () => {
    setupMocks();
    render(<EmailPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });
    const callsBefore = mockFetchWithAuth.mock.calls.length;
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]); // Toggle App One
    // Verify an additional fetch call was made (the PATCH)
    await waitFor(() => {
      expect(mockFetchWithAuth.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("shows empty state when no tracked apps", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/email-preferences/apps")) {
        return Promise.resolve(makeJsonResponse({ apps: [] }));
      }
      if (url.includes("/api/email-preferences")) {
        return Promise.resolve(makeJsonResponse({ categories: [] }));
      }
      if (url.includes("/api/notifications/preferences")) {
        return Promise.resolve(makeJsonResponse({ preferences: [] }));
      }
      return Promise.resolve(makeJsonResponse(null));
    });
    render(<EmailPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText(/No tracked apps/)).toBeInTheDocument();
    });
  });
});
