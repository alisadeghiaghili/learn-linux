/**
 * Command implementations for the virtual Ubuntu shell.
 *
 * Each command is (ctx, argv, stdin) => { stdout, stderr, code }.
 * ctx: { fs, session, print }
 */

import { formatMode, splitPath } from './fs.js';
import { globToRegExp } from './parser.js';
import { extraCommands } from './commands-extra.js';
import { mergeGapCommands } from './commands-gap.js';

/**
 * @typedef {Object} CmdResult
 * @property {string} [stdout]
 * @property {string} [stderr]
 * @property {number} [code]
 */

/**
 * @typedef {Object} CmdContext
 * @property {import('./fs.js').VirtualFS} fs
 * @property {any} session
 */

const ok = (stdout = '') => ({ stdout, stderr: '', code: 0 });
const fail = (stderr, code = 1) => ({ stdout: '', stderr, code });

/**
 * Expand path arguments (no globs yet) relative to fs.
 * @param {import('./fs.js').VirtualFS} fs
 * @param {string} arg
 * @returns {string[]} resolved absolute paths (1 or more if glob)
 */
function expandArg(fs, arg) {
  if (!/[*?]/.test(arg)) return [fs.resolve(arg)];
  const { dir, base } = splitPath(fs.resolve(arg.includes('/') ? arg : `./${arg}`));
  // resolve dir only
  const dirPath = arg.includes('/')
    ? fs.resolve(arg.slice(0, arg.lastIndexOf('/') || 0) || '.')
    : fs.cwd;
  const dirNode = fs.get(arg.includes('/') ? normalizePath(fs.cwd, arg.slice(0, arg.lastIndexOf('/')) || '.') : fs.cwd);
  if (!dirNode || dirNode.type !== 'dir') return [fs.resolve(arg)];
  const re = globToRegExp(base);
  const matched = fs
    .list(dirNode.path)
    .filter((n) => re.test(n.name))
    .map((n) => n.path);
  return matched.length ? matched : [fs.resolve(arg)];
}

/**
 * @param {import('./fs.js').VirtualFS} fs
 * @param {string[]} args
 */
function expandArgs(fs, args) {
  /** @type {string[]} */
  const out = [];
  for (const a of args) {
    out.push(...expandArg(fs, a));
  }
  return out;
}

function line(s = '') {
  return s.endsWith('\n') ? s : s + '\n';
}

