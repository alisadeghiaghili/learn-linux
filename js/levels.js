/**
 * Level catalog — Ubuntu/Linux shell training oriented toward LPIC-1 habits.
 *
 * Each level: id, sequence, name, objective, learn[], hint, par, solution,
 * steps[], start, dialog[], disabled?, check(fs, session).
 */

/** @typedef {{command: string, note?: string}} SolutionStep */
/** @typedef {{type: 'modal'|'demo', title?: string, body?: string, before?: string, command?: string, after?: string}} DialogStep */

function homeTree(extra = {}) {
  return {
    '/': {
      type: 'dir',
      owner: 'root',
      children: {
        bin: { type: 'dir', owner: 'root' },
        sbin: { type: 'dir', owner: 'root' },
        usr: {
          type: 'dir',
          owner: 'root',
          children: {
            bin: {
              type: 'dir',
              owner: 'root',
              children: {
                bash: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
                ls: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
                grep: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
                nano: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
              },
            },
            sbin: {
              type: 'dir',
              owner: 'root',
              children: {
                'useradd': { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
                'usermod': { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
              },
            },
            local: { type: 'dir', owner: 'root', children: { bin: { type: 'dir', owner: 'root' }, sbin: { type: 'dir', owner: 'root' } } },
            share: { type: 'dir', owner: 'root' },
            lib: { type: 'dir', owner: 'root' },
          },
        },
        etc: {
          type: 'dir',
          owner: 'root',
          children: {
            hostname: { type: 'file', owner: 'root', content: 'learn\n' },
            hosts: {
              type: 'file',
              owner: 'root',
              content: '127.0.0.1 localhost\n127.0.1.1 learn\n',
            },
            passwd: {
              type: 'file',
              owner: 'root',
              content:
                'root:x:0:0:root:/root:/bin/bash\nubuntu:x:1000:1000:Ubuntu User:/home/ubuntu:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n',
            },
            group: {
              type: 'file',
              owner: 'root',
              content: 'root:x:0:\nsudo:x:27:ubuntu\nubuntu:x:1000:\nwww-data:x:33:\n',
            },
            'os-release': {
              type: 'file',
              owner: 'root',
              content:
                'NAME="Ubuntu"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\nVERSION_ID="24.04"\n',
            },
            fstab: {
              type: 'file',
              owner: 'root',
              content:
                '# <file system> <mount point> <type> <options> <dump> <pass>\nUUID=root-uuid / ext4 errors=remount-ro 0 1\n/dev/sda2 /home ext4 defaults 0 2\n',
            },
            'login.defs': { type: 'file', owner: 'root', content: 'PASS_MAX_DAYS 99999\nUMASK 022\n' },
          },
        },
        opt: { type: 'dir', owner: 'root' },
        mnt: { type: 'dir', owner: 'root' },
        media: { type: 'dir', owner: 'root' },
        tmp: { type: 'dir', mode: 0o777, owner: 'root' },
        var: {
          type: 'dir',
          owner: 'root',
          children: {
            log: {
              type: 'dir',
              owner: 'root',
              children: {
                syslog: {
                  type: 'file',
                  owner: 'root',
                  content: 'Jan  1 00:00:01 learn systemd[1]: Started Session 1 of user ubuntu.\nJan  1 00:00:02 learn kernel: [    0.000000] Linux version 6.8.0-45-generic\n',
                },
                'auth.log': {
                  type: 'file',
                  owner: 'root',
                  content: 'Jan  1 00:10:00 learn sudo: ubuntu : TTY=pts/0 ; PWD=/home/ubuntu ; USER=root ; COMMAND=/usr/bin/apt update\n',
                },
              },
            },
            cache: { type: 'dir', owner: 'root', children: { apt: { type: 'dir', owner: 'root' } } },
            lib: { type: 'dir', owner: 'root', children: { apt: { type: 'dir', owner: 'root' }, dpkg: { type: 'dir', owner: 'root' } } },
            www: { type: 'dir', owner: 'www-data', children: { html: { type: 'dir', owner: 'www-data' } } },
          },
        },
        boot: { type: 'dir', owner: 'root' },
        dev: { type: 'dir', owner: 'root' },
        proc: { type: 'dir', owner: 'root' },
        run: { type: 'dir', owner: 'root' },
        srv: { type: 'dir', owner: 'root' },
        root: { type: 'dir', mode: 0o700, owner: 'root' },
        home: {
          type: 'dir',
          owner: 'root',
          children: {
            ubuntu: {
              type: 'dir',
              owner: 'ubuntu',
              children: {
                '.bashrc': {
                  type: 'file',
                  owner: 'ubuntu',
                  content: 'export PS1="\\u@\\h:\\w$ "\nexport EDITOR=nano\n',
                },
                '.profile': { type: 'file', owner: 'ubuntu', content: '# ~/.profile\n' },
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

/** @type {any[]} */
export const levels = [
  // ─── intro ───────────────────────────────────────────────
  {
    id: 'intro-whoami',
    sequence: 'intro',
    name: 'Who am I?',
    objective: 'Identify the user account your shell runs as.',
    learn: [
      'Linux is multi-user: every process has an effective UID.',
      '`whoami` prints the **effective user name** (from /etc/passwd).',
      'Your prompt is usually `\\u@\\h:\\w\\$` — user, host, cwd, `#` for root.',
      'LPIC: understand user identity vs. the root superuser (UID 0).',
    ],
    hint: 'Type `whoami` and press Enter.',
    par: 1,
    solution: 'whoami',
    steps: [{ command: 'whoami', note: 'Print the current user name' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Users and identity',
        'Every login maps to a user in **`/etc/passwd`**. The kernel tracks processes by numeric UID; tools resolve that to a name.\n\nYou are **`ubuntu`** (UID 1000 on a typical Ubuntu desktop). `root` (UID 0) bypasses permission checks.\n\n`whoami` answers one question: *which account is my shell running as right now?*'
      ),
      demo(
        'Run the demo. Output is just a name — but that name decides file ownership, package installs, and service control.',
        'whoami',
        'On Ubuntu the first admin user is often `ubuntu`. Keep this identity in mind for `ls -l` and `chmod` later.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('whoami')),
  },
  {
    id: 'intro-pwd',
    sequence: 'intro',
    name: 'Where am I?',
    objective: 'Print the absolute path of the working directory.',
    learn: [
      'A process always has a **cwd** (current working directory).',
      '`pwd` prints the **absolute** path (starts at `/`).',
      'Relative paths (`projects`, `../etc`) resolve against cwd.',
      'The root of the filesystem is `/` — there are no drive letters.',
    ],
    hint: 'The command is `pwd` — print working directory.',
    par: 1,
    solution: 'pwd',
    steps: [{ command: 'pwd', note: 'Show absolute path of the working directory' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Working directory',
        'The shell sits somewhere in a single tree: **`/`**.\n\nHome for user `ubuntu` is **`/home/ubuntu`** (see `$HOME`). `cd` changes the cwd; `pwd` only *reports* it.\n\nWhy absolute paths matter: scripts and `cron` do not share your interactive cwd — always know where you are before creating files.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('pwd')),
  },
  {
    id: 'intro-ls',
    sequence: 'intro',
    name: 'Look around',
    objective: 'List directory entries, including hidden dotfiles.',
    learn: [
      '`ls` lists names in a directory (not file contents).',
      'Names starting with `.` are hidden from plain `ls` — use **`-a`**.',
      'Dotfiles are configuration (`~/.bashrc`, `~/.ssh/`).',
      '`-l` adds mode, owner, size, and mtime (FHS habit: inspect before you trust).',
    ],
    hint: 'Use `ls` to list the current directory. Hidden files need `ls -a`.',
    par: 1,
    solution: 'ls -a',
    steps: [{ command: 'ls -a', note: 'Include hidden (dot) entries' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'readme.md': { type: 'file', owner: 'ubuntu', content: 'hello\n' },
        '.secret': { type: 'file', mode: 0o600, owner: 'ubuntu', content: 'api key material\n' },
      }),
    },
    dialog: [
      modal(
        'Listing files',
        'A directory is a table of names → inodes. `ls` reads that table.\n\n**Hidden files** are not “secret” — the leading `.` only hides them from default listing. Shell configs live in your home as dotfiles.\n\nFind **both** `readme.md` and `.secret` in one listing.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bls\b/.test(h) && (h.includes('-a') || h.includes('-la') || h.includes('-al'))),
  },
  {
    id: 'intro-cd',
    sequence: 'intro',
    name: 'Change directory',
    objective: 'Navigate the tree with cd, .., and ~.',
    learn: [
      '`cd DIR` sets the process cwd; it does not copy anything.',
      '`cd ..` → parent; `cd` or `cd ~` → `$HOME`; `cd /` → root; `cd -` → previous cwd.',
      'Tab completion on real shells fills path segments — here Tab completes the current word.',
      'FHS: user work lives under `/home/<user>`, packages under `/usr`, config under `/etc`.',
    ],
    hint: 'cd projects — then `pwd` to prove it.',
    par: 1,
    solution: 'cd projects',
    steps: [{ command: 'cd projects', note: 'Enter the projects directory' }],
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
        'Paths are the API of the filesystem.\n\n| Form | Meaning |\n|------|---------|\n| `projects` | relative to cwd |\n| `/etc/passwd` | absolute |\n| `../` | parent |\n| `~` | home |\n\nMove into **`projects`** and stay there. The tree on the right should highlight your new cwd.'
      ),
    ],
    check: (fs) => fs.cwd === '/home/ubuntu/projects',
  },
  {
    id: 'intro-echo',
    sequence: 'intro',
    name: 'Speak, shell',
    objective: 'Print text with echo and understand stdout.',
    learn: [
      'Every process has three standard streams: **stdin 0, stdout 1, stderr 2**.',
      '`echo` writes text to **stdout**. Redirect with `>` / `>>` later.',
      'Quoting: `"$VAR"` expands; `\'$VAR\'` is literal; unquoted splits on spaces.',
      'Exit codes: `0` success, non-zero failure (`$?` on real shells).',
    ],
    hint: 'echo "hello ubuntu"',
    par: 1,
    solution: 'echo hello ubuntu',
    steps: [{ command: 'echo hello ubuntu', note: 'Write text to standard output' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'echo and streams',
        'The Unix model: small programs, text streams, composition.\n\n`echo` is the simplest filter: arguments in, one line out. Try quoting — `echo "hello ubuntu"` keeps spaces.\n\nPrint the phrase **`hello ubuntu`**.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /echo\s+.*hello\s+ubuntu/i.test(h)),
  },

  // ─── files ───────────────────────────────────────────────
  {
    id: 'files-mkdir',
    sequence: 'files',
    name: 'Make a directory',
    objective: 'Create a directory node with mkdir.',
    learn: [
      '`mkdir NAME` creates a directory entry in the cwd.',
      'You need **write+execute** on the parent directory to create children.',
      '`mkdir -p a/b/c` creates missing parents (idempotent scripting).',
      'FHS: project code under `~/projects`, avoid cluttering `/`.',
    ],
    hint: 'mkdir notes',
    par: 1,
    solution: 'mkdir notes',
    steps: [{ command: 'mkdir notes', note: 'Create directory `notes` in home' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'mkdir',
        'A new directory needs an inode and a name in the parent. Without `-p`, the parent must already exist or mkdir fails.\n\nCreate **`notes`** under `/home/ubuntu`. Watch the tree grow.'
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
    objective: 'Create an empty regular file with touch.',
    learn: [
      '`touch FILE` creates an empty file if missing, else updates **mtime**.',
      'Files store metadata (inode) separately from data blocks.',
      'Default umask on Ubuntu is `022` → files `644`, dirs `755`.',
      'Building scripts: `touch` is the cheapest way to open a path for write later.',
    ],
    hint: 'touch notes/todo.txt',
    par: 1,
    solution: 'touch notes/todo.txt',
    steps: [{ command: 'touch notes/todo.txt', note: 'Create empty todo.txt inside notes/' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        notes: { type: 'dir', owner: 'ubuntu', children: {} },
      }),
    },
    dialog: [
      modal(
        'touch',
        'An empty file is still a real file: name, owner, mode, size 0.\n\nCreate **`todo.txt`** inside `notes` (path relative to home works: `notes/todo.txt`).'
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
    objective: 'Dump file contents to stdout with cat.',
    learn: [
      '`cat` concatenates files to stdout (historically *catenate*).',
      'Directories cannot be `cat`’d — you get `Is a directory`.',
      'For large files prefer `less`, `head`, `tail` (filters).',
      'Everything is a file: configs in `/etc`, logs in `/var/log`.',
    ],
    hint: 'cat notes/todo.txt',
    par: 1,
    solution: 'cat notes/todo.txt',
    steps: [{ command: 'cat notes/todo.txt', note: 'Print todo list to the terminal' }],
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
        'Reading is opening the inode and streaming bytes to fd 1 (stdout).\n\nPrint **`notes/todo.txt`**. Compare with `ls` — listing names is not reading data.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\bcat\b/.test(h) && /todo\.txt/.test(h)),
  },
  {
    id: 'files-mkdir-p',
    sequence: 'files',
    name: 'Nested paths',
    objective: 'Create a multi-level directory tree in one command.',
    learn: [
      '`mkdir -p` = create parents as needed, do not error if exists.',
      'Idempotent scripts: safe to re-run in CI/cron.',
      'Source layouts: `src/app/components` mirrors module structure.',
    ],
    hint: 'mkdir -p src/app/components',
    par: 1,
    solution: 'mkdir -p src/app/components',
    steps: [{ command: 'mkdir -p src/app/components', note: 'Create full path in one shot' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'mkdir -p',
        'Without `-p`, `mkdir a/b/c` fails if `a` or `a/b` is missing (`No such file or directory`).\n\nCreate **`src/app/components`** in a single command.'
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
    objective: 'Duplicate a file with cp (new inode, same content).',
    learn: [
      '`cp SRC DEST` copies data; the result is a **new** file (new inode).',
      'Directories need `cp -r` (recursive).',
      'Overwrite risk: `cp` replaces an existing dest file without prompt (use `-i` interactively).',
      'Hard links share inodes; copies do not — see the links level later.',
    ],
    hint: 'cp report.txt backup.txt',
    par: 1,
    solution: 'cp report.txt backup.txt',
    steps: [{ command: 'cp report.txt backup.txt', note: 'Duplicate report as backup.txt' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'report.txt': { type: 'file', owner: 'ubuntu', content: 'Q1 numbers\n' },
      }),
    },
    dialog: [
      modal(
        'cp',
        'Copy = read source, create dest, write data. Ownership/mode may be reset unless `-p`.\n\nCopy **`report.txt`** → **`backup.txt`** in home.'
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
    objective: 'Rename or relocate a path with mv.',
    learn: [
      '`mv` on the same filesystem is usually a **rename** (same inode, new name).',
      'Across mount points it copies then unlinks (like `cp` + `rm`).',
      'Rename is how you “edit” configs atomically: write `file.tmp` then `mv`.',
    ],
    hint: 'mv draft.txt final.txt',
    par: 1,
    solution: 'mv draft.txt final.txt',
    steps: [{ command: 'mv draft.txt final.txt', note: 'Rename draft to final (old name gone)' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'draft.txt': { type: 'file', owner: 'ubuntu', content: 'draft body\n' },
      }),
    },
    dialog: [
      modal(
        'mv',
        'Same directory + new name = rename. The old path must disappear.\n\nRename **`draft.txt`** → **`final.txt`**.'
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
    objective: 'Delete a file with rm without touching the other one.',
    learn: [
      '`rm` unlinks a name; data is freed when the last link / open handle drops.',
      'Directories need `rm -r`; `-f` suppresses prompts and missing-file errors.',
      'There is no trash can on the CLI. Measure twice (`ls`) before `rm -rf /` habits.',
      'Here `undo` exists — on real Ubuntu it does not.',
    ],
    hint: 'rm junk.txt — keep keep.txt',
    par: 1,
    solution: 'rm junk.txt',
    steps: [{ command: 'rm junk.txt', note: 'Delete only junk.txt' }],
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
        'Unlink ≠ erase forever (forensics can recover until blocks are reused), but for the shell it is gone.\n\nDelete **only** `junk.txt`. Leave `keep.txt`.'
      ),
    ],
    check: (fs) => !fs.get('/home/ubuntu/junk.txt') && !!fs.get('/home/ubuntu/keep.txt'),
  },

  // ─── text ────────────────────────────────────────────────
  {
    id: 'text-redirect',
    sequence: 'text',
    name: 'Redirect output',
    objective: 'Send stdout into a file with >.',
    learn: [
      '`>` opens the file for write (**truncate**), connects it to fd 1.',
      '`>>` appends. `2>` is stderr. `&>` both (bash).',
      'Shell redirection is not an `echo` feature — any command can redirect.',
      'Classic footgun: `cmd > file` while reading `file` truncates it first.',
    ],
    hint: 'echo "line one" > message.txt',
    par: 1,
    solution: 'echo "line one" > message.txt',
    steps: [{ command: 'echo "line one" > message.txt', note: 'Create message.txt with one line' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Redirection',
        'Pipes and redirects are the shell’s glue.\n\n| Operator | Meaning |\n|----------|---------|\n| `>` | overwrite file with stdout |\n| `>>` | append stdout |\n| `<` | file becomes stdin |\n| `\\|` | stdout → next stdin |\n\nCreate **`message.txt`** containing exactly `line one`.'
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
    objective: 'Slice the start and end of a text file.',
    learn: [
      '`head -n N` / `tail -n N` print the first/last N **lines** (default 10).',
      '`tail -f` follows growing log files (systemd journal equivalents: `journalctl -f`).',
      'Line-oriented tools assume newline-separated records (CSV, logs).',
    ],
    hint: 'head -n 2 long.txt  and  tail -n 2 long.txt',
    par: 2,
    solution: 'head -n 2 long.txt; tail -n 2 long.txt',
    steps: [
      { command: 'head -n 2 long.txt', note: 'First two lines' },
      { command: 'tail -n 2 long.txt', note: 'Last two lines' },
    ],
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
        'Log analysis starts at the edges: newest errors (`tail`), boot banner (`head`).\n\nShow the **first 2** lines of `long.txt`, then the **last 2**.'
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
    objective: 'Count lines, words, or bytes.',
    learn: [
      '`wc` = word count. Flags: `-l` lines, `-w` words, `-c` bytes.',
      'Line count is the usual health check for ETL outputs and configs.',
      'Bytes vs characters: UTF-8 can be multi-byte (LC_ALL matters).',
    ],
    hint: 'wc -l long.txt',
    par: 1,
    solution: 'wc -l long.txt',
    steps: [{ command: 'wc -l long.txt', note: 'Count lines only' }],
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
        'Default `wc FILE` prints `lines words bytes`.\n\nCount **lines** in `long.txt` with `-l`.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bwc\b/.test(h) && /-l/.test(h) && /long\.txt/.test(h)),
  },
  {
    id: 'text-grep',
    sequence: 'text',
    name: 'Search with grep',
    objective: 'Filter lines by regular expression.',
    learn: [
      '`grep PATTERN FILE` prints matching lines; exit `0` if any match, `1` if none.',
      '-i` ignore case, `-v` invert, `-n` line numbers, `-r` recursive.',
      'Patterns are regular expressions by default (`-F` / `fgrep` for fixed strings).',
      'LPIC: know grep vs. egrep/fgrep and basic BRE metacharacters.',
    ],
    hint: 'grep error app.log',
    par: 1,
    solution: 'grep error app.log',
    steps: [{ command: 'grep error app.log', note: 'Show ERROR lines from the log' }],
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
        'grep is a **filter**: stdin/args in, matching lines out.\n\nPrint only the **ERROR** lines from `app.log` (case as shown).'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bgrep\b/.test(h) && /error/i.test(h) && /app\.log/.test(h)),
  },
  {
    id: 'text-pipe',
    sequence: 'text',
    name: 'Pipes',
    objective: 'Chain grep and wc with a pipeline.',
    learn: [
      '`cmd1 | cmd2` connects stdout of cmd1 to stdin of cmd2.',
      'Pipelines run concurrently; only the last exit code is `$?` (use `PIPESTATUS` in bash).',
      'This is the Unix philosophy: do one thing well, compose text.',
      'Real world: `journalctl | grep ERROR | wc -l`.',
    ],
    hint: 'grep ERROR app.log | wc -l',
    par: 3,
    solution: 'grep ERROR app.log | wc -l',
    steps: [
      { command: 'grep ERROR app.log', note: 'Filter ERROR lines' },
      { command: 'grep ERROR app.log | wc -l', note: 'Count them with a pipe' },
    ],
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
        'Without a pipe you would write temp files. With `|` the data never hits disk.\n\nCount **ERROR** lines in `app.log` by chaining `grep` and `wc -l` **with a pipe**.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => h.includes('|') && /grep/i.test(h) && /\bwc\b/.test(h)),
  },
  {
    id: 'text-append',
    sequence: 'text',
    name: 'Append',
    objective: 'Build a two-line log with > then >>.',
    learn: [
      '`>>` opens without truncating — safe for logs and history files.',
      'Order matters: `>` creates, `>>` grows.',
      'Many daemons append to `/var/log/*` the same way (or via journald).',
    ],
    hint: 'echo one > notes.log then echo two >> notes.log',
    par: 2,
    solution: 'echo one > notes.log; echo two >> notes.log',
    steps: [
      { command: 'echo one > notes.log', note: 'Create with first line' },
      { command: 'echo two >> notes.log', note: 'Append second line' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        '>> vs >',
        'If you use `>` twice, the first line is gone.\n\nWrite `one` to **`notes.log`**, then **append** `two` so the file holds both lines in that order.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/notes.log');
      if (!n) return false;
      const lines = (n.content || '').trim().split('\n');
      return lines[0] === 'one' && lines[1] === 'two';
    },
  },
  {
    id: 'text-exit-code',
    sequence: 'text',
    name: 'Exit codes',
    objective: 'Observe true/false as process exit status.',
    learn: [
      'Every command returns an **exit status** 0–255 (`$?` after it).',
      '`true` → 0, `false` → 1. Scripts branch with `if`, `&&`, `||`.',
      'grep uses 0/1 for match/no-match — useful in conditionals.',
      'LPIC: understand why `cmd && next` skips `next` on failure.',
    ],
    hint: 'Run `true` then `false` (session meta shows codes in future shells). Here run both.',
    par: 2,
    solution: 'true; false',
    steps: [
      { command: 'true', note: 'Exit status 0' },
      { command: 'false', note: 'Exit status 1' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Exit status',
        'A process tells its parent how it went via **wait status**. The shell maps that to `$?`.\n\nRun **`true`** and **`false`**. On a real Ubuntu terminal try `echo $?` after each.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /(^|;|\s)true(\s|;|$)/.test(h)) &&
      session.history.some((h) => /(^|;|\s)false(\s|;|$)/.test(h)),
  },

  // ─── permissions ─────────────────────────────────────────
  {
    id: 'perm-ls-l',
    sequence: 'permissions',
    name: 'Read the mode',
    objective: 'Decode rwxrwxrwx in ls -l.',
    learn: [
      '`ls -l` columns: mode, links, owner, group, size, mtime, name.',
      'Mode is **9 bits**: user / group / other × read/write/execute.',
      'Execute on a directory means “may `cd` and list with rights”.',
      'First char: `-` file, `d` dir, `l` symlink (see links level).',
    ],
    hint: 'ls -l',
    par: 1,
    solution: 'ls -l',
    steps: [{ command: 'ls -l', note: 'Long format with permission bits' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'run.sh': { type: 'file', mode: 0o644, owner: 'ubuntu', content: '#!/bin/bash\necho hi\n' },
      }),
    },
    dialog: [
      modal(
        'ls -l',
        'Example: `-rw-r--r-- 1 ubuntu ubuntu 18 … run.sh`\n\nThat is `644` in octal: owner write, everyone read. **Execute is off** — the kernel will refuse `./run.sh`.\n\nInspect your home listing.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\bls\b/.test(h) && h.includes('-l')),
  },
  {
    id: 'perm-chmod-x',
    sequence: 'permissions',
    name: 'Make it executable',
    objective: 'Turn on the execute bit with chmod.',
    learn: [
      '`chmod +x` adds execute for the chosen class (default all, masked by umask rules).',
      'Scripts need `x` and a shebang (`#!/bin/bash`) to run as `./run.sh`.',
      'Direct files: `x` means “this is a program”, not “you may read it”.',
    ],
    hint: 'chmod +x run.sh  or  chmod 755 run.sh',
    par: 1,
    solution: 'chmod +x run.sh',
    steps: [{ command: 'chmod +x run.sh', note: 'Owner (and classes) get execute' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'run.sh': { type: 'file', mode: 0o644, owner: 'ubuntu', content: '#!/bin/bash\necho hi\n' },
      }),
    },
    dialog: [
      modal(
        'chmod +x',
        'Without `x`, bash will not execute the file via path (you can still `bash run.sh`).\n\nSet execute on **`run.sh`**. Confirm with `ls -l` (`x` in the first column).'
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
    objective: 'Set 600 on a private key.',
    learn: [
      'Octal digits: **4=r, 2=w, 1=x** — sum per class. `6=rw-`, `7=rwx`, `4=r--`.',
      '`chmod 600 file` = owner rw, group/other none — SSH key requirement.',
      'SSH refuses group/world-readable private keys (`Permissions 0644 are too open`).',
    ],
    hint: 'chmod 600 .ssh/id_rsa',
    par: 1,
    solution: 'chmod 600 .ssh/id_rsa',
    steps: [{ command: 'chmod 600 .ssh/id_rsa', note: 'rw------- for owner only' }],
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
        'Think in 3 digits: `600` → `rw-` `---` `---`.\n\nLock **`.ssh/id_rsa`** to `600`. Directory `.ssh` should stay `700`.'
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
    objective: 'Use chmod go-w without touching user write.',
    learn: [
      'Symbolic form: `[ugoa][+-=][rwx]` — e.g. `go-w`, `u+x`, `a=r`.',
      'Relative (`+/-`) keeps unrelated bits; absolute (`664`) sets the whole mask.',
      'Common hardening: `go-w` on shared dropboxes; `g+s` for group inheritance (later).',
    ],
    hint: 'chmod go-w shared.txt',
    par: 1,
    solution: 'chmod go-w shared.txt',
    steps: [{ command: 'chmod go-w shared.txt', note: 'Strip write for group and other only' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'shared.txt': { type: 'file', mode: 0o666, owner: 'ubuntu', content: 'team notes\n' },
      }),
    },
    dialog: [
      modal(
        'Symbolic chmod',
        '`go-w` means: group (`g`) and other (`o`), remove (`-`) write.\n\nOn **`shared.txt`** (starts `666`), keep **user write**, drop write for group and other.'
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
  {
    id: 'perm-setuid',
    sequence: 'permissions',
    name: 'Special bits (knowledge)',
    objective: 'Run chmod u+s and read what setuid means.',
    learn: [
      'Extra mode bits: **setuid (4000)**, **setgid (2000)**, **sticky (1000)**.',
      'setuid on a binary: runs as the **file owner** (often root) — e.g. `/usr/bin/passwd`.',
      'sticky on a directory (`/tmp`): only owner deletes their files.',
      'Security: never setuid a shell script casually — classic privesc footgun.',
    ],
    hint: 'chmod u+s run.sh  (and read the learn panel)',
    par: 1,
    solution: 'chmod u+s run.sh',
    steps: [{ command: 'chmod u+s run.sh', note: 'Set the setuid bit on the script' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'run.sh': { type: 'file', mode: 0o755, owner: 'ubuntu', content: '#!/bin/bash\necho hi\n' },
      }),
    },
    dialog: [
      modal(
        'setuid / setgid / sticky',
        'These bits show as `s`/`S` and `t`/`T` in `ls -l`.\n\n| Bit | Octal | Effect |\n|-----|-------|--------|\n| setuid | 4000 | exec as owner |\n| setgid | 2000 | exec as group / dir inherit |\n| sticky | 1000 | restricted delete on dirs |\n\nApply **`chmod u+s run.sh`** to feel the API. On a real box, check `ls -l /usr/bin/passwd` and `ls -ld /tmp`.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/run.sh');
      // u+s in our model: set execute high bit via chmod u+s → we map to user x already
      // Detect symbolic setuid request in history instead (simplified VFS).
      return !!n;
    },
    // override after: history-based
  },
  {
    id: 'perm-umask',
    sequence: 'permissions',
    name: 'umask habits',
    objective: 'Create a file and infer the default mask.',
    learn: [
      '**umask** is the bits *removed* from the default (777 / 666) at create time.',
      'Typical Ubuntu interactive umask: `022` → dirs `755`, files `644`.',
      'Shared homes sometimes use `002` (group-writable).',
      'Check with `umask` on a real shell; set with `umask 027` in scripts.',
    ],
    hint: 'touch newfile.txt then ls -l',
    par: 2,
    solution: 'touch newfile.txt; ls -l',
    steps: [
      { command: 'touch newfile.txt', note: 'Create with default mask' },
      { command: 'ls -l', note: 'Observe -rw-r--r-- (644)' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'umask',
        'Create a file and inspect its mode. Expect **`644`** if umask is `022`.\n\nCreate **`newfile.txt`** and list long format to confirm.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /touch\s+.*newfile\.txt/.test(h)) &&
      session.history.some((h) => /\bls\b/.test(h) && h.includes('-l')),
  },

  // ─── processes ───────────────────────────────────────────
  {
    id: 'proc-ps',
    sequence: 'processes',
    name: 'List processes',
    objective: 'Snapshot the process table with ps.',
    learn: [
      'A process = PID + address space + credentials + open files.',
      '`ps` reads `/proc` (procfs). `ps aux` is the BSD-style everyone uses.',
      'STAT: `S` sleeping, `R` running, `Z` zombie, `T` stopped.',
      'Parent (PPID 1) is `systemd` — it reaps orphans.',
    ],
    hint: 'ps',
    par: 1,
    solution: 'ps',
    steps: [{ command: 'ps', note: 'Snapshot processes' }],
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
        'The right panel is a live process table. The terminal `ps` shows the same idea.\n\nRun **`ps`** once and find `backup.sh` and `bash`.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim() === 'ps' || h.trim().startsWith('ps ')),
  },
  {
    id: 'proc-kill',
    sequence: 'processes',
    name: 'Kill the runaway',
    objective: 'Send SIGTERM (or SIGKILL) to a burning process.',
    learn: [
      '`kill PID` sends **SIGTERM** (15) — polite request to exit.',
      '`kill -9 PID` sends **SIGKILL** — immediate, uncatchable (last resort).',
      'You can only signal your own processes unless you are root.',
      'PID 1 cannot be killed from userspace in the normal way.',
    ],
    hint: 'ps to find the PID of backup.sh, then kill <pid>',
    par: 2,
    solution: 'ps; kill <pid>',
    steps: [
      { command: 'ps', note: 'Find PID of backup.sh' },
      { command: 'kill <pid>', note: 'Terminate backup.sh only' },
    ],
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
        '**`backup.sh`** is burning CPU. Find its PID with `ps`, then terminate it.\n\nLeave **`nginx: worker`** alone. You cannot kill PID 1 or your shell (PID 42 in this sim).'
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
    name: 'Background jobs',
    objective: 'List shell jobs with jobs.',
    learn: [
      'Jobs are processes started from *this* shell (pipeline / bg).',
      '`jobs`, `fg`, `bg`, `Ctrl+Z` manage job control in bash.',
      'Daemons are **not** jobs — they are detached (systemd services).',
    ],
    hint: 'jobs',
    par: 1,
    solution: 'jobs',
    steps: [{ command: 'jobs', note: 'List background jobs' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree(),
      processes: [
        { cmd: 'encode.sh', user: 'ubuntu', state: 'R', cpu: 12.0, mem: 3.1 },
        { cmd: 'sync.sh', user: 'ubuntu', state: 'S', cpu: 0.2, mem: 0.3 },
      ],
    },
    dialog: [
      modal('jobs', 'Inspect shell jobs with **`jobs`**.'),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('jobs')),
  },

  // ─── system ──────────────────────────────────────────────
  {
    id: 'sys-find',
    sequence: 'system',
    name: 'Find a file',
    objective: 'Walk the tree with find -name.',
    learn: [
      '`find PATH -name PATTERN` recursively walks directories.',
      'PATTERN is a glob (`*.log`), not a full regex — quote it (`\'*.log\'`).',
      'Combine with `-type f`, `-mtime`, `-exec` (carefully).',
      'FHS reminder: user logs under home or `/var/log`.',
    ],
    hint: 'find . -name "*.log"',
    par: 1,
    solution: 'find . -name "*.log"',
    steps: [{ command: 'find . -name "*.log"', note: 'Locate log files under home' }],
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
        'Search is a tree walk + predicate. Name is the simplest predicate.\n\nLocate every **`*.log`** under your home (`.`).'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\bfind\b/.test(h) && /\.log/.test(h)),
  },
  {
    id: 'sys-df',
    sequence: 'system',
    name: 'Disk free',
    objective: 'Report filesystem usage with df.',
    learn: [
      '`df` shows mount points and free space per filesystem.',
      '“Disk full” can be inodes, not bytes (`df -i`).',
      'Compare with `du` which sums file sizes in a tree.',
    ],
    hint: 'df',
    par: 1,
    solution: 'df',
    steps: [{ command: 'df', note: 'Filesystem disk space' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal('df', 'Check free space on mounted filesystems with **`df`**.'),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('df')),
  },
  {
    id: 'sys-du',
    sequence: 'system',
    name: 'Directory size',
    objective: 'Measure a tree with du.',
    learn: [
      '`du` estimates disk usage (blocks actually used).',
      '`du -sh dir` human summary; `du -sh * | sort -h` finds fat directories.',
      'Differs from `ls -l` size (logical bytes).',
    ],
    hint: 'du projects',
    par: 1,
    solution: 'du projects',
    steps: [{ command: 'du projects', note: 'Size of projects tree' }],
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
      modal('du', 'Measure usage of **`projects`** with `du`.'),
    ],
    check: (fs, session) => session.history.some((h) => /\bdu\b/.test(h) && /projects/.test(h)),
  },
  {
    id: 'sys-uname',
    sequence: 'system',
    name: 'Kernel identity',
    objective: 'Print the full kernel string with uname -a.',
    learn: [
      '`uname` = Unix name. `-r` kernel release, `-m` machine, `-a` all.',
      'Also read `/etc/os-release` for the distro (Ubuntu vs kernel).',
      'Package builds and driver installs key off these strings.',
    ],
    hint: 'uname -a',
    par: 1,
    solution: 'uname -a',
    steps: [{ command: 'uname -a', note: 'Full kernel/host identity' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'uname',
        'Kernel ≠ distribution. `uname -a` is kernel/arch; **`/etc/os-release`** is Ubuntu.\n\nPrint the full **`uname -a`** line.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\buname\b/.test(h) && h.includes('-a')),
  },
  {
    id: 'sys-links',
    sequence: 'system',
    name: 'Hard vs soft links',
    objective: 'Copy vs understand link counts in ls -l.',
    learn: [
      'A **hard link** is another name for the same inode (same data).',
      'A **soft/symbolic link** is a path string (can cross filesystems, can dangle).',
      '`ln target link` hard; `ln -s target link` symbolic.',
      '`ls -l` link count (second column) = number of hard links.',
    ],
    hint: 'cp notes.txt notes-copy.txt  then ls -l (observe two files)',
    par: 2,
    solution: 'cp notes.txt notes-copy.txt; ls -l',
    steps: [
      { command: 'cp notes.txt notes-copy.txt', note: 'Independent copy (new inode)' },
      { command: 'ls -l', note: 'Compare sizes and names' },
    ],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'notes.txt': { type: 'file', owner: 'ubuntu', content: 'shared body\n' },
      }),
    },
    dialog: [
      modal(
        'Links and inodes',
        'This sim’s `cp` always makes a new file. On a real system also try:\n\n```\nln notes.txt hard-notes\nln -s notes.txt soft-notes\nls -l\n```\n\nHard: delete one name, data lives until last name is gone. Soft: target path only.\n\nFor this level, make a **copy** `notes-copy.txt` and list long format.'
      ),
    ],
    check: (fs) => {
      const a = fs.get('/home/ubuntu/notes.txt');
      const b = fs.get('/home/ubuntu/notes-copy.txt');
      return !!a && !!b;
    },
  },
  {
    id: 'sys-fhs',
    sequence: 'system',
    name: 'FHS tour',
    objective: 'Locate key FHS directories with ls.',
    learn: [
      '**FHS**: `/bin` essential binaries, `/sbin` admin, `/etc` config, `/var` variable data.',
      '`/usr` secondary hierarchy (almost all packages). `/home` user trees.',
      '`/tmp` sticky shared temp. `/boot` kernels. `/dev` device nodes.',
      'LPIC: know where to find `passwd`, `fstab`, `os-release`, `syslog`.',
    ],
    hint: 'ls /etc  and  ls /var/log',
    par: 2,
    solution: 'ls /etc; ls /var/log',
    steps: [
      { command: 'ls /etc', note: 'System configuration' },
      { command: 'ls /var/log', note: 'Logs and variable data' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Filesystem Hierarchy Standard',
        '| Path | Role |\n|------|------|\n| `/bin`, `/usr/bin` | user commands |\n| `/sbin` | system admin |\n| `/etc` | config files |\n| `/var/log` | logs |\n| `/home` | user homes |\n| `/tmp` | temporary |\n\nList **`/etc`** and **`/var/log`** to ground the map in real names.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bls\b/.test(h) && /\/etc/.test(h)) &&
      session.history.some((h) => /\bls\b/.test(h) && /\/var\/log/.test(h)),
  },
  {
    id: 'sys-env',
    sequence: 'system',
    name: 'Environment',
    objective: 'Echo PATH and HOME.',
    learn: [
      'Environment variables are `KEY=value` strings inherited by children.',
      '`$PATH` is the executable search path (`:`-separated).',
      '`$HOME`, `$USER`, `$PWD` are standard. Set with `export NAME=val`.',
      'Shell init: `/etc/profile`, `~/.bashrc`, `~/.profile`.',
    ],
    hint: 'echo $HOME  and  echo $PATH',
    par: 2,
    solution: 'echo $HOME; echo $PATH',
    steps: [
      { command: 'echo $HOME', note: 'Home directory' },
      { command: 'echo $PATH', note: 'Executable search path' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Environment',
        'Our echo is simple — on bash `$HOME` expands before echo runs.\n\nPrint **`$HOME`** and **`$PATH`** (use those tokens literally in the sim; on Ubuntu type `echo $HOME`).'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /echo\s+.*HOME/.test(h)) &&
      session.history.some((h) => /echo\s+.*PATH/.test(h)),
  },
  {
    id: 'sys-users',
    sequence: 'system',
    name: 'Users and groups',
    objective: 'Read /etc/passwd and /etc/group with cat.',
    learn: [
      '`/etc/passwd`: `name:x:UID:GID:GECOS:home:shell`.',
      '`/etc/group`: `name:x:GID:members`.',
      'Passwords live in `/etc/shadow` (root-only). `x` in passwd points there.',
      'Admin tools: `useradd`, `usermod`, `userdel`, `passwd`, `id`, `groups`.',
    ],
    hint: 'cat /etc/passwd  and  cat /etc/group',
    par: 2,
    solution: 'cat /etc/passwd; cat /etc/group',
    steps: [
      { command: 'cat /etc/passwd', note: 'User account database' },
      { command: 'cat /etc/group', note: 'Group database' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'passwd and group',
        'Every `whoami` name is a row in **`/etc/passwd`**.\n\nRead **`/etc/passwd`** and **`/etc/group`**. Spot UID 0 (root) and UID 1000 (ubuntu).'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bcat\b/.test(h) && /passwd/.test(h)) &&
      session.history.some((h) => /\bcat\b/.test(h) && /group/.test(h)),
  },
  {
    id: 'sys-packages',
    sequence: 'system',
    name: 'apt (read)',
    objective: 'Simulate apt cache / package tree awareness.',
    learn: [
      'Ubuntu uses **dpkg + apt** (Debian family). Red Hat uses rpm/dnf.',
      '`apt update` refreshes indexes; `apt install/remove/purge` change packages.',
      'Config remnants: `purge` vs `remove`. Sources: `/etc/apt/sources.list`.',
      'Our sim exposes package dirs under `/var/lib/apt` — walk them with `find`.',
    ],
    hint: 'find /var/lib/apt -type d  or  ls /var/cache/apt',
    par: 2,
    solution: 'ls /var/cache/apt; ls /var/lib/apt',
    steps: [
      { command: 'ls /var/cache/apt', note: 'apt cache directory' },
      { command: 'ls /var/lib/apt', note: 'apt state directory' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Package management locations',
        'A full `apt install` needs a network and root — here we map the **filesystem layout** apt uses.\n\nList **`/var/cache/apt`** and **`/var/lib/apt`**. On a real Ubuntu box the next step is `sudo apt update && apt policy bash`.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bls\b/.test(h) && /cache\/apt|var\/cache/.test(h)) &&
      session.history.some((h) => /\bls\b/.test(h) && /lib\/apt|var\/lib/.test(h)),
  },
  {
    id: 'sys-capstone',
    sequence: 'system',
    name: 'Capstone pipeline',
    objective: 'grep | wc > file — compose the whole day.',
    learn: [
      'Combine filters and redirection the way ops scripts do.',
      'Count ERROR lines and store the number for a report.',
      'Same pattern as `grep -c` (which you may also use later).',
    ],
    hint: 'grep ERROR app.log | wc -l > error_count.txt',
    par: 3,
    solution: 'grep ERROR app.log | wc -l > error_count.txt',
    steps: [
      { command: 'grep ERROR app.log', note: 'Filter' },
      { command: 'grep ERROR app.log | wc -l', note: 'Count' },
      { command: 'grep ERROR app.log | wc -l > error_count.txt', note: 'Store count in a file' },
    ],
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
        'Ops day-one: **count and save**.\n\nCount **ERROR** lines in `app.log` and **redirect** that count into **`error_count.txt`** (content should be `2`). Use a pipe and `>`.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/error_count.txt');
      return !!n && (n.content || '').trim() === '2';
    },
  },
];

// Sticky checklist for setuid level uses history
const suidLevel = levels.find((l) => l.id === 'perm-setuid');
if (suidLevel) {
  suidLevel.check = (fs, session) =>
    session.history.some((h) => /chmod\s+.*u\+s/.test(h) || /chmod\s+[45]7/.test(h) || /chmod\s+47/.test(h));
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
    about: 'Identity, paths, listing, navigation, stdout — first contact with the shell.',
  },
  {
    id: 'files',
    name: 'Files & directories',
    about: 'Inodes and names: mkdir, touch, cat, cp, mv, rm (FHS-aware).',
  },
  {
    id: 'text',
    name: 'Text, streams & pipes',
    about: 'Filters, redirection, append, exit codes — the Unix composition model.',
  },
  {
    id: 'permissions',
    name: 'Permissions',
    about: 'rwx bits, octal vs symbolic chmod, setuid/setgid/sticky, umask.',
  },
  {
    id: 'processes',
    name: 'Processes & signals',
    about: 'ps, jobs, kill — PIDs, states, SIGTERM vs SIGKILL.',
  },
  {
    id: 'system',
    name: 'System & FHS',
    about: 'find, df, du, uname, links, env, passwd/group, apt layout, capstone.',
  },
];

/**
 * @param {string} sequenceId
 * @returns {any[]}
 */
export function levelsIn(sequenceId) {
  return levels.filter((l) => l.sequence === sequenceId);
}

/**
 * @param {string} id
 */
export function getLevel(id) {
  return levels.find((l) => l.id === id);
}
