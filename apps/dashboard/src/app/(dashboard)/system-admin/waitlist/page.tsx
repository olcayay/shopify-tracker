"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Trash2, Download, ClipboardList } from "lucide-react";
import { useFormatDate } from "@/lib/format-date";

interface WaitlistEntry {
  id: string;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  referrer: string | null;
  notes: string | null;
  createdAt: string;
}

export default function WaitlistPage() {
  const { fetchWithAuth } = useAuth();
  const { formatDateTime } = useFormatDate();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/system-admin/waitlist");
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function deleteEntry(id: string) {
    const res = await fetchWithAuth(`/api/system-admin/waitlist/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
  }

  function exportCsv() {
    const header = "Email,Signed Up,IP Address,Referrer";
    const rows = filtered.map(
      (e) =>
        `${e.email},${e.createdAt},${e.ipAddress || ""},${e.referrer || ""}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.email.toLowerCase().includes(q) ||
        (e.referrer || "").toLowerCase().includes(q) ||
        (e.ipAddress || "").includes(q)
    );
  }, [entries, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" / "}
          Waitlist
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Waitlist</h1>
            <Badge variant="secondary">{entries.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by email, referrer, IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {entries.length === 0
            ? "No waitlist signups yet."
            : "No results matching your search."}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Signed Up</TableHead>
                <TableHead>Referrer</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {entry.referrer || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">
                    {entry.ipAddress || "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntry(entry.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
