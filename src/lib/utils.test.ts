import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCustomerBaseUrl, getBarberBaseUrl } from './utils';

describe('Base URL Utilities', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    // Reset window object before each test
    vi.stubGlobal('window', {
      ...originalWindow,
      location: {
        host: '',
        protocol: 'https:',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getCustomerBaseUrl', () => {
    it('returns empty string when window is undefined', () => {
      vi.stubGlobal('window', undefined);
      expect(getCustomerBaseUrl()).toBe('');
    });

    it('returns base url without admin- prefix', () => {
      window.location.host = 'admin-example.com';
      expect(getCustomerBaseUrl()).toBe('https://example.com');
    });

    it('returns base url without admin. prefix', () => {
      window.location.host = 'admin.example.com';
      expect(getCustomerBaseUrl()).toBe('https://example.com');
    });

    it('returns base url without barber- prefix', () => {
      window.location.host = 'barber-example.com';
      expect(getCustomerBaseUrl()).toBe('https://example.com');
    });

    it('returns base url without barber. prefix', () => {
      window.location.host = 'barber.example.com';
      expect(getCustomerBaseUrl()).toBe('https://example.com');
    });

    it('returns the same url for non-prefixed hosts', () => {
      window.location.host = 'example.com';
      expect(getCustomerBaseUrl()).toBe('https://example.com');
    });

    it('handles multiple prefixes correctly', () => {
      window.location.host = 'admin-barber.example.com';
      expect(getCustomerBaseUrl()).toBe('https://example.com');
    });
  });

  describe('getBarberBaseUrl', () => {
    it('returns empty string when window is undefined', () => {
      vi.stubGlobal('window', undefined);
      expect(getBarberBaseUrl()).toBe('');
    });

    it('returns the same url for localhost', () => {
      window.location.host = 'localhost:3000';
      window.location.protocol = 'http:';
      expect(getBarberBaseUrl()).toBe('http://localhost:3000');
    });

    it('returns the same url for 127.0.0.1', () => {
      window.location.host = '127.0.0.1:5173';
      window.location.protocol = 'http:';
      expect(getBarberBaseUrl()).toBe('http://127.0.0.1:5173');
    });

    it('returns barber-prefixed url for non-prefixed production hosts', () => {
      window.location.host = 'example.com';
      expect(getBarberBaseUrl()).toBe('https://barber-example.com');
    });

    it('returns barber-prefixed url for admin-prefixed hosts', () => {
      window.location.host = 'admin-example.com';
      expect(getBarberBaseUrl()).toBe('https://barber-example.com');
    });

    it('returns barber-prefixed url for admin.prefixed hosts', () => {
      window.location.host = 'admin.example.com';
      expect(getBarberBaseUrl()).toBe('https://barber-example.com');
    });

    it('returns correct barber-prefixed url even if already has barber- prefix', () => {
      // The current implementation replaces 'barber-' with '' and then prepends 'barber-'
      window.location.host = 'barber-example.com';
      expect(getBarberBaseUrl()).toBe('https://barber-example.com');
    });

    it('returns correct barber-prefixed url for barber.prefixed hosts', () => {
      window.location.host = 'barber.example.com';
      expect(getBarberBaseUrl()).toBe('https://barber-example.com');
    });
  });
});
