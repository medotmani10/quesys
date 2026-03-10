import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMainBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;
  // Strip subdomains to get the root
  const rootHost = host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '').replace('customer.', '');

  if (host.includes('localhost') || host.includes('127.0.0')) {
    return `${window.location.protocol}//${rootHost}`;
  }
  // Hardcoded production landing for reliability
  return 'https://barberticket.vercel.app';
}

export function getCustomerBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;

  if (host.includes('localhost') || host.includes('127.0.0')) {
    const rootHost = host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '');
    return `${window.location.protocol}//${rootHost}`;
  }

  // Use main domain for customers to ensure it works without subdomain config
  return 'https://costumer-barberticket.vercel.app';
}

export function getBarberBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;

  if (host.includes('localhost') || host.includes('127.0.0')) {
    const rootHost = host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '');
    return `${window.location.protocol}//${rootHost}`;
  }

  const base = host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '').replace('customer.', '');
  return `${window.location.protocol}//barber-${base}`;
}

/** Returns the per-barber display code, e.g. "A1" for the 1st barber, "B1" for the 2nd. */
export function getTicketCode(barberIndex: number | undefined, ticketNumber: number): string {
  const prefix = barberIndex !== undefined && barberIndex >= 0
    ? String.fromCharCode(65 + (barberIndex % 26))
    : '#';
  return `${prefix}${ticketNumber}`;
}
