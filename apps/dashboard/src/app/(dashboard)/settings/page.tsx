"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, UserPlus, Mail } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { user, account, fetchWithAuth, refreshUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Account state
  const [accountName, setAccountName] = useState("");
  const [accountCompany, setAccountCompany] = useState("");

  // Create user state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"editor" | "viewer">("viewer");

  const isOwner = user?.role === "owner";

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (account) {
      setAccountName(account.name);
      setAccountCompany(account.company || "");
    }
  }, [account]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const membersRes = await fetchWithAuth("/api/account/members");
    if (membersRes.ok) setMembers(await membersRes.json());
  }

  async function handleAction(
    path: string,
    method: string,
    body?: any,
    successMsg?: string
  ) {
    setError("");
    setMessage("");
    const res = await fetchWithAuth(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) {
      setMessage(successMsg || "Done");
      await Promise.all([loadData(), refreshUser()]);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Operation failed");
    }
  }

  async function handleAccountUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const body: Record<string, string> = {};
    if (accountName !== account?.name) body.name = accountName;
    if (accountCompany !== (account?.company || "")) body.company = accountCompany;

    if (Object.keys(body).length === 0) {
      setMessage("No changes to save");
      return;
    }

    await handleAction("/api/account", "PUT", body, "Account updated");
  }

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

    await handleAction("/api/auth/me", "PATCH", body, "Profile updated");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    await handleAction(
      "/api/auth/me",
      "PATCH",
      { currentPassword, newPassword },
      "Password changed"
    );
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim() || !newUserPassword.trim()) return;
    await handleAction(
      "/api/account/members",
      "POST",
      {
        email: newUserEmail.trim(),
        name: newUserName.trim(),
        password: newUserPassword.trim(),
        role: newUserRole,
      },
      "User created"
    );
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("viewer");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {(message || error) && (
        <div
          className={`text-sm px-3 py-2 rounded-md ${error ? "text-destructive bg-destructive/10" : "text-green-700 bg-green-50"}`}
        >
          {error || message}
        </div>
      )}

      {/* Account Info & Package */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Account
            {account?.package && (
              <Badge variant="outline" className="text-sm font-normal">
                {account.package.name}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {account?.name}{account?.company ? ` · ${account.company}` : ""} · {user?.role}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner && (
            <form onSubmit={handleAccountUpdate} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Account Name</label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account name"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Company</label>
                <Input
                  value={accountCompany}
                  onChange={(e) => setAccountCompany(e.target.value)}
                  placeholder="Company name (optional)"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" className="mb-0.5">
                Save
              </Button>
            </form>
          )}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            {([
              { href: "/apps", usage: account?.usage.trackedApps, limit: account?.limits.maxTrackedApps, pkgLimit: account?.packageLimits?.maxTrackedApps, label: "My Apps" },
              { href: "/keywords", usage: account?.usage.trackedKeywords, limit: account?.limits.maxTrackedKeywords, pkgLimit: account?.packageLimits?.maxTrackedKeywords, label: "Keywords" },
              { href: "/competitors", usage: account?.usage.competitorApps, limit: account?.limits.maxCompetitorApps, pkgLimit: account?.packageLimits?.maxCompetitorApps, label: "Competitors" },
            ] as const).map(({ href, usage, limit, pkgLimit, label }) => {
              const isOverridden = pkgLimit != null && limit !== pkgLimit;
              return (
                <Link key={label} href={href} className="block hover:bg-accent/50 rounded-lg p-3 -m-1 transition-colors">
                  <p className="text-2xl font-bold">
                    {usage}/{limit}
                    {isOverridden && <span className="text-amber-500 text-sm ml-0.5" title={`Package default: ${pkgLimit}`}>*</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </Link>
              );
            })}
            <div className="rounded-lg p-3 -m-1">
              <p className="text-2xl font-bold">
                {account?.usage.users}/{account?.limits.maxUsers}
                {account?.packageLimits && account?.limits.maxUsers !== account?.packageLimits.maxUsers && (
                  <span className="text-amber-500 text-sm ml-0.5" title={`Package default: ${account.packageLimits.maxUsers}`}>*</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">Users</p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Team Members (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage who has access to this account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Name"
                required
              />
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Email address"
                required
              />
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                required
                minLength={8}
              />
              <div className="flex gap-2">
                <select
                  value={newUserRole}
                  onChange={(e) =>
                    setNewUserRole(e.target.value as "editor" | "viewer")
                  }
                  className="border rounded-md px-3 py-2 text-sm bg-background flex-1"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <Button type="submit" variant="outline">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Create User
                </Button>
              </div>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-sm">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {m.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleAction(
                              `/api/account/members/${m.id}`,
                              "DELETE",
                              undefined,
                              "Member removed"
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Email Notifications */}
      <Card>
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
      </Card>
    </div>
  );
}
