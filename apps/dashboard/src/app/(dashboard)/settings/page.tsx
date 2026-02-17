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
import { Trash2, UserPlus, Clock, Check, X, Copy, Mail } from "lucide-react";
import Link from "next/link";
import { ConfirmModal } from "@/components/confirm-modal";

export default function SettingsPage() {
  const { user, account, fetchWithAuth, refreshUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; email: string } | null>(null);

  const isOwner = user?.role === "owner";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [membersRes, invitationsRes] = await Promise.all([
      fetchWithAuth("/api/account/members"),
      fetchWithAuth("/api/account/invitations"),
    ]);
    if (membersRes.ok) setMembers(await membersRes.json());
    if (invitationsRes.ok) setPendingInvitations(await invitationsRes.json());
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

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    await handleAction(
      "/api/account/members/invite",
      "POST",
      { email: inviteEmail.trim(), role: inviteRole },
      "Invitation sent"
    );
    setInviteEmail("");
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

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            {account?.name}{account?.company ? ` · ${account.company}` : ""} · {user?.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <Link href="/apps" className="block hover:bg-accent/50 rounded-lg p-3 -m-1 transition-colors">
              <p className="text-2xl font-bold">
                {account?.usage.trackedApps}/{account?.limits.maxTrackedApps}
              </p>
              <p className="text-sm text-muted-foreground">Tracked Apps</p>
            </Link>
            <Link href="/keywords" className="block hover:bg-accent/50 rounded-lg p-3 -m-1 transition-colors">
              <p className="text-2xl font-bold">
                {account?.usage.trackedKeywords}/
                {account?.limits.maxTrackedKeywords}
              </p>
              <p className="text-sm text-muted-foreground">Keywords</p>
            </Link>
            <Link href="/competitors" className="block hover:bg-accent/50 rounded-lg p-3 -m-1 transition-colors">
              <p className="text-2xl font-bold">
                {account?.usage.competitorApps}/
                {account?.limits.maxCompetitorApps}
              </p>
              <p className="text-sm text-muted-foreground">Competitors</p>
            </Link>
            <Link href="/features" className="block hover:bg-accent/50 rounded-lg p-3 -m-1 transition-colors">
              <p className="text-2xl font-bold">
                {account?.usage.trackedFeatures}/
                {account?.limits.maxTrackedFeatures}
              </p>
              <p className="text-sm text-muted-foreground">Features</p>
            </Link>
            <div className="rounded-lg p-3 -m-1">
              <p className="text-2xl font-bold">
                {account?.usage.users}/{account?.limits.maxUsers}
              </p>
              <p className="text-sm text-muted-foreground">Users</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Manage who has access to this account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={inviteMember} className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "editor" | "viewer")
                }
                className="border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <Button type="submit" variant="outline">
                <UserPlus className="h-4 w-4 mr-1" />
                Invite
              </Button>
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

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div className="pt-4 border-t mt-4">
                <h3 className="text-sm font-medium mb-3">Pending Invitations</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvitations.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {inv.accepted ? (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Accepted
                            </Badge>
                          ) : inv.expired ? (
                            <Badge variant="outline" className="border-destructive text-destructive">
                              <Clock className="h-3 w-3 mr-1" />
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!inv.accepted && !inv.expired && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title="Copy invite link"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/invite/accept/${inv.token}`
                                  );
                                  setMessage("Invite link copied to clipboard");
                                }}
                              >
                                <Copy className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Cancel invitation"
                              onClick={() => setConfirmCancel({ id: inv.id, email: inv.email })}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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

      <ConfirmModal
        open={!!confirmCancel}
        title="Cancel Invitation"
        description={`Are you sure you want to cancel the invitation for "${confirmCancel?.email}"?`}
        onConfirm={() => {
          if (confirmCancel) {
            handleAction(
              `/api/account/invitations/${confirmCancel.id}`,
              "DELETE",
              undefined,
              "Invitation cancelled"
            );
            setConfirmCancel(null);
          }
        }}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