/** @type {Record<string, (ctx: CmdContext, argv: string[], stdin: string) => CmdResult>} */
export const commands = {
  pwd(ctx) {
    return ok(line(ctx.fs.cwd));
  },

  whoami(ctx) {
    return ok(line(ctx.fs.user));
  },

  hostname(ctx) {
    return ok(line(ctx.fs.host));
  },

  uname(ctx, argv) {
    if (argv.includes('-a') || argv.includes('--all')) {
      return ok(line('Linux learn 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux'));
    }
    return ok(line('Linux'));
  },

  clear() {
    return { stdout: '\x1b[2J\x1b[H', stderr: '', code: 0, special: 'clear' };
  },

  echo(ctx, argv) {
    // strip simple VAR=value prefix assignments
    let i = 0;
    while (i < argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[i])) {
      const eq = argv[i].indexOf('=');
      ctx.fs.env[argv[i].slice(0, eq)] = argv[i].slice(eq + 1);
      i += 1;
    }
    const args = argv.slice(i);
    let n = false;
    if (args[0] === '-n') {
      n = true;
      args.shift();
    }
    const text = args.join(' ');
    return ok(n ? text : line(text));
  },

  ls(ctx, argv) {
    let all = false;
    let long = false;
    const paths = [];
    for (const a of argv) {
      if (a.startsWith('-') && a !== '-' && a.length > 1) {
        if (a.includes('a')) all = true;
        if (a.includes('l')) long = true;
        if (a.includes('h')) {
          /* human - ignored, sizes already small */
        }
        continue;
      }
      paths.push(a);
    }
    const targets = paths.length ? paths : ['.'];
    const chunks = [];
    for (const t of targets) {
      const abs = fsPath(ctx, t);
      const node = ctx.fs.get(abs);
      if (!node) {
        return fail(`ls: cannot access '${t}': No such file or directory`);
      }
      if (node.type === 'file') {
        chunks.push(long ? formatLong(node) : node.name);
        continue;
      }
      let children = ctx.fs.list(abs);
      if (!all) children = children.filter((c) => !c.name.startsWith('.'));
      if (long) {
        const total = 0;
        chunks.push(`total ${total}`);
        for (const c of children) chunks.push(formatLong(c));
      } else {
        chunks.push(
          children
            .map((c) => (c.type === 'dir' ? c.name + '/' : c.name))
            .join('  ')
        );
      }
    }
    return ok(line(chunks.join('\n').replace(/\n$/, '')));
  },

  cd(ctx, argv) {
    const target = argv[0] ?? '~';
    try {
      ctx.fs.chdir(target);
      return ok('');
    } catch (e) {
      return fail(e.message.startsWith('bash:') ? e.message : `bash: cd: ${target}: ${e.message}`);
    }
  },

  mkdir(ctx, argv) {
    const parents = argv.includes('-p');
    const paths = argv.filter((a) => !a.startsWith('-'));
    if (!paths.length) return fail('mkdir: missing operand');
    for (const p of paths) {
      const abs = ctx.fs.resolve(p);
      try {
        if (parents) {
          ensurePath(ctx.fs, abs);
        } else {
          const { dir, base } = splitPath(abs);
          ctx.fs.create(dir, base, 'dir');
        }
      } catch (e) {
        return fail(`mkdir: cannot create directory '${p}': ${stripCannot(e.message)}`);
      }
    }
    return ok('');
  },

  rmdir(ctx, argv) {
    const paths = argv.filter((a) => !a.startsWith('-'));
    for (const p of paths) {
      const abs = ctx.fs.resolve(p);
      const node = ctx.fs.get(abs);
      if (!node) return fail(`rmdir: failed to remove '${p}': No such file or directory`);
      if (node.type !== 'dir') return fail(`rmdir: failed to remove '${p}': Not a directory`);
      if (node.children.length) return fail(`rmdir: failed to remove '${p}': Directory not empty`);
      ctx.fs.remove(abs, { recursive: true });
    }
    return ok('');
  },

  touch(ctx, argv) {
    const paths = argv.filter((a) => !a.startsWith('-'));
    if (!paths.length) return fail('touch: missing file operand');
    for (const p of paths) {
      const abs = ctx.fs.resolve(p);
      const existing = ctx.fs.get(abs);
      if (existing) {
        existing.mtime = Date.now();
        continue;
      }
      const { dir, base } = splitPath(abs);
      try {
        ctx.fs.create(dir, base, 'file', { content: '' });
      } catch (e) {
        return fail(`touch: cannot touch '${p}': ${stripCannot(e.message)}`);
      }
    }
    return ok('');
  },

  cat(ctx, argv, stdin) {
    if (!argv.length) return ok(stdin || '');
    const out = [];
    for (const p of argv) {
      const abs = ctx.fs.resolve(p);
      const node = ctx.fs.get(abs);
      if (!node) return fail(`cat: ${p}: No such file or directory`);
      if (node.type === 'dir') return fail(`cat: ${p}: Is a directory`);
      out.push(node.content ?? '');
    }
    return ok(out.join(''));
  },

  rm(ctx, argv) {
    const recursive = argv.some((a) => a.startsWith('-') && a.includes('r') && a !== '--');
    const force = argv.some((a) => a.startsWith('-') && a.includes('f') && a !== '--');
    const paths = argv.filter((a) => !a.startsWith('-'));
    if (!paths.length) return fail('rm: missing operand');
    for (const p of paths) {
      try {
        ctx.fs.remove(ctx.fs.resolve(p), { recursive, force });
      } catch (e) {
        return fail(`rm: cannot remove '${p}': ${stripCannot(e.message)}`);
      }
    }
    return ok('');
  },

  cp(ctx, argv) {
    const recursive = argv.some((a) => a.startsWith('-') && a.includes('r'));
    const paths = argv.filter((a) => !a.startsWith('-'));
    if (paths.length < 2) return fail('cp: missing destination file operand');
    const dest = paths.pop();
    const destAbs = ctx.fs.resolve(dest);
    try {
      if (paths.length > 1) {
        const destNode = ctx.fs.get(destAbs);
        if (!destNode || destNode.type !== 'dir') {
          return fail(`cp: target '${dest}' is not a directory`);
        }
        for (const p of paths) {
          for (const src of expandArg(ctx.fs, p)) {
            ctx.fs.copy(src, destAbs, { recursive });
          }
        }
      } else {
        for (const src of expandArg(ctx.fs, paths[0])) {
          ctx.fs.copy(src, destAbs, { recursive });
        }
      }
    } catch (e) {
      return fail(`cp: ${stripCannot(e.message)}`);
    }
    return ok('');
  },

  mv(ctx, argv) {
    const paths = argv.filter((a) => !a.startsWith('-'));
    if (paths.length < 2) return fail('mv: missing destination file operand');
    const dest = paths.pop();
    const destAbs = ctx.fs.resolve(dest);
    try {
      if (paths.length > 1) {
        const destNode = ctx.fs.get(destAbs);
        if (!destNode || destNode.type !== 'dir') {
          return fail(`mv: target '${dest}' is not a directory`);
        }
        for (const p of paths) {
          for (const src of expandArg(ctx.fs, p)) {
            ctx.fs.move(src, destAbs + '/' + splitPath(src).base);
          }
        }
      } else {
        for (const src of expandArg(ctx.fs, paths[0])) {
          ctx.fs.move(src, destAbs);
        }
      }
    } catch (e) {
      return fail(`mv: ${stripCannot(e.message)}`);
    }
    return ok('');
  },

  head(ctx, argv, stdin) {
    return headTail(ctx, argv, stdin, true);
  },

  tail(ctx, argv, stdin) {
    return headTail(ctx, argv, stdin, false);
  },

  wc(ctx, argv, stdin) {
    const showL = argv.includes('-l') || argv.includes('-c') === false && !argv.includes('-w');
    // default: lines words bytes; flags optional
    let mode = 'all';
    if (argv.includes('-l')) mode = 'l';
    else if (argv.includes('-w')) mode = 'w';
    else if (argv.includes('-c')) mode = 'c';
    const files = argv.filter((a) => !a.startsWith('-'));
    const rows = [];
    if (!files.length) {
      const stats = countStats(stdin || '');
      rows.push(formatWc(stats, mode));
      return ok(line(rows.join('\n')));
    }
    for (const f of files) {
      const abs = ctx.fs.resolve(f);
      const node = ctx.fs.get(abs);
      if (!node || node.type === 'dir') return fail(`wc: ${f}: No such file or directory`);
      rows.push(formatWc(countStats(node.content || ''), mode));
    }
    return ok(line(rows.join('\n')));
  },

  grep(ctx, argv, stdin) {
    let invert = false;
    let ignoreCase = false;
    let showName = false;
    const rest = [];
    for (const a of argv) {
      if (a === '-v') invert = true;
      else if (a === '-i') ignoreCase = true;
      else if (a === '-l') showName = true;
      else if (a.startsWith('-') && a.length > 1) {
        if (a.includes('v')) invert = true;
        if (a.includes('i')) ignoreCase = true;
      } else rest.push(a);
    }
    const pattern = rest[0];
    if (pattern === undefined) return fail('Usage: grep [OPTION]... PATTERN [FILE]...');
    const files = rest.slice(1);
    const re = new RegExp(pattern, ignoreCase ? 'i' : '');
    /** @type {string[]} */
    const out = [];

    /**
     * @param {string} text
     * @param {string} [label]
     */
    const scan = (text, label) => {
      const lines = text.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      const hits = lines.filter((l) => (invert ? !re.test(l) : re.test(l)));
      if (!hits.length) return;
      if (showName) {
        out.push(label || '(standard input)');
        return;
      }
      for (const h of hits) out.push(label ? `${label}:${h}` : h);
    };

    if (!files.length) {
      scan(stdin || '');
    } else {
      for (const f of files) {
        const abs = ctx.fs.resolve(f);
        const node = ctx.fs.get(abs);
        if (!node || node.type === 'dir') return fail(`grep: ${f}: No such file or directory`);
        scan(node.content || '', files.length > 1 ? f : undefined);
      }
    }
    return { stdout: out.length ? line(out.join('\n')) : '', stderr: '', code: out.length ? 0 : 1 };
  },

  find(ctx, argv) {
    const start = argv[0] && !argv[0].startsWith('-') ? argv[0] : '.';
    const nameIdx = argv.indexOf('-name');
    let pred = () => true;
    if (nameIdx !== -1 && argv[nameIdx + 1]) {
      const re = globToRegExp(argv[nameIdx + 1]);
      pred = (n) => re.test(n.name);
    } else if (argv.includes('-type')) {
      const t = argv[argv.indexOf('-type') + 1];
      pred = (n) => (t === 'd' ? n.type === 'dir' : n.type === 'file');
    }
    const nodes = ctx.fs.find(ctx.fs.resolve(start), pred);
    return ok(line(nodes.map((n) => displayPath(ctx.fs, n.path)).join('\n')));
  },

  chmod(ctx, argv) {
    const args = argv.filter((a) => !a.startsWith('-') || /^[0-7]+$/.test(a));
    // chmod 755 file  |  chmod u+x file
    if (args.length < 2) return fail('chmod: missing operand');
    const modeArg = args[0];
    for (const p of args.slice(1)) {
      const abs = ctx.fs.resolve(p);
      const node = ctx.fs.get(abs);
      if (!node) return fail(`chmod: cannot access '${p}': No such file or directory`);
      if (/^[0-7]{3,4}$/.test(modeArg)) {
        node.mode = parseInt(modeArg, 8) & 0o777;
      } else {
        // symbolic u+x / a-w / go=r
        applySymbolic(node, modeArg);
      }
      node.mtime = Date.now();
    }
    return ok('');
  },

  chown(ctx, argv) {
    const args = argv.filter((a) => !a.startsWith('-'));
    if (args.length < 2) return fail('chown: missing operand');
    // require root (or elevated sudo) for honesty
    if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) {
      return fail(`chown: changing ownership of '${args[1]}': Operation not permitted`);
    }
    const ownerSpec = args[0];
    const [owner, group] = ownerSpec.split(':');
    for (const p of args.slice(1)) {
      const abs = ctx.fs.resolve(p);
      const node = ctx.fs.get(abs);
      if (!node) return fail(`chown: cannot access '${p}': No such file or directory`);
      node.owner = owner || node.owner;
      if (group) node.group = group;
    }
    return ok('');
  },

  ps(ctx, argv) {
    const rows = ['  PID USER     STAT %CPU %MEM COMMAND'];
    const procs = [
      { pid: 1, user: 'root', state: 'S', cpu: 0.0, mem: 0.2, cmd: '/sbin/init' },
      { pid: 42, user: ctx.fs.user, state: 'S', cpu: 0.0, mem: 0.1, cmd: 'bash' },
      ...ctx.fs.processes,
    ];
    for (const p of procs) {
      rows.push(
        `${String(p.pid).padStart(5)} ${p.user.padEnd(8)} ${p.state.padEnd(4)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${p.cmd}`
      );
    }
    return ok(line(rows.join('\n')));
  },

  kill(ctx, argv) {
    let signal = 'TERM';
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '-9' || argv[i] === '-KILL') signal = 'KILL';
      else if (argv[i] === '-15' || argv[i] === '-TERM') signal = 'TERM';
      else if (argv[i].startsWith('-')) {
        const m = argv[i].match(/-s\s*(\w+)/) || argv[i].match(/-(\w+)/);
        if (m) signal = m[1].toUpperCase();
      } else rest.push(argv[i]);
    }
    if (!rest.length) return fail('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec');
    for (const pidStr of rest) {
      const pid = Number(pidStr);
      if (!Number.isInteger(pid)) return fail(`kill: ${pidStr}: arguments must be process or job IDs`);
      const known = pid === 1 || pid === 42 || ctx.fs.processes.some((p) => p.pid === pid);
      if (!known) return fail(`kill: (${pid}) - No such process`);
      if (pid === 1 || pid === 42) {
        return fail(`kill: (${pid}) - Operation not permitted`);
      }
      ctx.fs.killProcess(pid, signal);
    }
    return ok('');
  },

  jobs(ctx) {
    if (!ctx.fs.processes.length) return ok('');
    return ok(
      line(
        ctx.fs.processes
          .map((p, i) => `[${i + 1}]+ Running    ${p.cmd} &`)
          .join('\n')
      )
    );
  },

  df() {
    return ok(
      line(
        [
          'Filesystem     1K-blocks    Used Available Use% Mounted on',
          '/dev/sda1       41152000 8230400  30801600  22% /',
          'tmpfs            2014340       0   2014340   0% /dev/shm',
          '/dev/sda2       20511312  532480  18892544   3% /home',
        ].join('\n')
      )
    );
  },

  du(ctx, argv) {
    const target = argv.find((a) => !a.startsWith('-')) || '.';
    const abs = ctx.fs.resolve(target);
    const node = ctx.fs.get(abs);
    if (!node) return fail(`du: cannot access '${target}': No such file or directory`);
    const blocks = Math.max(1, Math.ceil(ctx.fs.sizeOf(abs) / 1024));
    return ok(line(`${blocks}\t${displayPath(ctx.fs, abs)}`));
  },

  free() {
    return ok(
      line(
        [
          '               total        used        free      shared  buff/cache   available',
          'Mem:         8057364     2345216     3124000      182412     2588148     5284000',
          'Swap:        2097148           0     2097148',
        ].join('\n')
      )
    );
  },

  which(ctx, argv) {
    const name = argv[0];
    if (!name) return fail('which: missing operand');
    if (commands[name]) return ok(line(`/usr/bin/${name}`));
    return fail('', 1);
  },

  man(ctx, argv) {
    const page = argv[0];
    const docs = MAN_PAGES[page];
    if (!docs) return fail(`No manual entry for ${page || ''}`);
    return ok(line(docs));
  },

  help() {
    const names = Object.keys(commands).sort().join('  ');
    return ok(
      line(
        [
          'learn-linux — built-in shell commands',
          '',
          'Navigation:  pwd ls cd find',
          'Files:       mkdir rmdir touch rm cp mv cat echo',
          'Text:        head tail wc grep',
          'Perms:       chmod chown',
          'Processes:   ps kill jobs',
          'System:      df du free uname which man whoami hostname',
          'Session:     clear history reset undo levels hint sandbox',
          '',
          'Supported operators: | > >> < ;',
          '',
          names,
        ].join('\n')
      )
    );
  },

  history(ctx) {
    const hist = ctx.session?.history || [];
    return ok(line(hist.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join('\n')));
  },

  true() {
    return ok('');
  },

  false() {
    return fail('', 1);
  },
};

