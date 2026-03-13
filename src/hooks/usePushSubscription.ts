import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Utility function to convert Base64 string to Uint8Array for the VAPID key
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const usePushSubscription = () => {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize the permission state when the component mounts
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      setError('This browser does not support desktop notifications.');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    } catch (err: any) {
      console.error('Error requesting notification permission:', err);
      setError('Failed to request notification permission.');
      return 'denied';
    }
  };

  const subscribeToWebPush = async (userId: string): Promise<boolean> => {
    setIsSubscribing(true);
    setError(null);

    try {
      // 1. Check if Service Workers and Push Manager are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Service Workers or Push Notifications are not supported by the browser.');
      }

      // 2. Ensure permission is granted
      if (notificationPermission !== 'granted') {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission was not granted.');
        }
      }

      // 3. Wait for Service Worker Registration
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
         throw new Error('Service Worker registration is not active.');
      }

      // 4. Fetch the VAPID public key securely via Supabase RPC
      const { data: vapidPublicKey, error: rpcError } = await supabase.rpc('get_vapid_public_key');

      if (rpcError || !vapidPublicKey) {
        console.error('RPC Error fetching VAPID key:', rpcError);
        throw new Error('Failed to retrieve VAPID public key from the server.');
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 5. Subscribe to PushManager
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 6. Serialize and save the subscription to Supabase
      const subscriptionJSON = pushSubscription.toJSON();

      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription: subscriptionJSON,
        }, {
           onConflict: 'user_id, subscription', // Ensure we don't duplicate identical subscriptions for a user
        });

      if (dbError) {
        console.error('Database Error saving subscription:', dbError);
        throw new Error('Failed to save push subscription to the database.');
      }

      setIsSubscribing(false);
      return true;

    } catch (err: any) {
      console.error('Failed to subscribe to web push:', err);
      setError(err.message || 'An unknown error occurred during subscription.');
      setIsSubscribing(false);
      return false;
    }
  };

  return {
    notificationPermission,
    isSubscribing,
    error,
    requestNotificationPermission,
    subscribeToWebPush,
  };
};
