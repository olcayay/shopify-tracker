"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
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

export default function KeywordsListPage() {
  const { fetchWithAuth } = useAuth();
  const [keywords, setKeywords] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);

  useEffect(() => {
    loadKeywords();
  }, []);

  async function loadKeywords() {
    try {
      const res = await fetchWithAuth("/api/system-admin/keywords");
      if (res.ok) setKeywords(await res.json());
    } catch (err) {
      console.error("Failed to load keywords:", err);
    }
  }

  async function toggleAccounts(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setAccountsList([]);
      return;
    }
    setExpandedId(id);
    const res = await fetchWithAuth(
      `/api/system-admin/keywords/${id}/accounts`
    );
    if (res.ok) setAccountsList(await res.json());
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Keywords"}
        </p>
        <h1 className="text-2xl font-bold">
          Keywords ({keywords.length})
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tracked By</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Scraped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map((kw: any) => (
                <>
                  <TableRow key={kw.id}>
                    <TableCell>
                      <Link
                        href={`/keywords/${kw.slug}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {kw.keyword}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {kw.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {kw.trackedByCount > 0 ? (
                        <button
                          onClick={() => toggleAccounts(kw.id)}
                          className="text-primary hover:underline text-sm"
                        >
                          {kw.trackedByCount} account
                          {kw.trackedByCount !== 1 ? "s" : ""}
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          0
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {kw.createdAt
                        ? new Date(kw.createdAt).toLocaleDateString()
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {kw.lastScrapedAt
                        ? new Date(kw.lastScrapedAt).toLocaleString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                  {expandedId === kw.id && (
                    <TableRow key={`${kw.id}-accounts`}>
                      <TableCell colSpan={5} className="bg-muted/30 p-4">
                        <div className="text-sm font-medium mb-2">
                          Accounts tracking &quot;{kw.keyword}&quot;
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
                </>
              ))}
              {keywords.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    No keywords found
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