Object.assign(commands, extraCommands);
mergeGapCommands(commands);

/** Meta commands handled by the shell session (not pure fs). */
export const metaCommands = new Set([
  'clear',
  'history',
  'reset',
  'undo',
  'levels',
  'hint',
  'sandbox',
  'help',
  'solution',
]);

function fsPath(ctx, p) {
  return ctx.fs.resolve(p);
}

function stripCannot(msg) {
  return msg.replace(/^cannot create '[^']*':\s*/, '').replace(/^cannot remove '[^']*':\s*/, '');
}

function ensurePath(fs, abs) {
  const parts = abs.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    if (!fs.exists(cur)) {
      const { dir, base } = splitPath(cur);
      fs.create(dir, base, 'dir');
    }
  }
}

/**
 * @param {import('./fs.js').VNode} node
 */
function formatLong(node) {
  const perms = formatMode(node.mode, node.type);
  const links = node.type === 'dir' ? 2 + (node.children?.length || 0) : 1;
  const size = node.type === 'dir' ? 4096 : (node.content || '').length;
  const date = new Date(node.mtime);
  const mon = date.toLocaleString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(2, ' ');
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const name = node.type === 'dir' ? node.name + '/' : node.name;
  return `${perms} ${links} ${node.owner.padEnd(8)} ${node.group.padEnd(8)} ${String(size).padStart(8)} ${mon} ${day} ${hm} ${name}`;
}

