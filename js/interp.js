/**
 * Minimal bash-like script interpreter for training.
 *
 * Supports: comments, shebang, set -e, assignments, commands (via executor),
 * if [ test ]; then …; fi, while [ test ]; do …; done, case/esac,
 * functions, $1..$9, $((arith)), [ tests ], local-less vars.
 */

/**
 * @typedef {Object} InterpResult
 * @property {number} code
 * @property {string} stdout
 * @property {string} stderr
 */

/**
 * @param {string} text
 * @returns {string[]} logical lines (if/while/case collapsed)
 */
export function parseScript(text) {
  const raw = text.split('\n');
  /** @type {string[]} */
  const lines = [];
  let buf = '';
  let depth = 0;
  let inBlock = false;

  for (const rawLine of raw) {
    const line = rawLine.replace(/\s+$/, '');
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      if (!inBlock) continue;
    }
    // accumulate control structures
    if (/^(if\s|while\s|until\s|case\s|for\s)/.test(t) || /(\(\)\s*\{|\{\s*)$/.test(t)) {
      inBlock = true;
      depth += countDepth(t);
      buf = buf ? buf + '\n' + line : line;
      if (depth <= 0 && /(\bf[i]|\bdone\b|\besac\b|\})\s*(;.*)?$/.test(t)) {
        lines.push(buf);
        buf = '';
        inBlock = false;
        depth = 0;
      }
      continue;
    }
    if (inBlock) {
      buf = buf ? buf + '\n' + line : line;
      depth += countDepth(t);
      if (
        depth <= 0 &&
        /(\bfi\b|\bdone\b|\besac\b|\})\s*(;.*)?$/.test(t)
      ) {
        lines.push(buf);
        buf = '';
        inBlock = false;
        depth = 0;
      }
      continue;
    }
    if (t) lines.push(line);
  }
  if (buf) lines.push(buf);
  return lines;
}

/**
 * @param {string} t
 */
function countDepth(t) {
  let d = 0;
  if (/^(if\s|while\s|until\s|case\s|for\s)/.test(t) || /(\(\)\s*\{)$/.test(t)) d += 1;
  if (/\bfi\b/.test(t)) d -= 1;
  if (/\bdone\b/.test(t)) d -= 1;
  if (/\besac\b/.test(t)) d -= 1;
  // rough: } closes a function/compound
  if (/(^|\s)\}(\s|$)/.test(t) && !/^(if|while|for|case)/.test(t)) d -= 1;
  return d;
}

/**
 * @param {string} line
 * @param {Record<string, string>} vars
 * @returns {string}
 */
export function expand(line, vars) {
  let out = line;
  out = out.replace(/\$\(\(([^)]+)\)\)/g, (_, expr) => {
    try {
      // safe-ish arith: numbers and + - * / %
      const e = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (n) => vars[n] ?? '0');
      // eslint-disable-next-line no-new-func
      return String(Function(`"use strict"; return (${e})`)());
    } catch {
      return '0';
    }
  });
  out = out.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, n) => vars[n] ?? '');
  out = out.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, n) => vars[n] ?? '');
  out = out.replace(/\$([1-9])/g, (_, n) => vars[n] ?? '');
  out = out.replace(/\$\?/g, () => vars['?'] ?? '0');
  return out;
}

/**
 * Evaluate a `[ … ]` / `test` condition.
 * @param {string} expr
 * @param {Record<string, string>} vars
 */
