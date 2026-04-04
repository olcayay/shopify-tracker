"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Moon, Clock, TestTube, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isPushSupported, getPermissionStatus, isSubscribed } from "@/lib/push-notifications";
import { toast } from "sonner";

export default function NotificationSettingsPage() {
  const { fetchWithAuth } = useAuth();
  const [preferences, setPreferences] = useState<{ type: string; inAppEnabled: boolean; pushEnabled: boolean }[]>([]);
  const [pushStatus, setPushStatus] = useState<"loading" | "granted" | "denied" | "default" | "unsupported">("loading");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/api/notifications/preferences");
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences || []);
      }
    } finally {
      setLoading(false);
    }

    // Check push status
    if (isPushSupported()) {
      setPushStatus(getPermissionStatus() as any);
      setPushSubscribed(await isSubscribed());
    } else {
      setPushStatus("unsupported");
    }
  }, [fetchWithAuth]);

  useEffect(() => { loadData(); }, [loadData]);

  const togglePref = async (type: string, field: "inAppEnabled" | "pushEnabled", current: boolean) => {
    setSaving(`${type}-${field}`);
    try {
      const res = await fetchWithAuth(`/api/notifications/preferences/${type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
      if (res.ok) {
        setPreferences((prev) =>
          prev.map((p) => p.type === type ? { ...p, [field]: !current } : p)
        );
        toast.success("Preference updated");
      }
    } finally {
      setSaving(null);
    }
  };

  const handlePushToggle = async () => {
    if (pushSubscribed) {
      // Unsubscribe via browser API
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetchWithAuth("/api/notifications/push-subscription", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
      } catch { /* ignore */ }
      setPushSubscribed(false);
      toast.success("Push notifications disabled");
    } else {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        const keyRes = await fetchWithAuth("/api/notifications/push/vapid-key");
        if (!keyRes.ok) return;
        const { vapidPublicKey } = await keyRes.json();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey,
        });
        const json = sub.toJSON();
        const res = await fetchWithAuth("/api/notifications/push-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
        if (res.ok) {
          setPushSubscribed(true);
          toast.success("Push notifications enabled");
        }
      } catch { /* ignore */ }
    }
    setPushStatus(getPermissionStatus() as any);
  };

  const sendTestPush = async () => {
    toast.info("Test push sent (check your browser)");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="h-6 w-6" />
          Notification Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage how and when you receive notifications.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Push Notifications
              </CardTitle>
              <CardDescription>Receive instant browser notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Browser Push</p>
                  <p className="text-xs text-muted-foreground">
                    {pushStatus === "unsupported" ? "Not supported in this browser" :
                     pushStatus === "denied" ? "Blocked — enable in browser settings" :
                     pushSubscribed ? "Active" : "Not enabled"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={pushSubscribed ? "default" : "outline"}
                    disabled={pushStatus === "unsupported" || pushStatus === "denied"}
                    onClick={handlePushToggle}
                  >
                    {pushSubscribed ? "Disable" : "Enable"}
                  </Button>
                  {pushSubscribed && (
                    <Button size="sm" variant="ghost" onClick={sendTestPush}>
                      <TestTube className="h-3 w-3 mr-1" /> Test
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-Type Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Types</CardTitle>
              <CardDescription>Choose which notifications to receive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_80px] gap-2 pb-2 border-b text-xs text-muted-foreground font-medium">
                  <div>Type</div>
                  <div className="text-center">In-App</div>
                  <div className="text-center">Push</div>
                </div>
                {preferences.map((pref) => (
                  <div key={pref.type} className="grid grid-cols-[1fr_80px_80px] gap-2 items-center py-1.5">
                    <span className="text-sm">{pref.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                    <div className="text-center">
                      <Button
                        size="sm"
                        variant={pref.inAppEnabled ? "default" : "outline"}
                        className="h-7 w-14 text-xs"
                        disabled={saving === `${pref.type}-inAppEnabled`}
                        onClick={() => togglePref(pref.type, "inAppEnabled", pref.inAppEnabled)}
                      >
                        {pref.inAppEnabled ? "On" : "Off"}
                      </Button>
                    </div>
                    <div className="text-center">
                      <Button
                        size="sm"
                        variant={pref.pushEnabled ? "default" : "outline"}
                        className="h-7 w-14 text-xs"
                        disabled={saving === `${pref.type}-pushEnabled`}
                        onClick={() => togglePref(pref.type, "pushEnabled", pref.pushEnabled)}
                      >
                        {pref.pushEnabled ? "On" : "Off"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
