/**
 * Gap-closing levels: shell control flow, ACL/SSH/sudoers, network write, drills.
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

export const gapLevels = [
  // ── shell control flow ───────────────────────────────────
  {
    id: 'shell-while',
    sequence: 'shell',
    name: 'while loop',
    objective: 'Write a script containing a while loop.',
    learn: [
      '`while [ cond ]; do ...; done` — test before each iteration.',
      '`until` is the inverse. `break`/`continue` control flow.',
      'Always update the loop variable or you spin forever.',
      'Read files with `while read line; do ...; done < file`.',
    ],
    mistakes: ['Infinite loop forgetting the increment', 'Using = instead of -eq for numbers'],
    hint: 'Build loop.sh with a while that touches files',
    par: 4,
    solution:
      'echo "#!/bin/bash" > loop.sh; echo "i=1" >> loop.sh; echo "while [ $i -le 2 ]; do touch f$i.txt; i=$((i+1)); done" >> loop.sh; chmod +x loop.sh',
    steps: [
      { command: 'echo "#!/bin/bash" > loop.sh', note: 'Shebang' },
      { command: 'echo "i=1" >> loop.sh', note: 'Init' },
      { command: 'echo "while [ $i -le 2 ]; do touch f$i.txt; i=$((i+1)); done" >> loop.sh', note: 'while body' },
      { command: 'chmod +x loop.sh', note: 'Executable' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'while',
        'A `while` loop keeps a process/script honest under load (retries, watchers).\n\nWrite **`loop.sh`** that contains a **while** loop and is executable.\n\n```bash\n#!/bin/bash\ni=1\nwhile [ $i -le 2 ]; do\n  touch f$i.txt\n  i=$((i+1))\ndone\n```\n\nWhy `$((i+1))`: arithmetic expansion. `[ $i -le 2 ]`: integer test.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/loop.sh');
      return !!n && (n.mode & 0o100) !== 0 && /while\s/.test(n.content || '');
    },
  },
  {
    id: 'shell-case',
    sequence: 'shell',
    name: 'case statement',
    objective: 'Write a script with a case branch.',
    learn: [
      '`case $1 in start) ... ;; stop) ... ;; esac` — pattern matching on words.',
      'Essential for init-style scripts (`start|stop|restart`).',
      'Patterns use glob syntax (`*`, `?`, `|` for alternatives).',
    ],
    mistakes: ['Forgetting `;;` or `esac`', 'Using if-chain for many mutually exclusive modes'],
    hint: 'cmd.sh with case start|stop',
    par: 3,
    solution:
      'echo "#!/bin/bash" > cmd.sh; echo "case $1 in start) echo up ;; stop) echo down ;; esac" >> cmd.sh; chmod +x cmd.sh',
    steps: [
      { command: 'echo "#!/bin/bash" > cmd.sh', note: 'Shebang' },
      { command: 'echo "case $1 in start) echo up ;; stop) echo down ;; esac" >> cmd.sh', note: 'case block' },
      { command: 'chmod +x cmd.sh', note: 'Executable' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'case',
        'SysV-style scripts dispatch on `$1`. Write **`cmd.sh`** with a **case** for `start`/`stop`.\n\n```bash\n#!/bin/bash\ncase $1 in\n  start) echo up ;;\n  stop)  echo down ;;\n  *)     echo "usage: $0 start|stop" ;;\nesac\n```'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/cmd.sh');
      return !!n && /case\s/.test(n.content || '') && /esac/.test(n.content || '');
    },
  },
  {
    id: 'shell-function',
    sequence: 'shell',
    name: 'Functions',
    objective: 'Write a script that defines and calls a function.',
    learn: [
      '`greet() { echo hi; }` then `greet`.',
      'Locals: `local x=1` inside functions.',
      'Return values are **exit codes** (0–255), not strings — use stdout for strings.',
    ],
    mistakes: ['Expecting `return "text"` to echo text'],
    hint: 'fn.sh with greet() and a call',
    par: 3,
    solution: 'echo "#!/bin/bash" > fn.sh; echo "greet() { echo hi; }; greet" >> fn.sh; chmod +x fn.sh',
    steps: [
      { command: 'echo "#!/bin/bash" > fn.sh', note: 'Shebang' },
      { command: 'echo "greet() { echo hi; }; greet" >> fn.sh', note: 'Define + call' },
      { command: 'chmod +x fn.sh', note: 'Executable' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('functions', 'Write **`fn.sh`** that defines `greet()` and calls it. Make it executable.')],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/fn.sh');
      return !!n && /\w+\(\)\s*\{/.test(n.content || '') && (n.mode & 0o100) !== 0;
    },
  },
  {
    id: 'shell-set-e',
    sequence: 'shell',
    name: 'set -e discipline',
    objective: 'Write a script that starts with set -e.',
    learn: [
      '`set -e` aborts the script on the first failing command (non-zero).',
      'Critical for deploy/install scripts — do not continue half-applied.',
      'Pair with `set -u` (nounset) and `set -o pipefail` in strict mode.',
    ],
    mistakes: ['set -e in interactive shells (surprising)', 'Hiding failures with `cmd || true` too broadly'],
    hint: 'safe.sh starting with set -e',
    par: 3,
    solution: 'echo "#!/bin/bash" > safe.sh; echo "set -e" >> safe.sh; echo "true" >> safe.sh; chmod +x safe.sh',
    steps: [
      { command: 'echo "#!/bin/bash" > safe.sh', note: 'Shebang' },
      { command: 'echo "set -e" >> safe.sh', note: 'Strict mode' },
      { command: 'chmod +x safe.sh', note: 'Executable' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'set -e',
        'Write **`safe.sh`** that enables **`set -e`** (fail-fast).\n\nDeploy scripts without this keep going after a broken `cp` and leave boxes in a cursed state.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/safe.sh');
      return !!n && /set\s+-e/.test(n.content || '');
    },
  },
  {
    id: 'shell-quiz',
    sequence: 'shell',
    name: 'Shell drill',
    objective: 'Answer a shell semantics check.',
    learn: [
      'Drill: quoting and expansion rules.',
      'This is how interviews and LPIC probe understanding — not just typing.',
    ],
    mistakes: ['Guessing without simulating in a real shell'],
    hint: 'Think about single vs double quotes',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal('Drill', 'You will get one multiple-choice question. Answer carefully.'),
      quiz(
        'What does `echo \'$HOME\'` print?',
        'Shell quoting rules matter every day.',
        ['The home directory path (e.g. /home/ubuntu)', 'The literal text $HOME', 'An empty line', 'An error'],
        1
      ),
    ],
    check: (fs, session) => session.quizOk === true || session.history.some((h) => /(^|;|\s)true(\s|;|$)/.test(h) && session.quizOk !== false),
  },

  // ── security depth ───────────────────────────────────────
  {
    id: 'sec-acl',
    sequence: 'security',
    name: 'POSIX ACL',
    objective: 'Grant a named user rw with setfacl.',
    learn: [
      'Classic ugo/rwx cannot express “bob may rw, others nothing” without owning group tricks.',
      'ACL: `setfacl -m u:bob:rw file` · `getfacl file` to inspect.',
      'mask:: is the ceiling of named user/group entries.',
      'Check filesystem was mounted with `acl` (modern ext4 default).',
    ],
    mistakes: ['Setting ACL and forgetting mask', 'Assuming chown is the only access path'],
    hint: 'setfacl -m u:bob:rw shared.txt',
    par: 1,
    solution: 'setfacl -m u:bob:rw shared.txt',
    steps: [{ command: 'setfacl -m u:bob:rw shared.txt', note: 'Named-user ACL' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({ 'shared.txt': { type: 'file', mode: 0o644, owner: 'ubuntu', content: 'team\n' } }),
    },
    dialog: [
      modal(
        'ACL',
        'Grant **bob** read-write on **`shared.txt`** via ACL (not chown).\n\n```\nsetfacl -m u:bob:rw shared.txt\ngetfacl shared.txt\n```'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/shared.txt');
      return !!n && n.acl && n.acl.user === 'bob';
    },
  },
  {
    id: 'sec-acl-group',
    sequence: 'security',
    name: 'Group ACL',
    objective: 'Grant a group r via setfacl.',
    learn: ['`setfacl -m g:dev:r file` group named entry.', 'Combine with directories + `X` for inherit on trees (default ACL).'],
    mistakes: ['Applying group ACL to the wrong path'],
    hint: 'setfacl -m g:dev:r shared.txt',
    par: 1,
    solution: 'setfacl -m g:dev:r shared.txt',
    steps: [{ command: 'setfacl -m g:dev:r shared.txt', note: 'Group ACL' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({ 'shared.txt': { type: 'file', mode: 0o644, owner: 'ubuntu', content: 'x\n' } }),
    },
    dialog: [modal('group ACL', 'Give group **dev** read access on `shared.txt`.')],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/shared.txt');
      return !!n && n.acl && n.acl.group === 'dev';
    },
  },
  {
    id: 'sec-ssh-keygen',
    sequence: 'security',
    name: 'SSH keypair',
    objective: 'Generate a key pair with ssh-keygen.',
    learn: [
      'Keypair: private (600, never share) + public (.pub, may share).',
      'Auth: server stores your pubkey in `~/.ssh/authorized_keys`.',
      '`ssh-keygen -t ed25519` is current best practice (rsa 4096 acceptable).',
      'Passphrase protects the key at rest (ssh-agent for convenience).',
    ],
    mistakes: ['Committing the private key', 'World-readable private key (SSH refuses it)'],
    hint: 'ssh-keygen -t rsa -f .ssh/id_rsa',
    par: 1,
    solution: 'ssh-keygen -t rsa -f .ssh/id_rsa',
    steps: [{ command: 'ssh-keygen -t rsa -f .ssh/id_rsa', note: 'Create keypair' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'ssh-keygen',
        'Generate a key pair at **`.ssh/id_rsa`** (+ `.pub`).\n\nOn a real Ubuntu box prefer `ed25519` unless you need RSA compatibility.'
      ),
    ],
    check: (fs) => {
      const k = fs.get('/home/ubuntu/.ssh/id_rsa');
      const p = fs.get('/home/ubuntu/.ssh/id_rsa.pub');
      return !!k && !!p && k.mode === 0o600;
    },
  },
  {
    id: 'sec-sudoers',
    sequence: 'security',
    name: 'sudoers sanity',
    objective: 'Validate sudoers with visudo.',
    learn: [
      'sudoers syntax: `user HOST=(root) NOPASSWD: /usr/bin/apt`.',
      'Always edit with **`visudo`** — it validates before save.',
      'A broken sudoers can lock you out of root forever (cloud serial console saves you).',
    ],
    mistakes: ['echo >> /etc/sudoers without visudo', 'NOPASSWD: ALL for everyone'],
    hint: 'visudo',
    par: 1,
    solution: 'sudo visudo',
    steps: [{ command: 'sudo visudo', note: 'Validate policy' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('visudo', 'Run **`sudo visudo`** (parses the policy safely).')],
    check: (fs, session) => /visudo/.test(session.history.join(' ')),
  },
  {
    id: 'sec-find-perm',
    sequence: 'security',
    name: 'Find loose permissions',
    objective: 'Find world-writable files with find -perm.',
    learn: [
      '`find /home -perm -002` world-writable — a classic audit.',
      '`-perm /u+x` any execute bit; `/` = any of the bits, `-` = all.',
      'Security baselines hunt for 777 secrets and keys.',
    ],
    mistakes: ['Using + for “any” (legacy) vs /'],
    hint: 'find . -perm -002',
    par: 1,
    solution: 'find . -perm -002',
    steps: [{ command: 'find . -perm -002', note: 'World-writable hunt' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'open.log': { type: 'file', mode: 0o666, owner: 'ubuntu', content: 'x\n' },
        'ok.txt': { type: 'file', mode: 0o644, owner: 'ubuntu', content: 'y\n' },
      }),
    },
    dialog: [modal('find -perm', 'Find world-writable files (`-perm -002`) under home.')],
    check: (fs, session) => /find/.test(session.history.join(' ')) && /perm/.test(session.history.join(' ')),
  },
  {
    id: 'sec-quiz',
    sequence: 'security',
    name: 'Security drill',
    objective: 'Answer a least-privilege check.',
    learn: ['Drill: private key modes.', 'These questions mirror interview/LPIC probes.'],
    mistakes: ['chmod 777 “to make it work”'],
    hint: 'Think about SSH key requirements',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'What mode must an SSH private key have for sshd to accept it?',
        'The client refuses loose keys.',
        ['755', '644', '600 (or tighter)', '666'],
        2
      ),
    ],
    check: (fs, session) => session.quizOk === true || session.history.some((h) => /true/.test(h)),
  },

  // ── network write ────────────────────────────────────────
  {
    id: 'net-addr-add',
    sequence: 'networking',
    name: 'ip addr add',
    objective: 'Add an address with sudo ip.',
    learn: [
      '`sudo ip addr add 10.0.2.50/24 dev eth0` — runtime add (lost on reboot).',
      'Persistent config: netplan (`/etc/netplan`) on Ubuntu.',
      'Wrong prefix length is a classic outage.',
    ],
    mistakes: ['Forgetting /24', 'Editing netplan without `netplan try`'],
    hint: 'sudo ip addr add 10.0.2.50/24 dev eth0',
    par: 1,
    solution: 'sudo ip addr add 10.0.2.50/24 dev eth0',
    steps: [{ command: 'sudo ip addr add 10.0.2.50/24 dev eth0', note: 'Runtime address' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'ip addr add',
        'Add **10.0.2.50/24** to **eth0** with sudo. Then `ip addr` to confirm.'
      ),
    ],
    check: (fs) => (fs.runtime?.net?.addrs || []).some((a) => a.includes('10.0.2.50')),
  },
  {
    id: 'net-route-add',
    sequence: 'networking',
    name: 'ip route add',
    objective: 'Add a static route with sudo.',
    learn: [
      '`sudo ip route add 192.168.5.0/24 via 10.0.2.2`.',
      'Longest prefix match wins. Default `0.0.0.0/0` is last resort.',
      'VPN/on-prem hybrids are mostly careful routing.',
    ],
    mistakes: ['Black-holing traffic with a wrong gateway'],
    hint: 'sudo ip route add 192.168.5.0/24 via 10.0.2.2',
    par: 1,
    solution: 'sudo ip route add 192.168.5.0/24 via 10.0.2.2',
    steps: [{ command: 'sudo ip route add 192.168.5.0/24 via 10.0.2.2', note: 'Static route' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('ip route add', 'Add route **192.168.5.0/24 via 10.0.2.2**.')],
    check: (fs) => (fs.runtime?.net?.routes || []).some((r) => r.includes('192.168.5.0')),
  },
  {
    id: 'net-quiz',
    sequence: 'networking',
    name: 'Network drill',
    objective: 'Answer a routing/DNS check.',
    learn: ['Drill: hosts vs DNS.', 'Layered debugging: link → addr → route → name → port.'],
    mistakes: ['Jumping to DNS before checking `ip r`'],
    hint: 'Order of resolution',
    par: 1,
    solution: 'true',
    steps: [{ command: 'true', note: 'Submit quiz' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      quiz(
        'Where does a Linux host look first for name resolution (default nsswitch)?',
        'files then dns is the common default.',
        ['/etc/hosts (files)', 'Public DNS only', '/etc/resolv.conf only', 'mDNS'],
        0
      ),
    ],
    check: (fs, session) => session.quizOk === true || session.history.some((h) => /true/.test(h)),
  },

  // ── more depth on weak pillars ────────────────────────────
  {
    id: 'proc-kill-l',
    sequence: 'processes',
    name: 'kill -l',
    objective: 'List signals.',
    learn: ['`kill -l` prints the signal matrix.', 'Numbers vs names: `kill -TERM`, `kill -15` same.', 'SIGKILL cannot be caught/blocked.'],
    mistakes: ['Assuming -9 is safer because stronger'],
    hint: 'kill -l',
    par: 1,
    solution: 'kill -l',
    steps: [{ command: 'kill -l', note: 'Signal table' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('kill -l', 'Print the signal list.')],
    check: (fs, session) => /kill\s+-l/.test(session.history.join(' ')),
  },
  {
    id: 'pkg-hold',
    sequence: 'packages',
    name: 'apt hold concept',
    objective: 'Query policy before a risky upgrade.',
    learn: [
      '`apt-mark hold pkg` freezes a package across upgrades.',
      'Always `apt policy` before `full-upgrade` in prod.',
      'Unattended-upgrades vs manual holds is an ops policy question.',
    ],
    mistakes: ['full-upgrade on prod without changelog read'],
    hint: 'apt policy bash',
    par: 1,
    solution: 'apt policy bash',
    steps: [{ command: 'apt policy bash', note: 'Check versions first' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('hold & policy', 'Inspect **`apt policy bash`** as the pre-upgrade habit.')],
    check: (fs, session) => /apt\s+policy/.test(session.history.join(' ')),
  },
  {
    id: 'svc-unit',
    sequence: 'services',
    name: 'Read a unit file',
    objective: 'Inspect unit definition with systemctl cat.',
    learn: [
      'Unit files: `[Unit]`, `[Service]`, `[Install]` sections.',
      'WantedBy=multi-user.target is the usual enable hook.',
      'systemctl cat is the fastest way to see drop-ins + main unit.',
    ],
    mistakes: ['Editing vendor units without override in /etc/systemd/system'],
    hint: 'systemctl cat ssh',
    par: 1,
    solution: 'systemctl cat ssh',
    steps: [{ command: 'systemctl cat ssh', note: 'Unit definition' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('unit files', 'Read the **ssh** unit definition.')],
    check: (fs, session) => /systemctl\s+cat/.test(session.history.join(' ')),
  },
  {
    id: 'text-sed-i',
    sequence: 'text',
    name: 'sed -i in-place',
    objective: 'Edit a file in place with sed -i.',
    learn: [
      'GNU `sed -i \'s/a/b/\' file` rewrites the file.',
      'Safer: `sed -i.bak` keeps a backup.',
      'Always `cp` or git-commit before mass rewrite.',
    ],
    mistakes: ['sed -i without backup on unique data'],
    hint: "sed -i 's/old/new/' edit.txt",
    par: 1,
    solution: "sed -i 's/old/new/' edit.txt",
    steps: [{ command: "sed -i 's/old/new/' edit.txt", note: 'In-place edit' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({ 'edit.txt': { type: 'file', owner: 'ubuntu', content: 'old value\n' } }),
    },
    dialog: [modal('sed -i', 'Rewrite **old → new** inside `edit.txt` (in place).')],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/edit.txt');
      return !!n && /new/.test(n.content || '') && !/old/.test(n.content || '');
    },
  },
  {
    id: 'text-awk-nf',
    sequence: 'text',
    name: 'awk NF/NR',
    objective: 'Use awk field/line variables.',
    learn: ['`NF` fields per line, `NR` record number, `$NF` last field.', 'Great for quick metrics on delimited logs.'],
    mistakes: ['Confusing NR with NF'],
    hint: "awk '{print $NF}' report.tsv",
    par: 1,
    solution: "awk '{print $NF}' report.tsv",
    steps: [{ command: "awk '{print $NF}' report.tsv", note: 'Last field' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({ 'report.tsv': { type: 'file', owner: 'ubuntu', content: 'cpu\t90\nmem\t70\n' } }),
    },
    dialog: [modal('awk $NF', 'Print the **last field** of each line in `report.tsv`.')],
    check: (fs, session) => /awk/.test(session.history.join(' ')) && /\$NF|print \$NF/.test(session.history.join(' ')),
  },
  {
    id: 'fs-find-user',
    sequence: 'system',
    name: 'find -user',
    objective: 'Find files by owner.',
    learn: ['`find . -user ubuntu` ownership filter.', 'Combine predicates: `-user alice -type f -mtime -7`.'],
    mistakes: ['Forgetting -type and matching dirs too'],
    hint: 'find . -user ubuntu',
    par: 1,
    solution: 'find . -user ubuntu',
    steps: [{ command: 'find . -user ubuntu', note: 'Owner filter' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({ 'mine.txt': { type: 'file', owner: 'ubuntu', content: 'x\n' } }),
    },
    dialog: [modal('find -user', 'Find files owned by **ubuntu**.')],
    check: (fs, session) => /find/.test(session.history.join(' ')) && /user/.test(session.history.join(' ')),
  },
  {
    id: 'cap-final',
    sequence: 'shell',
    name: 'Final capstone',
    objective: 'Write a fail-fast script with a case and a while.',
    learn: [
      'This is the “you can write ops glue” bar.',
      'Combine: shebang + set -e + case + while + executable bit.',
      'LPIC 105 + real job: deploy hooks, health checks, batch renames.',
    ],
    mistakes: ['Shipping an untested one-liner to prod cron'],
    hint: 'ops.sh with set -e, case, and while',
    par: 5,
    solution:
      'echo "#!/bin/bash" > ops.sh; echo "set -e" >> ops.sh; echo "case $1 in run) i=1; while [ $i -le 2 ]; do touch out$i.txt; i=$((i+1)); done ;; esac" >> ops.sh; chmod +x ops.sh',
    steps: [
      { command: 'echo "#!/bin/bash" > ops.sh', note: 'Shebang' },
      { command: 'echo "set -e" >> ops.sh', note: 'Fail-fast' },
      { command: 'echo "case ... while ..." >> ops.sh', note: 'Control flow' },
      { command: 'chmod +x ops.sh', note: 'Executable' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Capstone',
        'Write **`ops.sh`** that includes **all** of:\n\n1. `#!/bin/bash`\n2. `set -e`\n3. a **case** statement\n4. a **while** loop\n5. executable bit (`chmod +x`)\n\nThis is the bar for “can automate safely”.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/ops.sh');
      if (!n) return false;
      const c = n.content || '';
      return (
        (n.mode & 0o100) !== 0 &&
        /set\s+-e/.test(c) &&
        /case\s/.test(c) &&
        /while\s/.test(c)
      );
    },
  },
];
