import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSessionId, getOrCreateSessionId } from './supabase';

describe('supabase helpers', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    localStorage.clear();
    // Reset all mocks
    vi.restoreAllMocks();
  });

  describe('generateSessionId', () => {
    it('should generate a valid session ID', () => {
      const sessionId = generateSessionId();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.startsWith('session_')).toBe(true);
      expect(sessionId.length).toBeGreaterThan(10);
    });

    it('should generate unique session IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('getOrCreateSessionId', () => {
    it('should return existing session ID from localStorage', () => {
      const existingId = 'session_123456_abcdef';
      localStorage.setItem('queue_session_id', existingId);

      // We spy on getItem to ensure it was called
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      // We could also spy on setItem to ensure it wasn't called
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const sessionId = getOrCreateSessionId();

      expect(sessionId).toBe(existingId);
      expect(getItemSpy).toHaveBeenCalledWith('queue_session_id');
      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should create and store new session ID if none exists', () => {
      // Ensure it's empty to begin with
      expect(localStorage.getItem('queue_session_id')).toBeNull();

      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const sessionId = getOrCreateSessionId();

      expect(sessionId).toBeDefined();
      expect(sessionId.startsWith('session_')).toBe(true);

      expect(getItemSpy).toHaveBeenCalledWith('queue_session_id');
      expect(setItemSpy).toHaveBeenCalledWith('queue_session_id', sessionId);
      expect(localStorage.getItem('queue_session_id')).toBe(sessionId);
    });
  });
});
