"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortKey = "title" | "handle" | "trackedBy";
type SortDir = "asc" | "desc";

export default function FeaturesListPage() {
  const { fetchWithAuth } = useAuth();
  const [features, setFeatures] = useState<any[]>([]);
  const [expandedHandle, setExpandedHandle] = useState<string | null>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    loadFeatures();
  }, []);

  async function loadFeatures() {
    const res = await fetchWithAuth("/api/system-admin/features");
    if (res.ok) setFeatures(await res.json());
  }

  async function toggleAccounts(handle: string) {
    if (expandedHandle === handle) {
      setExpandedHandle(null);
      setAccountsList([]);
      return;
    }
    setExpandedHandle(handle);
    const res = await fetchWithAuth(
      `/api/system-admin/features/${encodeURIComponent(handle)}/accounts`
    );
    if (res.ok) setAccountsList(await res.json());
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "handle" ? "asc" : "desc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return <ArrowUpDown className="inline h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ArrowDown className="inline h-3.5 w-3.5 ml-1" />
    );
  }

  const filtered = useMemo(() => {
    let result = features;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.featureTitle.toLowerCase().includes(q) ||
          f.featureHandle.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.featureTitle.localeCompare(b.featureTitle);
          break;
        case "handle":
          cmp = a.featureHandle.localeCompare(b.featureHandle);
          break;
        case "trackedBy":
          cmp = (a.trackedByCount ?? 0) - (b.trackedByCount ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [features, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Features"}
        </p>
        <h1 className="text-2xl font-bold">
          Features ({filtered.length})
        </h1>
      </div>

      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search title or handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("title")}
                >
                  Feature <SortIcon col="title" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("handle")}
                >
                  Handle <SortIcon col="handle" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("trackedBy")}
                >
                  Tracked By <SortIcon col="trackedBy" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f: any) => (
                <Fragment key={f.featureHandle}>
                  <TableRow>
                    <TableCell>
                      <Link
                        href={`/features/${f.featureHandle}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {f.featureTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {f.featureHandle}
                    </TableCell>
                    <TableCell>
                      {f.trackedByCount > 0 ? (
                        <button
                          onClick={() => toggleAccounts(f.featureHandle)}
                          className="text-primary hover:underline text-sm"
                        >
                          {f.trackedByCount} account
                          {f.trackedByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          0
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedHandle === f.featureHandle && (
                    <TableRow>
                      <TableCell colSpan={3} className="bg-muted/30 p-4">
                        <div className="text-sm font-medium mb-2">
                          Accounts tracking &quot;{f.featureTitle}&quot;
                        </div>
                        {accountsList.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No accounts
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {accountsList.map((a: any) => (
                              <Link
                                key={a.accountId}
                                href={`/system-admin/accounts/${a.accountId}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border text-sm hover:bg-muted transition-colors"
                              >
                                {a.accountName}
                              </Link>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No features found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