/**
 * @param {{lines:number, words:number, bytes:number}} s
 * @param {string} mode
 */
function formatWc(s, mode) {
  if (mode === 'l') return String(s.lines).padStart(7);
  if (mode === 'w') return String(s.words).padStart(7);
  if (mode === 'c') return String(s.bytes).padStart(7);
  return `${String(s.lines).padStart(7)}${String(s.words).padStart(8)}${String(s.bytes).padStart(8)}`;
}

/**
 * @param {string} text
 */
function countStats(text) {
  const bytes = text.length;
  const lines = text.length ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
  const words = text.split(/\s+/).filter(Boolean).length;
  return { lines, words, bytes };
}

/**
 * @param {CmdContext} ctx
 * @param {string[]} argv
 * @param {string} stdin
 * @param {boolean} isHead
 */
function headTail(ctx, argv, stdin, isHead) {
  let n = 10;
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-n' && argv[i + 1]) {
      n = Number(argv[i + 1]);
      i += 1;
    } else if (/^-\d+$/.test(argv[i])) {
      n = Number(argv[i].slice(1));
    } else if (!argv[i].startsWith('-')) {
      files.push(argv[i]);
    }
  }
  const pick = (text) => {
    let lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    lines = isHead ? lines.slice(0, n) : lines.slice(-n);
    return line(lines.join('\n'));
  };
  if (!files.length) return ok(pick(stdin || ''));
  const out = [];
  for (const f of files) {
    const abs = ctx.fs.resolve(f);
    const node = ctx.fs.get(abs);
    if (!node || node.type === 'dir') {
      return fail(`${isHead ? 'head' : 'tail'}: cannot open '${f}' for reading: No such file or directory`);
    }
    out.push(pick(node.content || ''));
  }
  return ok(out.join(''));
}

