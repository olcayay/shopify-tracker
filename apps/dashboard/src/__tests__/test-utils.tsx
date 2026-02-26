import React, { type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { vi } from "vitest";
import type { User, Account } from "@/lib/auth-context";

// Default mock user
export const mockUser: User = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "owner",
  isSystemAdmin: false,
  emailDigestEnabled: true,
  timezone: "Europe/Istanbul",
};

export const mockAdminUser: User = {
  ...mockUser,
  id: "admin-1",
  name: "Admin User",
  isSystemAdmin: true,
};

export const mockViewerUser: User = {
  ...mockUser,
  id: "viewer-1",
  name: "Viewer User",
  role: "viewer",
};

export const mockAccount: Account = {
  id: "account-1",
  name: "Test Account",
  company: "Test Co",
  isSuspended: false,
  package: { slug: "pro", name: "Pro" },
  packageLimits: {
    maxTrackedApps: 10,
    maxTrackedKeywords: 50,
    maxCompetitorApps: 20,
    maxUsers: 5,
  },
  limits: {
    maxTrackedApps: 10,
    maxTrackedKeywords: 50,
    maxCompetitorApps: 20,
    maxUsers: 5,
  },
  usage: {
    trackedApps: 3,
    trackedKeywords: 10,
    competitorApps: 5,
    starredFeatures: 2,
    users: 2,
  },
};

// Mock auth context value
export const mockAuthContext = {
  user: mockUser,
  account: mockAccount,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  fetchWithAuth: vi.fn(),
};

// Create a mock AuthContext provider
const AuthContext = React.createContext(mockAuthContext);

export function MockAuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<typeof mockAuthContext>;
}) {
  const merged = { ...mockAuthContext, ...value };
  return (
    <AuthContext.Provider value={merged}>{children}</AuthContext.Provider>
  );
}

// Setup auth mock for a test file — call this in beforeEach
export function setupAuthMock(overrides?: Partial<typeof mockAuthContext>) {
  const ctx = { ...mockAuthContext, ...overrides };
  vi.doMock("@/lib/auth-context", () => ({
    useAuth: () => ctx,
    AuthProvider: ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>
    ),
  }));
  return ctx;
}

// Render helper with common wrappers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions
) {
  return render(ui, { ...options });
}
