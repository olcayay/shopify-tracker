"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscribeToPush, isPushSupported, getPermissionStatus } from "@/lib/push-notifications";
import { useAuth } from "@/lib/auth-context";

const DISMISS_KEY = "push-banner-dismissed";
const DISMISS_DURATION_DAYS = 30;

/**
 * Two-step push permission banner (PLA-690).
 * Shows a soft-ask banner first, then triggers the browser dialog on "Enable".
 * Remembers dismissal for 30 days.
 */
export function PushPermissionBanner() {
  const { accessToken } = useAuth();
  const [show, setShow] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Don't show if:
    // 1. Push not supported
    // 2. Already granted
    // 3. Denied (can't ask again)
    // 4. Recently dismissed
    if (!isPushSupported()) return;

    const status = getPermissionStatus();
    if (status === "granted" || status === "denied") return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed).getTime();
      if (Date.now() - dismissedAt < DISMISS_DURATION_DAYS * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Show banner after a short delay (don't interrupt initial page load)
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const success = await subscribeToPush(
        process.env.NEXT_PUBLIC_VAPID_KEY || "",
        apiUrl,
        accessToken || ""
      );
      if (success) {
        setShow(false);
      }
    } finally {
      setSubscribing(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setShow(false);
  };

  const handleNever = () => {
    localStorage.setItem(DISMISS_KEY, new Date(2099, 0, 1).toISOString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-card shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Enable push notifications</p>
          <p className="text-xs text-muted-foreground mt-1">
            Get instant alerts for ranking changes, new reviews, and competitor activity.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnable} disabled={subscribing}>
              {subscribing ? "Enabling..." : "Enable"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Not now
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground ml-auto"
              onClick={handleNever}
            >
              Never
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
