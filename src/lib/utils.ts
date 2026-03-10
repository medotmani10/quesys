import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCustomerBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;
  
  // If already on customer subdomain, use current host
  if (host.includes('customer') || host.includes('costumer')) {
    return `${window.location.protocol}//${host}`;
  }
  
  // For localhost development
  if (host.includes('localhost') || host.includes('127.0.0')) {
    const localHost = host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '');
    return `${window.location.protocol}//${localHost}`;
  }
  
  // Production customer subdomain
  return 'https://customer-barberticket.vercel.app';
}

export function getBarberBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '');
  if (host.includes('localhost') || host.includes('127.0.0')) return `${window.location.protocol}//${host}`;
  return `${window.location.protocol}//barber-${host}`;
}

/** Returns the per-barber display code, e.g. "A1" for the 1st barber, "B1" for the 2nd. */
export function getTicketCode(barberIndex: number | undefined, ticketNumber: number): string {
  const prefix = barberIndex !== undefined && barberIndex >= 0
    ? String.fromCharCode(65 + (barberIndex % 26))
    : '#';
  return `${prefix}${ticketNumber}`;
}
