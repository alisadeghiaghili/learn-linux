/**
 * Level catalog for learn-linux.
 *
 * Each level: id, sequence, name, hint, par, solution, start, dialog, disabled, check.
 * Sequences mirror learnGitBranching's series tabs.
 */

/**
 * @typedef {Object} Level
 * @property {string} id
 * @property {string} sequence
 * @property {string} name
 * @property {string} hint
 * @property {number} par
 * @property {string} solution
 * @property {any} start
 * @property {any[]} dialog
 * @property {Record<string, boolean>} [disabled]
 * @property {(fs: any, session: any) => boolean} check
 */

/** Shared empty home for focused levels. */
function homeTree(extra = {}) {
  return {
    '/': {
      type: 'dir',
      owner: 'root',
      children: {
        bin: { type: 'dir', owner: 'root' },
        usr: {
          type: 'dir',
          owner: 'root',
          children: {
            bin: { type: 'dir', owner: 'root' },
            local: { type: 'dir', owner: 'root', children: { bin: { type: 'dir', owner: 'root' } } },
          },
        },
        etc: {
          type: 'dir',
          owner: 'root',
          children: {
            'os-release': {
              type: 'file',
              owner: 'root',
              content: 'NAME="Ubuntu"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu\n',
            },
          },
        },
        tmp: { type: 'dir', mode: 0o777, owner: 'root' },
        var: { type: 'dir', owner: 'root', children: { log: { type: 'dir', owner: 'root' } } },
        proc: { type: 'dir', owner: 'root' },
        home: {
          type: 'dir',
          owner: 'root',
          children: {
            ubuntu: {
              type: 'dir',
              owner: 'ubuntu',
              children: {
                '.bashrc': { type: 'file', owner: 'ubuntu', content: 'export PS1="\\u@\\h:\\w$ "\n' },
                ...extra,
              },
            },
          },
        },
      },
    },
  };
}

const modal = (title, body) => ({ type: 'modal', title, body });
const demo = (before, command, after) => ({ type: 'demo', before, command, after });

