"use client";

import { useEffect, useState, useCallback } from "react";
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
  Shield,
  TrendingUp,
  Users,
  Star,
  Award,
  Settings,
  Check,
  Loader2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import type { PlatformId } from "@appranks/shared";
import { toast } from "sonner";

interface EmailCategory {
  key: string;
  label: string;
  description: string;
  types: {
    type: string;
    label: string;
    required: boolean;
    enabled: boolean;
  }[];
}

interface NotificationPreference {
  type: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
}

interface AppDigest {
  appId: number;
  slug: string;
  name: string;
  platform: string;
  iconUrl: string | null;
  dailyDigestEnabled: boolean;
}

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

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  transactional: Shield,
  alerts: Bell,
  digests: TrendingUp,
  lifecycle: Award,
  team: Users,
};

export default function EmailPreferencesPage() {
  const { fetchWithAuth } = useAuth();
  const [emailCategories, setEmailCategories] = useState<EmailCategory[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference[]>([]);
  const [appDigests, setAppDigests] = useState<AppDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const [emailRes, notifRes, appsRes] = await Promise.all([
        fetchWithAuth("/api/email-preferences").catch(() => null),
        fetchWithAuth("/api/notifications/preferences").catch(() => null),
        fetchWithAuth("/api/email-preferences/apps").catch(() => null),
      ]);

      if (emailRes?.ok) {
        const data = await emailRes.json();
        setEmailCategories(data.categories || []);
      }
      if (notifRes?.ok) {
        const data = await notifRes.json();
        setNotifPrefs(data.preferences || []);
      }
      if (appsRes?.ok) {
        const data = await appsRes.json();
        setAppDigests(data.apps || []);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  const toggleEmailPref = async (type: string, currentEnabled: boolean) => {
    setSaving(type);
    try {
      const res = await fetchWithAuth("/api/email-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: [{ type, enabled: !currentEnabled }] }),
      });
      if (res.ok) {
        setEmailCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            types: cat.types.map((t) =>
              t.type === type ? { ...t, enabled: !currentEnabled } : t
            ),
          }))
        );
        toast.success("Email preference updated");
      } else {
        toast.error("Failed to update preference");
      }
    } finally {
      setSaving(null);
    }
  };

  const toggleNotifPref = async (type: string, currentEnabled: boolean) => {
    setSaving(`notif-${type}`);
    try {
      const res = await fetchWithAuth("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: [{ type, inAppEnabled: !currentEnabled }] }),
      });
      if (res.ok) {
        setNotifPrefs((prev) =>
          prev.map((p) => (p.type === type ? { ...p, inAppEnabled: !currentEnabled } : p))
        );
        toast.success("Notification preference updated");
      }
    } finally {
      setSaving(null);
    }
  };

  const toggleAppDigest = async (appId: number, currentEnabled: boolean) => {
    setSaving(`app-${appId}`);
    setAppDigests((prev) => prev.map((a) => a.appId === appId ? { ...a, dailyDigestEnabled: !currentEnabled } : a));
    try {
      const res = await fetchWithAuth(`/api/email-preferences/apps/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyDigestEnabled: !currentEnabled }),
      });
      if (res.ok) {
        toast.success(!currentEnabled ? "Daily report enabled" : "Daily report disabled");
      } else {
        setAppDigests((prev) => prev.map((a) => a.appId === appId ? { ...a, dailyDigestEnabled: currentEnabled } : a));
        toast.error("Failed to update preference");
      }
    } finally {
      setSaving(null);
    }
  };

  const togglePlatformBulk = async (platform: string, enable: boolean) => {
    const platformApps = appDigests.filter((a) => a.platform === platform);
    const appIds = platformApps.map((a) => a.appId);
    if (appIds.length === 0) return;
    setSaving(`bulk-${platform}`);
    setAppDigests((prev) => prev.map((a) => a.platform === platform ? { ...a, dailyDigestEnabled: enable } : a));
    try {
      const res = await fetchWithAuth("/api/email-preferences/apps/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds, dailyDigestEnabled: enable }),
      });
      if (res.ok) {
        toast.success(enable ? "All enabled" : "All disabled");
      } else {
        setAppDigests((prev) => prev.map((a) => a.platform === platform ? { ...a, dailyDigestEnabled: !enable } : a));
        toast.error("Failed to update preferences");
      }
    } finally {
      setSaving(null);
    }
  };

  // Group apps by platform
  const appsByPlatform = new Map<string, AppDigest[]>();
  for (const app of appDigests) {
    const list = appsByPlatform.get(app.platform) || [];
    list.push(app);
    appsByPlatform.set(app.platform, list);
  }

  // Group notification prefs by category
  const notifGroups = new Map<string, NotificationPreference[]>();
  for (const pref of notifPrefs) {
    const meta = NOTIFICATION_TYPE_META[pref.type];
    const cat = meta?.category || "Other";
    const list = notifGroups.get(cat) || [];
    list.push(pref);
    notifGroups.set(cat, list);
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Email Preferences by Category */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5" /> Email Preferences
            </h2>

            {emailCategories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.key] || Mail;
              return (
                <Card key={cat.key} className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {cat.label}
                    </CardTitle>
                    <CardDescription>{cat.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {cat.types.map((t) => (
                        <div key={t.type} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{t.label}</span>
                            {t.required && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                <Lock className="h-2.5 w-2.5" /> Required
                              </span>
                            )}
                          </div>
                          {t.required ? (
                            <span className="text-xs text-muted-foreground">Always on</span>
                          ) : (
                            <Button
                              variant={t.enabled ? "default" : "outline"}
                              size="sm"
                              disabled={saving === t.type}
                              onClick={() => toggleEmailPref(t.type, t.enabled)}
                            >
                              {saving === t.type ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : t.enabled ? (
                                <><Check className="h-3 w-3 mr-1" /> On</>
                              ) : (
                                "Off"
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Per-App Email Reports */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5" /> App Email Reports
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which apps include data in your daily email report.
            </p>

            {appDigests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No tracked apps. Track apps to manage their email reports.
                </CardContent>
              </Card>
            ) : (
              [...appsByPlatform.entries()]
                .sort(([a], [b]) => {
                  const labelA = PLATFORM_DISPLAY[a as PlatformId]?.label ?? a;
                  const labelB = PLATFORM_DISPLAY[b as PlatformId]?.label ?? b;
                  return labelA.localeCompare(labelB);
                })
                .map(([platform, apps]) => {
                  const allEnabled = apps.every((a) => a.dailyDigestEnabled);
                  const brand = PLATFORM_DISPLAY[platform as PlatformId];
                  return (
                    <Card key={platform} className="mb-4">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: brand?.color ?? "#888" }} />
                            {brand?.label ?? platform}
                            <span className="text-xs text-muted-foreground font-normal">({apps.length})</span>
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={saving === `bulk-${platform}`}
                            onClick={() => togglePlatformBulk(platform, !allEnabled)}
                            className="text-xs"
                          >
                            {saving === `bulk-${platform}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : allEnabled ? "Deselect All" : "Select All"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {apps.map((app) => (
                            <div key={app.appId} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {app.iconUrl ? (
                                  <img src={app.iconUrl} alt="" aria-hidden="true" className="w-5 h-5 rounded shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded bg-muted shrink-0" />
                                )}
                                <span className="text-sm font-medium truncate">{app.name}</span>
                              </div>
                              <Switch
                                checked={app.dailyDigestEnabled}
                                disabled={saving === `app-${app.appId}`}
                                onCheckedChange={() => toggleAppDigest(app.appId, app.dailyDigestEnabled)}
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </div>

          {/* In-App Notification Preferences */}
          {notifGroups.size > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Bell className="h-5 w-5" /> In-App Notifications
              </h2>

              {[...notifGroups.entries()].map(([category, prefs]) => (
                <Card key={category} className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{category} Notifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {prefs.map((pref) => {
                        const meta = NOTIFICATION_TYPE_META[pref.type];
                        return (
                          <div key={pref.type} className="flex items-center justify-between py-2 border-b last:border-0">
                            <span className="text-sm font-medium">{meta?.label || pref.type}</span>
                            <Button
                              variant={pref.inAppEnabled ? "default" : "outline"}
                              size="sm"
                              disabled={saving === `notif-${pref.type}`}
                              onClick={() => toggleNotifPref(pref.type, pref.inAppEnabled)}
                            >
                              {saving === `notif-${pref.type}` ? (
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
