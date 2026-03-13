/**
 * pushNotification.ts
 *
 * A simple helper to trigger a Web Push notification for a specific user
 * by calling the Supabase `send-push` Edge Function.
 *
 * Usage:
 *   import { sendPushToUser } from '@/lib/pushNotification';
 *
 *   // Send a notification when a customer's turn arrives
 *   await sendPushToUser({
 *     userId: barber.auth_id,       // the authenticated user_id to notify
 *     title: 'Your turn is coming!',
 *     body: 'You are next in queue.',
 *     url: `/shop/${shopSlug}/ticket/${ticketId}`,
 *   });
 */

import { supabase } from './supabase';

export interface PushNotificationPayload {
    /** The `auth.users.id` of the user to notify */
    userId: string;
    /** Notification title (shown in bold) */
    title: string;
    /** Notification body text */
    body: string;
    /** Optional URL to open when the user clicks the notification */
    url?: string;
}

export interface PushNotificationResult {
    success: boolean;
    message?: string;
    successCount?: number;
    failureCount?: number;
    error?: string;
}

/**
 * Sends a Web Push notification to all active devices of a given user.
 * Calls the Supabase `send-push` Edge Function internally.
 *
 * @returns Result object indicating success/failure and dispatch counts.
 */
export async function sendPushToUser(
    payload: PushNotificationPayload
): Promise<PushNotificationResult> {
    try {
        const { data, error } = await supabase.functions.invoke('send-push', {
            body: payload,
        });

        if (error) {
            console.error('[Push] Edge Function error:', error.message);
            return { success: false, error: error.message };
        }

        console.log('[Push] Dispatch result:', data);
        return {
            success: true,
            message: data?.message,
            successCount: data?.successCount ?? 0,
            failureCount: data?.failureCount ?? 0,
        };
    } catch (err: any) {
        console.error('[Push] Unexpected error calling send-push:', err);
        return { success: false, error: err.message ?? 'Unknown error' };
    }
}
