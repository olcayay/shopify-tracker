"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Bell,
  TrendingUp,
  Users,
  Star,
  Tag,
  Award,
  AlertTriangle,
  Settings,
  Check,
  Loader2,
} from "lucide-react";

interface EmailPreference {
  type: string;
  enabled: boolean;
}

interface NotificationPreference {
  type: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
}

const EMAIL_TYPE_META: Record<string, { label: string; description: string; icon: typeof Mail; category: string }> = {
  daily_digest: { label: "Daily Digest", description: "Daily ranking report delivered to your inbox", icon: TrendingUp, category: "Reports" },
  weekly_summary: { label: "Weekly Summary", description: "Weekly performance overview every Monday", icon: TrendingUp, category: "Reports" },
  ranking_alert: { label: "Ranking Alerts", description: "Notifications when ranking positions change significantly", icon: TrendingUp, category: "Alerts" },
  competitor_alert: { label: "Competitor Alerts", description: "Updates when competitors make notable moves", icon: Users, category: "Alerts" },
  review_alert: { label: "Review Alerts", description: "New review notifications for your tracked apps", icon: Star, category: "Alerts" },
  opportunity_alert: { label: "Opportunity Alerts", description: "Weekly analysis of market opportunities", icon: Award, category: "Alerts" },
  win_celebration: { label: "Win Celebrations", description: "Milestone notifications when you achieve something great", icon: Award, category: "Alerts" },
  welcome: { label: "Welcome Email", description: "Initial onboarding email after signup", icon: Mail, category: "System" },
  re_engagement: { label: "Re-engagement", description: "Check-in emails when you haven't logged in for a while", icon: Mail, category: "System" },
  security_password_change: { label: "Security Alerts", description: "Password change confirmations and security notifications", icon: AlertTriangle, category: "System" },
};

const NOTIFICATION_TYPE_META: Record<string, { label: string; category: string }> = {
  ranking_top3_entry: { label: "Entered Top 3", category: "Ranking" },
  ranking_top3_exit: { label: "Left Top 3", category: "Ranking" },
  ranking_significant_change: { label: "Significant Change", category: "Ranking" },
  ranking_new_entry: { label: "New Category Entry", category: "Ranking" },
  ranking_dropped_out: { label: "Dropped Out", category: "Ranking" },
  competitor_overtook: { label: "Competitor Overtook", category: "Competitor" },
  competitor_pricing_change: { label: "Pricing Change", category: "Competitor" },
  review_new_positive: { label: "Positive Review", category: "Review" },
  review_new_negative: { label: "Negative Review", category: "Review" },
  featured_new_placement: { label: "New Featured Placement", category: "Featured" },
  featured_removed: { label: "Removed from Featured", category: "Featured" },
  account_limit_warning: { label: "Limit Warning", category: "Account" },
  account_limit_reached: { label: "Limit Reached", category: "Account" },
};

export default function EmailPreferencesPage() {
  const { fetchWithAuth } = useAuth();
  const [emailPrefs, setEmailPrefs] = useState<EmailPreference[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const [emailRes, notifRes] = await Promise.all([
        fetchWithAuth("/api/account/email-preferences").catch(() => null),
        fetchWithAuth("/api/notifications/preferences").catch(() => null),
      ]);

      if (emailRes?.ok) {
        const data = await emailRes.json();
        setEmailPrefs(data.preferences || []);
      }
      if (notifRes?.ok) {
        const data = await notifRes.json();
        setNotifPrefs(data.preferences || []);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  const toggleEmailPref = async (type: string, currentEnabled: boolean) => {
    setSaving(type);
    setMessage("");
    try {
      const res = await fetchWithAuth("/api/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({ preferences: [{ type, inAppEnabled: !currentEnabled }] }),
      });
      if (res.ok) {
        setNotifPrefs((prev) =>
          prev.map((p) => (p.type === type ? { ...p, inAppEnabled: !currentEnabled } : p))
        );
        setMessage("Preference updated");
      }
    } finally {
      setSaving(null);
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const groups = new Map<string, NotificationPreference[]>();
  for (const pref of notifPrefs) {
    const meta = NOTIFICATION_TYPE_META[pref.type];
    const cat = meta?.category || "Other";
    const list = groups.get(cat) || [];
    list.push(pref);
    groups.set(cat, list);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Email & Notification Preferences
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose which emails and notifications you want to receive.
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-3 py-2 rounded-md">
          <Check className="h-4 w-4" />
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Notification Preferences by Category */}
          {[...groups.entries()].map(([category, prefs]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category} Notifications</CardTitle>
                <CardDescription>Control in-app notifications for {category.toLowerCase()} events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {prefs.map((pref) => {
                    const meta = NOTIFICATION_TYPE_META[pref.type];
                    return (
                      <div key={pref.type} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{meta?.label || pref.type}</p>
                        </div>
                        <Button
                          variant={pref.inAppEnabled ? "default" : "outline"}
                          size="sm"
                          disabled={saving === pref.type}
                          onClick={() => toggleEmailPref(pref.type, pref.inAppEnabled)}
                        >
                          {saving === pref.type ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : pref.inAppEnabled ? (
                            <><Bell className="h-3 w-3 mr-1" /> On</>
                          ) : (
                            "Off"
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Info card */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Email digests (daily/weekly) can be managed from your{" "}
                <Link href="/settings" className="text-primary hover:underline">account settings</Link>.
                You can also unsubscribe from individual email types using the link in any email.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
