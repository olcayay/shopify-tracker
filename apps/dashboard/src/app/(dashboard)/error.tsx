"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "@/components/ui/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const msg = error.message || "";
  const isApiUnavailable =
    msg.includes("fetch failed") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("503") ||
    msg.includes("Service Unavailable") ||
    msg.includes("API error: 500");

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 max-w-md mx-auto text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <h2 className="text-lg font-semibold">
        {isApiUnavailable ? "Service Temporarily Unavailable" : "Something went wrong"}
      </h2>
      <p className="text-muted-foreground text-sm">
        {isApiUnavailable
          ? "We're having trouble connecting to our servers. This is usually temporary — please try again in a moment."
          : "An unexpected error occurred. Please try refreshing the page."}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/overview">
            <Home className="h-4 w-4 mr-2" />
            Home
          </Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
