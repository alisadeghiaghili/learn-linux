/**
 * Core command levels: navigation, files, basic text — deepened.
 */

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
                sed: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
                awk: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
                curl: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
              },
            },
            sbin: {
              type: 'dir',
              owner: 'root',
              children: {
                useradd: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
                systemctl: { type: 'file', mode: 0o755, owner: 'root', content: '#!/bin/bash\n' },
              },
            },
            local: { type: 'dir', owner: 'root', children: { bin: { type: 'dir', owner: 'root' } } },
          },
        },
        etc: {
          type: 'dir',
          owner: 'root',
          children: {
            hostname: { type: 'file', owner: 'root', content: 'learn\n' },
            hosts: { type: 'file', owner: 'root', content: '127.0.0.1 localhost\n127.0.1.1 learn\n' },
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
            fstab: {
              type: 'file',
              owner: 'root',
              content: 'UUID=root / ext4 errors=remount-ro 0 1\n/dev/sda2 /home ext4 defaults 0 2\n',
            },
            'os-release': {
              type: 'file',
              owner: 'root',
              content: 'NAME="Ubuntu"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\n',
            },
            'login.defs': { type: 'file', owner: 'root', content: 'UMASK 022\nPASS_MAX_DAYS 99999\n' },
          },
        },
        opt: { type: 'dir', owner: 'root' },
        mnt: { type: 'dir', owner: 'root' },
        media: { type: 'dir', owner: 'root' },
        tmp: { type: 'dir', mode: 0o1777, owner: 'root' },
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
                  content: 'Jan  1 00:00:01 learn systemd[1]: Started Session.\nJan  1 00:00:02 learn kernel: Linux version 6.8.0\n',
                },
                'auth.log': {
                  type: 'file',
                  owner: 'root',
                  content: 'Jan  1 00:10:00 learn sudo: ubuntu : TTY=pts/0 ; USER=root ; COMMAND=/usr/bin/apt update\n',
                },
              },
            },
            cache: { type: 'dir', owner: 'root', children: { apt: { type: 'dir', owner: 'root' } } },
            lib: { type: 'dir', owner: 'root', children: { apt: { type: 'dir', owner: 'root' }, dpkg: { type: 'dir', owner: 'root' } } },
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
                '.bashrc': { type: 'file', owner: 'ubuntu', content: 'export PS1="\\u@\\h:\\w$ "\nexport EDITOR=nano\n' },
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