/** @type {Level[]} */
export const levels = [
  // ─── intro ───────────────────────────────────────────────
  {
    id: 'intro-whoami',
    sequence: 'intro',
    name: 'Who am I?',
    hint: 'Type `whoami` and press Enter.',
    par: 1,
    solution: 'whoami',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Welcome to Ubuntu',
        'This is a **sandbox shell** with a live filesystem tree on the right.\n\nYou are `ubuntu` on host `learn`. Every command you type updates the tree.\n\nOpen with `whoami` — print the current user name.'
      ),
      demo('Run the demo below to see the output.', 'whoami', 'That prints your username. Now do it yourself.'),
    ],
    check: (fs, session) => session.history.some((h) => h.trim() === 'whoami' || h.trim().startsWith('whoami')),
  },
  {
    id: 'intro-pwd',
    sequence: 'intro',
    name: 'Where am I?',
    hint: 'The command is `pwd` — print working directory.',
    par: 1,
    solution: 'pwd',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Working directory',
        'Your shell is always *somewhere* in the filesystem.\n\n`pwd` prints the absolute path of that location. You start in `/home/ubuntu`.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('pwd')),
  },
  {
    id: 'intro-ls',
    sequence: 'intro',
    name: 'Look around',
    hint: 'Use `ls` to list the current directory. Hidden files need `ls -a`.',
    par: 1,
    solution: 'ls -a',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'readme.md': { type: 'file', owner: 'ubuntu', content: 'hello\n' },
        '.secret': { type: 'file', owner: 'ubuntu', content: 'shh\n' },
      }),
    },
    dialog: [
      modal(
        'Listing files',
        '`ls` lists visible entries. Files starting with `.` are hidden until you pass `-a`.\n\nFind **both** the visible `readme.md` and the hidden `.secret`.'
      ),
    ],
    check: (fs) => {
      // win when both names appear in an ls -a of home
      return false; // replaced below via session history check in wrapper
    },
  },
  {
    id: 'intro-cd',
    sequence: 'intro',
    name: 'Change directory',
    hint: 'cd projects — then `pwd` to prove it.',
    par: 1,
    solution: 'cd projects',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        projects: {
          type: 'dir',
          owner: 'ubuntu',
          children: {
            'app.py': { type: 'file', owner: 'ubuntu', content: 'print("hi")\n' },
          },
        },
      }),
    },
    dialog: [
      modal(
        'Navigation',
        '`cd DIR` moves you into a directory.\n\n`cd ..` goes up, `cd` or `cd ~` goes home, `cd /` goes to root.\n\nMove into `projects` and stay there.'
      ),
    ],
    check: (fs) => fs.cwd === '/home/ubuntu/projects',
  },
  {
    id: 'intro-echo',
    sequence: 'intro',
    name: 'Speak, shell',
    hint: 'echo "hello ubuntu"',
    par: 1,
    solution: 'echo hello ubuntu',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'echo',
        '`echo` writes text to **stdout**. Quote strings that contain spaces.\n\nPrint the phrase `hello ubuntu`.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /echo\s+.*hello\s+ubuntu/i.test(h)),
  },

  // ─── files ───────────────────────────────────────────────
  {
    id: 'files-mkdir',
    sequence: 'files',
    name: 'Make a directory',
    hint: 'mkdir notes',
    par: 1,
    solution: 'mkdir notes',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'mkdir',
        'Directories are containers for other files.\n\n`mkdir NAME` creates one in the current directory. `mkdir -p a/b/c` creates missing parents.\n\nCreate a directory named `notes` in your home.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/notes');
      return !!n && n.type === 'dir';
    },
  },
  {
    id: 'files-touch',
    sequence: 'files',
    name: 'Create a file',
    hint: 'touch todo.txt',
    par: 1,
    solution: 'touch notes/todo.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        notes: { type: 'dir', owner: 'ubuntu', children: {} },
      }),
    },
    dialog: [
      modal(
        'touch',
        '`touch FILE` creates an empty file (or updates its timestamp if it exists).\n\nCreate `todo.txt` inside `notes`.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/notes/todo.txt');
      return !!n && n.type === 'file';
    },
  },
  {
    id: 'files-cat',
    sequence: 'files',
    name: 'Read a file',
    hint: 'cat /home/ubuntu/notes/todo.txt',
    par: 1,
    solution: 'cat notes/todo.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        notes: {
          type: 'dir',
          owner: 'ubuntu',
          children: {
            'todo.txt': { type: 'file', owner: 'ubuntu', content: 'buy milk\nship feature\n' },
          },
        },
      }),
    },
    dialog: [
      modal(
        'cat',
        '`cat FILE` concatenates file contents to stdout — the fastest way to read a short file.\n\nPrint `todo.txt` from the `notes` folder.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bcat\b/.test(h) && /todo\.txt/.test(h)),
  },
  {
    id: 'files-mkdir-p',
    sequence: 'files',
    name: 'Nested paths',
    hint: 'mkdir -p src/app/components',
    par: 1,
    solution: 'mkdir -p src/app/components',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'mkdir -p',
        'Without `-p`, `mkdir a/b/c` fails if `a` or `a/b` is missing.\n\nCreate the full path `src/app/components` in one command.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/src/app/components');
      return !!n && n.type === 'dir';
    },
  },
  {
    id: 'files-cp',
    sequence: 'files',
    name: 'Copy',
    hint: 'cp report.txt backup.txt — or cp -r dir dest',
    par: 1,
    solution: 'cp report.txt backup.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'report.txt': { type: 'file', owner: 'ubuntu', content: 'Q1 numbers\n' },
      }),
    },
    dialog: [
      modal(
        'cp',
        '`cp SRC DEST` copies a file. Directories need `cp -r`.\n\nCopy `report.txt` to `backup.txt` in your home.'
      ),
    ],
    check: (fs) => {
      const a = fs.get('/home/ubuntu/report.txt');
      const b = fs.get('/home/ubuntu/backup.txt');
      return !!a && !!b && a.type === 'file' && b.type === 'file' && a.content === b.content;
    },
  },
  {
    id: 'files-mv',
    sequence: 'files',
    name: 'Move / rename',
    hint: 'mv draft.txt final.txt',
    par: 1,
    solution: 'mv draft.txt final.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'draft.txt': { type: 'file', owner: 'ubuntu', content: 'draft body\n' },
      }),
    },
    dialog: [
      modal(
        'mv',
        '`mv` moves or renames. Same directory = rename.\n\nRename `draft.txt` to `final.txt`. The old name must be gone.'
      ),
    ],
    check: (fs) => {
      const old = fs.get('/home/ubuntu/draft.txt');
      const now = fs.get('/home/ubuntu/final.txt');
      return !old && !!now && now.type === 'file';
    },
  },
  {
    id: 'files-rm',
    sequence: 'files',
    name: 'Remove carefully',
    hint: 'rm junk.txt — use -r for directories, -f to force',
    par: 1,
    solution: 'rm junk.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'junk.txt': { type: 'file', owner: 'ubuntu', content: 'temp\n' },
        'keep.txt': { type: 'file', owner: 'ubuntu', content: 'important\n' },
      }),
    },
    dialog: [
      modal(
        'rm',
        'Deletion is permanent in real shells. Here you can `undo`.\n\nDelete **only** `junk.txt`. Keep `keep.txt`.'
      ),
    ],
    check: (fs) => !fs.get('/home/ubuntu/junk.txt') && !!fs.get('/home/ubuntu/keep.txt'),
  },

  // ─── text ────────────────────────────────────────────────
  {
    id: 'text-redirect',
    sequence: 'text',
    name: 'Redirect output',
    hint: 'echo "line one" > message.txt  (then maybe append with >>)',
    par: 1,
    solution: 'echo "line one" > message.txt',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Redirection',
        '`>` writes stdout to a file (overwrite). `>>` appends. `<` feeds a file into stdin.\n\nCreate `message.txt` containing exactly:\n\n```\nline one\n```'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/message.txt');
      return !!n && (n.content || '').trim() === 'line one';
    },
  },
  {
    id: 'text-head-tail',
    sequence: 'text',
    name: 'Head and tail',
    hint: 'head -n 2 long.txt  and  tail -n 2 long.txt',
    par: 2,
    solution: 'head -n 2 long.txt; tail -n 2 long.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'long.txt': {
          type: 'file',
          owner: 'ubuntu',
          content: 'alpha\nbravo\ncharlie\ndelta\necho\nfoxtrot\n',
        },
      }),
    },
    dialog: [
      modal(
        'Slice a file',
        '`head -n N` prints the first N lines. `tail -n N` prints the last N.\n\nShow the **first 2** lines of `long.txt`, then the **last 2** (two commands is fine).'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bhead\b/.test(h) && /long\.txt/.test(h)) &&
      session.history.some((h) => /\btail\b/.test(h) && /long\.txt/.test(h)),
  },
  {
    id: 'text-wc',
    sequence: 'text',
    name: 'Count with wc',
    hint: 'wc -l long.txt',
    par: 1,
    solution: 'wc -l long.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'long.txt': {
          type: 'file',
          owner: 'ubuntu',
          content: 'alpha\nbravo\ncharlie\ndelta\necho\nfoxtrot\n',
        },
      }),
    },
    dialog: [
      modal(
        'wc',
        '`wc` counts lines, words, and bytes. Flags: `-l` `-w` `-c`.\n\nCount the **lines** in `long.txt`.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bwc\b/.test(h) && /-l/.test(h) && /long\.txt/.test(h)),
  },
  {
    id: 'text-grep',
    sequence: 'text',
    name: 'Search with grep',
    hint: 'grep error app.log',
    par: 1,
    solution: 'grep error app.log',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'app.log': {
          type: 'file',
          owner: 'ubuntu',
          content: 'INFO boot ok\nERROR disk full\nINFO retry\nERROR timeout\nDEBUG trace\n',
        },
      }),
    },
    dialog: [
      modal(
        'grep',
        '`grep PATTERN FILE` prints matching lines.\n\nPrint only the **ERROR** lines from `app.log`.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bgrep\b/.test(h) && /error/i.test(h) && /app\.log/.test(h)),
  },
  {
    id: 'text-pipe',
    sequence: 'text',
    name: 'Pipes',
    hint: 'cat app.log | grep ERROR | wc -l',
    par: 3,
    solution: 'grep ERROR app.log | wc -l',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'app.log': {
          type: 'file',
          owner: 'ubuntu',
          content: 'INFO boot ok\nERROR disk full\nINFO retry\nERROR timeout\nDEBUG trace\n',
        },
      }),
    },
    dialog: [
      modal(
        'Pipes',
        'The pipe `|` sends stdout of one command into stdin of the next. This is the Unix philosophy: small tools, composed.\n\nCount how many **ERROR** lines are in `app.log` by chaining `grep` and `wc -l` **with a pipe**.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => h.includes('|') && /grep/i.test(h) && /\bwc\b/.test(h)),
  },
  {
    id: 'text-append',
    sequence: 'text',
    name: 'Append',
    hint: 'echo "more" >> notes.log',
    par: 2,
    solution: 'echo one > notes.log; echo two >> notes.log',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        '>> vs >',
        '`>` overwrites. `>>` appends.\n\nWrite `one` to `notes.log`, then **append** `two` so the file has both lines in that order.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/notes.log');
      if (!n) return false;
      const lines = (n.content || '').trim().split('\n');
      return lines[0] === 'one' && lines[1] === 'two';
    },
  },

  // ─── permissions ─────────────────────────────────────────
  {
    id: 'perm-ls-l',
    sequence: 'permissions',
    name: 'Read the mode',
    hint: 'ls -l',
    par: 1,
    solution: 'ls -l',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'run.sh': { type: 'file', mode: 0o644, owner: 'ubuntu', content: '#!/bin/bash\necho hi\n' },
      }),
    },
    dialog: [
      modal(
        'ls -l',
        'Long format shows `rwxrwxrwx` permission bits, owner, and group.\n\nInspect the long listing of your home (look at `run.sh`).'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\bls\b/.test(h) && h.includes('-l')),
  },
  {
    id: 'perm-chmod-x',
    sequence: 'permissions',
    name: 'Make it executable',
    hint: 'chmod +x run.sh  or  chmod 755 run.sh',
    par: 1,
    solution: 'chmod +x run.sh',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'run.sh': { type: 'file', mode: 0o644, owner: 'ubuntu', content: '#!/bin/bash\necho hi\n' },
      }),
    },
    dialog: [
      modal(
        'chmod +x',
        'Scripts need the execute bit before the shell will run them.\n\nSet execute for the owner on `run.sh` (`ls -l` should show `x` for user).'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/run.sh');
      return !!n && (n.mode & 0o100) !== 0;
    },
  },
  {
    id: 'perm-octal',
    sequence: 'permissions',
    name: 'Octal lockdown',
    hint: 'chmod 600 id_rsa',
    par: 1,
    solution: 'chmod 600 .ssh/id_rsa',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        '.ssh': {
          type: 'dir',
          mode: 0o700,
          owner: 'ubuntu',
          children: {
            id_rsa: { type: 'file', mode: 0o644, owner: 'ubuntu', content: 'PRIVATE KEY MATERIAL\n' },
          },
        },
      }),
    },
    dialog: [
      modal(
        'chmod 600',
        'Octal modes: `4` read, `2` write, `1` execute, summed per class (user/group/other).\n\nLock `id_rsa` down to `600` (rw-------).'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/.ssh/id_rsa');
      return !!n && n.mode === 0o600;
    },
  },
  {
    id: 'perm-symbolic',
    sequence: 'permissions',
    name: 'Symbolic modes',
    hint: 'chmod go-w shared.txt',
    par: 1,
    solution: 'chmod go-w shared.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'shared.txt': { type: 'file', mode: 0o666, owner: 'ubuntu', content: 'team notes\n' },
      }),
    },
    dialog: [
      modal(
        'Symbolic chmod',
        'Forms like `u+x`, `go-w`, `a=r` adjust bits per class.\n\nOn `shared.txt`, remove write for **group** and **other** only. Keep user write.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/shared.txt');
      if (!n) return false;
      const userW = n.mode & 0o200;
      const groupW = n.mode & 0o020;
      const otherW = n.mode & 0o002;
      return !!userW && !groupW && !otherW;
    },
  },

  // ─── processes ───────────────────────────────────────────
  {
    id: 'proc-ps',
    sequence: 'processes',
    name: 'List processes',
    hint: 'ps',
    par: 1,
    solution: 'ps',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree(),
      processes: [
        { cmd: 'backup.sh', user: 'ubuntu', state: 'R', cpu: 2.1, mem: 0.4 },
        { cmd: 'sleep infinity', user: 'ubuntu', state: 'S', cpu: 0.0, mem: 0.0 },
      ],
    },
    dialog: [
      modal(
        'ps',
        'Every running program is a **process** with a PID.\n\n`ps` snapshots the process table. The right panel shows the live table too.\n\nRun `ps` once.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim() === 'ps' || h.trim().startsWith('ps ')),
  },
  {
    id: 'proc-kill',
    sequence: 'processes',
    name: 'Kill the runaway',
    hint: 'ps first to find the PID, then kill <pid>  (or kill -9)',
    par: 2,
    solution: 'ps; kill <pid>',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree(),
      processes: [
        { cmd: 'backup.sh', user: 'ubuntu', state: 'R', cpu: 48.2, mem: 2.4 },
        { cmd: 'nginx: worker', user: 'www-data', state: 'S', cpu: 0.1, mem: 1.2 },
      ],
    },
    dialog: [
      modal(
        'kill',
        '`backup.sh` is burning CPU. Find its PID with `ps`, then terminate it.\n\nLeave `nginx: worker` running. You cannot kill PID 1 or your own shell.'
      ),
    ],
    check: (fs) => {
      const names = fs.processes.map((p) => p.cmd);
      return !names.some((c) => c.includes('backup')) && names.some((c) => c.includes('nginx'));
    },
  },
  {
    id: 'proc-jobs',
    sequence: 'processes',
    name: 'Background noise',
    hint: 'jobs',
    par: 1,
    solution: 'jobs',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree(),
      processes: [
        { cmd: 'encode.sh', user: 'ubuntu', state: 'R', cpu: 12.0, mem: 3.1 },
        { cmd: 'sync.sh', user: 'ubuntu', state: 'S', cpu: 0.2, mem: 0.3 },
      ],
    },
    dialog: [
      modal('jobs', 'Inspect background jobs with `jobs`.'),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('jobs')),
  },

  // ─── system ──────────────────────────────────────────────
  {
    id: 'sys-find',
    sequence: 'system',
    name: 'Find a file',
    hint: 'find . -name "*.log"  or  find /var -name syslog',
    par: 1,
    solution: 'find . -name "*.log"',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        logs: {
          type: 'dir',
          owner: 'ubuntu',
          children: {
            'a.log': { type: 'file', owner: 'ubuntu', content: 'a\n' },
            'b.txt': { type: 'file', owner: 'ubuntu', content: 'b\n' },
          },
        },
        'notes.log': { type: 'file', owner: 'ubuntu', content: 'n\n' },
      }),
    },
    dialog: [
      modal(
        'find',
        '`find PATH -name PATTERN` walks a tree and filters by name (glob).\n\nLocate every `*.log` file under your home.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bfind\b/.test(h) && /\.log/.test(h)),
  },
  {
    id: 'sys-df',
    sequence: 'system',
    name: 'Disk free',
    hint: 'df',
    par: 1,
    solution: 'df',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal('df', '`df` reports filesystem disk space. Run it.'),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('df')),
  },
  {
    id: 'sys-du',
    sequence: 'system',
    name: 'Directory size',
    hint: 'du projects',
    par: 1,
    solution: 'du projects',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        projects: {
          type: 'dir',
          owner: 'ubuntu',
          children: {
            'big.txt': { type: 'file', owner: 'ubuntu', content: 'x'.repeat(200) },
            'small.txt': { type: 'file', owner: 'ubuntu', content: 'y' },
          },
        },
      }),
    },
    dialog: [
      modal('du', '`du` estimates file space usage. Measure the `projects` directory.'),
    ],
    check: (fs, session) => session.history.some((h) => /\bdu\b/.test(h) && /projects/.test(h)),
  },
  {
    id: 'sys-uname',
    sequence: 'system',
    name: 'Kernel identity',
    hint: 'uname -a',
    par: 1,
    solution: 'uname -a',
    disabled: {},
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'uname',
        '`uname` prints the kernel name. `uname -a` dumps the full identity string.\n\nPrint the full one.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\buname\b/.test(h) && h.includes('-a')),
  },
  {
    id: 'sys-pipeline-capstone',
    sequence: 'system',
    name: 'Capstone pipeline',
    hint: 'grep ERROR app.log | wc -l > error_count.txt',
    par: 3,
    solution: 'grep ERROR app.log | wc -l > error_count.txt',
    disabled: {},
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'app.log': {
          type: 'file',
          owner: 'ubuntu',
          content: 'INFO ok\nERROR a\nERROR b\nINFO done\n',
        },
      }),
    },
    dialog: [
      modal(
        'Compose everything',
        'Count ERROR lines in `app.log` and **redirect** that count into `error_count.txt`.\n\nUse a pipe (`grep` → `wc -l`) and `>`.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/error_count.txt');
      return !!n && (n.content || '').trim() === '2';
    },
  },
];

