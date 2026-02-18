"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

interface Package {
  id: number;
  slug: string;
  name: string;
  maxTrackedApps: number;
  maxTrackedKeywords: number;
  maxCompetitorApps: number;
  maxTrackedFeatures: number;
  maxUsers: number;
  sortOrder: number;
}

interface AccountSummary {
  id: string;
  name: string;
  company: string | null;
  packageId: number | null;
  hasLimitOverrides: boolean;
}

const EMPTY_FORM = {
  slug: "",
  name: "",
  maxTrackedApps: 5,
  maxTrackedKeywords: 5,
  maxCompetitorApps: 3,
  maxTrackedFeatures: 5,
  maxUsers: 2,
  sortOrder: 0,
};

export default function PackagesPage() {
  const { fetchWithAuth } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Package>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<Package | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [pkgRes, accRes] = await Promise.all([
      fetchWithAuth("/api/system-admin/packages"),
      fetchWithAuth("/api/system-admin/accounts"),
    ]);
    if (pkgRes.ok) setPackages(await pkgRes.json());
    if (accRes.ok) {
      const data = await accRes.json();
      setAccounts(
        data.map((a: any) => ({
          id: a.id,
          name: a.name,
          company: a.company,
          packageId: a.packageId,
          hasLimitOverrides: a.hasLimitOverrides,
        }))
      );
    }
  }

  function accountsForPackage(pkgId: number) {
    return accounts.filter((a) => a.packageId === pkgId);
  }

  async function createPackage(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const res = await fetchWithAuth("/api/system-admin/packages", {
      method: "POST",
      body: JSON.stringify(createForm),
    });
    if (res.ok) {
      setMessage("Package created");
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      loadData();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create package");
    }
  }

  async function saveEdit() {
    if (editingId === null) return;
    setError("");
    setMessage("");
    const res = await fetchWithAuth(`/api/system-admin/packages/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setMessage("Package updated");
      setEditingId(null);
      setEditForm({});
      loadData();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update package");
    }
  }

  async function deletePackage(pkg: Package) {
    setError("");
    setMessage("");
    const res = await fetchWithAuth(`/api/system-admin/packages/${pkg.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessage(`Package "${pkg.name}" deleted`);
      setConfirmDelete(null);
      loadData();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to delete package");
      setConfirmDelete(null);
    }
  }

  function startEdit(pkg: Package) {
    setEditingId(pkg.id);
    setEditForm({
      name: pkg.name,
      maxTrackedApps: pkg.maxTrackedApps,
      maxTrackedKeywords: pkg.maxTrackedKeywords,
      maxCompetitorApps: pkg.maxCompetitorApps,
      maxTrackedFeatures: pkg.maxTrackedFeatures,
      maxUsers: pkg.maxUsers,
      sortOrder: pkg.sortOrder,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Packages"}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Packages ({packages.length})</h1>
          {!showCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Package
            </Button>
          )}
        </div>
      </div>

      {(message || error) && (
        <div
          className={`text-sm px-3 py-2 rounded-md ${error ? "text-destructive bg-destructive/10" : "text-green-700 bg-green-50"}`}
        >
          {error || message}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New Package</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createPackage} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">Slug</label>
                  <Input
                    value={createForm.slug}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, slug: e.target.value }))
                    }
                    placeholder="e.g. business"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <Input
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Business"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Sort Order
                  </label>
                  <Input
                    type="number"
                    value={createForm.sortOrder}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        sortOrder: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground">Apps</label>
                  <Input
                    type="number"
                    value={createForm.maxTrackedApps}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        maxTrackedApps: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Keywords
                  </label>
                  <Input
                    type="number"
                    value={createForm.maxTrackedKeywords}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        maxTrackedKeywords: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Competitors
                  </label>
                  <Input
                    type="number"
                    value={createForm.maxCompetitorApps}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        maxCompetitorApps: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    Features
                  </label>
                  <Input
                    type="number"
                    value={createForm.maxTrackedFeatures}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        maxTrackedFeatures: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Users</label>
                  <Input
                    type="number"
                    value={createForm.maxUsers}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        maxUsers: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Create
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateForm(EMPTY_FORM);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Package cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {packages.map((pkg) => {
          const pkgAccounts = accountsForPackage(pkg.id);
          const isEditing = editingId === pkg.id;

          return (
            <Card key={pkg.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {isEditing ? (
                        <Input
                          className="h-7 w-40 text-base font-semibold"
                          value={editForm.name ?? ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              name: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        pkg.name
                      )}
                      <Badge variant="outline" className="text-xs font-mono">
                        {pkg.slug}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {pkgAccounts.length} account{pkgAccounts.length !== 1 ? "s" : ""}
                      {pkgAccounts.some((a) => a.hasLimitOverrides) && (
                        <span className="text-amber-500 ml-1">
                          ({pkgAccounts.filter((a) => a.hasLimitOverrides).length} with overrides)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={saveEdit}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingId(null);
                            setEditForm({});
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => startEdit(pkg)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setConfirmDelete(pkg)}
                          disabled={pkgAccounts.length > 0}
                          title={
                            pkgAccounts.length > 0
                              ? "Cannot delete: accounts use this package"
                              : "Delete package"
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Limits grid */}
                <div className="grid grid-cols-5 gap-3 text-center">
                  {([
                    { key: "maxTrackedApps", label: "Apps" },
                    { key: "maxTrackedKeywords", label: "Keywords" },
                    { key: "maxCompetitorApps", label: "Competitors" },
                    { key: "maxTrackedFeatures", label: "Features" },
                    { key: "maxUsers", label: "Users" },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="bg-muted/50 rounded-md p-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          className="h-7 text-center text-lg font-bold w-full"
                          value={(editForm as any)[key] ?? (pkg as any)[key]}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              [key]: Number(e.target.value),
                            }))
                          }
                        />
                      ) : (
                        <p className="text-lg font-bold">
                          {(pkg as any)[key]}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Accounts using this package */}
                {pkgAccounts.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Accounts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pkgAccounts.map((acc) => (
                        <Link
                          key={acc.id}
                          href={`/system-admin/accounts/${acc.id}`}
                        >
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-secondary/80"
                          >
                            {acc.name}
                            {acc.hasLimitOverrides && (
                              <span
                                className="ml-0.5 text-amber-500"
                                title="Custom limit overrides"
                              >
                                *
                              </span>
                            )}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {packages.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No packages defined yet.
        </p>
      )}

      {/* Unassigned accounts */}
      {accounts.filter((a) => !a.packageId).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Unassigned Accounts ({accounts.filter((a) => !a.packageId).length})
            </CardTitle>
            <CardDescription>
              Accounts without a package assignment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {accounts
                .filter((a) => !a.packageId)
                .map((acc) => (
                  <Link
                    key={acc.id}
                    href={`/system-admin/accounts/${acc.id}`}
                  >
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                    >
                      {acc.name}
                    </Badge>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Package"
        description={`Are you sure you want to delete the "${confirmDelete?.name}" package?`}
        onConfirm={() => {
          if (confirmDelete) deletePackage(confirmDelete);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
