"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
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
import { ToggleLeft, Plus } from "lucide-react";
import { toast } from "sonner";

interface FeatureFlag {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  accountCount: number;
  userCount: number;
}

export default function FeatureFlagsPage() {
  const { fetchWithAuth } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadFlags();
  }, []);

  async function loadFlags() {
    const res = await fetchWithAuth("/api/system-admin/feature-flags");
    if (res.ok) {
      const data = await res.json();
      setFlags(data.data);
    }
    setLoading(false);
  }

  async function toggleFlag(slug: string, isEnabled: boolean) {
    // Optimistic update
    setFlags((prev) =>
      prev.map((f) => (f.slug === slug ? { ...f, isEnabled: !isEnabled } : f))
    );

    const res = await fetchWithAuth(`/api/system-admin/feature-flags/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ isEnabled: !isEnabled }),
    });

    if (res.ok) {
      toast.success(`Flag "${slug}" ${!isEnabled ? "enabled" : "disabled"}`);
      loadFlags();
    } else {
      // Revert on failure
      setFlags((prev) =>
        prev.map((f) => (f.slug === slug ? { ...f, isEnabled } : f))
      );
      toast.error("Failed to toggle flag");
    }
  }

  async function createFlag() {
    if (!newSlug.trim() || !newName.trim()) return;
    setCreating(true);

    const res = await fetchWithAuth("/api/system-admin/feature-flags", {
      method: "POST",
      body: JSON.stringify({
        slug: newSlug.trim(),
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      }),
    });

    if (res.ok) {
      toast.success(`Flag "${newSlug}" created`);
      setShowCreate(false);
      setNewSlug("");
      setNewName("");
      setNewDescription("");
      loadFlags();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create flag");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Feature Flags"}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ToggleLeft className="h-6 w-6" />
            Feature Flags ({flags.length})
          </h1>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4 mr-1" />
            New Flag
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="slug (e.g. market-research)"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
              />
              <Input
                placeholder="Display Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={createFlag} disabled={creating || !newSlug.trim() || !newName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feature flags created yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts / Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Activated</TableHead>
                  <TableHead>Deactivated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell>
                      <Link
                        href={`/system-admin/feature-flags/${flag.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {flag.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{flag.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={flag.isEnabled ? "default" : "secondary"}>
                        {flag.isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>{flag.accountCount} / {flag.userCount ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(flag.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {flag.activatedAt
                        ? new Date(flag.activatedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {flag.deactivatedAt
                        ? new Date(flag.deactivatedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={flag.isEnabled ? "outline" : "default"}
                        onClick={() => toggleFlag(flag.slug, flag.isEnabled)}
                      >
                        {flag.isEnabled ? "Disable" : "Enable"}
                      </Button>
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
