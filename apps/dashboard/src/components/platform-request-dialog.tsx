"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { CheckCircle } from "lucide-react";

export function PlatformRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { fetchWithAuth } = useAuth();
  const [platformName, setPlatformName] = useState("");
  const [marketplaceUrl, setMarketplaceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPlatformName("");
    setMarketplaceUrl("");
    setNotes("");
    setSubmitted(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!platformName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/account/platform-requests", {
        method: "POST",
        body: JSON.stringify({
          platformName: platformName.trim(),
          marketplaceUrl: marketplaceUrl.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to submit request");
      }
    } catch {
      setError("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:w-[400px]">
        <SheetTitle className="text-lg font-semibold mb-4">
          Request a Platform
        </SheetTitle>

        {submitted ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">Thank you!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              We&apos;ve received your platform request. We&apos;ll review it
              and let you know when it&apos;s available.
            </p>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Platform Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g., Monday.com Apps"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Marketplace URL
              </label>
              <Input
                placeholder="e.g., https://monday.com/marketplace"
                value={marketplaceUrl}
                onChange={(e) => setMarketplaceUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Notes
              </label>
              <textarea
                placeholder="Why would this platform be useful for you?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !platformName.trim()}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
