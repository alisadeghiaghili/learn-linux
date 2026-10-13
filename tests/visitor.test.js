/**
 * Visitor counter tests with fetch and localStorage fully mocked.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getVisitorCount,
  getCachedVisitorCount,
  counterUrl,
  API_BASE,
  NAMESPACE,
  COUNTER_KEY,
  COUNTED_FLAG_KEY,
  CACHE_KEY,
} from '../js/visitor.js';

const SLUG = 'learn-linux';
const realFetch = globalThis.fetch;
const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

let store;
let calls;
let responder;

function installStorage(impl) {
  Object.defineProperty(globalThis, 'localStorage', { value: impl, configurable: true, writable: true });
}

function memoryStorage(seed = {}) {
  store = new Map(Object.entries(seed));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
}

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ value }),
  };
}

beforeEach(() => {
  calls = [];
  responder = () => jsonResponse(0);
  installStorage(memoryStorage());
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return responder(url, opts, calls.length);
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
  else delete globalThis.localStorage;
});

test('request URLs use the exact namespace and course key', async () => {
  assert.equal(API_BASE, 'https://abacus.jasoncameron.dev');
  assert.equal(NAMESPACE, 'alisadeghiaghili.github.io');
  assert.equal(COUNTER_KEY, `${SLUG}-unique-visitors`);
  assert.equal(
    counterUrl('hit'),
    `https://abacus.jasoncameron.dev/hit/alisadeghiaghili.github.io/${SLUG}-unique-visitors`,
  );
  assert.equal(
    counterUrl('get'),
    `https://abacus.jasoncameron.dev/get/alisadeghiaghili.github.io/${SLUG}-unique-visitors`,
  );
  responder = () => jsonResponse(5);
  await getVisitorCount();
  assert.equal(calls[0].url, counterUrl('hit'));
  assert.equal(calls[0].opts.cache, 'no-store');
  assert.ok(calls[0].opts.signal);
});

test('first visit sends exactly one hit, sets the flag and shows the hit value', async () => {
  responder = () => jsonResponse(120);
  const count = await getVisitorCount();
  assert.equal(count, 120);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/hit\//);
  assert.equal(COUNTED_FLAG_KEY, `${SLUG}:visitor-counted:v1`);
  assert.ok(!Number.isNaN(Date.parse(store.get(COUNTED_FLAG_KEY))));
  assert.equal(getCachedVisitorCount(), 120);
});

test('the flag is set before the hit request is sent', async () => {
  let flagDuringRequest = null;
  responder = () => {
    flagDuringRequest = store.get(COUNTED_FLAG_KEY) ?? null;
    return jsonResponse(9);
  };
  await getVisitorCount();
  assert.notEqual(flagDuringRequest, null);
});

test('second visit only reads, never increments', async () => {
  responder = () => jsonResponse(120);
  await getVisitorCount();
  calls.length = 0;
  responder = () => jsonResponse(121);
  const count = await getVisitorCount();
  assert.equal(count, 121);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/get\//);
  assert.doesNotMatch(calls[0].url, /\/hit\//);
});

for (const [label, make] of [
  ['network error', () => { throw new TypeError('network down'); }],
  ['non-2xx status', () => jsonResponse(0, 500)],
  ['bad JSON', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } })],
  ['missing value', () => ({ ok: true, status: 200, json: async () => ({}) })],
]) {
  test(`failed hit (${label}) removes the flag, falls back to get, and the next visit hits again`, async () => {
    responder = (url) => (url.includes('/hit/') ? make() : jsonResponse(77));
    const count = await getVisitorCount();
    assert.equal(count, 77);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/hit\//);
    assert.match(calls[1].url, /\/get\//);
    assert.equal(store.has(COUNTED_FLAG_KEY), false);

    calls.length = 0;
    responder = () => jsonResponse(78);
    assert.equal(await getVisitorCount(), 78);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/hit\//);
    assert.ok(store.has(COUNTED_FLAG_KEY));
  });
}

test('a timed out hit aborts after the timeout and recovers via get', async () => {
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...rest) => realSetTimeout(fn, ms > 1000 ? 1 : ms, ...rest);
  try {
    responder = (url, opts) => {
      if (!url.includes('/hit/')) return jsonResponse(15);
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    };
    assert.equal(await getVisitorCount(), 15);
    assert.equal(store.has(COUNTED_FLAG_KEY), false);
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
});

test('get answering 404 is shown as 0', async () => {
  store.set(COUNTED_FLAG_KEY, '2025-01-01T00:00:00.000Z');
  responder = () => ({ ok: false, status: 404, json: async () => ({ error: 'not found' }) });
  assert.equal(await getVisitorCount(), 0);
  assert.equal(calls.length, 1);
  assert.equal(getCachedVisitorCount(), 0);
});

test('a stale or inflated cache is replaced by the lower server value', async () => {
  store.set(COUNTED_FLAG_KEY, '2025-01-01T00:00:00.000Z');
  store.set(CACHE_KEY, JSON.stringify({ count: 99999, at: 1 }));
  assert.equal(getCachedVisitorCount(), 99999);
  responder = () => jsonResponse(42);
  const count = await getVisitorCount();
  assert.equal(count, 42);
  assert.equal(JSON.parse(store.get(CACHE_KEY)).count, 42);
  assert.equal(getCachedVisitorCount(), 42);
});

test('unreadable cache is ignored', () => {
  store.set(CACHE_KEY, '{not json');
  assert.equal(getCachedVisitorCount(), null);
  store.set(CACHE_KEY, JSON.stringify({ count: -3 }));
  assert.equal(getCachedVisitorCount(), null);
});

test('unavailable localStorage never hits, only gets', async () => {
  const boom = () => { throw new Error('SecurityError'); };
  installStorage({ getItem: boom, setItem: boom, removeItem: boom });
  responder = () => jsonResponse(31);
  assert.equal(await getVisitorCount(), 31);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/get\//);
  assert.equal(getCachedVisitorCount(), null);
});

test('resolves to null when the server cannot be reached at all', async () => {
  responder = () => { throw new TypeError('offline'); };
  assert.equal(await getVisitorCount(), null);
  assert.equal(store.has(COUNTED_FLAG_KEY), false);
});