export const homeTreeSpec = homeTree;
export const coreLevels = [
  {
    id: 'intro-whoami',
    sequence: 'intro',
    name: 'Who am I?',
    objective: 'Identify the user account your shell runs as.',
    learn: [
      'Linux is multi-user and multi-tasking: every process carries an effective UID.',
      '`whoami` prints the **effective user name** (resolved from /etc/passwd).',
      'Prompt `\\u@\\h:\\w\\$` = user@host:cwd — `#` appears for root.',
      '`id` prints numeric UID/GID and supplementary groups — more precise than whoami.',
      'LPIC 101.3 / 107.1: understand users, groups, and the root superuser (UID 0).',
    ],
    mistakes: ['Confusing hostname with username', 'Assuming the prompt means you are root when `$` is shown'],
    hint: 'Type `whoami` and press Enter.',
    par: 1,
    solution: 'whoami',
    steps: [{ command: 'whoami', note: 'Print the current user name' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Users and identity',
        'Every login maps to a user in **`/etc/passwd`**. The kernel tracks processes by numeric UID; tools resolve that to a name for humans.\n\nYou are **`ubuntu`** (UID 1000 on a typical Ubuntu desktop). `root` (UID 0) bypasses DAC permission checks — that is why least-privilege matters.\n\n`whoami` answers one question: *which account is my shell running as right now?* Not “who logged in” (`logname`), not “what is my home” (`echo $HOME`).'
      ),
      demo(
        'Run the demo. Output is a name — that name decides file ownership, package installs, and service control.',
        'whoami',
        'On Ubuntu the first admin user is often `ubuntu` and is in the `sudo` group. Keep this identity in mind for `ls -l`, `chmod`, and `sudo` later.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('whoami')),
  },
  {
    id: 'intro-id',
    sequence: 'intro',
    name: 'UID and groups',
    objective: 'Read numeric identity with id.',
    learn: [
      '`id` → `uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),27(sudo)`.',
      'Primary group vs supplementary groups both gate file access.',
      'Permission checks use numbers, not names — NSS maps them.',
      'LPIC 107.1: manage user/group identity awareness.',
    ],
    mistakes: ['Reading only whoami and missing secondary groups like sudo'],
    hint: 'id',
    par: 1,
    solution: 'id',
    steps: [{ command: 'id', note: 'UID/GID and groups' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'id',
        '`whoami` is the name. **`id`** is the full identity: primary UID/GID plus every supplementary group.\n\nBeing in **`sudo`** (or `wheel` on RH) means the sudoers policy may elevate you — not that you are root all the time.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('id')),
  },
  {
    id: 'intro-pwd',
    sequence: 'intro',
    name: 'Where am I?',
    objective: 'Print the absolute path of the working directory.',
    learn: [
      'A process always has a **cwd** (current working directory) in its task struct.',
      '`pwd` prints the **absolute** path (starts at `/`).',
      'Relative paths resolve against cwd; absolute paths ignore cwd.',
      'There is one root `/` — no drive letters (unlike Windows).',
      'Scripts and cron do not share your interactive cwd — always know where you are.',
    ],
    mistakes: ['Writing scripts that assume cwd without `cd "$(dirname "$0")"`'],
    hint: 'pwd',
    par: 1,
    solution: 'pwd',
    steps: [{ command: 'pwd', note: 'Absolute path of cwd' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Working directory',
        'The shell sits somewhere in a single tree: **`/`**.\n\nHome for user `ubuntu` is **`/home/ubuntu`** (`$HOME`). `cd` changes the cwd; `pwd` only *reports* it. `PWD` env var is a convenience copy — the kernel truth is the process cwd.'
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
      '`ls` lists names in a directory inode (not file contents).',
      'Names starting with `.` are hidden from plain `ls` — use **`-a`** (or `-A` to skip `.`/`..`).',
      '`-l` adds mode, links, owner, group, size, mtime.',
      '`-t` sorts by mtime, `-r` reverses, `-R` recurses, `-h` human sizes.',
      'Dotfiles are configuration (`~/.bashrc`, `~/.ssh/config`) — hidden ≠ secret.',
    ],
    mistakes: ['`ls -l /etc/something.conf` on a directory instead of the dir path', 'Forgetting `-a` when looking for `.git` or `.env`'],
    hint: 'ls -a',
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
        'A directory is a table of names → inodes. `ls` reads that table.\n\nFind **both** `readme.md` and `.secret`. On a real box, `ls -la` is the reflex before any `rm`.'
      ),
    ],
    check: (fs, session) =>
      session.history.some((h) => /\bls\b/.test(h) && (h.includes('-a') || h.includes('-la') || h.includes('-al'))),
  },
  {
    id: 'intro-ls-l',
    sequence: 'intro',
    name: 'Long listing',
    objective: 'Decode ls -l columns and rwx bits.',
    learn: [
      'Columns: **mode, links, owner, group, size, mtime, name**.',
      'Mode: type char (`-` file, `d` dir, `l` symlink) + 9 rwx bits + optional setuid/sticky.',
      'Links count = hard links (dirs count subdirs on classic Unix).',
      'Size for dirs is the dirent table size (often 4096), not recursive bytes (`du`).',
    ],
    mistakes: ['Reading directory size as “folder weight”'],
    hint: 'ls -l',
    par: 1,
    solution: 'ls -l',
    steps: [{ command: 'ls -l', note: 'Long format' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'run.sh': { type: 'file', mode: 0o644, owner: 'ubuntu', content: '#!/bin/bash\necho hi\n' },
      }),
    },
    dialog: [
      modal(
        'ls -l anatomy',
        'Example: `-rw-r--r-- 1 ubuntu ubuntu 18 … run.sh`\n\n`644` in octal = owner write, everyone read. Execute off. Compare with `drwxr-xr-x` for directories.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\bls\b/.test(h) && h.includes('-l')),
  },
  {
    id: 'intro-cd',
    sequence: 'intro',
    name: 'Change directory',
    objective: 'Navigate with cd, .., ~, and absolute paths.',
    learn: [
      '`cd DIR` sets the process cwd (a path resolution + chdir syscall).',
      '`cd ..` parent · `cd`/`cd ~` home · `cd /` root · `cd -` previous · `cd ~user`.',
      'Tab completion fills path segments — here Tab completes the current word.',
      'FHS: user work under `/home/<user>`, admin tools `/usr/sbin`, config `/etc`.',
    ],
    mistakes: ['`cd /etc/passwd` (file, not dir)', 'Assuming `cd` without args goes to `/`'],
    hint: 'cd projects',
    par: 1,
    solution: 'cd projects',
    steps: [{ command: 'cd projects', note: 'Enter projects/' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        projects: {
          type: 'dir',
          owner: 'ubuntu',
          children: { 'app.py': { type: 'file', owner: 'ubuntu', content: 'print("hi")\n' } },
        },
      }),
    },
    dialog: [
      modal(
        'Navigation',
        '| Form | Meaning |\n|------|---------|\n| `projects` | relative to cwd |\n| `/etc/passwd` | absolute |\n| `../logs` | parent + logs |\n| `~/notes` | home/notes |\n\nMove into **`projects`** and stay there.'
      ),
    ],
    check: (fs) => fs.cwd === '/home/ubuntu/projects',
  },
  {
    id: 'intro-echo',
    sequence: 'intro',
    name: 'Speak, shell',
    objective: 'Print text with echo; understand stdout and quoting.',
    learn: [
      'Three standard streams: **stdin 0, stdout 1, stderr 2**.',
      '`echo` writes to **stdout**. Redirection `>`/`2>`/`|` attaches those fds.',
      'Quoting: `"..."` expands vars/globs; `\'...\'` literal; unquoted splits on IFS.',
      'Exit codes: `0` success, `1–255` failure (`$?`).',
    ],
    mistakes: ['Unquoted `$var` word-splitting and globbing', 'Using echo for anything binary (use printf)'],
    hint: 'echo "hello ubuntu"',
    par: 1,
    solution: 'echo hello ubuntu',
    steps: [{ command: 'echo hello ubuntu', note: 'stdout only' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'echo and streams',
        'The Unix model: small programs, text streams, composition.\n\nPrint **`hello ubuntu`**. Try `"hello ubuntu"` vs `hello ubuntu` spacing in your head — both work here because echo joins args with one space.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /echo\s+.*hello\s+ubuntu/i.test(h)),
  },
  {
    id: 'files-mkdir',
    sequence: 'files',
    name: 'Make a directory',
    objective: 'Create a directory node with mkdir.',
    learn: [
      '`mkdir NAME` creates a dirent + inode of type directory.',
      'You need **write+execute** on the parent to create children.',
      '`mkdir -p` creates missing parents and is idempotent (scripts/CI).',
      'Mode of new dirs is `0777 & ~umask` (typically 755).',
    ],
    mistakes: ['mkdir in a directory without w+x', 'Not using -p in provisioning scripts'],
    hint: 'mkdir notes',
    par: 1,
    solution: 'mkdir notes',
    steps: [{ command: 'mkdir notes', note: 'Create notes/' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal('mkdir', 'Create **`notes`** under `/home/ubuntu`. Watch the tree grow.'),
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
      '`touch` creates empty file if missing, else updates **mtime** (and ctime).',
      'Data lives in blocks; metadata in the inode.',
      'Default Ubuntu umask `022` → files `644`, dirs `755`.',
      '`touch` is the cheapest way to reserve a path for a later write.',
    ],
    mistakes: ['Expecting touch to write content (use `echo >` or a real editor)'],
    hint: 'touch notes/todo.txt',
    par: 1,
    solution: 'touch notes/todo.txt',
    steps: [{ command: 'touch notes/todo.txt', note: 'Empty file inside notes/' }],
    start: { cwd: '/home/ubuntu', tree: homeTree({ notes: { type: 'dir', owner: 'ubuntu', children: {} } }) },
    dialog: [
      modal('touch', 'Create **`notes/todo.txt`**. Empty file ≠ missing file.'),
    ],
    check: (fs) => !!fs.get('/home/ubuntu/notes/todo.txt'),
  },
  {
    id: 'files-cat',
    sequence: 'files',
    name: 'Read a file',
    objective: 'Dump file contents to stdout with cat.',
    learn: [
      '`cat` *concatenates* files to stdout (historical name).',
      'Directories: `cat dir` → `Is a directory`.',
      'Large files: `less`/`more`; never `cat huge.log` in production.',
      'Everything is a file: configs in `/etc`, logs in `/var/log` (or journal).',
    ],
    mistakes: ['cat a directory', 'Using cat when `head`/`grep` would be enough'],
    hint: 'cat notes/todo.txt',
    par: 1,
    solution: 'cat notes/todo.txt',
    steps: [{ command: 'cat notes/todo.txt', note: 'Print contents' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        notes: {
          type: 'dir',
          owner: 'ubuntu',
          children: { 'todo.txt': { type: 'file', owner: 'ubuntu', content: 'buy milk\nship feature\n' } },
        },
      }),
    },
    dialog: [modal('cat', 'Print **`notes/todo.txt`**.')],
    check: (fs, session) => session.history.some((h) => /\bcat\b/.test(h) && /todo\.txt/.test(h)),
  },
  {
    id: 'files-mkdir-p',
    sequence: 'files',
    name: 'Nested paths',
    objective: 'Create a multi-level tree with mkdir -p.',
    learn: ['`mkdir -p a/b/c` = create parents as needed, no error if exists.', 'Idempotent = safe to re-run in Ansible/cron.'],
    mistakes: ['Three mkdir calls when -p does it in one'],
    hint: 'mkdir -p src/app/components',
    par: 1,
    solution: 'mkdir -p src/app/components',
    steps: [{ command: 'mkdir -p src/app/components', note: 'Full path in one shot' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('mkdir -p', 'Create **`src/app/components`** in one command.')],
    check: (fs) => !!fs.get('/home/ubuntu/src/app/components'),
  },
  {
    id: 'files-cp',
    sequence: 'files',
    name: 'Copy',
    objective: 'Duplicate a file with cp.',
    learn: [
      '`cp SRC DEST` = new inode, same content (unless `-l` hard-link copy).',
      'Directories need `cp -r` (recursive) or `-a` (archive: preserve metadata).',
      'Default `cp` overwrites without prompt — `cp -i` is interactive.',
      'Copy ≠ link: later `ln` levels show shared inodes.',
    ],
    mistakes: ['cp -r without noticing overwrite', 'Expecting cp to keep mode/owner without -p/-a'],
    hint: 'cp report.txt backup.txt',
    par: 1,
    solution: 'cp report.txt backup.txt',
    steps: [{ command: 'cp report.txt backup.txt', note: 'Duplicate' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({ 'report.txt': { type: 'file', owner: 'ubuntu', content: 'Q1 numbers\n' } }),
    },
    dialog: [modal('cp', 'Copy **`report.txt`** → **`backup.txt`**.')],
    check: (fs) => {
      const a = fs.get('/home/ubuntu/report.txt');
      const b = fs.get('/home/ubuntu/backup.txt');
      return !!a && !!b && a.content === b.content;
    },
  },
  {
    id: 'files-mv',
    sequence: 'files',
    name: 'Move / rename',
    objective: 'Rename or relocate with mv.',
    learn: [
      'Same filesystem: `mv` is usually **rename** (same inode, new dirent).',
      'Across mounts: copy + unlink (different devices).',
      'Atomic replace pattern: write `file.tmp` then `mv` onto target.',
    ],
    mistakes: ['mv across filesystems expecting instant rename'],
    hint: 'mv draft.txt final.txt',
    par: 1,
    solution: 'mv draft.txt final.txt',
    steps: [{ command: 'mv draft.txt final.txt', note: 'Rename' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({ 'draft.txt': { type: 'file', owner: 'ubuntu', content: 'draft body\n' } }),
    },
    dialog: [modal('mv', 'Rename **`draft.txt`** → **`final.txt`**. Old name must vanish.')],
    check: (fs) => !fs.get('/home/ubuntu/draft.txt') && !!fs.get('/home/ubuntu/final.txt'),
  },
  {
    id: 'files-rm',
    sequence: 'files',
    name: 'Remove carefully',
    objective: 'Delete one file without touching the other.',
    learn: [
      '`rm` unlinks a name; blocks free when last link/open fd drops.',
      'Dirs: `rm -r`; `-f` force/no errors; `rm -rf /` is the classic footgun.',
      'No trash CLI. On this sim `undo` exists — Ubuntu does not.',
    ],
    mistakes: ['rm * in the wrong directory', 'Using -f to hide a real path bug'],
    hint: 'rm junk.txt',
    par: 1,
    solution: 'rm junk.txt',
    steps: [{ command: 'rm junk.txt', note: 'Only junk.txt' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'junk.txt': { type: 'file', owner: 'ubuntu', content: 'temp\n' },
        'keep.txt': { type: 'file', owner: 'ubuntu', content: 'important\n' },
      }),
    },
    dialog: [modal('rm', 'Delete **only** `junk.txt`. Keep `keep.txt`.')],
    check: (fs) => !fs.get('/home/ubuntu/junk.txt') && !!fs.get('/home/ubuntu/keep.txt'),
  },
];

export { modal as coreModal, demo as coreDemo };
