import { precacheAndRoute } from 'workbox-precaching';

// Required for vite-plugin-pwa injectManifest
precacheAndRoute(self.__WB_MANIFEST || []);

// ---------------------------------------------------------
// Web Push Notifications Handling
// ---------------------------------------------------------

self.addEventListener('push', function (event) {
  if (!event.data) {
    console.warn('Push event received, but no data was attached.');
    return;
  }

  try {
    const payload = event.data.json();

    const title = payload.title || 'New Notification';
    const options = {
      body: payload.body || 'You have a new message.',
      icon: '/pwa-icon.svg', // Assuming pwa-icon.svg is in public directory
      vibrate: [200, 100, 200],
      data: {
        url: payload.url || '/', // URL to open when clicked
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('Error parsing push event data:', error);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  // This looks to see if the current window is already open and
  // focuses if it is. If not, it opens a new window.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];

        // If the URL matches, focus on it
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }

        // As a fallback, if we just want to focus the app regardless of exact URL match
        if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen); // Navigate to the specific URL
            return client.focus();
        }
      }

      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
