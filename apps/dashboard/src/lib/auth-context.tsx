"use client";

import { trackEvent } from "@/lib/posthog";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { PLATFORM_IDS } from "@appranks/shared";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/confirm-modal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "viewer";
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
  enabledFeatures: string[];
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
  login: (email: string, password: string, returnUrl?: string) => Promise<void>;
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

const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${isSecure ? "; Secure" : ""}`;
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Valid platform slugs for auto-injection
const VALID_PLATFORMS = new Set<string>(PLATFORM_IDS);

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
  // Counter to force proactive refresh timer to re-arm after token rotation
  const [tokenGeneration, setTokenGeneration] = useState(0);

  // PLA-1112: Cross-tab coordination via BroadcastChannel.
  // Only one tab refreshes; others receive the new tokens via broadcast.
  const authChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("auth");
    authChannelRef.current = channel;
    channel.onmessage = (event) => {
      const { type, accessToken, refreshToken } = event.data ?? {};
      if (type === "refreshed" && accessToken && refreshToken) {
        setCookie("access_token", accessToken, 900);
        setCookie("refresh_token", refreshToken, 7 * 86400);
        setTokenGeneration((g) => g + 1);
      } else if (type === "logout") {
        deleteCookie("access_token");
        deleteCookie("refresh_token");
        setUser(null);
        setAccount(null);
        setImpersonation(null);
        router.push("/login");
      }
    };
    return () => { channel.close(); authChannelRef.current = null; };
  }, [router]);

  // Silent token refresh using refresh_token cookie
  // PLA-1112: single-owner refresh — only auth-context refreshes tokens.
  // Uses a mutex to prevent concurrent refresh requests within the same tab,
  // and BroadcastChannel to prevent races across tabs.
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const silentRefresh = useCallback(async (): Promise<boolean> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const doRefresh = async (): Promise<boolean> => {
      const refreshToken = getCookie("refresh_token");
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (res.ok) {
          const data = await res.json();
          setCookie("access_token", data.accessToken, 900);
          setCookie("refresh_token", data.refreshToken, 7 * 86400);
          try { authChannelRef.current?.postMessage({ type: "refreshed", accessToken: data.accessToken, refreshToken: data.refreshToken }); } catch {}
          return true;
        }
        // PLA-1112: handle 429 — wait Retry-After then retry once
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("Retry-After") || "10", 10);
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          const retryToken = getCookie("refresh_token");
          if (!retryToken) return false;
          const retry = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: retryToken }),
          });
          if (retry.ok) {
            const data = await retry.json();
            setCookie("access_token", data.accessToken, 900);
            setCookie("refresh_token", data.refreshToken, 7 * 86400);
            try { authChannelRef.current?.postMessage({ type: "refreshed", accessToken: data.accessToken, refreshToken: data.refreshToken }); } catch {}
            return true;
          }
        }
        return false;
      } catch {
        return false;
      }
    };

    refreshPromiseRef.current = doRefresh().finally(() => {
      refreshPromiseRef.current = null;
    });
    return refreshPromiseRef.current;
  }, []);

  // Redirect to login and broadcast logout to other tabs.
  // Guard with a ref to prevent multiple concurrent redirects (e.g. when
  // several useApiQuery hooks all hit 401 at the same time).
  const isRedirectingRef = useRef(false);
  const redirectToLogin = useCallback(() => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    deleteCookie("access_token");
    deleteCookie("refresh_token");
    setUser(null);
    setAccount(null);
    setImpersonation(null);
    try { authChannelRef.current?.postMessage({ type: "logout" }); } catch {}
    const returnUrl = typeof window !== "undefined" ? window.location.pathname : "/overview";
    router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  }, [router]);

  // Proactive token refresh — refresh 2 minutes before expiry (PLA-559)
  useEffect(() => {
    const token = getCookie("access_token");
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expiresAt = payload.exp * 1000;
      const refreshAt = expiresAt - 2 * 60 * 1000; // 2 min before expiry
      const delay = refreshAt - Date.now();
      if (delay <= 0) return;
      const timer = setTimeout(async () => {
        // PLA-1112: re-read token — it may have been refreshed by another tab
        const currentToken = getCookie("access_token");
        if (currentToken && currentToken !== token) {
          setTokenGeneration((g) => g + 1);
          return;
        }
        const ok = await silentRefresh();
        if (ok) {
          setTokenGeneration((g) => g + 1);
        } else {
          toast.warning("Your session is about to expire. Please save your work.", {
            duration: 10000,
          });
        }
      }, delay);
      return () => clearTimeout(timer);
    } catch {
      // Invalid token — skip proactive refresh
    }
  }, [user, silentRefresh, tokenGeneration]);

  const doFetch = useCallback(
    async (path: string, options?: RequestInit): Promise<Response> => {
      // If we're already redirecting to login, don't make any more API calls
      if (isRedirectingRef.current) {
        return new Response(JSON.stringify({ error: "Session expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      let token = getCookie("access_token");
      if (!token && !path.includes("/api/auth/")) {
        // Access token missing — try silent refresh before giving up
        const refreshed = await silentRefresh();
        if (refreshed) {
          token = getCookie("access_token");
        }
        if (!token) {
          toast.error("Session expired. Redirecting to login...", { duration: 3000 });
          redirectToLogin();
          return new Response(JSON.stringify({ error: "Session expired" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      if (options?.body) {
        headers["Content-Type"] = "application/json";
      }
      let res: Response;
      try {
        res = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            ...headers,
            ...(options?.headers || {}),
          },
        });
      } catch {
        // Network error — typically caused by API being down and Traefik
        // returning 502/503/504 without CORS headers, which the browser
        // blocks entirely. Return a synthetic 503 so callers get a clear
        // status instead of an opaque TypeError.
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again in a moment." }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }

      // Handle expired token — try silent refresh, then redirect to login
      if (res.status === 401 && token && !path.includes("/api/auth/")) {
        // Check again — another concurrent request may have already triggered redirect
        if (isRedirectingRef.current) {
          return new Response(JSON.stringify({ error: "Session expired" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const refreshed = await silentRefresh();
        if (refreshed) {
          // Retry the original request with the new token
          const newToken = getCookie("access_token");
          if (newToken) {
            return fetch(`${API_BASE}${path}`, {
              ...options,
              headers: { ...headers, Authorization: `Bearer ${newToken}`, ...(options?.headers || {}) },
            });
          }
        }
        // Refresh failed — clear state and redirect to login (PLA-559/PLA-1141)
        toast.error("Session expired. Redirecting to login...", { duration: 3000 });
        redirectToLogin();
      }

      return res;
    },
    [silentRefresh, router, redirectToLogin]
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
    let token = getCookie("access_token");

    // Access token expired/missing but refresh token exists — try silent refresh
    if (!token) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        token = getCookie("access_token");
      }
    }

    if (!token) {
      setUser(null);
      setAccount(null);
      setImpersonation(null);
      return;
    }
    const fetchMe = async (accessToken: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        return await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      let res: Response;
      try {
        res = await fetchMe(token);
        // Retry once on timeout/5xx — covers transient DB pool pressure (PLA-1097)
        if (res.status >= 500) {
          res = await fetchMe(token);
        }
      } catch {
        res = await fetchMe(token);
      }

      // PLA-1112: if /me returns 401, try silentRefresh then retry once
      if (res.status === 401) {
        const refreshed = await silentRefresh();
        if (refreshed) {
          const newToken = getCookie("access_token");
          if (newToken) {
            res = await fetchMe(newToken);
          }
        }
      }

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setAccount({
          ...data.account,
          enabledPlatforms: data.enabledPlatforms ?? ["shopify"],
          enabledFeatures: data.enabledFeatures ?? [],
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
  }, [silentRefresh]);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string, returnUrl?: string) => {
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
    trackEvent("user_logged_in", { role: data.user.role });
    // Redirect to returnUrl if safe (must start with / to prevent open redirect)
    const dest = returnUrl && returnUrl.startsWith("/") ? returnUrl : "/overview";
    router.push(dest);
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
    trackEvent("user_signed_up");
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
    trackEvent("user_logged_out");
    deleteCookie("access_token");
    deleteCookie("refresh_token");
    setUser(null);
    setAccount(null);
    setImpersonation(null);
    try { authChannelRef.current?.postMessage({ type: "logout" }); } catch {}
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
