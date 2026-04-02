"use client";

import { useState } from "react";
import { MailWarning, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function EmailVerificationBanner() {
  const { user, fetchWithAuth } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  // Don't show if: no user, email verified, or dismissed
  if (!user || (user as any).emailVerifiedAt || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await fetchWithAuth("/api/auth/resend-verification", { method: "POST" });
      if (res.ok) {
        toast.success("Verification email sent! Check your inbox.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to send verification email");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MailWarning className="h-4 w-4 shrink-0" />
        <span>Please verify your email address.</span>
        <Button
          variant="link"
          size="sm"
          className="text-amber-800 dark:text-amber-200 underline p-0 h-auto"
          onClick={handleResend}
          disabled={sending}
        >
          {sending ? "Sending..." : "Resend verification email"}
        </Button>
      </div>
      <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
