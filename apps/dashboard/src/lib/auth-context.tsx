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
  isSuspended: boolean;
  limits: {
    maxTrackedApps: number;
    maxTrackedKeywords: number;
    maxCompetitorApps: number;
    maxTrackedFeatures: number;
    maxUsers: number;
  };
  usage: {
    trackedApps: number;
    trackedKeywords: number;
    competitorApps: number;
    trackedFeatures: number;
    users: number;
  };
}

interface AuthState {
  user: User | null;
  account: Account | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    accountName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  fetchWithAuth: (path: string, options?: RequestInit) => Promise<Response>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchWithAuth = useCallback(
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

  const refreshUser = useCallback(async () => {
    const token = getCookie("access_token");
    if (!token) {
      setUser(null);
      setAccount(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setAccount(data.account);
      } else {
        setUser(null);
        setAccount(null);
      }
    } catch {
      setUser(null);
      setAccount(null);
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
    router.push("/");
    router.refresh();
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    accountName: string
  ) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, accountName }),
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
    router.push("/");
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
    router.push("/login");
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        account,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        fetchWithAuth,
      }}
    >
      {children}
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
