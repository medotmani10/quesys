import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCustomerBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;
  if (host.includes('localhost') || host.includes('127.0.0')) {
    const localHost = host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '');
    return `${window.location.protocol}//${localHost}`;
  }
  return 'https://costumer-barberticket.vercel.app';
}

export function getBarberBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.host.replace('admin-', '').replace('admin.', '').replace('barber-', '').replace('barber.', '');
  if (host.includes('localhost') || host.includes('127.0.0')) return `${window.location.protocol}//${host}`;
  return `${window.location.protocol}//barber-${host}`;
}
