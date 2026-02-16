"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Plus, Search } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export default function FeaturesPage() {
  const { fetchWithAuth, user, account, refreshUser } = useAuth();
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{
    handle: string;
    title: string;
  } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadFeatures();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadFeatures() {
    setLoading(true);
    const res = await fetchWithAuth("/api/account/tracked-features");
    if (res.ok) {
      setFeatures(await res.json());
    }
    setLoading(false);
  }

  function handleSearchInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchWithAuth(
        `/api/features/search?q=${encodeURIComponent(value)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      }
      setSearchLoading(false);
    }, 300);
  }

  async function trackFeature(handle: string, title: string) {
    setMessage("");
    const res = await fetchWithAuth("/api/account/tracked-features", {
      method: "POST",
      body: JSON.stringify({ handle, title }),
    });
    if (res.ok) {
      setMessage(`"${title}" added to tracking.`);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      loadFeatures();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to track feature");
    }
  }

  async function untrackFeature(handle: string, title: string) {
    setMessage("");
    const res = await fetchWithAuth(
      `/api/account/tracked-features/${encodeURIComponent(handle)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setMessage(`"${title}" removed from tracking`);
      loadFeatures();
      refreshUser();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Failed to untrack feature");
    }
  }

  const trackedHandles = new Set(features.map((f) => f.featureHandle));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Tracked Features ({features.length}
          {account ? `/${account.limits.maxTrackedFeatures}` : ""})
        </h1>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      {canEdit && (
        <div ref={searchRef} className="relative max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search features to track..."
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() =>
                suggestions.length > 0 && setShowSuggestions(true)
              }
              className="pl-9"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-60 overflow-auto">
              {suggestions.map((s: any) => (
                <button
                  key={s.handle}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                  onClick={() => {
                    if (trackedHandles.has(s.handle)) return;
                    trackFeature(s.handle, s.title);
                  }}
                >
                  <span>{s.title}</span>
                  {trackedHandles.has(s.handle) ? (
                    <span className="text-xs text-muted-foreground">
                      Tracked
                    </span>
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
          {showSuggestions &&
            query.length >= 1 &&
            suggestions.length === 0 &&
            !searchLoading && (
              <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
                No features found for &ldquo;{query}&rdquo;
              </div>
            )}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">
              Loading...
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Added</TableHead>
                  {canEdit && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((f) => (
                  <TableRow key={f.featureHandle}>
                    <TableCell>
                      <Link
                        href={`/features/${encodeURIComponent(f.featureHandle)}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {f.featureTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[f.categoryTitle, f.subcategoryTitle]
                        .filter(Boolean)
                        .join(" > ") || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmRemove({
                              handle: f.featureHandle,
                              title: f.featureTitle,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {features.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 4 : 3}
                      className="text-center text-muted-foreground"
                    >
                      No tracked features yet. Use the search above to find and
                      track features.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={!!confirmRemove}
        title="Remove Tracked Feature"
        description={`Are you sure you want to stop tracking "${confirmRemove?.title}"?`}
        onConfirm={() => {
          if (confirmRemove) {
            untrackFeature(confirmRemove.handle, confirmRemove.title);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
