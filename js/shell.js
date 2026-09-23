/**
 * Shell session: execute parsed pipelines, undo stack, meta commands.
 */

import { VirtualFS, defaultTree } from './fs.js';
import { parseLine, splitStatements } from './parser.js';
import { commands, metaCommands } from './commands.js';

/**
 * @typedef {Object} ExecLine
 * @property {string} input
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} code
 * @property {string} [prompt]
 * @property {boolean} [specialClear]
 */

export class ShellSession {
  /**
   * @param {Object} [opts]
   * @param {any} [opts.level] active level definition
   * @param {(line: ExecLine) => void} [opts.onOutput]
   * @param {() => void} [opts.onChange]
   * @param {() => void} [opts.onWin]
   */
  constructor(opts = {}) {
    this.level = opts.level || null;
    this.onOutput = opts.onOutput || (() => {});
    this.onChange = opts.onChange || (() => {});
    this.onWin = opts.onWin || (() => {});
    this.history = [];
    this.commandCount = 0;
    this.solved = false;
    /** @type {any[]} */
    this.undoStack = [];
    this.disabled = new Set();
    this.fs = new VirtualFS({
      user: 'ubuntu',
      host: 'learn',
      treeSpec: defaultTree('ubuntu'),
      cwd: '/home/ubuntu',
    });
  }

  /**
   * Load a level's start state.
   * @param {any} level
   */
  loadLevel(level) {
    this.level = level;
    this.solved = false;
    this.commandCount = 0;
    this.history = [];
    this.undoStack = [];
    this.disabled = new Set(Object.keys(level.disabled || {}));
    this.fs = new VirtualFS({
      user: level.start?.user || 'ubuntu',
      host: 'learn',
      cwd: level.start?.cwd || '/home/ubuntu',
      treeSpec: level.start?.tree || defaultTree(level.start?.user || 'ubuntu'),
      env: level.start?.env,
    });
    for (const proc of level.start?.processes || []) {
      this.fs.spawnProcess(proc.cmd, proc);
    }
    this.onChange();
  }

  /** Reset to level start (or sandbox default). */
  reset() {
    if (this.level) this.loadLevel(this.level);
    else this.enterSandbox();
    this.onOutput({
      input: '',
      stdout: 'Session reset.\n',
      stderr: '',
      code: 0,
      prompt: this.prompt(),
    });
    this.onChange();
  }

  /** Free play mode. */
  enterSandbox() {
    this.level = null;
    this.solved = false;
    this.disabled = new Set();
    this.commandCount = 0;
    this.undoStack = [];
    this.fs = new VirtualFS({
      user: 'ubuntu',
      host: 'learn',
      treeSpec: defaultTree('ubuntu'),
      cwd: '/home/ubuntu',
    });
    this.fs.spawnProcess('sleep infinity', { cmd: 'sleep infinity', cpu: 0.0, mem: 0.0 });
    this.onChange();
  }

  /** @returns {string} */
  prompt() {
    return `${this.fs.user}@${this.fs.host}:${this.fs.promptPath()}$`;
  }

  /** Undo last successful mutating statement. */
  undo() {
    const snap = this.undoStack.pop();
    if (!snap) {
      this.onOutput({
        input: '',
        stdout: '',
        stderr: 'undo: nothing to undo\n',
        code: 1,
        prompt: this.prompt(),
      });
      return;
    }
    this.fs.restore(snap);
    this.onOutput({
      input: '',
      stdout: 'Undid last command.\n',
      stderr: '',
      code: 0,
      prompt: this.prompt(),
    });
    this.onChange();
  }

  /**
   * Hint for the active level.
   * @returns {string}
   */
  hint() {
    if (!this.level) return 'No active level. Type `levels` to pick one, or stay in sandbox.';
    return this.level.hint || 'No hint for this level.';
  }

