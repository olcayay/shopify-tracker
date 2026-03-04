"use client";

import { useEffect, useState, useMemo } from "react";
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
import { useFormatDate } from "@/lib/format-date";

type SortKey = "name" | "account" | "creator" | "keywords" | "competitors" | "createdAt";
type SortDir = "asc" | "desc";

export default function ResearchProjectsListPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    const res = await fetchWithAuth("/api/system-admin/research-projects");
    if (res.ok) setProjects(await res.json());
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "account" || key === "creator" ? "asc" : "desc");
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
    let result = projects;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.accountName || "").toLowerCase().includes(q) ||
          (p.creatorName || "").toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "account":
          cmp = (a.accountName || "").localeCompare(b.accountName || "");
          break;
        case "creator":
          cmp = (a.creatorName || "").localeCompare(b.creatorName || "");
          break;
        case "keywords":
          cmp = (a.keywordCount ?? 0) - (b.keywordCount ?? 0);
          break;
        case "competitors":
          cmp = (a.competitorCount ?? 0) - (b.competitorCount ?? 0);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [projects, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Research Projects"}
        </p>
        <h1 className="text-2xl font-bold">
          Research Projects ({filtered.length})
        </h1>
      </div>

      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search project, account, creator..."
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
                  onClick={() => toggleSort("name")}
                >
                  Project Name <SortIcon col="name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("account")}
                >
                  Account <SortIcon col="account" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("creator")}
                >
                  Creator <SortIcon col="creator" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("keywords")}
                >
                  Keywords <SortIcon col="keywords" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("competitors")}
                >
                  Competitors <SortIcon col="competitors" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("createdAt")}
                >
                  Created <SortIcon col="createdAt" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/system-admin/accounts/${p.accountId}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/system-admin/accounts/${p.accountId}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {p.accountName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {p.creatorId ? (
                      <Link
                        href={`/system-admin/users/${p.creatorId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {p.creatorName || "Unknown"}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                    )}
                  </TableCell>
                  <TableCell>{p.keywordCount ?? 0}</TableCell>
                  <TableCell>{p.competitorCount ?? 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.createdAt ? formatDateTime(p.createdAt) : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No research projects found
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
