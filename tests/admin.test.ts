import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdmin } from '@/lib/auth/admin';

describe('isAdmin', () => {
  const ORIGINAL = process.env.ADMIN_USER_IDS;
  beforeEach(() => { process.env.ADMIN_USER_IDS = 'aaa,bbb,ccc'; });
  afterEach(() => { process.env.ADMIN_USER_IDS = ORIGINAL; });

  it('returns true for a listed id', () => {
    expect(isAdmin('bbb')).toBe(true);
  });
  it('returns false for an unlisted id', () => {
    expect(isAdmin('zzz')).toBe(false);
  });
  it('returns false for empty id', () => {
    expect(isAdmin('')).toBe(false);
  });
  it('trims whitespace in the env var', () => {
    process.env.ADMIN_USER_IDS = ' aaa , bbb ';
    expect(isAdmin('aaa')).toBe(true);
    expect(isAdmin('bbb')).toBe(true);
  });
  it('returns false when env var missing', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(isAdmin('aaa')).toBe(false);
  });
});
