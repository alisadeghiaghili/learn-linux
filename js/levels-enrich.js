/**
 * Depth enrichment: extend learn notes and attach drills so every sequence
 * hits textbook-level pedagogy, not just a thin bullet list.
 */

/** Extra LPIC-aligned notes keyed by level id. */
const EXTRA_LEARN = {
  'intro-whoami': [
    'Related: `logname` (login name), `id -un` (effective name only).',
    'setuid binaries can make `whoami` differ from the human at the keyboard.',
  ],
  'intro-pwd': [
    '`pwd -P` resolves symlinks to the physical path.',
    'Every `cd` is a kernel state change on the process — children inherit at fork.',
  ],
  'intro-ls': [
    'Column mode is `ls -C` (default to tty); scripts often want `ls -1`.',
    '`ls` color is a shell alias (`--color=auto`) not a core behavior.',
  ],
  'intro-cd': [
    'CDPATH can surprise you: a bare `cd foo` may not go where you think.',
    '`pushd`/`popd` keep a directory stack for deep navigation.',
  ],
  'intro-echo': [
    'Prefer `printf` for formats with % or trailing-newline control.',
    'stderr is for diagnostics; never mix data and errors on fd 1 in scripts.',
  ],
  'files-mkdir': [
    '`mkdir -m 700 secrets` sets mode at create time (bypasses umask for the given mode).',
  ],
  'files-cp': [
    '`cp -a` ≈ archive: preserve mode, owner, timestamps, recurse (root often needed for owner).',
    '`rsync -a` is the network/efficient cousin of recursive copy.',
  ],
  'files-rm': [
    'Open file + unlink = data lives until the fd closes (log rotation depends on this).',
    '`shred` is not reliable on journaling/SSD — assume delete is logical.',
  ],
  'text-redirect': [
    'Order matters: `2>&1 >/dev/null` ≠ `>/dev/null 2>&1`.',
    'Here-strings `<<<` and here-docs `<<EOF` feed stdin without a file.',
  ],
  'text-pipe': [
    'Pipe buffers (64KiB typical) — producers can block if the consumer stalls.',
    'Tee-off for debugging: `cmd | tee /tmp/x | next`.',
  ],
  'text-grep': [
    'Word boundary `\\<`, line anchors `^ $`, character classes `[[:digit:]]`.',
    '`grep -P` enables PCRE where available (not POSIX).',
  ],
  'text-sed': [
    'Addresses: `sed -n \'5p\'`, `sed \'1,3d\'`.',
    'Hold space `h/H/g/G` is advanced but appears in real ops one-liners.',
  ],
  'text-awk': [
    'BEGIN/END blocks for setup and totals: `awk \'{s+=$1} END{print s}\'`.',
    'Associative arrays: `awk \'{c[$1]++} END{for (k in c) print k, c[k]}\'`.',
  ],
  'perm-octal': [
    'Directory execute is “may traverse / cd”; read is “may list names”.',
    'Remove write on a dir to freeze the name table even if files are writable.',
  ],
  'perm-special': [
    'setgid directory: new children inherit the directory group (project dirs).',
    'capabilities (`getcap`) can replace some setuid binaries with finer rights.',
  ],
  'user-add': [
    'Defaults from `/etc/default/useradd` and `/etc/skel` (skeleton dotfiles).',
    'System users often use `--system` and nologin shell.',
  ],
  'proc-kill': [
    'SIGTERM lets the process close sockets and flush — the polite contract.',
    'cgroup/oom-killer can take processes without any kill from you.',
  ],
  'fs-ln': [
    'Link count drops to 0 → inode is freed when no process holds the file open.',
    'Symlink permissions are unused on Linux (target perms apply).',
  ],
  'fs-mount': [
    '`mount -o remount,rw /` recovery move when root is ro after an error.',
    'Bind mounts and loop devices appear in containers/ISO workflows.',
  ],
  'pkg-install': [
    'Recommended vs Suggests vs Depends — `apt install --no-install-recommends` is lean.',
    'Local `.deb`: `apt install ./pkg.deb` resolves deps better than raw `dpkg -i`.',
  ],
  'net-ss': [
    '`ss -tulpn` is the modern replacement for `netstat -tulpn`.',
    'TIME-WAIT piles are normal on busy servers — not always a leak.',
  ],
  'net-curl': [
    '`curl -fsS` fails on HTTP errors and shows errors but not progress — CI favorite.',
    'TLS trust is system CA store (`/etc/ssl/certs`) plus openssl s_client for debug.',
  ],
  'sec-acl': [
    'Default ACL on a dir (`-d`) inherits to new files — team shared trees.',
    'ACL survives chmod mostly, but getfacl is the source of truth when debugging.',
  ],
  'svc-status': [
    '`systemctl is-active` / `is-enabled` for scripts (cleaner than parsing status).',
    'Failed units: `systemctl reset-failed` after fixing the root cause.',
  ],
  'shell-vars': [
    '`readonly` / `declare -i` (integer) / `declare -A` (associative array).',
    'Env dumps for children only include exported vars (`export -p`).',
  ],
  'shell-while': [
    'Idiom: `while read -r line; do ...; done < file` keeps whitespace with `-r`.',
    'Pipelines run the while in a **subshell** in bash — variable updates vanish (use <<< or process subst).',
  ],
  'shell-case': [
    'Pattern `start|restart)` handles both words — common in service scripts.',
    'Always provide `*)` with a usage message.',
  ],
};

