import { createClient } from '@supabase/supabase-js';
import { getDeviceFingerprint } from './fingerprint';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ FIXED H-5: fail fast instead of silently using empty strings
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Barber Ticket] Missing required env variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return match[2];
  return null;
}

function setCookie(name: string, value: string, days: number) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
}

// Ensure the ID is stable using device fingerprinting + dual storage
export async function getOrCreateSessionId(): Promise<string> {
  const cookieId = getCookie('queue_session_id');
  const localId = localStorage.getItem('queue_session_id');

  // If we already have a robust ID stored, ensure it's in both places and return
  if (cookieId || localId) {
    const idToUse = cookieId || localId || '';
    if (!cookieId) setCookie('queue_session_id', idToUse, 365);
    if (!localId) localStorage.setItem('queue_session_id', idToUse);
    return idToUse;
  }

  // Generate robust fingerprint instead of Math.random
  const fingerprint = await getDeviceFingerprint();

  localStorage.setItem('queue_session_id', fingerprint);
  setCookie('queue_session_id', fingerprint, 365);

  return fingerprint;
}

// Helper to clear session ID (if ever needed)
export function clearSessionId(): void {
  localStorage.removeItem('queue_session_id');
  document.cookie = "queue_session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}
