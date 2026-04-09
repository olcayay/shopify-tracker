"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleLeft, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface FlagUser {
  userId: string;
  enabled: boolean;
  enabledAt: string;
  userEmail: string;
  userName: string;
  accountId: string;
  accountName: string;
}

interface FlagDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  accountCount: number;
  accounts: Array<{
    accountId: string;
    accountName: string;
    enabledAt: string;
  }>;
  userCount: number;
  users: FlagUser[];
}

interface SearchResult {
  id: string;
  name: string;
}

interface UserSearchResult {
  id: string;
  email: string;
  name: string;
  accountId: string;
  accountName: string;
}

export default function FeatureFlagDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { fetchWithAuth } = useAuth();
  const [flag, setFlag] = useState<FlagDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Account search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);

  // Confirmation modal state
  const [confirmDisable, setConfirmDisable] = useState<string | null>(null);
  const [confirmUserRemove, setConfirmUserRemove] = useState<string | null>(null);

  // Stable ref for fetchWithAuth to prevent search effects from re-firing
  const fetchRef = useRef(fetchWithAuth);
  useEffect(() => {
    fetchRef.current = fetchWithAuth;
  }, [fetchWithAuth]);

  const loadFlag = useCallback(async () => {
    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}`);
    if (res.ok) {
      const data = await res.json();
      setFlag(data);
      setEditName(data.name);
      setEditDescription(data.description || "");
    }
    setLoading(false);
  }, [slug, fetchWithAuth]);

  useEffect(() => {
    loadFlag();
  }, [loadFlag]);

  // Debounced account search (uses fetchRef to avoid re-firing on fetchWithAuth identity change)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetchRef.current(
        `/api/system-admin/feature-flags/${slug}/accounts/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, slug]);

  // Debounced user search (uses fetchRef to avoid re-firing on fetchWithAuth identity change)
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setUserSearching(true);
      const res = await fetchRef.current(
        `/api/system-admin/feature-flags/${slug}/users/search?q=${encodeURIComponent(userSearchQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setUserSearchResults(data.data);
      }
      setUserSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, slug]);

  async function enableUser(userId: string, enabled: boolean = true) {
    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}/users`, {
      method: "POST",
      body: JSON.stringify({ userId, enabled }),
    });

    if (res.ok) {
      toast.success(enabled ? "User enabled" : "User disabled");
      setUserSearchQuery("");
      setUserSearchResults([]);
      loadFlag();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to update user");
    }
  }

  async function removeUser(userId: string) {
    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}/users/${userId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("User override removed");
      setConfirmUserRemove(null);
      loadFlag();
    } else {
      toast.error("Failed to remove user override");
    }
  }

  async function toggleGlobal() {
    if (!flag) return;

    // Optimistic update
    setFlag({ ...flag, isEnabled: !flag.isEnabled });

    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ isEnabled: !flag.isEnabled }),
    });

    if (res.ok) {
      toast.success(`Flag "${slug}" ${!flag.isEnabled ? "enabled" : "disabled"} globally`);
      loadFlag();
    } else {
      setFlag(flag);
      toast.error("Failed to toggle flag");
    }
  }

  async function saveEdit() {
    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName, description: editDescription || null }),
    });

    if (res.ok) {
      toast.success("Flag updated");
      setEditing(false);
      loadFlag();
    } else {
      toast.error("Failed to update flag");
    }
  }

  async function enableAccount(accountId: string) {
    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}/accounts`, {
      method: "POST",
      body: JSON.stringify({ accountId }),
    });

    if (res.ok) {
      toast.success("Account enabled");
      setSearchQuery("");
      setSearchResults([]);
      loadFlag();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to enable account");
    }
  }

  async function disableAccount(accountId: string) {
    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}/accounts/${accountId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Account disabled");
      setConfirmDisable(null);
      loadFlag();
    } else {
      toast.error("Failed to disable account");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Loading...</h1>
      </div>
    );
  }

  if (!flag) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Feature flag not found</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > "}
          <Link href="/system-admin/feature-flags" className="hover:underline">
            Feature Flags
          </Link>
          {" > "}
          {flag.name}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ToggleLeft className="h-6 w-6" />
            {flag.name}
          </h1>
          <Badge variant={flag.isEnabled ? "default" : "secondary"}>
            {flag.isEnabled ? "Enabled Globally" : "Disabled"}
          </Badge>
        </div>
      </div>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Flag Details</CardTitle>
              <CardDescription>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{flag.slug}</code>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={flag.isEnabled ? "outline" : "default"}
                onClick={toggleGlobal}
              >
                {flag.isEnabled ? "Disable Globally" : "Enable Globally"}
              </Button>
              {!editing && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Description</label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{flag.description || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm">{new Date(flag.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Activated</p>
                <p className="text-sm">
                  {flag.activatedAt ? new Date(flag.activatedAt).toLocaleDateString() : "Never"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deactivated</p>
                <p className="text-sm">
                  {flag.deactivatedAt ? new Date(flag.deactivatedAt).toLocaleDateString() : "Never"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts Card */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts ({flag.accountCount})</CardTitle>
          <CardDescription>
            Accounts with this feature flag enabled via per-account override.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search accounts to enable..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                {searchResults.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer"
                  >
                    <span className="text-sm">{account.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => enableAccount(account.id)}
                    >
                      Enable
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md px-3 py-2">
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
          </div>

          {/* Enabled Accounts Table */}
          {flag.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts have this feature enabled yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Enabled At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flag.accounts.map((account) => (
                  <TableRow key={account.accountId}>
                    <TableCell>
                      <Link
                        href={`/system-admin/accounts/${account.accountId}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {account.accountName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(account.enabledAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {confirmDisable === account.accountId ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-muted-foreground">Confirm?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => disableAccount(account.accountId)}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDisable(null)}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDisable(account.accountId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Users Card */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({flag.userCount ?? 0})</CardTitle>
          <CardDescription>
            Per-user overrides. User-level settings take precedence over account-level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search users by email or name..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
            />
            {userSearchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                {userSearchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-accent"
                  >
                    <div>
                      <span className="text-sm font-medium">{user.email}</span>
                      <span className="text-xs text-muted-foreground ml-2">({user.accountName})</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enableUser(user.id, true)}
                      >
                        Enable
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enableUser(user.id, false)}
                      >
                        Disable
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {userSearching && (
              <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md px-3 py-2">
                <span className="text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
          </div>

          {/* Enabled Users Table */}
          {(!flag.users || flag.users.length === 0) ? (
            <p className="text-sm text-muted-foreground">No user-level overrides configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Set At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flag.users.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{user.userEmail}</p>
                        <p className="text-xs text-muted-foreground">{user.userName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/system-admin/accounts/${user.accountId}`}
                        className="text-primary hover:underline text-sm"
                      >
                        {user.accountName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.enabled ? "default" : "destructive"}>
                        {user.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.enabledAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => enableUser(user.userId, !user.enabled)}
                        >
                          {user.enabled ? "Disable" : "Enable"}
                        </Button>
                        {confirmUserRemove === user.userId ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeUser(user.userId)}
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmUserRemove(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmUserRemove(user.userId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
