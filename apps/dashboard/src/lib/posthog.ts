import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

/**
 * Initialize PostHog. No-op if NEXT_PUBLIC_POSTHOG_KEY is not set.
 */
export function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true, // Privacy: mask form inputs
    },
    persistence: "localStorage",
  });
  initialized = true;
}

/**
 * Identify a user for session tracking.
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, properties);
}

/**
 * Track a custom event.
 */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

/**
 * Reset PostHog on logout.
 */
export function resetPostHog() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}
