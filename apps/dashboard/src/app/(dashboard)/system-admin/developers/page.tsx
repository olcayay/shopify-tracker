"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Merge,
  Unlink,
  Link2,
  Plus,
  Lightbulb,
  Globe,
  ExternalLink,
} from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";
import { getPlatformLabel, getPlatformColor } from "@/lib/platform-display";

interface PlatformDev {
  id: number;
  platform: string;
  name: string;
}

interface GlobalDev {
  id: number;
  slug: string;
  name: string;
  website: string | null;
  platformDevelopers: PlatformDev[];
  appCount: number;
}

interface MergeSuggestion {
  developer1: { id: number; slug: string; name: string };
  developer2: { id: number; slug: string; name: string };
  similarity: number;
}

export default function SystemAdminDevelopersPage() {
  const { fetchWithAuth } = useAuth();
  const [developers, setDevelopers] = useState<GlobalDev[]>([]);
  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDevName, setNewDevName] = useState("");
  const [newDevWebsite, setNewDevWebsite] = useState("");

  // Merge dialog state
  const [mergeSource, setMergeSource] = useState<GlobalDev | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  // Link dialog state
  const [linkPdId, setLinkPdId] = useState<number | null>(null);
  const [linkTargetGlobalId, setLinkTargetGlobalId] = useState("");

  useEffect(() => {
    loadDevelopers();
  }, [page, search]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  async function loadDevelopers() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);

    const res = await fetchWithAuth(`/api/developers/admin/list?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDevelopers(data.developers);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    }
    setLoading(false);
  }

  async function loadSuggestions() {
    const res = await fetchWithAuth("/api/developers/admin/suggestions?limit=30");
    if (res.ok) {
      const data = await res.json();
      setSuggestions(data.suggestions);
    }
    setShowSuggestions(true);
  }

  async function handleCreate() {
    if (!newDevName.trim()) return;
    const res = await fetchWithAuth("/api/developers/admin/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDevName.trim(), website: newDevWebsite.trim() || undefined }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `Created developer "${newDevName.trim()}"` });
      setNewDevName("");
      setNewDevWebsite("");
      setShowCreateForm(false);
      loadDevelopers();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Failed to create" });
    }
  }

  async function handleMerge() {
    if (!mergeSource || !mergeTargetId) return;
    const res = await fetchWithAuth("/api/developers/admin/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: mergeSource.id, targetId: parseInt(mergeTargetId) }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `Merged "${mergeSource.name}" into target #${mergeTargetId}` });
      setMergeSource(null);
      setMergeTargetId("");
      loadDevelopers();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Merge failed" });
    }
  }

  async function handleUnlink(pdId: number, pdName: string) {
    const res = await fetchWithAuth("/api/developers/admin/unlink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformDeveloperId: pdId }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `Unlinked "${pdName}"` });
      loadDevelopers();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Unlink failed" });
    }
  }

  async function handleLink() {
    if (!linkPdId || !linkTargetGlobalId) return;
    const res = await fetchWithAuth("/api/developers/admin/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformDeveloperId: linkPdId,
        globalDeveloperId: parseInt(linkTargetGlobalId),
      }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: "Re-linked successfully" });
      setLinkPdId(null);
      setLinkTargetGlobalId("");
      loadDevelopers();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Link failed" });
    }
  }

  async function handleSuggestionMerge(sourceId: number, targetId: number, sourceName: string) {
    const res = await fetchWithAuth("/api/developers/admin/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, targetId }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: `Merged "${sourceName}"` });
      setSuggestions((prev) => prev.filter((s) => s.developer1.id !== sourceId && s.developer2.id !== sourceId));
      loadDevelopers();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Merge failed" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Developers"}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            Global Developers {!loading && `(${total})`}
          </h1>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (showSuggestions) {
                  setShowSuggestions(false);
                } else {
                  loadSuggestions();
                }
              }}
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              {showSuggestions ? "Hide" : "Merge"} Suggestions
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-md ${
            message.type === "success"
              ? "text-green-700 bg-green-50"
              : "text-red-700 bg-red-50"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Global Developer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newDevName}
                  onChange={(e) => setNewDevName(e.target.value)}
                  placeholder="Developer name"
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium">Website (optional)</label>
                <Input
                  value={newDevWebsite}
                  onChange={(e) => setNewDevWebsite(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              <Button onClick={handleCreate} disabled={!newDevName.trim()}>
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Merge suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Suggested Merges ({suggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Developer 1</TableHead>
                  <TableHead>Developer 2</TableHead>
                  <TableHead className="text-right">Similarity</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className="font-medium">
                        {s.developer1.name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        #{s.developer1.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {s.developer2.name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        #{s.developer2.id}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {(s.similarity * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title={`Merge "${s.developer1.name}" into "${s.developer2.name}"`}
                          onClick={() =>
                            handleSuggestionMerge(
                              s.developer1.id,
                              s.developer2.id,
                              s.developer1.name
                            )
                          }
                        >
                          <Merge className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showSuggestions && suggestions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No merge suggestions found. All developers look unique.
          </CardContent>
        </Card>
      )}

      {/* Merge dialog */}
      {mergeSource && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <span className="text-sm">
                Merge <strong>{mergeSource.name}</strong> (#{mergeSource.id}) into:
              </span>
              <Input
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                placeholder="Target developer ID"
                className="w-48"
              />
              <Button size="sm" onClick={handleMerge} disabled={!mergeTargetId}>
                <Merge className="h-3.5 w-3.5 mr-1" />
                Merge
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMergeSource(null);
                  setMergeTargetId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link dialog */}
      {linkPdId && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <span className="text-sm">
                Re-link platform developer #{linkPdId} to global developer:
              </span>
              <Input
                value={linkTargetGlobalId}
                onChange={(e) => setLinkTargetGlobalId(e.target.value)}
                placeholder="Global developer ID"
                className="w-48"
              />
              <Button size="sm" onClick={handleLink} disabled={!linkTargetGlobalId}>
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLinkPdId(null);
                  setLinkTargetGlobalId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex gap-3 items-center">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search developers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Developer list */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <TableSkeleton rows={10} cols={5} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Developer</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead className="text-right">Apps</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {developers.map((dev) => (
                    <TableRow key={dev.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {dev.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/developers/${dev.slug}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {dev.name}
                          </Link>
                          {dev.website && (
                            <a
                              href={dev.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Globe className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          /{dev.slug}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {dev.platformDevelopers.map((pd) => (
                            <div
                              key={pd.id}
                              className="inline-flex items-center gap-1"
                            >
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0"
                                style={{
                                  borderColor: getPlatformColor(pd.platform),
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full mr-1"
                                  style={{
                                    backgroundColor: getPlatformColor(pd.platform),
                                  }}
                                />
                                {getPlatformLabel(pd.platform)}
                                {pd.name !== dev.name && (
                                  <span className="text-muted-foreground ml-0.5">
                                    : {pd.name}
                                  </span>
                                )}
                              </Badge>
                              <button
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                                title={`Unlink "${pd.name}" from ${dev.name}`}
                                onClick={() => handleUnlink(pd.id, pd.name)}
                              >
                                <Unlink className="h-3 w-3" />
                              </button>
                              <button
                                className="text-muted-foreground hover:text-blue-500 transition-colors"
                                title={`Re-link "${pd.name}" to different global developer`}
                                onClick={() => setLinkPdId(pd.id)}
                              >
                                <Link2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{dev.appCount}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Merge into another developer"
                          onClick={() => setMergeSource(dev)}
                        >
                          <Merge className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