// Fix intro-ls check (needs history)
const lsLevel = levels.find((l) => l.id === 'intro-ls');
if (lsLevel) {
  lsLevel.check = (fs, session) =>
    session.history.some((h) => /\bls\b/.test(h) && (h.includes('-a') || h.includes('-la') || h.includes('-al')));
}

/**
 * @typedef {Object} SequenceMeta
 * @property {string} id
 * @property {string} name
 * @property {string} about
 */

/** @type {SequenceMeta[]} */
export const sequences = [
  {
    id: 'intro',
    name: 'Introduction',
    about: 'pwd, ls, cd, whoami, echo — find your footing in Ubuntu.',
  },
  {
    id: 'files',
    name: 'Files & directories',
    about: 'Create, copy, move, and delete with mkdir, touch, cp, mv, rm.',
  },
  {
    id: 'text',
    name: 'Text & pipes',
    about: 'head, tail, wc, grep, redirection, and the pipe that glues them.',
  },
  {
    id: 'permissions',
    name: 'Permissions',
    about: 'Read rwx bits and change them with chmod (octal and symbolic).',
  },
  {
    id: 'processes',
    name: 'Processes',
    about: 'ps, jobs, and kill — own the process table.',
  },
  {
    id: 'system',
    name: 'System',
    about: 'find, df, du, uname, and a capstone pipeline.',
  },
];

/**
 * @param {string} sequenceId
 * @returns {Level[]}
 */
export function levelsIn(sequenceId) {
  return levels.filter((l) => l.sequence === sequenceId);
}

/**
 * @param {string} id
 * @returns {Level|undefined}
 */
export function getLevel(id) {
  return levels.find((l) => l.id === id);
}

/** Progress helpers (localStorage). */
const STORAGE_KEY = 'learn-linux-progress-v1';

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * @param {string} levelId
 * @param {number} commandCount
 * @param {number} par
 */
export function recordWin(levelId, commandCount, par) {
  const progress = loadProgress();
  const prev = progress[levelId];
  if (!prev || commandCount < prev.best) {
    progress[levelId] = {
      best: commandCount,
      par,
      at: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }
  return progress[levelId];
}
