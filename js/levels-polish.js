/**
 * Residual 9/10 polish: globs, nice, purge, timers, admin depth, extra drills.
 */

import { homeTreeSpec } from './levels-core.js';

const homeTree = homeTreeSpec;
const modal = (title, body) => ({ type: 'modal', title, body });
const quiz = (title, body, choices, correct) => ({
  type: 'quiz',
  title,
  body,
  choices,
  correct,
});

export const polishLevels = [
  {
    id: 'cmd-glob',
    sequence: 'intro',
    name: 'Glob patterns',
    objective: 'List only .txt files with a shell glob.',
    learn: [
      'Shell expands globs **before** the command runs: `ls *.txt` becomes a file list.',
      '`*` any string · `?` one char · `[abc]` class · `{a,b}` brace (bash).',
      'Quote globs to pass them literally to `find`/`grep`.',
      'No match: bash leaves the pattern literal (or `nullglob` empties it).',
    ],
    mistakes: ['`find . -name *.log` unquoted — shell expands first', 'Expecting regex in ls'],
    hint: 'ls *.txt',
    par: 1,
    solution: 'ls *.txt',
    steps: [{ command: 'ls *.txt', note: 'Glob expansion' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'a.txt': { type: 'file', owner: 'ubuntu', content: 'a\n' },
        'b.md': { type: 'file', owner: 'ubuntu', content: 'b\n' },
        'c.txt': { type: 'file', owner: 'ubuntu', content: 'c\n' },
      }),
    },
    dialog: [
      modal(
        'Globbing',
        'List only **`*.txt`** in home (`a.txt` and `c.txt`, not `b.md`).\n\nThe **shell** expands the pattern — `ls` just receives concrete names. That is why `find -name \'*.log\'` needs quotes: stop the shell from expanding.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => /\bls\b/.test(h) && /\*\.txt/.test(h)),
  },
  {
    id: 'cmd-pwd-cd-pipe',
    sequence: 'intro',
    name: 'Path pipeline',
    objective: 'Print cwd and list /etc in one line with ;',
    learn: [
      '`cmd1; cmd2` runs both regardless of status (unlike `&&`).',
      'Grouping: `{ cmd1; cmd2; } > log` redirects both.',
      'Scripts prefer `&&` when step N+1 depends on N.',
    ],
    mistakes: ['Using ; when you meant && in deploy scripts'],
    hint: 'pwd; ls /etc',
    par: 1,
    solution: 'pwd; ls /etc',
    steps: [{ command: 'pwd; ls /etc', note: 'Sequential commands' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal(';', 'Run **`pwd`** then **`ls /etc`** as one input line separated by `;`.')],
    check: (fs, session) =>
      session.history.some((h) => h.includes(';') && /pwd/.test(h) && /etc/.test(h)),
  },
  {
    id: 'proc-nice',
    sequence: 'processes',
    name: 'nice priority',
    objective: 'Read top output and understand nice.',
    learn: [
      'nice −20…19: lower number = higher priority (need root for <0).',
      '`nice -n 10 cmd` start low priority; `renice` changes a live process.',
      'Batch jobs should not starve interactive SSH.',
    ],
    mistakes: ['Thinking nice is “nice to the process” (it is the opposite scale)'],
    hint: 'top',
    par: 1,
    solution: 'top',
    steps: [{ command: 'top', note: 'Observe PR/NI columns' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree(),
      processes: [{ cmd: 'batch.sh', user: 'ubuntu', state: 'R', cpu: 20, mem: 1 }],
    },
    dialog: [
      modal(
        'nice / PR / NI',
        'In `top`, **NI** is niceness. 0 default, 19 idle-only, −20 realtime-ish (root).\n\nOpen **`top`** and locate NI. On a real box: `nice -n 19 tar czf big.tgz /data` for backups.'
      ),
    ],
    check: (fs, session) => session.history.some((h) => h.trim().startsWith('top') || /nice|renice/.test(h)),
  },
  {
    id: 'pkg-purge',
    sequence: 'packages',
    name: 'remove vs purge',
    objective: 'Purge a package (drop config).',
    learn: [
      '`apt remove` keeps `/etc` configs (easy reinstall).',
      '`apt purge` deletes configs too (clean slate / GDPR-ish).',
      '`apt autoremove` drops orphaned deps.',
    ],
    mistakes: ['purge when you need the old nginx.conf back'],
    hint: 'sudo apt purge curl',
    par: 1,
    solution: 'sudo apt purge curl',
    steps: [{ command: 'sudo apt purge curl', note: 'Remove + configs' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('purge', 'Install would be needed first in a full lab. Here **purge curl** (`sudo apt purge curl`) so it is gone with configs.')],
    check: (fs, session) => {
      const hist = session.history.join(' ');
      if (/apt\s+purge/.test(hist) && !(fs.runtime?.packages || []).includes('curl')) return true;
      // allow purge after prior install in session
      return /apt\s+purge\s+curl/.test(hist) && !(fs.runtime?.packages || []).includes('curl');
    },
  },
  {
    id: 'svc-timer',
    sequence: 'services',
    name: 'systemd timer concept',
    objective: 'List units and know timers replace cron.',
    learn: [
      '`foo.timer` + `foo.service` = systemd native scheduling.',
      'Persistent timers catch missed runs (`Persistent=true`).',
      'Cron still common; timers integrate with journal and deps.',
    ],
    mistakes: ['Mixing cron and timer on the same job (double fire)'],
    hint: 'systemctl list-units',
    par: 1,
    solution: 'systemctl list-units',
    steps: [{ command: 'systemctl list-units', note: 'See service/timer landscape' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'timers',
        'Modern Ubuntu schedules with **`.timer` units** more often than crontab.\n\nRun **`systemctl list-units`**. On a real box: `systemctl list-timers`.'
      ),
    ],
    check: (fs, session) => /list-units|list-timers/.test(session.history.join(' ')),
  },
  {
    id: 'admin-vipw',
    sequence: 'admin',
    name: 'Edit accounts safely',
    objective: 'Read passwd and know vipw.',
    learn: [
      'Never `vim /etc/passwd` directly — use **`vipw`** / **`vipw -s`** (shadow).',
      'Those tools lock the file and keep the format valid.',
      'Broken passwd = nobody can log in.',
    ],
    mistakes: ['Hand-editing shadow and corrupting the hash field'],
    hint: 'cat /etc/passwd',
    par: 1,
    solution: 'cat /etc/passwd',
    steps: [{ command: 'cat /etc/passwd', note: 'Inspect format' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'vipw',
        'Read **`/etc/passwd`** again. Remember the safe editor is **`vipw`** (and `vipw -s` for shadow).\n\nThis is a process discipline point more than a command point.'
      ),
    ],
    check: (fs, session) => /cat\s+.*passwd|vipw/.test(session.history.join(' ')),
  },
  {
    id: 'admin-quiz',
    sequence: 'admin',
    name: 'Admin drill',
    objective: 'Answer a user/group check.',
    learn: ['Drill: primary vs supplementary groups.', 'File access is evaluated against uid + all groups.'],
    mistakes: ['Logging out and in after usermod -aG (sometimes required)'],
    hint: 'Supplementary groups and file DAC',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'Which command ADDS a supplementary group without wiping others?',
        'usermod flags matter.',
        ['usermod -G sudo alice', 'usermod -aG sudo alice', 'groupmod -a alice', 'useradd -G sudo alice'],
        1
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
  {
    id: 'text-quiz',
    sequence: 'text',
    name: 'Filters drill',
    objective: 'Answer a pipeline design check.',
    learn: ['Drill: uniq adjacency.', 'These are the questions that catch cargo-cult piping.'],
    mistakes: ['uniq without sort'],
    hint: 'Think about sort | uniq',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'Why almost always `sort | uniq` instead of `uniq` alone?',
        'uniq only collapses adjacent runs.',
        ['uniq is slow', 'uniq only collapses consecutive equal lines', 'sort writes to disk', 'uniq needs root'],
        1
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
  {
    id: 'perm-quiz',
    sequence: 'permissions',
    name: 'Mode drill',
    objective: 'Answer an octal check.',
    learn: ['Drill: 4/2/1 arithmetic.', 'Fast octal reading is an LPIC and ops interview staple.'],
    mistakes: ['Mixing 644 vs 755 when +x is needed'],
    hint: '600 and 755',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'What does octal 640 mean?',
        'u=rw, g=r, o=—',
        ['rwxr-x---', 'rw-r-----', 'rw-r--r--', 'rwx------'],
        1
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
  {
    id: 'fs-quiz',
    sequence: 'system',
    name: 'FS drill',
    objective: 'Answer a link/inode check.',
    learn: ['Drill: hard vs soft links.', 'Inodes are the real file identity.'],
    mistakes: ['Soft-linking with a relative path from the wrong cwd'],
    hint: 'Same inode?',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'Two hard links to one file share…',
        'Hard link = second name for the same inode.',
        ['Two inodes, same size', 'One inode (same data)', 'Nothing — always copy', 'Only atime'],
        1
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
  {
    id: 'pkg-quiz',
    sequence: 'packages',
    name: 'Package drill',
    objective: 'Answer an apt check.',
    learn: ['Drill: update vs upgrade vs install.', 'Index freshness is the usual root cause of “version not found”.'],
    mistakes: ['apt upgrade without update'],
    hint: 'update is indexes only',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        '`apt update` does what?',
        'It refreshes package indexes — it does not install.',
        ['Upgrades all packages', 'Refreshes package indexes', 'Removes old kernels', 'Writes sources.list'],
        1
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
  {
    id: 'svc-quiz',
    sequence: 'services',
    name: 'Service drill',
    objective: 'Answer a systemd check.',
    learn: ['Drill: start vs enable.', 'Boot persistence is the surprise after reboot.'],
    mistakes: ['start without enable'],
    hint: 'What survives reboot?',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'Which pair makes nginx run now AND after reboot?',
        'start = now, enable = at boot.',
        ['start only', 'enable only', 'start and enable', 'restart'],
        2
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
  {
    id: 'proc-quiz',
    sequence: 'processes',
    name: 'Signals drill',
    objective: 'Answer a signal check.',
    learn: ['Drill: TERM vs KILL.', 'Graceful first is the professional habit.'],
    mistakes: ['kill -9 as the first tool'],
    hint: 'Catchable vs not',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'Which signal cannot be caught or ignored?',
        'SIGKILL is special — the kernel just ends the task.',
        ['SIGTERM', 'SIGINT', 'SIGKILL', 'SIGHUP'],
        2
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
  {
    id: 'sec-quiz-2',
    sequence: 'security',
    name: 'Privilege drill',
    objective: 'Answer a sudo/ACL check.',
    learn: ['Drill: least privilege.', 'Security is mostly boring consistency.'],
    mistakes: ['NOPASSWD: ALL'],
    hint: 'Who should own root scripts?',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'Best default for a root-owned deploy script mode?',
        '750 or 700 — not 777.',
        ['777', '755 or 750/700', '666', '777 on /usr/local/bin'],
        1
      ),
    ],
    check: (fs, session) => session.quizOk === true,
  },
];
