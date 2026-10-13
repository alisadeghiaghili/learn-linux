/**
 * Unique visitor counter client.
 *
 * The number lives only on the server. A browser counts once, ever: a
 * per-course localStorage flag decides between `hit` (first visit) and `get`
 * (every later visit). The local cache is a first-paint placeholder and is
 * always overwritten by the server value.
 */

'use strict';

export const API_BASE = 'https://abacus.jasoncameron.dev';
export const NAMESPACE = 'alisadeghiaghili.github.io';
export const SLUG = 'learn-linux';
export const COUNTER_KEY = `${SLUG}-unique-visitors`;
export const COUNTED_FLAG_KEY = `${SLUG}:visitor-counted:v1`;
export const CACHE_KEY = `${SLUG}:visitor-count:v2`;
export const REQUEST_TIMEOUT_MS = 5000;

/**
 * Builds the endpoint URL for a counter action.
 *
 * @param {'get' | 'hit'} action
 * @returns {string}
 */
export function counterUrl(action) {
  return `${API_BASE}/${action}/${NAMESPACE}/${COUNTER_KEY}`;
}

/**
 * Reads the placeholder count used for the first paint only.
 *
 * @returns {number | null}
 */
export function getCachedVisitorCount() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Number.isInteger(cached?.count) && cached.count >= 0) return cached.count;
  } catch {
    // unreadable cache is ignored
  }
  return null;
}

function cacheCount(count) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ count, at: Date.now() }));
  } catch {
    // storage unavailable
  }
}

/**
 * Calls the counter API and returns the integer value.
 * A 404 on `get` means the key does not exist yet and reads as 0.
 *
 * @param {'get' | 'hit'} action
 * @returns {Promise<number>}
 */
async function request(action) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(counterUrl(action), {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (action === 'get' && res.status === 404) return 0;
    if (!res.ok) throw new Error(`counter ${action} failed: ${res.status}`);
    const data = await res.json();
    if (!Number.isInteger(data?.value) || data.value < 0) {
      throw new Error('counter response has no valid value');
    }
    return data.value;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Marks this browser as counted. Returns false when storage is unusable.
 *
 * @returns {boolean}
 */
function markCounted() {
  try {
    if (localStorage.getItem(COUNTED_FLAG_KEY)) return false;
    localStorage.setItem(COUNTED_FLAG_KEY, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

function clearCounted() {
  try {
    localStorage.removeItem(COUNTED_FLAG_KEY);
  } catch {
    // storage unavailable
  }
}

/**
 * Resolves the visitor count shown to the user. Increments at most once per
 * browser. Resolves to null when the server cannot be reached at all.
 *
 * @returns {Promise<number | null>}
 */
export async function getVisitorCount() {
  let value = null;
  if (markCounted()) {
    try {
      value = await request('hit');
    } catch {
      clearCounted();
    }
  }
  if (value === null) {
    try {
      value = await request('get');
    } catch {
      return null;
    }
  }
  cacheCount(value);
  return value;
}
