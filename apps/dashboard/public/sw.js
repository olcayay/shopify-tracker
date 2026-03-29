/**
 * Service Worker for Web Push notifications.
 * Handles push events, notification clicks, and dismissals.
 */

/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "AppRanks", body: event.data.text() };
  }

  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-72.png",
    tag: payload.tag || payload.notificationId || "appranks",
    data: {
      url: payload.url || "/",
      notificationId: payload.notificationId,
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title || "AppRanks", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || "/";
  const notificationId = data.notificationId;

  event.waitUntil(
    (async () => {
      // Report click
      if (notificationId) {
        try {
          await fetch(`/api/notifications/${notificationId}/read`, {
            method: "POST",
            credentials: "same-origin",
          });
        } catch {
          // Ignore — best effort
        }
      }

      // Focus existing window or open new one
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }

      self.clients.openWindow(url);
    })()
  );
});

self.addEventListener("notificationclose", (event) => {
  const data = event.notification.data || {};
  const notificationId = data.notificationId;

  if (notificationId) {
    // Best-effort dismiss tracking
    fetch(`/api/notifications/${notificationId}/dismiss`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
  }
});
