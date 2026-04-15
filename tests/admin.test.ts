import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdmin } from '@/lib/auth/admin';

describe('isAdmin', () => {
  const ORIGINAL_CSV = process.env.ADMIN_USER_IDS;
  const ORIGINAL_1 = process.env.ADMIN_USER_ID_1;
  const ORIGINAL_2 = process.env.ADMIN_USER_ID_2;
  const ORIGINAL_3 = process.env.ADMIN_USER_ID_3;

  beforeEach(() => {
    process.env.ADMIN_USER_IDS = 'aaa,bbb,ccc';
    delete process.env.ADMIN_USER_ID_1;
    delete process.env.ADMIN_USER_ID_2;
    delete process.env.ADMIN_USER_ID_3;
  });
  afterEach(() => {
    if (ORIGINAL_CSV === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = ORIGINAL_CSV;
    if (ORIGINAL_1 === undefined) delete process.env.ADMIN_USER_ID_1;
    else process.env.ADMIN_USER_ID_1 = ORIGINAL_1;
    if (ORIGINAL_2 === undefined) delete process.env.ADMIN_USER_ID_2;
    else process.env.ADMIN_USER_ID_2 = ORIGINAL_2;
    if (ORIGINAL_3 === undefined) delete process.env.ADMIN_USER_ID_3;
    else process.env.ADMIN_USER_ID_3 = ORIGINAL_3;
  });

  it('returns true for a listed id via CSV', () => {
    expect(isAdmin('bbb')).toBe(true);
  });
  it('returns false for an unlisted id', () => {
    expect(isAdmin('zzz')).toBe(false);
  });
  it('returns false for empty id', () => {
    expect(isAdmin('')).toBe(false);
  });
  it('trims whitespace in the CSV var', () => {
    process.env.ADMIN_USER_IDS = ' aaa , bbb ';
    expect(isAdmin('aaa')).toBe(true);
    expect(isAdmin('bbb')).toBe(true);
  });
  it('returns false when all sources missing', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(isAdmin('aaa')).toBe(false);
  });

  it('reads numbered ADMIN_USER_ID_N vars', () => {
    delete process.env.ADMIN_USER_IDS;
    process.env.ADMIN_USER_ID_1 = 'one';
    process.env.ADMIN_USER_ID_2 = 'two';
    expect(isAdmin('one')).toBe(true);
    expect(isAdmin('two')).toBe(true);
    expect(isAdmin('three')).toBe(false);
  });
  it('stops numbered scan at first gap', () => {
    delete process.env.ADMIN_USER_IDS;
    process.env.ADMIN_USER_ID_1 = 'one';
    // _2 missing
    process.env.ADMIN_USER_ID_3 = 'three';
    expect(isAdmin('one')).toBe(true);
    expect(isAdmin('three')).toBe(false); // not reached
  });
  it('merges CSV and numbered sources', () => {
    process.env.ADMIN_USER_IDS = 'csv-id';
    process.env.ADMIN_USER_ID_1 = 'num-id';
    expect(isAdmin('csv-id')).toBe(true);
    expect(isAdmin('num-id')).toBe(true);
  });
});
