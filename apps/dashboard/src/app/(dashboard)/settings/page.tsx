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

export default function SettingsPage() {
  const { user, account, fetchWithAuth, refreshUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [trackedApps, setTrackedApps] = useState<any[]>([]);
  const [trackedKeywords, setTrackedKeywords] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);

  // Form states
  const [newAppSlug, setNewAppSlug] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newCompetitorSlug, setNewCompetitorSlug] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isOwner = user?.role === "owner";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [membersRes, appsRes, keywordsRes, competitorsRes] =
      await Promise.all([
        fetchWithAuth("/api/account/members"),
        fetchWithAuth("/api/account/tracked-apps"),
        fetchWithAuth("/api/account/tracked-keywords"),
        fetchWithAuth("/api/account/competitors"),
      ]);

    if (membersRes.ok) setMembers(await membersRes.json());
    if (appsRes.ok) setTrackedApps(await appsRes.json());
    if (keywordsRes.ok) setTrackedKeywords(await keywordsRes.json());
    if (competitorsRes.ok) setCompetitors(await competitorsRes.json());
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

  async function addTrackedApp(e: React.FormEvent) {
    e.preventDefault();
    if (!newAppSlug.trim()) return;
    await handleAction(
      "/api/account/tracked-apps",
      "POST",
      { slug: newAppSlug.trim() },
      "App added"
    );
    setNewAppSlug("");
  }

  async function addTrackedKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    await handleAction(
      "/api/account/tracked-keywords",
      "POST",
      { keyword: newKeyword.trim() },
      "Keyword added"
    );
    setNewKeyword("");
  }

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompetitorSlug.trim()) return;
    await handleAction(
      "/api/account/competitors",
      "POST",
      { slug: newCompetitorSlug.trim() },
      "Competitor added"
    );
    setNewCompetitorSlug("");
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
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">
                {account?.usage.trackedApps}/{account?.limits.maxTrackedApps}
              </p>
              <p className="text-sm text-muted-foreground">Tracked Apps</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {account?.usage.trackedKeywords}/
                {account?.limits.maxTrackedKeywords}
              </p>
              <p className="text-sm text-muted-foreground">Keywords</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {account?.usage.competitorApps}/
                {account?.limits.maxCompetitorApps}
              </p>
              <p className="text-sm text-muted-foreground">Competitors</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tracked Apps */}
      <Card>
        <CardHeader>
          <CardTitle>Tracked Apps</CardTitle>
          <CardDescription>
            Apps your account is tracking ({trackedApps.length}/
            {account?.limits.maxTrackedApps})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isOwner || user?.role === "editor") && (
            <form onSubmit={addTrackedApp} className="flex gap-2">
              <Input
                value={newAppSlug}
                onChange={(e) => setNewAppSlug(e.target.value)}
                placeholder="App slug (e.g. formful)"
                className="flex-1"
              />
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App Slug</TableHead>
                <TableHead>Added</TableHead>
                {(isOwner || user?.role === "editor") && (
                  <TableHead className="w-12" />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trackedApps.map((app: any) => (
                <TableRow key={app.appSlug}>
                  <TableCell className="font-mono">{app.appSlug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </TableCell>
                  {(isOwner || user?.role === "editor") && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleAction(
                            `/api/account/tracked-apps/${app.appSlug}`,
                            "DELETE",
                            undefined,
                            "App removed"
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {trackedApps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No tracked apps yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tracked Keywords */}
      <Card>
        <CardHeader>
          <CardTitle>Tracked Keywords</CardTitle>
          <CardDescription>
            Keywords your account is tracking ({trackedKeywords.length}/
            {account?.limits.maxTrackedKeywords})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isOwner || user?.role === "editor") && (
            <form onSubmit={addTrackedKeyword} className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Keyword (e.g. form builder)"
                className="flex-1"
              />
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Added</TableHead>
                {(isOwner || user?.role === "editor") && (
                  <TableHead className="w-12" />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {trackedKeywords.map((kw: any) => (
                <TableRow key={kw.keywordId}>
                  <TableCell>{kw.keyword || `#${kw.keywordId}`}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(kw.createdAt).toLocaleDateString()}
                  </TableCell>
                  {(isOwner || user?.role === "editor") && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleAction(
                            `/api/account/tracked-keywords/${kw.keywordId}`,
                            "DELETE",
                            undefined,
                            "Keyword removed"
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {trackedKeywords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No tracked keywords yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Competitor Apps */}
      <Card>
        <CardHeader>
          <CardTitle>Competitor Apps</CardTitle>
          <CardDescription>
            Competitor apps to watch ({competitors.length}/
            {account?.limits.maxCompetitorApps})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isOwner || user?.role === "editor") && (
            <form onSubmit={addCompetitor} className="flex gap-2">
              <Input
                value={newCompetitorSlug}
                onChange={(e) => setNewCompetitorSlug(e.target.value)}
                placeholder="App slug"
                className="flex-1"
              />
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App Slug</TableHead>
                <TableHead>Added</TableHead>
                {(isOwner || user?.role === "editor") && (
                  <TableHead className="w-12" />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.map((c: any) => (
                <TableRow key={c.appSlug}>
                  <TableCell className="font-mono">{c.appSlug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </TableCell>
                  {(isOwner || user?.role === "editor") && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleAction(
                            `/api/account/competitors/${c.appSlug}`,
                            "DELETE",
                            undefined,
                            "Competitor removed"
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {competitors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No competitor apps yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
