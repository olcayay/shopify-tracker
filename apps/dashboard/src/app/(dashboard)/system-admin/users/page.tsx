"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SortKey = "name" | "email" | "account" | "role" | "createdAt";
type SortDir = "asc" | "desc";
type RoleFilter = "all" | "owner" | "editor" | "viewer" | "admin";

export default function UsersListPage() {
  const { fetchWithAuth } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const res = await fetchWithAuth("/api/system-admin/users");
    if (res.ok) setUsers(await res.json());
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "email" ? "asc" : "desc");
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
    let result = users;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.accountName || "").toLowerCase().includes(q)
      );
    }

    if (roleFilter === "admin") {
      result = result.filter((u) => u.isSystemAdmin);
    } else if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "account":
          cmp = (a.accountName || "").localeCompare(b.accountName || "");
          break;
        case "role":
          cmp = a.role.localeCompare(b.role);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [users, search, roleFilter, sortKey, sortDir]);

  const roleCounts = useMemo(() => {
    const base = search.trim()
      ? users.filter((u) => {
          const q = search.toLowerCase();
          return (
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.accountName || "").toLowerCase().includes(q)
          );
        })
      : users;
    return {
      all: base.length,
      owner: base.filter((u) => u.role === "owner").length,
      editor: base.filter((u) => u.role === "editor").length,
      viewer: base.filter((u) => u.role === "viewer").length,
      admin: base.filter((u) => u.isSystemAdmin).length,
    };
  }, [users, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Users"}
        </p>
        <h1 className="text-2xl font-bold">Users ({filtered.length})</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              ["all", "All"],
              ["owner", "Owner"],
              ["editor", "Editor"],
              ["viewer", "Viewer"],
              ["admin", "Admin"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={roleFilter === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRoleFilter(key)}
            >
              {label}
              {roleCounts[key] > 0 && (
                <span className="ml-1 opacity-70">({roleCounts[key]})</span>
              )}
            </Button>
          ))}
        </div>
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
                  Name <SortIcon col="name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("email")}
                >
                  Email <SortIcon col="email" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("account")}
                >
                  Account <SortIcon col="account" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("role")}
                >
                  Role <SortIcon col="role" />
                </TableHead>
                <TableHead>Admin</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("createdAt")}
                >
                  Created <SortIcon col="createdAt" />
                </TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link
                      href={`/system-admin/users/${u.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {u.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Link
                      href={`/system-admin/accounts/${u.accountId}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {u.accountName || u.accountId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.isSystemAdmin && (
                      <Badge variant="default">Admin</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.createdAt ? formatDate(u.createdAt) : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.lastSeen ? formatDate(u.lastSeen) : "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No users found
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
