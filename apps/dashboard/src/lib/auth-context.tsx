"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/confirm-modal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  isSystemAdmin: boolean;
  emailDigestEnabled: boolean;
  timezone: string;
}

export interface Account {
  id: string;
  name: string;
  company?: string | null;
  isSuspended: boolean;
  package?: { slug: string; name: string } | null;
  packageLimits?: {
    maxTrackedApps: number;
    maxTrackedKeywords: number;
    maxCompetitorApps: number;
    maxUsers: number;
    maxResearchProjects: number;
    maxPlatforms: number;
  } | null;
  limits: {
    maxTrackedApps: number;
    maxTrackedKeywords: number;
    maxCompetitorApps: number;
    maxUsers: number;
    maxResearchProjects: number;
    maxPlatforms: number;
  };
  usage: {
    trackedApps: number;
    trackedKeywords: number;
    competitorApps: number;
    starredFeatures: number;
    users: number;
    researchProjects: number;
    platforms: number;
  };
  enabledPlatforms: string[];
}

export interface ImpersonationState {
  isImpersonating: boolean;
  realAdmin: { userId: string; email: string; name: string } | null;
  targetUser: { userId: string; email: string; name: string } | null;
}

interface AuthState {
  user: User | null;
  account: Account | null;
  isLoading: boolean;
  impersonation: ImpersonationState | null;
  globalPlatformVisibility: Record<string, boolean> | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    accountName: string,
    company?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  fetchWithAuth: (path: string, options?: RequestInit) => Promise<Response>;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Valid platform slugs for auto-injection
const VALID_PLATFORMS = new Set(["shopify", "salesforce", "canva", "wix", "wordpress", "google_workspace", "atlassian", "zoom", "zoho", "zendesk", "hubspot"]);

/** Extract platform from the current browser URL path (e.g. /salesforce/keywords → salesforce) */
function getPlatformFromPath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const seg = window.location.pathname.split("/")[1];
  return seg && VALID_PLATFORMS.has(seg) ? seg : undefined;
}

// Paths that should NOT get automatic platform injection
const PLATFORM_EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/system-admin/",
  "/api/account/members",
  "/api/platforms",
  "/api/cross-platform/",
  "/api/developers",
];

/** Append ?platform= to an API path if not already present and applicable */
function withAutoPlatform(path: string): string {
  // Already has platform param
  if (/[?&]platform=/.test(path)) return path;
  // Skip exempt paths
  if (PLATFORM_EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return path;
  const platform = getPlatformFromPath();
  if (!platform) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}platform=${platform}`;
}

// Paths that should skip the impersonation confirmation dialog
const IMPERSONATION_SKIP_PATHS = [
  "/api/system-admin/stop-impersonation",
  "/api/system-admin/impersonate/",
  "/api/auth/me",
  "/api/auth/logout",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonation, setImpersonation] =
    useState<ImpersonationState | null>(null);
  const [globalPlatformVisibility, setGlobalPlatformVisibility] =
    useState<Record<string, boolean> | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    resolve: () => void;
    reject: () => void;
  } | null>(null);
  const router = useRouter();

  const doFetch = useCallback(
    async (path: string, options?: RequestInit): Promise<Response> => {
      const token = getCookie("access_token");
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      if (options?.body) {
        headers["Content-Type"] = "application/json";
      }
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(options?.headers || {}),
        },
      });
    },
    []
  );

  const fetchWithAuth = useCallback(
    async (rawPath: string, options?: RequestInit): Promise<Response> => {
      const path = withAutoPlatform(rawPath);
      const method = (options?.method || "GET").toUpperCase();
      const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
      const shouldSkip = IMPERSONATION_SKIP_PATHS.some((p) =>
        path.includes(p)
      );

      // Show confirmation dialog for mutating requests during impersonation
      if (
        impersonation?.isImpersonating &&
        isMutating &&
        !shouldSkip
      ) {
        const confirmed = await new Promise<boolean>((resolve) => {
          setPendingConfirm({
            resolve: () => {
              resolve(true);
              setPendingConfirm(null);
            },
            reject: () => {
              resolve(false);
              setPendingConfirm(null);
            },
          });
        });
        if (!confirmed) {
          throw new Error("Action cancelled by user");
        }
      }

      return doFetch(path, options);
    },
    [doFetch, impersonation]
  );

  const refreshUser = useCallback(async () => {
    const token = getCookie("access_token");
    if (!token) {
      setUser(null);
      setAccount(null);
      setImpersonation(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setAccount({
          ...data.account,
          enabledPlatforms: data.enabledPlatforms ?? ["shopify"],
        });
        if (data.impersonation) {
          setImpersonation(data.impersonation);
        } else {
          setImpersonation(null);
        }
        setGlobalPlatformVisibility(data.globalPlatformVisibility ?? null);
      } else {
        setUser(null);
        setAccount(null);
        setImpersonation(null);
        setGlobalPlatformVisibility(null);
      }
    } catch {
      setUser(null);
      setAccount(null);
      setImpersonation(null);
      setGlobalPlatformVisibility(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Login failed");
    }

    const data = await res.json();
    setCookie("access_token", data.accessToken, 900);
    setCookie("refresh_token", data.refreshToken, 7 * 86400);
    setUser(data.user);
    await refreshUser();
    router.push("/overview");
    router.refresh();
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    accountName: string,
    company?: string
  ) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, accountName, company: company || undefined }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Registration failed");
    }

    const data = await res.json();
    setCookie("access_token", data.accessToken, 900);
    setCookie("refresh_token", data.refreshToken, 7 * 86400);
    setUser(data.user);
    await refreshUser();
    router.push("/overview");
    router.refresh();
  };

  const logout = async () => {
    const refreshToken = getCookie("refresh_token");
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignore logout errors
    }
    deleteCookie("access_token");
    deleteCookie("refresh_token");
    setUser(null);
    setAccount(null);
    setImpersonation(null);
    router.push("/login");
    router.refresh();
  };

  const startImpersonation = async (userId: string) => {
    const res = await doFetch(
      `/api/system-admin/impersonate/${userId}`,
      { method: "POST" }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to start impersonation");
    }
    const data = await res.json();
    setCookie("access_token", data.accessToken, 1800); // 30 min
    // Do NOT update refresh_token — keep admin's refresh token
    await refreshUser();
    router.push("/overview");
    router.refresh();
  };

  const stopImpersonation = async () => {
    const res = await doFetch("/api/system-admin/stop-impersonation", {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error("Failed to stop impersonation");
    }
    const data = await res.json();
    setCookie("access_token", data.accessToken, 900); // normal 15 min
    setImpersonation(null);
    await refreshUser();
    router.push("/system-admin/users");
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        account,
        isLoading,
        impersonation,
        globalPlatformVisibility,
        login,
        register,
        logout,
        refreshUser,
        fetchWithAuth,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
      <ConfirmModal
        open={!!pendingConfirm}
        title="Confirm action on behalf of user"
        description={`You are about to perform this action on behalf of ${impersonation?.targetUser?.name} (${impersonation?.targetUser?.email}). Are you sure you want to proceed?`}
        confirmLabel="Proceed"
        cancelLabel="Cancel"
        onConfirm={() => pendingConfirm?.resolve()}
        onCancel={() => pendingConfirm?.reject()}
        destructive={false}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
