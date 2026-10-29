import { Label, isLabel } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_TEXTS_PER_BATCH = 1000;
export const MAX_TEXT_LENGTH = 2000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateRegister(body: unknown): Result<{ email: string; password: string; name: string | null }> {
  if (!isObject(body)) return { ok: false, error: 'Request body must be a JSON object' };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 100) : null;
  if (!EMAIL_RE.test(email) || email.length > 255) return { ok: false, error: 'A valid email is required' };
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters' };
  if (password.length > 72) return { ok: false, error: 'Password must be at most 72 characters' };
  return { ok: true, value: { email, password, name } };
}

export function validateLogin(body: unknown): Result<{ email: string; password: string }> {
  if (!isObject(body)) return { ok: false, error: 'Request body must be a JSON object' };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return { ok: false, error: 'Email and password are required' };
  return { ok: true, value: { email, password } };
}

export function validateBatch(body: unknown): Result<{ name: string; texts: string[] }> {
  if (!isObject(body)) return { ok: false, error: 'Request body must be a JSON object' };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 150) return { ok: false, error: 'Batch name is required (max 150 characters)' };
  if (!Array.isArray(body.texts) || body.texts.length === 0) {
    return { ok: false, error: 'texts must be a non-empty array' };
  }
  if (body.texts.length > MAX_TEXTS_PER_BATCH) {
    return { ok: false, error: `At most ${MAX_TEXTS_PER_BATCH} texts per batch` };
  }
  const texts: string[] = [];
  for (const t of body.texts) {
    if (typeof t !== 'string') return { ok: false, error: 'Every text must be a string' };
    const trimmed = t.trim();
    if (!trimmed) return { ok: false, error: 'Texts must not be empty' };
    if (trimmed.length > MAX_TEXT_LENGTH) {
      return { ok: false, error: `Each text must be at most ${MAX_TEXT_LENGTH} characters` };
    }
    texts.push(trimmed);
  }
  return { ok: true, value: { name, texts } };
}

export function validateCorrection(body: unknown): Result<{ label: Label }> {
  if (!isObject(body) || !isLabel(body.correctedLabel)) {
    return { ok: false, error: 'correctedLabel must be negative, neutral or positive' };
  }
  return { ok: true, value: { label: body.correctedLabel } };
}

export function parseId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

export function parsePagination(query: Record<string, unknown>): { page: number; pageSize: number } {
  const page = Number(query.page);
  const pageSize = Number(query.pageSize);
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : 20,
  };
}
