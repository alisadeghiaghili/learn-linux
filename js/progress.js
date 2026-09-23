/**
 * Progress persistence: localStorage + cookie so learners resume next week.
 */

import { levels, sequences, levelsIn } from './levels.js';

export const STORAGE_KEY = 'learn-linux-progress-v1';
export const COOKIE_KEY = 'learn_linux_progress';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/** In-memory fallback when localStorage/cookies are unavailable (tests, private mode). */
const memStore = new Map();

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch {
    return false;
  }
}

/**
 * @typedef {Object} LevelProgress
 * @property {boolean} solved
 * @property {number} [bestCommands]
 * @property {number} [par]
 * @property {number} [at]
 */

/**
 * @typedef {Object} CurriculumItem
 * @property {string} id
 * @property {string} name
 * @property {string} seriesTitle
 * @property {string[]} learn
 * @property {number} [bestCommands]
 */

/**
 * @typedef {Object} CurriculumSummary
 * @property {number} solvedCount
 * @property {number} total
 * @property {CurriculumItem[]} learned
 * @property {CurriculumItem[]} remaining
 * @property {CurriculumItem|null} next
 * @property {number} percent
 */

function readCookie() {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey !== COOKIE_KEY) continue;
    try {
      return decodeURIComponent(rest.join('='));
    } catch {
      return rest.join('=');
    }
  }
  return null;
}

/**
 * @param {string} payload
 */
function writeCookie(payload) {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(payload)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * @param {string|null} raw
 * @returns {Record<string, LevelProgress>|null}
 */
function parseBlob(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.progress && typeof parsed.progress === 'object') {
      return parsed.progress;
    }
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Merge localStorage + cookie.
 * @returns {Record<string, LevelProgress>}
 */
export function loadProgress() {
  let fromLocal = null;
  let fromCookie = null;
  try {
    fromLocal = parseBlob(hasLocalStorage() ? localStorage.getItem(STORAGE_KEY) : memStore.get(STORAGE_KEY) || null);
  } catch {
    fromLocal = parseBlob(memStore.get(STORAGE_KEY) || null);
  }
  try {
    fromCookie = parseBlob(readCookie() || memStore.get(COOKIE_KEY) || null);
  } catch {
    fromCookie = parseBlob(memStore.get(COOKIE_KEY) || null);
  }
  /** @type {Record<string, LevelProgress>} */
  const merged = {};
  for (const src of [fromCookie || {}, fromLocal || {}]) {
    for (const [id, prog] of Object.entries(src)) {
      if (!prog) continue;
      const prev = merged[id];
      merged[id] = {
        solved: Boolean(prog.solved || prev?.solved),
        bestCommands:
          prev?.bestCommands === undefined
            ? prog.bestCommands
            : prog.bestCommands === undefined
              ? prev.bestCommands
              : Math.min(prev.bestCommands, prog.bestCommands),
        par: prog.par ?? prev?.par,
        at: prog.at ?? prev?.at,
      };
    }
  }
  return merged;
}

/**
 * @param {Record<string, LevelProgress>} progress
 */
export function saveProgress(progress) {
  const payload = JSON.stringify({ progress, savedAt: new Date().toISOString() });
  memStore.set(STORAGE_KEY, payload);
  memStore.set(COOKIE_KEY, payload);
  try {
    if (hasLocalStorage()) localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    /* quota / private mode */
  }
  writeCookie(payload);
}

/**
 * @param {string} levelId
 * @param {number} commandCount
 * @param {number} par
 * @returns {LevelProgress}
 */
export function recordWin(levelId, commandCount, par) {
  const progress = loadProgress();
  const prev = progress[levelId];
  if (!prev || !prev.solved || commandCount < (prev.bestCommands ?? Infinity)) {
    progress[levelId] = {
      solved: true,
      bestCommands: prev?.bestCommands === undefined ? commandCount : Math.min(prev.bestCommands, commandCount),
      par,
      at: Date.now(),
    };
    saveProgress(progress);
  } else if (!prev.solved) {
    progress[levelId] = { ...prev, solved: true, par, at: Date.now() };
    saveProgress(progress);
  }
  return progress[levelId];
}

/**
 * @param {string} sequenceId
 * @returns {string}
 */
function seriesTitle(sequenceId) {
  return sequences.find((s) => s.id === sequenceId)?.name || sequenceId;
}

/**
 * @param {Record<string, LevelProgress>} progress
 * @returns {CurriculumSummary}
 */
export function summarizeCurriculum(progress) {
  /** @type {CurriculumItem[]} */
  const learned = [];
  /** @type {CurriculumItem[]} */
  const remaining = [];
  let next = null;

  for (const level of levels) {
    const item = {
      id: level.id,
      name: level.name,
      seriesTitle: seriesTitle(level.sequence),
      learn: level.learn || [],
      bestCommands: progress[level.id]?.bestCommands,
    };
    if (progress[level.id]?.solved) {
      learned.push(item);
    } else {
      remaining.push(item);
      if (!next) next = item;
    }
  }

  const total = levels.length;
  const solvedCount = learned.length;
  return {
    solvedCount,
    total,
    learned,
    remaining,
    next,
    percent: total ? Math.round((solvedCount / total) * 100) : 0,
  };
}

/**
 * Next unsolved level after a given id.
 * @param {string} afterId
 * @param {Record<string, LevelProgress>} progress
 */
export function nextLevelId(afterId, progress) {
  const all = sequences.flatMap((s) => levelsIn(s.id));
  const i = all.findIndex((l) => l.id === afterId);
  for (const lv of all.slice(i + 1)) {
    if (!progress[lv.id]?.solved) return lv;
  }
  for (const lv of all) {
    if (!progress[lv.id]?.solved) return lv;
  }
  return null;
}
