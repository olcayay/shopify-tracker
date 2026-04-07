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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Mail, RotateCw, X } from "lucide-react";
import { AccountUsageCards, USAGE_STAT_PRESETS } from "@/components/account-usage-cards";
import { BillingCard } from "@/components/billing-card";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { ConfirmModal } from "@/components/confirm-modal";
import { Download } from "lucide-react";

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastSeenAt?: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  invitedByName?: string;
  expired: boolean;
  accepted: boolean;
}

type UnifiedRow =
  | { type: "member"; data: Member }
  | { type: "invitation"; data: Invitation };

export default function SettingsPage() {
  const { user, account, fetchWithAuth, refreshUser } = useAuth();
  const hasResearch = useFeatureFlag("market-research");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
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

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [inviteLoading, setInviteLoading] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", confirmLabel: "", onConfirm: () => {} });

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
    const [membersRes, invitationsRes] = await Promise.all([
      fetchWithAuth("/api/account/members"),
      isOwner ? fetchWithAuth("/api/account/invitations") : Promise.resolve(null),
    ]);
    if (membersRes.ok) setMembers(await membersRes.json());
    if (invitationsRes?.ok) setInvitations(await invitationsRes.json());
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
      toast.success(successMsg || "Done");
      await Promise.all([loadData(), refreshUser()]);
    } else {
      const data = await res.json().catch(() => ({}));
      const errMsg = data.error || "Operation failed";
      setError(errMsg);
      toast.error(errMsg);
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setError("");
    setMessage("");
    const res = await fetchWithAuth("/api/account/members/invite", {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    if (res.ok) {
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("viewer");
      await Promise.all([loadData(), refreshUser()]);
    } else {
      const data = await res.json().catch(() => ({}));
      const errMsg = data.error || "Failed to send invitation";
      setError(errMsg);
      toast.error(errMsg);
    }
    setInviteLoading(false);
  }

  async function handleResendInvitation(inv: Invitation) {
    await handleAction(
      `/api/account/invitations/${inv.id}/resend`,
      "POST",
      undefined,
      `Invitation resent to ${inv.email}`
    );
  }

  function confirmDeleteMember(m: Member) {
    setConfirmModal({
      open: true,
      title: "Remove Member",
      description: `Are you sure you want to remove ${m.name} (${m.email}) from this account? They will lose access immediately.`,
      confirmLabel: "Remove Member",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        await handleAction(`/api/account/members/${m.id}`, "DELETE", undefined, "Member removed");
      },
    });
  }

  function confirmCancelInvitation(inv: Invitation) {
    setConfirmModal({
      open: true,
      title: "Cancel Invitation",
      description: `Are you sure you want to cancel the invitation for ${inv.email}?`,
      confirmLabel: "Cancel Invitation",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        await handleAction(`/api/account/invitations/${inv.id}`, "DELETE", undefined, "Invitation cancelled");
      },
    });
  }

  // Build unified rows: active members first, then pending invitations, then expired
  const pendingInvitations = invitations.filter((i) => !i.accepted && !i.expired);
  const expiredInvitations = invitations.filter((i) => !i.accepted && i.expired);
  const unifiedRows: UnifiedRow[] = [
    ...members.map((m) => ({ type: "member" as const, data: m })),
    ...pendingInvitations.map((i) => ({ type: "invitation" as const, data: i })),
    ...expiredInvitations.map((i) => ({ type: "invitation" as const, data: i })),
  ];

  const totalUsed = members.length + pendingInvitations.length;
  const maxUsers = account?.limits.maxUsers ?? 0;

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

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        destructive
      />

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
          <AccountUsageCards stats={[
            { key: "apps", ...USAGE_STAT_PRESETS.apps, value: account?.usage.trackedApps ?? 0, limit: account?.limits.maxTrackedApps ?? 0, href: "/apps" },
            { key: "keywords", ...USAGE_STAT_PRESETS.keywords, value: account?.usage.trackedKeywords ?? 0, limit: account?.limits.maxTrackedKeywords ?? 0, href: "/keywords" },
            { key: "competitors", ...USAGE_STAT_PRESETS.competitors, value: account?.usage.competitorApps ?? 0, limit: account?.limits.maxCompetitorApps ?? 0, href: "/competitors" },
            { key: "research", ...USAGE_STAT_PRESETS.research, value: account?.usage.researchProjects ?? 0, limit: account?.limits.maxResearchProjects ?? 0, href: "/research", show: hasResearch },
            { key: "users", ...USAGE_STAT_PRESETS.users, value: account?.usage.users ?? 0, limit: account?.limits.maxUsers ?? 0 },
          ]} />
        </CardContent>
      </Card>

      {/* Profile */}
      {/* Billing */}
      <BillingCard />

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

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {isOwner
              ? `Manage who has access to this account · ${totalUsed} of ${maxUsers} seats used`
              : "People with access to this account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner && (
            <form onSubmit={handleInvite} className="flex gap-2 items-center">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                required
                className="max-w-xs"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "editor" | "viewer")
                }
                className="border rounded-md px-3 py-2 text-sm bg-background h-9"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <Button type="submit" variant="outline" disabled={inviteLoading}>
                <Mail className="h-4 w-4 mr-1" />
                {inviteLoading ? "Sending..." : "Send Invitation"}
              </Button>
            </form>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Signed Up</TableHead>
                <TableHead>Last Login</TableHead>
                {isOwner && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {unifiedRows.map((row) => {
                if (row.type === "member") {
                  const m = row.data;
                  // Find matching invitation for this member (accepted)
                  const matchingInv = invitations.find(
                    (i) => i.email === m.email && i.accepted
                  );
                  return (
                    <TableRow key={`member-${m.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {m.role === "owner" && "👑 "}{m.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {matchingInv ? formatDate(matchingInv.createdAt) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {timeAgo(m.lastSeenAt)}
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          {m.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDeleteMember(m)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                } else {
                  const inv = row.data;
                  return (
                    <TableRow key={`inv-${inv.id}`}>
                      <TableCell>
                        <div>
                          <p className="text-sm text-muted-foreground">{inv.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{inv.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {inv.expired ? (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">
                            Expired
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(inv.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      <TableCell className="text-sm text-muted-foreground">—</TableCell>
                      {isOwner && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Resend invitation"
                              onClick={() => handleResendInvitation(inv)}
                            >
                              <RotateCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cancel invitation"
                              onClick={() => confirmCancelInvitation(inv)}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                }
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
