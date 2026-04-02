"use client";

import { AlertOctagon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function SuspensionBanner() {
  const { account } = useAuth();

  if (!account?.isSuspended) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2 text-center text-sm">
      <AlertOctagon className="inline h-4 w-4 mr-1.5 -mt-0.5" />
      <strong>Account Suspended</strong> — Your account has been suspended. Please contact support at{" "}
      <a href="mailto:support@appranks.io" className="underline font-medium">
        support@appranks.io
      </a>{" "}
      to resolve this.
    </div>
  );
}
