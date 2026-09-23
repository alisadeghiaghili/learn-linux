/**
 * Social share payloads: LinkedIn, X/Twitter, Facebook + clipboard copy.
 * Messages include the learner's curriculum (what they have learned so far).
 */

export const LIVE_URL = 'https://alisadeghiaghili.github.io/learn-linux/';
export const SHARE_URL = LIVE_URL;
export const REPO_URL = 'https://github.com/alisadeghiaghili/learn-linux';
export const PUBLISHER = 'Ali Sadeghi Aghili';

/**
 * @typedef {import('./progress.js').CurriculumSummary} CurriculumSummary
 * @typedef {import('./progress.js').CurriculumItem} CurriculumItem
 */

/**
 * @typedef {Object} ShareContext
 * @property {string} levelName
 * @property {string} levelId
 * @property {number|null} commands
 * @property {number} par
 * @property {CurriculumSummary} curriculum
 */

/**
 * @param {{name: string, seriesTitle: string}[]} items
 * @param {number} [limit]
 * @returns {string[]}
 */
function bulletList(items, limit) {
  const list = limit ? items.slice(0, limit) : items;
  const lines = list.map((l) => `• ${l.seriesTitle}: ${l.name}`);
  if (limit && items.length > limit) lines.push(`• …and ${items.length - limit} more`);
  return lines;
}

/**
 * @param {ShareContext} ctx
 * @returns {string}
 */
export function shareMessageLinkedIn(ctx) {
  const c = ctx.curriculum;
  const learned = c.learned.length ? bulletList(c.learned) : [];
  const latest =
    c.solvedCount > 0
      ? `Just cleared “${ctx.levelName}”` +
        (ctx.commands !== null ? ` in ${ctx.commands} command${ctx.commands === 1 ? '' : 's'} (par ${ctx.par}).` : '.')
      : 'Starting my Linux CLI journey.';
  const parts = [
    'I am learning real Ubuntu/Linux command-line skills on learn-linux!',
    '',
    latest,
    '',
    learned.length ? 'What I have learned so far:' : '',
    ...learned,
    '',
    `Progress: ${c.solvedCount}/${c.total} levels.`,
    '',
    'Hands-on shell sandbox, live filesystem tree, LPIC-oriented lessons.',
    SHARE_URL,
  ];
  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {ShareContext} ctx
 * @returns {string}
 */
export function shareMessageX(ctx) {
  const c = ctx.curriculum;
  const head = `Leveling up my Linux CLI on learn-linux — ${c.solvedCount}/${c.total} done.`;
  const first = c.learned[c.learned.length - 1]
    ? `• ${c.learned[c.learned.length - 1].name}`
    : 'Hands-on sandbox + live FS tree.';
  let text = `${head}\n${first}\n${SHARE_URL}`;
  if (text.length > 275) text = `${head}\n${SHARE_URL}`;
  return text;
}

/**
 * @typedef {Object} ShareTargets
 * @property {string} linkedin
 * @property {string} x
 * @property {string} facebook
 * @property {string} text
 * @property {string} shortText
 * @property {string} url
 * @property {string[]} learnedLines
 */

/**
 * @param {ShareContext} ctx
 * @returns {ShareTargets}
 */
export function buildShareTargets(ctx) {
  const longText = shareMessageLinkedIn(ctx);
  const shortText = shareMessageX(ctx);
  const url = SHARE_URL;
  return {
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent('learn-linux — Ubuntu CLI trainer')}&summary=${encodeURIComponent(longText)}&source=learn-linux`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(longText)}`,
    text: longText,
    shortText,
    url,
    learnedLines: bulletList(ctx.curriculum.learned),
  };
}

/**
 * @param {string} url
 */
export function openShareWindow(url) {
  window.open(url, '_blank', 'noopener,noreferrer,width=720,height=640');
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copySharePayload(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Open network share and copy text as a fallback paste source.
 * @param {'linkedin'|'facebook'|'x'|'copy'} kind
 * @param {ShareTargets} targets
 * @returns {Promise<{opened: boolean, copied: boolean}>}
 */
export async function shareWithClipboard(kind, targets) {
  if (kind === 'copy') {
    return { opened: false, copied: await copySharePayload(targets.text) };
  }
  const copied = await copySharePayload(kind === 'x' ? targets.shortText : targets.text);
  const href = kind === 'linkedin' ? targets.linkedin : kind === 'facebook' ? targets.facebook : targets.x;
  openShareWindow(href);
  return { opened: true, copied };
}
