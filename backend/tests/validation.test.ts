import { describe, expect, it } from 'vitest';
import {
  MAX_TEXTS_PER_BATCH, parseId, parsePagination, validateBatch, validateCorrection,
  validateLogin, validateRegister,
} from '../src/validation';

describe('validateRegister', () => {
  it('accepts a valid body and normalizes the email', () => {
    const r = validateRegister({ email: '  Ali@Example.COM ', password: 'password123', name: 'Ali' });
    expect(r).toEqual({ ok: true, value: { email: 'ali@example.com', password: 'password123', name: 'Ali' } });
  });
  it('rejects a bad email', () => {
    expect(validateRegister({ email: 'nope', password: 'password123' }).ok).toBe(false);
  });
  it('rejects a short password', () => {
    expect(validateRegister({ email: 'a@b.com', password: 'short' }).ok).toBe(false);
  });
  it('rejects non-object bodies', () => {
    expect(validateRegister(null).ok).toBe(false);
    expect(validateRegister([]).ok).toBe(false);
  });
});

describe('validateLogin', () => {
  it('requires email and password', () => {
    expect(validateLogin({ email: 'a@b.com' }).ok).toBe(false);
    expect(validateLogin({ email: 'a@b.com', password: 'x' }).ok).toBe(true);
  });
});

describe('validateBatch', () => {
  it('accepts valid input and trims texts', () => {
    const r = validateBatch({ name: 'Oct reviews', texts: ['  bohot acha  ', 'kharab'] });
    expect(r).toEqual({ ok: true, value: { name: 'Oct reviews', texts: ['bohot acha', 'kharab'] } });
  });
  it('rejects empty list, empty texts, non-strings and too many texts', () => {
    expect(validateBatch({ name: 'x', texts: [] }).ok).toBe(false);
    expect(validateBatch({ name: 'x', texts: ['  '] }).ok).toBe(false);
    expect(validateBatch({ name: 'x', texts: [5] }).ok).toBe(false);
    expect(validateBatch({ name: 'x', texts: Array(MAX_TEXTS_PER_BATCH + 1).fill('a') }).ok).toBe(false);
  });
  it('requires a batch name', () => {
    expect(validateBatch({ texts: ['a'] }).ok).toBe(false);
  });
});

describe('validateCorrection / parseId / parsePagination', () => {
  it('accepts only the three labels', () => {
    expect(validateCorrection({ correctedLabel: 'positive' }).ok).toBe(true);
    expect(validateCorrection({ correctedLabel: 'happy' }).ok).toBe(false);
  });
  it('parses ids safely', () => {
    expect(parseId('12')).toBe(12);
    expect(parseId('0')).toBeNull();
    expect(parseId('1; DROP TABLE users')).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });
  it('uses safe pagination defaults', () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20 });
    expect(parsePagination({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
    expect(parsePagination({ page: '-1', pageSize: '9999' })).toEqual({ page: 1, pageSize: 20 });
  });
});
