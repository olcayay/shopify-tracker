"use client";

import { useState, useEffect, useCallback } from "react";
import { Monitor, Trash2, RefreshCw, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format-utils";
import { toast } from "sonner";

interface Session {
  id: string;
  userAgentHash: string | null;
  createdAt: string;
  expiresAt: string;
}

export default function SessionsPage() {
  const { fetchWithAuth } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeSession = async (id: string) => {
    const res = await fetchWithAuth(`/api/auth/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Session revoked");
      fetchSessions();
    } else {
      toast.error("Failed to revoke session");
    }
  };

  const revokeAll = async () => {
    const res = await fetchWithAuth("/api/auth/revoke-all-sessions", { method: "POST" });
    if (res.ok) {
      toast.success("All sessions revoked. You will be logged out.");
      setTimeout(() => window.location.href = "/login", 2000);
    } else {
      toast.error("Failed to revoke sessions");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Sessions"
        description="Manage your active login sessions across devices"
        icon={Shield}
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Sessions" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
            {sessions.length > 1 && (
              <Button variant="destructive" size="sm" onClick={revokeAll}>
                Revoke All
              </Button>
            )}
          </div>
        }
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                No active sessions
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs">
                      {session.userAgentHash ? `Device ${session.userAgentHash.slice(0, 8)}` : "Unknown device"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {timeAgo(session.createdAt)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(session.expiresAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => revokeSession(session.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