  /**
   * Execute one raw input line (may contain `;` and pipes).
   * @param {string} raw
   * @returns {ExecLine[]}
   */
  exec(raw) {
    const input = raw.replace(/\s+$/, '');
    if (!input.trim()) return [];
    this.history.push(input);
    const prompt = this.prompt();
    /** @type {ExecLine[]} */
    const results = [];

    // Meta / app commands that ignore shell grammar
    const metaResult = this._tryMeta(input.trim());
    if (metaResult) {
      results.push({ input, prompt, ...metaResult });
      if (!metaResult.specialClear) {
        this.commandCount += 1;
      }
      this._checkWin();
      return results;
    }

    const statements = splitStatements(input);
    for (const stmt of statements) {
      const before = this.fs.serialize();
      const parsed = parseLine(stmt);
      if (!Array.isArray(parsed)) {
        results.push({
          input: stmt,
          prompt,
          stdout: '',
          stderr: `bash: ${parsed.error}\n`,
          code: 2,
        });
        continue;
      }
      for (const pipeline of parsed) {
        const outcome = this._runPipeline(pipeline.stages, stmt);
        results.push({ input: stmt, prompt, ...outcome });
        this.commandCount += 1;
        const mutated = outcome.mutated !== false;
        if (mutated && outcome.code === 0 && !this.solved) {
          this.undoStack.push(before);
          if (this.undoStack.length > 50) this.undoStack.shift();
        }
      }
    }
    this.onChange();
    this._checkWin();
    return results;
  }

  /**
   * @param {string} input
   * @returns {{stdout: string, stderr: string, code: number, specialClear?: boolean}|null}
   */
  _tryMeta(input) {
    const parts = input.split(/\s+/);
    const cmd = parts[0];
    if (cmd === 'clear') return { stdout: '\x1b[2J\x1b[H', stderr: '', code: 0, specialClear: true };
    if (cmd === 'reset') {
      this.reset();
      return { stdout: '', stderr: '', code: 0 };
    }
    if (cmd === 'undo') {
      this.undo();
      return { stdout: '', stderr: '', code: 0 };
    }
    if (cmd === 'levels') {
      return { stdout: this._levelsHelp(), stderr: '', code: 0 };
    }
    if (cmd === 'hint') {
      return { stdout: this.hint() + '\n', stderr: '', code: 0 };
    }
    if (cmd === 'sandbox') {
      this.enterSandbox();
      return { stdout: 'Sandbox mode. Free play — no win condition.\n', stderr: '', code: 0 };
    }
    if (cmd === 'solution') {
      if (!this.level?.solution) return { stdout: 'No solution recorded for this level.\n', stderr: '', code: 0 };
      return {
        stdout: `Solution: ${this.level.solution}\nCommand count on your path: ${this.commandCount}\n`,
        stderr: '',
        code: 0,
      };
    }
    if (cmd === 'help' || cmd === 'history') {
      // fall through to command registry
    }
    if (this.disabled.has(cmd) || this.disabled.has(parts.slice(0, 2).join(' '))) {
      return {
        stdout: '',
        stderr: `bash: ${cmd}: command not allowed in this level\n`,
        code: 127,
      };
    }
    return null;
  }

  /** @returns {string} */
  _levelsHelp() {
    // UI also has a picker; this is the terminal version like LGB.
    return 'Open the Levels panel (toolbar) to browse sequences.\nProgress is saved in localStorage.\n';
  }

