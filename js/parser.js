/**
 * Shell line parser: tokens, pipes, redirections, quotes.
 */

/**
 * @typedef {Object} Redirect
 * @property {'in'|'out'|'append'} kind
 * @property {string} target
 */

/**
 * @typedef {Object} SimpleCommand
 * @property {string[]} argv
 * @property {Redirect[]} redirects
 */

/**
 * @typedef {Object} Pipeline
 * @property {SimpleCommand[]} stages
 */

/**
 * Tokenize one shell line. Supports ' " and \ escapes outside quotes.
 * @param {string} line
 * @returns {string[]|{error: string}}
 */
export function tokenize(line) {
  /** @type {string[]} */
  const tokens = [];
  let cur = '';
  let i = 0;
  let quote = /** @type {null|'"'|'\''} */ (null);
  let has = false;

  const push = () => {
    if (has || cur.length) {
      tokens.push(cur);
    }
    cur = '';
    has = false;
  };

  while (i < line.length) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < line.length) {
        cur += line[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
        has = true;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      i += 1;
      continue;
    }
    if (ch === '\\' && i + 1 < line.length) {
      cur += line[i + 1];
      has = true;
      i += 2;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      i += 1;
      continue;
    }
    if (ch === '|' || ch === '>' || ch === '<') {
      push();
      // multi-char redirects
      if (ch === '>' && line[i + 1] === '>') {
        tokens.push('>>');
        i += 2;
        continue;
      }
      tokens.push(ch);
      i += 1;
      continue;
    }
    cur += ch;
    has = true;
    i += 1;
  }
  if (quote) {
    return { error: 'unexpected EOF while looking for matching quote' };
  }
  push();
  return tokens;
}

/**
 * Split a raw line on unquoted `;` and `&&` / `||` (logical AND only for v1).
 * @param {string} line
 * @returns {string[]}
 */
export function splitStatements(line) {
  /** @type {string[]} */
  const out = [];
  let cur = '';
  let quote = /** @type {null|'"'|'\''} */ (null);
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && quote === '"' && i + 1 < line.length) {
        cur += line[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === ';' ) {
      out.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    if (ch === '&' && line[i + 1] === '&') {
      out.push(cur);
      cur = '';
      i += 2;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Parse tokens into a pipeline of simple commands with redirects.
 * @param {string[]|{error: string}} tokensOrError
 * @returns {Pipeline|{error: string}}
 */
export function parsePipeline(tokensOrError) {
  if (!Array.isArray(tokensOrError)) return tokensOrError;
  const tokens = tokensOrError;
  /** @type {SimpleCommand[]} */
  const stages = [];
  /** @type {SimpleCommand} */
  let current = { argv: [], redirects: [] };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '|') {
      if (!current.argv.length) return { error: 'syntax error near unexpected token `|`' };
      stages.push(current);
      current = { argv: [], redirects: [] };
      continue;
    }
    if (t === '>' || t === '>>' || t === '<') {
      const target = tokens[i + 1];
      if (target === undefined || target === '|' || t === target) {
        return { error: `syntax error near unexpected token \`${t}\`` };
      }
      if (t === '<') current.redirects.push({ kind: 'in', target });
      else if (t === '>') current.redirects.push({ kind: 'out', target });
      else current.redirects.push({ kind: 'append', target });
      i += 1;
      continue;
    }
    current.argv.push(t);
  }
  if (!current.argv.length) {
    return { error: 'syntax error near unexpected token `|`' };
  }
  stages.push(current);
  return { stages };
}

/**
 * Parse a full user line into sequential pipelines.
 * @param {string} line
 * @returns {Pipeline[]|{error: string}}
 */
export function parseLine(line) {
  const statements = splitStatements(line);
  /** @type {Pipeline[]} */
  const pipelines = [];
  for (const stmt of statements) {
    const parsed = parsePipeline(tokenize(stmt));
    if ('error' in parsed) return parsed;
    pipelines.push(parsed);
  }
  return pipelines;
}

/**
 * Minimal glob: `*` and `?`.
 * @param {string} pattern
 * @returns {RegExp}
 */
export function globToRegExp(pattern) {
  let out = '';
  for (const ch of pattern) {
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}