/** Drill quiz appended when a level has no quiz yet. */
const DRILLS = {
  'intro-ls': {
    title: 'Hidden files',
    body: 'Quick check on listing semantics.',
    choices: ['ls -l', 'ls -a', 'ls -R', 'ls -t'],
    correct: 1,
  },
  'files-mv': {
    title: 'Rename vs copy',
    body: 'Same-filesystem mv is…',
    choices: [
      'A full copy + delete (new inode)',
      'Usually a rename (same inode)',
      'Only for directories',
      'Impossible across directories',
    ],
    correct: 1,
  },
  'text-head-tail': {
    title: 'Follow logs',
    body: 'Which command follows a growing log?',
    choices: ['head -f', 'tail -f', 'cat -f', 'less -F only'],
    correct: 1,
  },
  'perm-chmod-x': {
    title: 'Scripts and +x',
    body: 'To run `./run.sh` you need…',
    choices: ['Only read', 'Only write', 'Execute on the file + read to interpret', 'Nothing — bash ignores modes'],
    correct: 2,
  },
  'user-sudo-install': {
    title: 'apt locks',
    body: 'Permission denied on `/var/lib/dpkg/lock-frontend` means…',
    choices: ['Disk full', 'Need root/sudo', 'apt is deprecated', 'Bad DNS'],
    correct: 1,
  },
  'fs-df': {
    title: 'df vs du',
    body: 'Free space **on a mount** is reported by…',
    choices: ['du', 'df', 'ls -l', 'stat'],
    correct: 1,
  },
  'net-ping': {
    title: 'ICMP',
    body: 'ping primarily uses…',
    choices: ['TCP SYN', 'ICMP echo', 'UDP DNS', 'ARP only'],
    correct: 1,
  },
  'svc-start': {
    title: 'Now vs boot',
    body: '`systemctl start` affects…',
    choices: ['Only this boot session', 'Only next boot', 'Both always', 'Nothing'],
    correct: 0,
  },
  'pkg-update': {
    title: 'apt update',
    body: 'After `apt update` you should expect…',
    choices: ['New binaries upgraded', 'Fresh package indexes', 'Kernel changed', 'Services restarted'],
    correct: 1,
  },
  'shell-quoting': {
    title: 'Quotes',
    body: '`echo "$HOME"` vs `echo \'$HOME\'`…',
    choices: [
      'Both print the path',
      'First expands, second literal',
      'First literal, second expands',
      'Both print $HOME',
    ],
    correct: 1,
  },
  'cap-final': {
    title: 'Fail-fast',
    body: '`set -e` means…',
    choices: [
      'Ignore all errors',
      'Exit on first failing command',
      'Enable errexit only in functions',
      'Print stack traces',
    ],
    correct: 1,
  },
};

/**
 * Lab-manual block attached to every level.
 * @param {any} level
 */
function labManual(level) {
  const goal = level.objective || level.name;
  const steps = (level.steps || []).map((s, i) => `${i + 1}. \`${s.command}\`${s.note ? ` — ${s.note}` : ''}`);
  return {
    type: 'modal',
    title: `Lab — ${level.name}`,
    body: [
      '**Objective**',
      goal,
      '',
      '**Procedure**',
      steps.join('\n') || '1. Use the checklist in the right panel.',
      '',
      '**Verify**',
      '- Check the filesystem tree / process table changed as expected.',
      '- Re-read the error text if the command failed — do not retry blindly.',
      '- State *why* the result is correct in one sentence before moving on.',
      '',
      '**Pitfalls**',
      ...(level.mistakes || ['Skipping verification.', 'Typing before predicting the result.']).map(
        (m) => `- ${m}`
      ),
      '',
      '**If stuck**',
      '- `hint` for the intended command shape.',
      '- `reset` to restore the start state.',
      '- `undo` to reverse the last change.',
    ].join('\n'),
  };
}

/**
 * Mutate the catalog in place with deeper pedagogy.
 * @param {any[]} levels
 */
export function enrichLevels(levels) {
  for (const level of levels) {
    const extra = EXTRA_LEARN[level.id];
    if (extra) {
      level.learn = [...(level.learn || []), ...extra];
    }
    if (!level.learn) level.learn = [];
    if (level.learn.length < 5) {
      level.learn = [
        ...level.learn,
        'LPIC habit: verify the effect (`ls -l`, `echo $?`, `getfacl`, `systemctl status`) after every mutation.',
        'Write the one-line explanation of *why* before you type the next admin command.',
        'When stuck, reduce: one command, one file, read the error fully before retrying.',
      ];
    }
    while (level.learn.length < 5) {
      level.learn.push(
        'Exam/lab tip: state the expected result first, then type the command (predict → observe).'
      );
    }
    // Lab manual as the closing dialog step
    if (!(level.dialog || []).some((d) => d.type === 'modal' && String(d.title || '').startsWith('Lab'))) {
      level.dialog = [...(level.dialog || []), labManual(level)];
    }
    const hasQuiz = (level.dialog || []).some((d) => d.type === 'quiz');
    const drill = DRILLS[level.id];
    if (!hasQuiz && drill) {
      level.dialog = [
        ...(level.dialog || []),
        {
          type: 'quiz',
          title: drill.title,
          body: drill.body,
          choices: drill.choices,
          correct: drill.correct,
        },
      ];
    }
  }
  return levels;
}