  /**
   * @param {import('./parser.js').SimpleCommand[]} stages
   * @param {string} stmt
   */
  _runPipeline(stages, stmt) {
    let stdin = '';
    /** @type {string} */
    let lastStderr = '';
    let code = 0;
    let mutated = false;
    /** @type {string} */
    let stdout = '';

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const name = stage.argv[0];
      if (this.disabled.has(name)) {
        return {
          stdout,
          stderr: `bash: ${name}: command not allowed in this level\n`,
          code: 127,
          mutated,
        };
      }
      const fn = commands[name];
      if (!fn) {
        return {
          stdout,
          stderr: `bash: ${name}: command not found\n`,
          code: 127,
          mutated,
        };
      }

      // input redirection
      let inputText = stdin;
      for (const r of stage.redirects) {
        if (r.kind === 'in') {
          const abs = this.fs.resolve(r.target);
          const node = this.fs.get(abs);
          if (!node || node.type !== 'file') {
            return {
              stdout,
              stderr: `bash: ${r.target}: No such file or directory\n`,
              code: 1,
              mutated,
            };
          }
          inputText = node.content || '';
        }
      }

      /** @type {CmdContext} */
      const ctx = { fs: this.fs, session: this };
      let result;
      try {
        result = fn(ctx, stage.argv.slice(1), inputText);
      } catch (e) {
        result = { stdout: '', stderr: `${e.message}\n`, code: 1 };
      }

      if (result.specialClear) {
        return { stdout: '\x1b[2J\x1b[H', stderr: result.stderr, code: 0, mutated, specialClear: true };
      }

      lastStderr = result.stderr || lastStderr;
      code = result.code ?? 0;
      stdout = result.stdout ?? '';

      // Detect mutating commands for undo
      if (MUTATING.has(name)) mutated = true;

      // output redirects consume stdout of this stage
      let consumed = false;
      for (const r of stage.redirects) {
        if (r.kind === 'out' || r.kind === 'append') {
          const abs = this.fs.resolve(r.target);
          let node = this.fs.get(abs);
          if (!node) {
            try {
              const { splitPath } = this._pathHelpers();
              const parts = splitPath(abs);
              node = this.fs.create(parts.dir, parts.base, 'file', { content: '' });
              mutated = true;
            } catch (e) {
              return {
                stdout,
                stderr: `bash: ${r.target}: ${e.message}\n`,
                code: 1,
                mutated,
              };
            }
          }
          if (node.type === 'dir') {
            return {
              stdout,
              stderr: `bash: ${r.target}: Is a directory\n`,
              code: 1,
              mutated,
            };
          }
          if (r.kind === 'out') node.content = stdout;
          else node.content = (node.content || '') + stdout;
          node.mtime = Date.now();
          stdout = '';
          mutated = true;
          consumed = true;
        }
      }

      const isLast = i === stages.length - 1;
      if (isLast) {
        return { stdout, stderr: lastStderr, code, mutated };
      }
      if (consumed) stdin = '';
      else stdin = stdout;
      stdout = '';
    }
    return { stdout, stderr: lastStderr, code, mutated };
  }

  _pathHelpers() {
    return {
      splitPath: (path) => {
        const i = path.lastIndexOf('/');
        if (i <= 0) return { dir: '/', base: path.slice(1) };
        return { dir: path.slice(0, i) || '/', base: path.slice(i + 1) };
      },
    };
  }

  _checkWin() {
    if (this.solved || !this.level?.check) return;
    let win = false;
    try {
      win = !!this.level.check(this.fs, this);
    } catch {
      win = false;
    }
    if (win) {
      this.solved = true;
      this.onWin(this.level);
    }
  }
}

const MUTATING = new Set([
  'mkdir',
  'rmdir',
  'touch',
  'rm',
  'cp',
  'mv',
  'cat',
  'echo',
  'chmod',
  'chown',
  'kill',
  'head',
  'tail',
  'wc',
  'grep',
  'cd',
  'find',
]);

/**
 * Run a demo command sequence on a throwaway session (for dialog demos).
 * @param {any} level
 * @param {string} command
 * @returns {{stdout: string, stderr: string}}
 */
export function runDemo(level, command) {
  const s = new ShellSession({});
  if (level?.start) s.loadLevel(level);
  else s.enterSandbox();
  const lines = s.exec(command);
  return {
    stdout: lines.map((l) => l.stdout).join(''),
    stderr: lines.map((l) => l.stderr).join(''),
  };
}
