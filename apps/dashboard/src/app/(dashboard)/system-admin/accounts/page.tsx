"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccountsListPage() {
  const { fetchWithAuth } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    const res = await fetchWithAuth("/api/system-admin/accounts");
    if (res.ok) setAccounts(await res.json());
  }

  async function updateAccount(id: string, updates: any) {
    const res = await fetchWithAuth(`/api/system-admin/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      setMessage("Account updated");
      loadAccounts();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/system-admin" className="hover:underline">
            System Admin
          </Link>
          {" > Accounts"}
        </p>
        <h1 className="text-2xl font-bold">
          Accounts ({accounts.length})
        </h1>
      </div>

      {message && (
        <div className="text-sm px-3 py-2 rounded-md bg-muted">{message}</div>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Apps</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Competitors</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc: any) => (
                <TableRow key={acc.id}>
                  <TableCell>
                    <Link
                      href={`/system-admin/accounts/${acc.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {acc.name}
                    </Link>
                  </TableCell>
                  <TableCell>{acc.usage?.members ?? "-"}</TableCell>
                  <TableCell>
                    {acc.usage?.trackedApps ?? 0}/{acc.maxTrackedApps}
                  </TableCell>
                  <TableCell>
                    {acc.usage?.trackedKeywords ?? 0}/
                    {acc.maxTrackedKeywords}
                  </TableCell>
                  <TableCell>
                    {acc.usage?.competitorApps ?? 0}/
                    {acc.maxCompetitorApps}
                  </TableCell>
                  <TableCell>
                    {acc.usage?.trackedFeatures ?? 0}/
                    {acc.maxTrackedFeatures}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={acc.isSuspended ? "destructive" : "default"}
                    >
                      {acc.isSuspended ? "Suspended" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {acc.createdAt ? formatDate(acc.createdAt) : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {acc.lastSeen ? formatDate(acc.lastSeen) : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateAccount(acc.id, {
                          isSuspended: !acc.isSuspended,
                        })
                      }
                    >
                      {acc.isSuspended ? "Activate" : "Suspend"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground"
                  >
                    No accounts
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
