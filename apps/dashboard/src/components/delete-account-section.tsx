"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function DeleteAccountSection() {
  const { user, fetchWithAuth, logout } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  if (user?.role !== "owner") return null;

  const canDelete = password.length > 0 && confirmText === "DELETE";

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/auth/me", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        toast.success("Account deleted successfully");
        await logout();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete account");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!showConfirm ? (
          <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
            Delete Account
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              To confirm, enter your password and type <strong>DELETE</strong> below.
            </p>
            <Input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              placeholder='Type "DELETE" to confirm'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" disabled={!canDelete || loading} onClick={handleDelete}>
                {loading ? "Deleting..." : "Permanently Delete Account"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowConfirm(false); setPassword(""); setConfirmText(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
