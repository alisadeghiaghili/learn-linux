/**
 * Smoke-test the browser entry graph without a DOM.
 * Confirms every static import used by app.js resolves.
 */

import { ShellSession } from './shell.js';
import { VirtualFS, defaultTree, formatMode, normalizePath, splitPath } from './fs.js';
import { parseLine, tokenize, splitStatements, globToRegExp } from './parser.js';
import { commands, metaCommands } from './commands.js';
import { levels, sequences, levelsIn, getLevel } from './levels.js';
import { loadProgress, recordWin } from './progress.js';
import { runDemo } from './shell.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(typeof ShellSession === 'function', 'ShellSession');
assert(typeof VirtualFS === 'function', 'VirtualFS');
assert(typeof commands.ls === 'function', 'commands.ls');
assert(metaCommands.has('undo'), 'metaCommands');
assert(sequences.length >= 6, 'sequences');
assert(levelsIn('intro').length >= 4, 'intro levels');

// tokenize quotes
const tok = tokenize('grep -i "disk full" app.log');
assert(tok.includes('disk full'), 'quoted token ' + JSON.stringify(tok));

// glob
assert(globToRegExp('*.log').test('a.log'), 'glob');

// demo runner
const demo = runDemo(levels[0], 'whoami');
assert(demo.stdout.includes('ubuntu'), 'demo whoami');

// formatMode
assert(formatMode(0o755, 'dir') === 'drwxr-xr-x', 'formatMode ' + formatMode(0o755, 'dir'));
assert(formatMode(0o600, 'file') === '-rw-------', 'formatMode 600');

// normalize
assert(normalizePath('/home/ubuntu', 'a/../b') === '/home/ubuntu/b', 'normalize');
assert(splitPath('/home/ubuntu/x').base === 'x', 'splitPath');

// history / undo
const s = new ShellSession({});
s.enterSandbox();
s.exec('touch only.txt');
assert(s.fs.get('/home/ubuntu/only.txt'), 'touch');
s.undo();
assert(!s.fs.get('/home/ubuntu/only.txt'), 'undo removes');

// pipes + redirect end-to-end
s.exec('echo INFO ok > app.log');
s.exec('echo ERROR a >> app.log');
s.exec('echo ERROR b >> app.log');
s.exec('grep ERROR app.log | wc -l > error_count.txt');
const cnt = s.fs.get('/home/ubuntu/error_count.txt');
assert((cnt?.content || '').trim() === '2', 'capstone got ' + JSON.stringify(cnt?.content));

// permission denied path is not used yet — chmod works
s.exec('touch run.sh');
s.exec('chmod +x run.sh');
assert(s.fs.get('/home/ubuntu/run.sh').mode & 0o100, 'chmod +x');

console.log('BUNDLE GRAPH OK');