export function evalTest(expr, vars) {
  let e = expand(expr, vars).trim();
  if (e.startsWith('[') && e.endsWith(']')) e = e.slice(1, -1).trim();
  if (e.startsWith('test ')) e = e.slice(5).trim();
  const parts = e.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const tok = parts.map((p) => p.replace(/^["']|["']$/g, ''));
  if (tok.length === 1) return tok[0] !== '' && tok[0] !== '0';
  if (tok.length === 3) {
    const [a, op, b] = tok;
    if (op === '=') return a === b;
    if (op === '!=') return a !== b;
    if (op === '-eq') return Number(a) === Number(b);
    if (op === '-ne') return Number(a) !== Number(b);
    if (op === '-lt') return Number(a) < Number(b);
    if (op === '-le') return Number(a) <= Number(b);
    if (op === '-gt') return Number(a) > Number(b);
    if (op === '-ge') return Number(a) >= Number(b);
  }
  if (tok.length === 2) {
    const [op, a] = tok;
    if (op === '-z') return a === '';
    if (op === '-n') return a !== '';
    if (op === '-e') return true; // existence checked loosely in sim (content/fs)
    if (op === '-f' || op === '-d') return a !== '';
    if (op === '-s') return a !== '';
    if (op === '-x') return a !== '';
    if (op === '!') return !(a && a !== '0');
  }
  return false;
}

/**
 * Split a compound body into simple statements.
 * @param {string} body
 * @returns {string[]}
 */
function splitStmts(body) {
  return body
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));
}

/**
 * @param {string[]} lines
 * @param {Record<string, string>} vars
 * @param {(line: string) => InterpResult} exec
 * @param {boolean} setE
 */
function execStatements(lines, vars, exec, setERef) {
  let stdout = '';
  let stderr = '';
  let code = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const assign = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (assign && !t.includes(' | ') && !/^echo/.test(t) && !t.includes('()')) {
      const val = assign[2].trim().replace(/^["']|["']$/g, '');
      vars[assign[1]] = expand(val, vars);
      vars['?'] = '0';
      continue;
    }
    // bare function call
    const call = t.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
    if (call && vars['__fn_' + call[1]] !== undefined) {
      const body = vars['__fn_' + call[1]];
      const r = execStatements(splitStmts(body), vars, exec, setERef);
      stdout += r.stdout;
      stderr += r.stderr;
      code = r.code;
      vars['?'] = String(code);
      if (setERef.value && code !== 0) return { code, stdout, stderr };
      continue;
    }
    const expanded = expand(t, vars);
    const r = exec(expanded);
    stdout += r.stdout || '';
    stderr += r.stderr || '';
    code = r.code ?? 0;
    vars['?'] = String(code);
    if (setERef.value && code !== 0) {
      return { code, stdout, stderr };
    }
  }
  return { code, stdout, stderr };
}

/**
 * Run a script text through the interpreter.
 * @param {string} text
 * @param {{exec: (line: string) => InterpResult, fs: any, cwd?: string}} ctx
 * @param {string[]} [args]
 * @returns {InterpResult}
 */
export function runScript(text, ctx, args = []) {
  /** @type {Record<string, string>} */
  const vars = {
    '1': args[0] ?? '',
    '2': args[1] ?? '',
    '3': args[2] ?? '',
    '0': 'script',
    '?': '0',
  };
  let stdout = '';
  let stderr = '';
  let code = 0;
  const setE = { value: false };

  /**
   * @param {string[]} lines
   * @returns {number}
   */
  const execBlock = (lines) => {
    let i = 0;
    while (i < lines.length) {
      let line = lines[i];
      const t = line.trim();
      if (!t || t.startsWith('#')) {
        i += 1;
        continue;
      }

      // function def: name() { … } [; more]
      const fnMatch = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{([\s\S]*)\}\s*;?\s*([\s\S]*)$/);
      if (fnMatch) {
        let body = fnMatch[2];
        let rest = (fnMatch[3] || '').trim();
        // trim a trailing call after the closing brace if body accidentally includes it
        // body is everything between first { and last }
        const lastBrace = t.lastIndexOf('}');
        const firstBrace = t.indexOf('{');
        body = t.slice(firstBrace + 1, lastBrace);
        rest = t.slice(lastBrace + 1).replace(/^;?\s*/, '').trim();
        vars['__fn_' + fnMatch[1]] = body;
        if (rest) {
          const r = execStatements(splitStmts(rest), vars, ctx.exec, setE);
          stdout += r.stdout;
          stderr += r.stderr;
          code = r.code;
          if (setE.value && code !== 0) return code;
        }
        i += 1;
        continue;
      }

      if (/^set\s+-e\b/.test(t) || /^set\s+-o\s+errexit/.test(t)) {
        setE.value = true;
        i += 1;
        continue;
      }

      // if
      if (/^if\s/.test(t)) {
        const block = parseCompound(lines.slice(i).join('\n'), 'if');
        if (!block) break;
        const ok = evalTest(block.cond, vars);
        const sub = ok ? block.thenPart : block.elsePart;
        if (sub && sub.trim()) {
          const r = execStatements(splitStmts(sub), vars, ctx.exec, setE);
          stdout += r.stdout;
          stderr += r.stderr;
          code = r.code;
          vars['?'] = String(code);
          if (setE.value && code !== 0) return code;
        }
        i += block.consumed;
        continue;
      }

      // while
      if (/^while\s/.test(t)) {
        const block = parseCompound(lines.slice(i).join('\n'), 'while');
        if (!block) break;
        let guard = 0;
        while (evalTest(block.cond, vars) && guard++ < 1000) {
          const r = execStatements(splitStmts(block.thenPart), vars, ctx.exec, setE);
          stdout += r.stdout;
          stderr += r.stderr;
          code = r.code;
          vars['?'] = String(code);
          if (setE.value && code !== 0) return code;
        }
        i += block.consumed;
        continue;
      }

      // case
      if (/^case\s/.test(t)) {
        const block = parseCase(lines.slice(i).join('\n'));
        if (!block) break;
        const word = expand(block.word, vars);
        for (const arm of block.arms) {
          const pats = arm.patterns.map((p) =>
            new RegExp(
              '^' +
                p
                  .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                  .replace(/\*/g, '.*')
                  .replace(/\?/g, '.') +
                '$'
            )
          );
          if (pats.some((r) => r.test(word))) {
            const r = execStatements(splitStmts(arm.body), vars, ctx.exec, setE);
            stdout += r.stdout;
            stderr += r.stderr;
            code = r.code;
            break;
          }
        }
        i += block.consumed;
        continue;
      }

      // function call
      const call = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*$/);
      if (call && vars['__fn_' + call[1]] !== undefined) {
        const r = execStatements(splitStmts(vars['__fn_' + call[1]]), vars, ctx.exec, setE);
        stdout += r.stdout;
        stderr += r.stderr;
        code = r.code;
        i += 1;
        continue;
      }

      // simple statements on this line (may contain ;)
      const stmts = splitStmts(t);
      const r = execStatements(stmts, vars, ctx.exec, setE);
      stdout += r.stdout;
      stderr += r.stderr;
      code = r.code;
      vars['?'] = String(code);
      if (setE.value && code !== 0) return code;
      i += 1;
    }
    return code;
  };

  const lines = parseScript(text);
  code = execBlock(lines) || 0;
  return { code, stdout, stderr };
}

