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
import { Trash2, UserPlus } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { user, account, fetchWithAuth, refreshUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isOwner = user?.role === "owner";

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
            {account?.name} &middot; {user?.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
