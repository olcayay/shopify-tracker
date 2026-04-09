"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useFeatureFlag } from "@/contexts/feature-flags-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Download } from "lucide-react";
import { DeleteAccountSection } from "@/components/delete-account-section";

export default function SettingsPage() {
  const { user, fetchWithAuth, refreshUser } = useAuth();
  const hasNotifications = useFeatureFlag("notifications");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const body: Record<string, string> = {};
    if (profileName !== user?.name) body.name = profileName;
    if (profileEmail !== user?.email) body.email = profileEmail;

    if (Object.keys(body).length === 0) {
      setMessage("No changes to save");
      return;
    }

    const res = await fetchWithAuth("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setMessage("Profile updated");
      toast.success("Profile updated");
      await refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      const errMsg = data.error || "Operation failed";
      setError(errMsg);
      toast.error(errMsg);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const res = await fetchWithAuth("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (res.ok) {
      setMessage("Password changed");
      toast.success("Password changed");
      await refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      const errMsg = data.error || "Operation failed";
      setError(errMsg);
      toast.error(errMsg);
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {(message || error) && (
        <div
          className={`text-sm px-3 py-2 rounded-md ${error ? "text-destructive bg-destructive/10" : "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20"}`}
        >
          {error || message}
        </div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Save Changes
            </Button>
          </form>

          <div className="border-t pt-6">
            <h3 className="text-sm font-medium mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  required
                />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  required
                  minLength={8}
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Change Password
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications — gated by feature flag */}
      {hasNotifications && (<Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Receive daily ranking reports with keyword position changes and competitor updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Daily Ranking Digest</p>
              <p className="text-xs text-muted-foreground">
                Keyword ranking changes, new entries, and competitor performance
              </p>
            </div>
            <Button
              variant={user?.emailDigestEnabled ? "default" : "outline"}
              size="sm"
              onClick={async () => {
                const res = await fetchWithAuth("/api/auth/me", {
                  method: "PATCH",
                  body: JSON.stringify({ emailDigestEnabled: !user?.emailDigestEnabled }),
                });
                if (res.ok) {
                  await refreshUser();
                  setMessage(user?.emailDigestEnabled ? "Email digest disabled" : "Email digest enabled");
                }
              }}
            >
              {user?.emailDigestEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Timezone</p>
              <p className="text-xs text-muted-foreground">
                Emails are sent at 08:00 in your timezone
              </p>
            </div>
            <select
              value={user?.timezone || "Europe/Istanbul"}
              onChange={async (e) => {
                const res = await fetchWithAuth("/api/auth/me", {
                  method: "PATCH",
                  body: JSON.stringify({ timezone: e.target.value }),
                });
                if (res.ok) {
                  await refreshUser();
                  setMessage("Timezone updated");
                }
              }}
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
            >
              <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
              <option value="Europe/London">Europe/London (UTC+0/+1)</option>
              <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
              <option value="America/New_York">America/New York (UTC-5/-4)</option>
              <option value="America/Los_Angeles">America/Los Angeles (UTC-8/-7)</option>
              <option value="America/Chicago">America/Chicago (UTC-6/-5)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
              <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
              <option value="Australia/Sydney">Australia/Sydney (UTC+10/+11)</option>
            </select>
          </div>
        </CardContent>
      </Card>)}

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Data & Privacy
          </CardTitle>
          <CardDescription>Download your personal data or delete your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetchWithAuth("/api/auth/export");
              if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "appranks-data-export.json";
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Data export downloaded");
              } else {
                toast.error("Failed to download data");
              }
            }}
          >
            <Download className="h-3 w-3 mr-1.5" />
            Download My Data
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Includes your profile, tracked apps, keywords, and account settings as JSON.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone — Delete Account */}
      <DeleteAccountSection />
    </div>
  );
}
