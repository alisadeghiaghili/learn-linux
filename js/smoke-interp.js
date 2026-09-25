/**
 * Smoke: script interpreter actually executes control flow.
 */

import { ShellSession } from './shell.js';
import { runScript, parseScript, evalTest, expand } from './interp.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// unit
assert(evalTest('[ -f foo ]', {}), 'test -f');
assert(evalTest('[ 1 -eq 1 ]', {}), 'test -eq');
assert(!evalTest('[ 1 -eq 2 ]', {}), 'test -ne');
assert(expand('echo $((1+2))', {}) === 'echo 3', 'arith');
assert(expand('echo $HOME', { HOME: '/home/ubuntu' }) === 'echo /home/ubuntu', 'expand');

const lines = parseScript(`#!/bin/bash\n# c\nset -e\ntrue\n`);
assert(lines.some((l) => l.includes('set -e')), 'parse set -e');

// end-to-end via session
const s = new ShellSession({});
s.enterSandbox();
s.exec('echo "#!/bin/bash" > loop.sh');
s.exec('echo "set -e" >> loop.sh');
s.exec('echo "i=1" >> loop.sh');
s.exec('echo "while [ $i -le 2 ]; do touch f$i.txt; i=$((i+1)); done" >> loop.sh');
s.exec('chmod +x loop.sh');
s.exec('bash loop.sh');
assert(s.fs.get('/home/ubuntu/f1.txt'), 'while created f1');
assert(s.fs.get('/home/ubuntu/f2.txt'), 'while created f2');

const s2 = new ShellSession({});
s2.enterSandbox();
s2.exec('echo "#!/bin/bash" > cmd.sh');
s2.exec('echo "case $1 in start) touch started.flag ;; stop) touch stopped.flag ;; esac" >> cmd.sh');
s2.exec('chmod +x cmd.sh');
s2.exec('bash cmd.sh start');
assert(s2.fs.get('/home/ubuntu/started.flag'), 'case start');
assert(!s2.fs.get('/home/ubuntu/stopped.flag'), 'case stop not run');

const s3 = new ShellSession({});
s3.enterSandbox();
s3.exec('echo "#!/bin/bash" > check.sh');
s3.exec('echo "if [ -f notes.txt ]; then touch yes.flag; fi" >> check.sh');
s3.exec('touch notes.txt');
s3.exec('bash check.sh');
assert(s3.fs.get('/home/ubuntu/yes.flag'), 'if then');

const s4 = new ShellSession({});
s4.enterSandbox();
s4.exec('echo "#!/bin/bash" > fn.sh');
s4.exec('echo "greet() { touch greeted.flag; }; greet" >> fn.sh');
s4.exec('bash fn.sh');
assert(s4.fs.get('/home/ubuntu/greeted.flag'), 'function call');

console.log('INTERP OK');