/**
 * @param {import('./fs.js').VNode} node
 * @param {string} mode
 */
function applySymbolic(node, mode) {
  // forms: u+x, go-w, a=r, +x
  // bit layout: user = mode[8:6], group = mode[5:3], other = mode[2:0]
  // r=4 w=2 x=1, shifted per class (u<<6, g<<3, o<<0)
  const parts = mode.split(',');
  for (const part of parts) {
    const m = part.match(/^([ugoa]*)([+\-=])([rwx]+)$/);
    if (!m) continue;
    const who = m[1] || 'a';
    const op = m[2];
    let bits = 0;
    for (const ch of m[3]) {
      if (ch === 'r') bits |= 4;
      if (ch === 'w') bits |= 2;
      if (ch === 'x') bits |= 1;
    }
    const all = who.includes('a') || who === '';
    const wantU = all || who.includes('u');
    const wantG = all || who.includes('g');
    const wantO = all || who.includes('o');
    let shifted = 0;
    let setMask = 0;
    if (wantU) {
      shifted |= bits << 6;
      setMask |= 0o700;
    }
    if (wantG) {
      shifted |= bits << 3;
      setMask |= 0o070;
    }
    if (wantO) {
      shifted |= bits;
      setMask |= 0o007;
    }
    if (op === '+') node.mode |= shifted;
    else if (op === '-') node.mode &= ~shifted & 0o777;
    else node.mode = (node.mode & ~setMask) | (shifted & setMask);
    node.mode &= 0o777;
  }
}

