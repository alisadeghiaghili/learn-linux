/**
 * Sticky solution checklist: once a step was successfully run, it stays done.
 */

/**
 * @typedef {Object} SolutionStep
 * @property {string} command
 * @property {string} [note]
 */

/**
 * @typedef {Object} SolutionStepStatus
 * @property {string} command
 * @property {string} [note]
 * @property {boolean} done
 * @property {number} index
 */

/**
 * @param {string} s
 * @returns {string}
 */
function normalizeWs(s) {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * @param {string} historyCmd
 * @param {string} solutionCmd
 * @returns {boolean}
 */
export function matchSolutionCommand(historyCmd, solutionCmd) {
  const h = normalizeWs(historyCmd);
  const s = normalizeWs(solutionCmd);
  if (!h || !s) return false;
  if (h === s) return true;
  if (h.startsWith(s) || s.startsWith(h)) return true;

  const hParts = h.split(' ');
  const sParts = s.split(' ');
  // same verb + same primary object/flag fragment
  const verb = (parts) => parts.slice(0, 2).join(' ').toLowerCase();
  if (verb(hParts) !== verb(sParts)) {
    // single-word commands: whoami, pwd, ls, ps, df
    if (sParts.length === 1 && hParts[0] === sParts[0]) return true;
    return false;
  }
  // flags in solution present in history
  const sFlags = sParts.filter((p) => p.startsWith('-'));
  const okFlags = sFlags.every((f) => hParts.includes(f) || h.includes(f));
  // path-like args of solution appear in history
  const sPaths = sParts.filter((p) => !p.startsWith('-') && p.includes('/') || /\.(txt|log|sh|py|md|rsa)$/.test(p) || ['notes', 'projects', 'demo', 'src', 'app', 'components', 'run.sh', 'id_rsa', 'shared.txt', 'backup.txt', 'final.txt', 'todo.txt', 'message.txt', 'notes.log', 'error_count.txt', 'app.log', 'long.txt', 'readme.md'].includes(p));
  const okPaths = sPaths.every((p) => h.includes(p));
  return okFlags && okPaths;
}

/**
 * Build step list from level.steps or level.solution.
 * @param {any} level
 * @returns {SolutionStep[]}
 */
export function solutionSteps(level) {
  if (!level) return [];
  if (Array.isArray(level.steps) && level.steps.length) {
    return level.steps.map((s) => (typeof s === 'string' ? { command: s } : s));
  }
  if (!level.solution) return [];
  return level.solution
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((command) => ({ command }));
}

/**
 * @param {{history: string[]}} session
 * @param {any} level
 * @returns {SolutionStepStatus[]}
 */
export function solutionProgress(session, level) {
  const steps = solutionSteps(level);
  const history = (session.history || []).map(normalizeWs).filter(Boolean);
  /** @type {Set<number>} */
  const seen = new Set();
  return steps.map((step, index) => {
    // sticky: mark done if any history line matched this step (prefer earlier unmatched)
    let done = false;
    for (let h = 0; h < history.length; h++) {
      if (matchSolutionCommand(history[h], step.command)) {
        done = true;
        seen.add(index);
        break;
      }
    }
    return { ...step, done, index };
  });
}

/**
 * @param {SolutionStepStatus[]} steps
 * @returns {number}
 */
export function currentStepIndex(steps) {
  return steps.findIndex((s) => !s.done);
}
