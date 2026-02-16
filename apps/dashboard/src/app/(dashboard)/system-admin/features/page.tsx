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

export default function FeaturesListPage() {
  const { fetchWithAuth } = useAuth();
  const [features, setFeatures] = useState<any[]>([]);
  const [expandedHandle, setExpandedHandle] = useState<string | null>(null);
  const [accountsList, setAccountsList] = useState<any[]>([]);

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
          Tracked Features ({features.length})
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Tracked By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((f: any) => (
                <>
                  <TableRow key={f.featureHandle}>
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
                    <TableRow key={`${f.featureHandle}-accounts`}>
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
                </>
              ))}
              {features.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No tracked features
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
