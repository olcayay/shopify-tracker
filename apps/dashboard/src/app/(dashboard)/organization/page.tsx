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
import { Trash2, Mail, RotateCw, X, Building2 } from "lucide-react";
import { AccountUsageCards, USAGE_STAT_PRESETS } from "@/components/account-usage-cards";
import { BillingCard } from "@/components/billing-card";
import { ConfirmModal } from "@/components/confirm-modal";
import { ActivityLog } from "@/components/activity-log";

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "\u2014";
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
  if (!date) return "\u2014";
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

export default function OrganizationPage() {
  const { user, account, fetchWithAuth, refreshUser } = useAuth();
  const hasResearch = useFeatureFlag("market-research");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Account state
  const [accountName, setAccountName] = useState("");
  const [accountCompany, setAccountCompany] = useState("");

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer");
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
  const isAdmin = user?.role === "admin";
  const canManageMembers = isOwner || isAdmin;

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
      canManageMembers ? fetchWithAuth("/api/account/invitations") : Promise.resolve(null),
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

    await handleAction("/api/account", "PUT", body, "Organization updated");
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
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        Organization
      </h1>

      {(message || error) && (
        <div
          className={`text-sm px-3 py-2 rounded-md ${error ? "text-destructive bg-destructive/10" : "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20"}`}
        >
          {error || message}
        </div>
      )}

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        destructive
      />

      {/* Organization Info & Package */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Organization
            {account?.package && (
              <Badge variant="outline" className="text-sm font-normal">
                {account.package.name}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {account?.name}{account?.company ? ` \u00B7 ${account.company}` : ""} \u00B7 {user?.role}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner && (
            <form onSubmit={handleAccountUpdate} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Organization Name</label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Organization name"
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

      {/* Billing */}
      <BillingCard />

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {canManageMembers
              ? `Manage who has access to this account \u00B7 ${totalUsed} of ${maxUsers} seats used`
              : "People with access to this account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManageMembers && (
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
                  setInviteRole(e.target.value as "admin" | "editor" | "viewer")
                }
                className="border rounded-md px-3 py-2 text-sm bg-background h-9"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                {isOwner && <option value="admin">Admin</option>}
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
                {canManageMembers && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {unifiedRows.map((row) => {
                if (row.type === "member") {
                  const m = row.data;
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
                          {m.role === "owner" && "\uD83D\uDC51 "}{m.role === "admin" && "\uD83D\uDEE1\uFE0F "}{m.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {matchingInv ? formatDate(matchingInv.createdAt) : "\u2014"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {timeAgo(m.lastSeenAt)}
                      </TableCell>
                      {canManageMembers && (
                        <TableCell>
                          {m.id !== user?.id && m.role !== "owner" && (
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
                      <TableCell className="text-sm text-muted-foreground">\u2014</TableCell>
                      <TableCell className="text-sm text-muted-foreground">\u2014</TableCell>
                      {canManageMembers && (
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

      {/* Activity Log */}
      <ActivityLog />
    </div>
  );
}
