// =============================================================
// Service Worker — Coiffure App
//
// Strategy: VitePWA `injectManifest`
//   • Vite PWA processes this file and replaces `self.__WB_MANIFEST`
//     with the list of precached assets automatically.
//   • `precacheAndRoute` is imported via workbox (bundled at build time).
// =============================================================

import { precacheAndRoute } from 'workbox-precaching';

// Required by VitePWA `injectManifest` — DO NOT REMOVE.
// At build time this is replaced with the actual asset manifest.
precacheAndRoute(self.__WB_MANIFEST || []);


// ─── Web Push: Push Event ─────────────────────────────────────────────────────
//
// Fired when the browser receives a server-sent push message.
// Payload JSON shape (produced by the `send-push` Supabase Edge Function):
//   { title: string, body: string, url: string }

self.addEventListener('push', function (event) {
  if (!event.data) {
    console.warn('[SW] Push received with no payload — skipping.');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    console.error('[SW] Failed to parse push data as JSON:', err);
    return;
  }

  const title = payload.title || 'Coiffure';
  const options = {
    body: payload.body || 'لديك إشعار جديد.',
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    vibrate: [200, 100, 200],
    tag: 'coiffure-push',  // Replaces any previous notification (no spam)
    renotify: true,
    data: {
      url: payload.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});


// ─── Web Push: Notification Click ─────────────────────────────────────────────
//
// Fired when the user taps on the notification.
// Opens the target URL in the app or focused an existing window.

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windowClients) {
        // If an app window is already open, navigate it to the URL and focus
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            if ('navigate' in client) {
              client.navigate(urlToOpen);
            }
            return client.focus();
          }
        }
        // No existing window — open a new tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
