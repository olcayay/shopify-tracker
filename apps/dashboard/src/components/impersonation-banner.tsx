"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useAuth();

  if (!impersonation?.isImpersonating) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          You are currently viewing the site as{" "}
          <strong>{impersonation.targetUser?.name}</strong> (
          {impersonation.targetUser?.email})
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="bg-amber-100 border-amber-700 text-amber-900 hover:bg-amber-200 hover:text-amber-900 hover:border-amber-700 h-7 text-xs shrink-0"
        onClick={stopImpersonation}
      >
        Stop Impersonating
      </Button>
    </div>
  );
}