/**
 * Parse if/while compound from joined text.
 * @param {string} text
 * @param {'if'|'while'} kind
 */
function parseCompound(text, kind) {
  const lines = text.split('\n');
  const head = lines[0] || '';
  const kw = kind === 'while' ? 'do' : 'then';
  const condMatch =
    head.match(new RegExp(`^${kind}\\s+(.+?);\\s*${kw}\\s*$`)) ||
    head.match(new RegExp(`^${kind}\\s+(.+?);\\s*${kw}(;|\\s)`));
  if (!condMatch) {
    const m2 = head.match(new RegExp(`^${kind}\\s+([\\s\\S]+?);\\s*${kw}`));
    if (!m2) return null;
  }
  const cond = (
    condMatch
      ? condMatch[1]
      : head.replace(new RegExp(`^${kind}\\s+`), '').replace(new RegExp(`;\\s*${kw}\\s*$`), '')
  ).trim();
  // find matching fi/done at depth 1
  let depth = 1;
  let bodyLines = [];
  let elseAt = -1;
  let consumed = 1;
  for (let i = 1; i < lines.length; i++) {
    const L = lines[i];
    const t = L.trim();
    if (/^(if\s|while\s|case\s)/.test(t)) depth += 1;
    if (/^(fi|done)\b/.test(t)) {
      depth -= 1;
      if (depth === 0) {
        consumed = i + 1;
        break;
      }
    }
    if (kind === 'if' && depth === 1 && /^else\b/.test(t)) {
      elseAt = bodyLines.length;
    }
    bodyLines.push(L);
    consumed = i + 1;
  }
  // single-line while …; do body; done  |  if …; then body; fi
  const closer = kind === 'while' ? 'done' : 'fi';
  if (bodyLines.length === 0 && new RegExp(`;\\s*${closer}\\s*$`).test(head)) {
    const mid = head.match(new RegExp(`;\\s*${kw}\\s+(.+?);\\s*${closer}\\s*$`));
    return { cond, thenPart: mid ? mid[1] : '', elsePart: '', consumed: 1 };
  }
  const body = bodyLines.join('\n');
  if (kind === 'while') {
    return { cond, thenPart: body.replace(/\bdone\s*$/, ''), consumed };
  }
  if (elseAt >= 0) {
    return {
      cond,
      thenPart: bodyLines.slice(0, elseAt).join('\n'),
      elsePart: bodyLines.slice(elseAt + 1).join('\n').replace(/\bfi\s*$/, ''),
      consumed,
    };
  }
  return {
    cond,
    thenPart: body.replace(/\bfi\s*$/, ''),
    elsePart: '',
    consumed,
  };
}

/**
 * @param {string} text
 */
function parseCase(text) {
  const lines = text.split('\n');
  const head = lines[0] || '';
  const wordMatch = head.match(/^case\s+(\S+)\s+in\b/);
  const word = wordMatch ? wordMatch[1] : '$1';
  /** @type {{patterns: string[], body: string}[]} */
  const arms = [];
  let consumed = 1;
  let cur = null;
  // single-line: case $1 in start) touch x ;; esac
  const flat = lines.join('\n');
  const inMatch = flat.match(/^case\s+\S+\s+in\s*([\s\S]*?)\s*esac\s*$/);
  if (inMatch && flat.split('\n').length <= 2) {
    const parts = inMatch[1]
      .split(';;')
      .map((p) => p.trim())
      .filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(.+?)\)\s*([\s\S]*)$/);
      if (!m) continue;
      arms.push({
        patterns: m[1].split('|').map((s) => s.trim()),
        body: m[2],
      });
    }
    return { word, arms, consumed: lines.length };
  }
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^esac\b/.test(t)) {
      consumed = i + 1;
      break;
    }
    const arm = t.match(/^(.+?)\)\s*(.*)$/);
    if (arm && !t.startsWith('#')) {
      if (cur) arms.push(cur);
      const pats = arm[1].split('|').map((s) => s.trim());
      cur = { patterns: pats, body: arm[2] && arm[2] !== ';;' ? arm[2] + '\n' : '' };
      continue;
    }
    if (cur) {
      if (t === ';;') continue;
      cur.body += lines[i] + '\n';
    }
    consumed = i + 1;
  }
  if (cur) arms.push(cur);
  return { word, arms, consumed };
}
