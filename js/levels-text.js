/**
 * Text filters, redirection, pipes, exit codes, sed/awk/sort/uniq.
 */

import { homeTreeSpec } from './levels-core.js';

const homeTree = homeTreeSpec;
const modal = (title, body) => ({ type: 'modal', title, body });

export const textLevels = [
  {
    id: 'text-redirect',
    sequence: 'text',
    name: 'Redirect output',
    objective: 'Send stdout into a file with >.',
    learn: [
      '`>` opens the file for write and **truncates** — fd 1 points at the file.',
      '`>>` appends. `2>` stderr. `2>&1` merge. `&>` both (bash).',
      'Redirection is a shell feature — works on every command.',
      'Footgun: `cmd > file` while reading `file` empties it first.',
    ],
    mistakes: ['`2> file` and wondering where stdout went', 'Using `>` twice on the same log'],
    hint: 'echo "line one" > message.txt',
    par: 1,
    solution: 'echo "line one" > message.txt',
    steps: [{ command: 'echo "line one" > message.txt', note: 'Create/overwrite file' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [
      modal(
        'Redirection',
        '| Operator | Meaning |\n|----------|---------|\n| `>` | overwrite file with stdout |\n| `>>` | append stdout |\n| `<` | file becomes stdin |\n| `\\|` | stdout → next stdin |\n| `2>` | stderr |\n\nCreate **`message.txt`** with exactly `line one`.'
      ),
    ],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/message.txt');
      return !!n && (n.content || '').trim() === 'line one';
    },
  },
  {
    id: 'text-append',
    sequence: 'text',
    name: 'Append',
    objective: 'Build a two-line log with > then >>.',
    learn: ['`>>` does not truncate — safe for logs.', 'Order matters: `>` creates, `>>` grows.', 'Many daemons append to `/var/log/*` or journald.'],
    mistakes: ['Using `>` for the second line'],
    hint: 'echo one > notes.log then echo two >> notes.log',
    par: 2,
    solution: 'echo one > notes.log; echo two >> notes.log',
    steps: [
      { command: 'echo one > notes.log', note: 'Create' },
      { command: 'echo two >> notes.log', note: 'Append' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('>> vs >', 'Write `one` then append `two` to **`notes.log`**.')],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/notes.log');
      if (!n) return false;
      const lines = (n.content || '').trim().split('\n');
      return lines[0] === 'one' && lines[1] === 'two';
    },
  },
  {
    id: 'text-head-tail',
    sequence: 'text',
    name: 'Head and tail',
    objective: 'Slice the start and end of a file.',
    learn: [
      '`head -n N` / `tail -n N` (default 10). `-c N` is bytes.',
      '`tail -f` follows a growing file (log tailing).',
      'Line-oriented tools assume newline records (logs, CSV).',
    ],
    mistakes: ['Forgetting -n and getting 10 lines by accident'],
    hint: 'head -n 2 long.txt and tail -n 2 long.txt',
    par: 2,
    solution: 'head -n 2 long.txt; tail -n 2 long.txt',
    steps: [
      { command: 'head -n 2 long.txt', note: 'First 2 lines' },
      { command: 'tail -n 2 long.txt', note: 'Last 2 lines' },
    ],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'long.txt': { type: 'file', owner: 'ubuntu', content: 'alpha\nbravo\ncharlie\ndelta\necho\nfoxtrot\n' },
      }),
    },
    dialog: [modal('Slice', 'Show **first 2** then **last 2** lines of `long.txt`.')],
    check: (fs, session) =>
      session.history.some((h) => /\bhead\b/.test(h) && /long\.txt/.test(h)) &&
      session.history.some((h) => /\btail\b/.test(h) && /long\.txt/.test(h)),
  },
  {
    id: 'text-wc',
    sequence: 'text',
    name: 'Count with wc',
    objective: 'Count lines, words, or bytes.',
    learn: ['`wc -l|-w|-c` lines/words/bytes.', 'Line count is a cheap ETL health check.', 'UTF-8 bytes ≠ characters (`LC_ALL` matters).'],
    mistakes: ['Counting lines without -l and reading the wrong column'],
    hint: 'wc -l long.txt',
    par: 1,
    solution: 'wc -l long.txt',
    steps: [{ command: 'wc -l long.txt', note: 'Line count' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'long.txt': { type: 'file', owner: 'ubuntu', content: 'alpha\nbravo\ncharlie\ndelta\necho\nfoxtrot\n' },
      }),
    },
    dialog: [modal('wc', 'Count **lines** in `long.txt`.')],
    check: (fs, session) => session.history.some((h) => /\bwc\b/.test(h) && /-l/.test(h) && /long\.txt/.test(h)),
  },
  {
    id: 'text-grep',
    sequence: 'text',
    name: 'Search with grep',
    objective: 'Filter lines by pattern.',
    learn: [
      '`grep PAT FILE` prints matches; exit 0 if any match, 1 if none.',
      '`-i` case · `-v` invert · `-n` numbers · `-r` recursive · `-c` count · `-l` filenames.',
      'Default BRE regex; `-F` fixed strings; `-E` ERE.',
      'LPIC 103.2: be fluent in grep and its return codes.',
    ],
    mistakes: ['Using grep for binary (add -a or strings)', 'Unquoted patterns that the shell globs'],
    hint: 'grep error app.log',
    par: 1,
    solution: 'grep error app.log',
    steps: [{ command: 'grep error app.log', note: 'ERROR lines' }],
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
    dialog: [modal('grep', 'Print only **ERROR** lines from `app.log`.')],
    check: (fs, session) =>
      session.history.some((h) => /\bgrep\b/.test(h) && /error/i.test(h) && /app\.log/.test(h)),
  },
  {
    id: 'text-pipe',
    sequence: 'text',
    name: 'Pipes',
    objective: 'Chain filters with a pipeline.',
    learn: [
      '`cmd1 | cmd2` connects stdout→stdin. Processes run **concurrently**.',
      'Only the last status is `$?`; bash has `PIPESTATUS`.',
      'This is the Unix philosophy: do one thing well, compose text.',
      'Real world: `journalctl | grep ERROR | wc -l`.',
    ],
    mistakes: ['Expecting intermediate exit codes in `$?`'],
    hint: 'grep ERROR app.log | wc -l',
    par: 3,
    solution: 'grep ERROR app.log | wc -l',
    steps: [
      { command: 'grep ERROR app.log', note: 'Filter' },
      { command: 'grep ERROR app.log | wc -l', note: 'Count via pipe' },
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
    dialog: [modal('Pipes', 'Count **ERROR** lines with `grep | wc -l`.')],
    check: (fs, session) =>
      session.history.some((h) => h.includes('|') && /grep/i.test(h) && /\bwc\b/.test(h)),
  },
  {
    id: 'text-exit-code',
    sequence: 'text',
    name: 'Exit codes',
    objective: 'Observe true/false as process exit status.',
    learn: [
      'Every process returns **0–255** (`wait` status for the parent).',
      '`true` → 0, `false` → 1. Scripts branch with `&&` and `||`.',
      'grep uses 0/1 for match/no-match — idiomatic in conditionals.',
      '`cmd && next` skips `next` when cmd fails (important in install scripts).',
    ],
    mistakes: ['Ignoring non-zero status in CI scripts'],
    hint: 'true then false',
    par: 2,
    solution: 'true; false',
    steps: [
      { command: 'true', note: 'status 0' },
      { command: 'false', note: 'status 1' },
    ],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('Exit status', 'Run **`true`** and **`false`**. On Ubuntu also try `echo $?`.')],
    check: (fs, session) =>
      session.history.some((h) => /(^|;|\s)true(\s|;|$)/.test(h)) &&
      session.history.some((h) => /(^|;|\s)false(\s|;|$)/.test(h)),
  },
  {
    id: 'text-sort',
    sequence: 'text',
    name: 'Sort and unique',
    objective: 'Sort lines and collapse duplicates.',
    learn: [
      '`sort` default lexicographic; `-n` numeric; `-r` reverse; `-u` unique.',
      '`uniq` collapses **adjacent** equals — almost always `sort | uniq`.',
      '`uniq -c` counts runs; `sort | uniq -c | sort -nr` top-N pattern.',
    ],
    mistakes: ['uniq without sort', 'sort -n on zero-padded version strings'],
    hint: 'sort names.txt',
    par: 1,
    solution: 'sort names.txt',
    steps: [{ command: 'sort names.txt', note: 'Lexicographic sort' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'names.txt': { type: 'file', owner: 'ubuntu', content: 'zoe\namy\nbob\namy\n' },
      }),
    },
    dialog: [modal('sort', 'Sort **`names.txt`** (A→Z).')],
    check: (fs, session) => session.history.some((h) => /\bsort\b/.test(h) && /names\.txt/.test(h)),
  },
  {
    id: 'text-uniq',
    sequence: 'text',
    name: 'uniq -c',
    objective: 'Count duplicate lines.',
    learn: ['`uniq -c` prefixes counts.', 'Pipeline idiom: `sort file | uniq -c | sort -nr`.'],
    mistakes: ['uniq on unsorted input'],
    hint: 'sort names.txt | uniq -c',
    par: 2,
    solution: 'sort names.txt | uniq -c',
    steps: [{ command: 'sort names.txt | uniq -c', note: 'Count duplicates' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'names.txt': { type: 'file', owner: 'ubuntu', content: 'zoe\namy\nbob\namy\n' },
      }),
    },
    dialog: [modal('uniq -c', 'Count names with `sort | uniq -c`.')],
    check: (fs, session) => session.history.some((h) => h.includes('|') && /uniq/.test(h)),
  },
  {
    id: 'text-cut',
    sequence: 'text',
    name: 'cut fields',
    objective: 'Extract columns from delimited text.',
    learn: ['`cut -d: -f1 /etc/passwd` field mode.', '`cut -c1-5` character mode.', 'Fragile on quoted CSV — use `awk`/`python` for real CSV.'],
    mistakes: ['cut on commas with quotes'],
    hint: 'cut -d: -f1 /etc/passwd',
    par: 1,
    solution: 'cut -d: -f1 /etc/passwd',
    steps: [{ command: 'cut -d: -f1 /etc/passwd', note: 'First field (usernames)' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('cut', 'Extract usernames from **`/etc/passwd`** with `cut`.')],
    check: (fs, session) => session.history.some((h) => /\bcut\b/.test(h) && /passwd/.test(h)),
  },
  {
    id: 'text-sed',
    sequence: 'text',
    name: 'sed substitute',
    objective: 'Stream-edit with sed s///.',
    learn: [
      '`sed \'s/foo/bar/\' file` substitutes first match per line; `s///g` global.',
      'sed is **stream** editor — does not write back without `-i`.',
      '`-i` in-place (GNU). Always keep a backup: `sed -i.bak`.',
    ],
    mistakes: ['sed -i without backup on the only copy', 'Forgetting /g'],
    hint: "sed 's/red/green/' colors.txt",
    par: 1,
    solution: "sed 's/red/green/' colors.txt",
    steps: [{ command: "sed 's/red/green/' colors.txt", note: 'Replace red→green' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'colors.txt': { type: 'file', owner: 'ubuntu', content: 'red\nred blue\n' },
      }),
    },
    dialog: [modal('sed', 'Substitute **red → green** in `colors.txt` and print to stdout.')],
    check: (fs, session) => session.history.some((h) => /\bsed\b/.test(h) && /colors\.txt/.test(h)),
  },
  {
    id: 'text-awk',
    sequence: 'text',
    name: 'awk fields',
    objective: 'Print columns with awk.',
    learn: [
      '`awk \'{print $1}\'` first field; `$NF` last; `NR` line number; `NF` field count.',
      '`-F:` sets input field separator (passwd style).',
      'awk is a language — patterns, actions, associative arrays.',
    ],
    mistakes: ['$0 vs $1', 'Shell-quoting the program: always single-quote awk scripts'],
    hint: "awk '{print $1}' report.tsv",
    par: 1,
    solution: "awk '{print $1}' report.tsv",
    steps: [{ command: "awk '{print $1}' report.tsv", note: 'First column' }],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'report.tsv': { type: 'file', owner: 'ubuntu', content: 'cpu\t90\nmem\t70\ndisk\t40\n' },
      }),
    },
    dialog: [modal('awk', 'Print the **first column** of `report.tsv`.')],
    check: (fs, session) => session.history.some((h) => /\bawk\b/.test(h) && /report\.tsv/.test(h)),
  },
  {
    id: 'text-tee',
    sequence: 'text',
    name: 'tee',
    objective: 'Duplicate stdout to a file and the screen.',
    learn: ['`cmd | tee file` writes file **and** keeps stdout.', '`tee -a` appends.', 'Classic: `sudo make install | tee build.log`.'],
    mistakes: ['Using > and losing the terminal output'],
    hint: 'echo done | tee status.txt',
    par: 1,
    solution: 'echo done | tee status.txt',
    steps: [{ command: 'echo done | tee status.txt', note: 'Duplicate stream' }],
    start: { cwd: '/home/ubuntu', tree: homeTree() },
    dialog: [modal('tee', 'Write `done` to **`status.txt`** and still show it on stdout.')],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/status.txt');
      return !!n && (n.content || '').includes('done');
    },
  },
  {
    id: 'text-capstone',
    sequence: 'text',
    name: 'Filter capstone',
    objective: 'Compose grep|wc redirect — ops day-one.',
    learn: ['Count and store the number for a report.', 'Same idea as `grep -c`.', 'Small tools + streams beat one mega-script.'],
    mistakes: ['Redirecting the wrong stage of the pipe'],
    hint: 'grep ERROR app.log | wc -l > error_count.txt',
    par: 3,
    solution: 'grep ERROR app.log | wc -l > error_count.txt',
    steps: [
      { command: 'grep ERROR app.log', note: 'Filter' },
      { command: 'grep ERROR app.log | wc -l', note: 'Count' },
      { command: 'grep ERROR app.log | wc -l > error_count.txt', note: 'Save count' },
    ],
    start: {
      cwd: '/home/ubuntu',
      tree: homeTree({
        'app.log': { type: 'file', owner: 'ubuntu', content: 'INFO ok\nERROR a\nERROR b\nINFO done\n' },
      }),
    },
    dialog: [modal('Compose', 'Count ERROR lines and save the number to **`error_count.txt`** (content `2`).')],
    check: (fs) => {
      const n = fs.get('/home/ubuntu/error_count.txt');
      return !!n && (n.content || '').trim() === '2';
    },
  },
];