/**
 * @param {import('./fs.js').VirtualFS} fs
 * @param {string} abs
 */
function displayPath(fs, abs) {
  const home = fs.env.HOME;
  if (abs === home) return '.';
  if (abs.startsWith(fs.cwd + '/')) return abs.slice(fs.cwd.length + 1);
  if (abs === fs.cwd) return '.';
  return abs;
}

const MAN_PAGES = {
  ls: 'LS(1)\n\nNAME\n       ls - list directory contents\n\nSYNOPSIS\n       ls [-al] [FILE]...\n\nDESCRIPTION\n       List information about files. -a includes hidden entries; -l uses the long format.',
  cd: 'CD(1)\n\nNAME\n       cd - change the working directory\n\nSYNOPSIS\n       cd [DIR]\n\nDESCRIPTION\n       Change the current directory to DIR. Home is used when DIR is omitted.',
  chmod: 'CHMOD(1)\n\nNAME\n       chmod - change file mode bits\n\nSYNOPSIS\n       chmod MODE FILE...\n\nDESCRIPTION\n       MODE may be octal (755) or symbolic (u+x, go-w, a=r).',
  grep: 'GREP(1)\n\nNAME\n       grep - print lines matching a pattern\n\nSYNOPSIS\n       grep [-iv] PATTERN [FILE]...\n\nDESCRIPTION\n       Filter lines by regular expression. -i ignore case, -v invert match.',
  pipes: 'PIPES(7)\n\n       cmd1 | cmd2   send stdout of cmd1 into stdin of cmd2\n       cmd > file    overwrite file with stdout\n       cmd >> file   append stdout to file\n       cmd < file    read file as stdin',
};
