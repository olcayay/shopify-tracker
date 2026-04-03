"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { initPostHog, identifyUser, resetPostHog } from "@/lib/posthog";

/**
 * PostHog initialization and user identification.
 * Renders nothing — just initializes tracking on mount.
 * No-op if NEXT_PUBLIC_POSTHOG_KEY is not set.
 */
export function PostHogProvider() {
  const { user } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (user) {
      identifyUser(user.id, {
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } else {
      resetPostHog();
    }
  }, [user]);

  return null;
}
