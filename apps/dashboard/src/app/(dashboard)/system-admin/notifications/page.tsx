"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  RefreshCw,
  Loader2,
  Settings,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface NotificationConfig {
  id: string;
  notificationType: string;
  inAppEnabled: boolean;
  pushDefaultEnabled: boolean;
}

export default function AdminNotificationDashboard() {
  const { fetchWithAuth } = useAuth();
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get notification type configs
      const [configRes, statsRes] = await Promise.all([
        fetchWithAuth("/api/system-admin/email-configs").catch(() => null),
        fetchWithAuth("/api/system-admin/emails/stats").catch(() => null),
      ]);

      if (configRes?.ok) {
        // Reuse email configs endpoint — notification configs are similar
        const data = await configRes.json();
        setConfigs(data || []);
      }
      if (statsRes?.ok) {
        setStats(await statsRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  const categoryLabel = (type: string) => {
    if (type.startsWith("ranking_")) return "Ranking";
    if (type.startsWith("competitor_")) return "Competitor";
    if (type.startsWith("review_")) return "Review";
    if (type.startsWith("keyword_")) return "Keyword";
    if (type.startsWith("featured_")) return "Featured";
    if (type.startsWith("system_")) return "System";
    if (type.startsWith("account_")) return "Account";
    return "Other";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" /> Notification Management
        </h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{stats.total || 0}</p>
              <p className="text-xs text-muted-foreground">Total Emails</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{stats.sent24h || 0}</p>
              <p className="text-xs text-muted-foreground">Last 24h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{stats.openRate || 0}%</p>
              <p className="text-xs text-muted-foreground">Open Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{configs.length}</p>
              <p className="text-xs text-muted-foreground">Config Types</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notification Type Configs */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No notification configs found
                    </TableCell>
                  </TableRow>
                ) : (
                  configs.map((c: any) => (
                    <TableRow key={c.id || c.emailType || c.notificationType}>
                      <TableCell className="text-sm font-mono">
                        {(c.emailType || c.notificationType || "").replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabel(c.emailType || c.notificationType || "")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(c.enabled ?? c.inAppEnabled) ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <ToggleRight className="h-4 w-4" /> Enabled
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-sm">
                            <ToggleLeft className="h-4 w-4" /> Disabled
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
