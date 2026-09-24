/**
 * Node smoke test for learn-linux core modules.
 * Run: node --input-type=module js/smoke.js
 */

import { VirtualFS, defaultTree } from './fs.js';
import { parseLine, tokenize } from './parser.js';
import { ShellSession } from './shell.js';
import { levels } from './levels.js';
import { loadProgress, recordWin, summarizeCurriculum } from './progress.js';
import { buildShareTargets, shareMessageLinkedIn, SHARE_URL } from './share.js';
import { solutionProgress, currentStepIndex } from './solution.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const t = tokenize('echo "hello world" > f.txt');
assert(Array.isArray(t), 'tokenize fail ' + JSON.stringify(t));
assert(t.join(' ') === 'echo hello world > f.txt' || t.includes('hello world'), 'tokens: ' + JSON.stringify(t));

const p = parseLine('grep ERROR app.log | wc -l');
assert(Array.isArray(p) && p[0]?.stages?.length === 2, 'pipeline parse ' + JSON.stringify(p));

const fs = new VirtualFS({ treeSpec: defaultTree('ubuntu') });
assert(fs.get('/home/ubuntu/notes.txt')?.type === 'file', 'seed notes.txt');
fs.chdir('projects');
assert(fs.cwd === '/home/ubuntu/projects', 'chdir');

const s = new ShellSession({});
s.enterSandbox();
s.exec('mkdir demo && touch demo/a.txt');
assert(s.fs.get('/home/ubuntu/demo/a.txt'), 'touch via &&');

s.exec('echo "line one" > message.txt');
const m = s.fs.get('/home/ubuntu/message.txt');
assert((m?.content || '').trim() === 'line one', 'redirect got ' + JSON.stringify(m?.content));

s.exec('echo one > notes.log; echo two >> notes.log');
const log = s.fs.get('/home/ubuntu/notes.log');
assert((log?.content || '').trim().split('\n').join(',') === 'one,two', 'append got ' + JSON.stringify(log?.content));

const lsOut = s.exec('ls');
assert((lsOut[0].stdout || '').includes('demo'), 'ls lists demo');

// pipeline count
const wins = [];
const fails = [];
/** Commands that actually satisfy check() (solutions may be didactic). */
const winCommands = {
  'files-touch': 'touch notes/todo.txt',
  'perm-octal': 'chmod 600 .ssh/id_rsa',
  'perm-symbolic': 'chmod go-w shared.txt',
  'proc-kill': 'kill 100',
  'proc-signals': 'kill -15 100',
  'user-mod': 'sudo useradd alice; sudo usermod -aG sudo alice',
  'user-sudo-install': 'sudo apt install curl',
  'user-add': 'sudo useradd alice',
  'pkg-install': 'sudo apt install curl',
  'pkg-remove': 'sudo apt install curl; sudo apt remove curl',
  'pkg-update': 'sudo apt update',
  'pkg-list': 'apt list --installed',
  'pkg-policy': 'apt policy bash',
  'pkg-dpkg': 'dpkg -l',
  'sec-sudo-denied': 'sudo apt install curl',
  'svc-start': 'sudo systemctl start nginx',
  'svc-stop': 'sudo systemctl start nginx; sudo systemctl stop nginx',
  'svc-enable': 'sudo systemctl enable nginx',
  'svc-status': 'systemctl status ssh',
  'svc-list': 'systemctl list-units',
  'svc-journal': 'journalctl -u ssh',
  'svc-cron': 'crontab -l',
  'user-cron': 'crontab -l',
  'net-ip': 'ip addr',
  'net-route': 'ip route',
  'net-ss': 'ss',
  'net-ping': 'ping -c 2 127.0.0.1',
  'net-curl': 'curl http://localhost/',
  'net-hosts': 'cat /etc/hosts',
  'net-dns': 'nslookup localhost',
  'net-ifconfig': 'ifconfig',
  'sec-authlog': 'cat /var/log/auth.log',
  'sec-passwd': 'passwd',
  'sec-key': 'chmod 600 .ssh/id_rsa',
  'fs-ln': 'ln notes.txt notes-hard; ln -s notes.txt notes-soft',
  'fs-stat': 'stat notes.txt',
  'fs-mount': 'mount; cat /etc/fstab',
  'fs-lsblk': 'lsblk',
  'fs-dmesg': 'dmesg',
  'shell-vars': 'echo $HOME',
  'shell-which': 'which ls',
  'shell-man': 'man ls',
  'shell-script': 'echo "#!/bin/bash" > hello.sh; echo "echo hi" >> hello.sh; chmod +x hello.sh',
  'shell-true-false-if': 'true && echo yes',
  'shell-quoting': 'touch "my notes.txt"',
  'shell-if-script': 'echo "#!/bin/bash" > check.sh; echo "if [ -f notes.txt ]; then echo has; fi" >> check.sh; chmod +x check.sh',
  'shell-for-loop': 'touch a.txt; touch b.txt; touch c.txt',
  'shell-while': 'echo "#!/bin/bash" > loop.sh; echo "i=1" >> loop.sh; echo "while [ $i -le 2 ]; do touch f$i.txt; i=$((i+1)); done" >> loop.sh; chmod +x loop.sh',
  'shell-case': 'echo "#!/bin/bash" > cmd.sh; echo "case $1 in start) echo up ;; stop) echo down ;; esac" >> cmd.sh; chmod +x cmd.sh',
  'shell-function': 'echo "#!/bin/bash" > fn.sh; echo "greet() { echo hi; }; greet" >> fn.sh; chmod +x fn.sh',
  'shell-set-e': 'echo "#!/bin/bash" > safe.sh; echo "set -e" >> safe.sh; echo "true" >> safe.sh; chmod +x safe.sh',
  'shell-quiz': 'true',
  'sec-acl': 'setfacl -m u:bob:rw shared.txt',
  'sec-acl-group': 'setfacl -m g:dev:r shared.txt',
  'sec-ssh-keygen': 'ssh-keygen -t rsa -f .ssh/id_rsa',
  'sec-sudoers': 'sudo visudo',
  'sec-find-perm': 'find . -perm -002',
  'sec-quiz': 'true',
  'net-addr-add': 'sudo ip addr add 10.0.2.50/24 dev eth0',
  'net-route-add': 'sudo ip route add 192.168.5.0/24 via 10.0.2.2',
  'net-quiz': 'true',
  'proc-kill-l': 'kill -l',
  'pkg-hold': 'apt policy bash',
  'svc-unit': 'systemctl cat ssh',
  'text-sed-i': "sed -i 's/old/new/' edit.txt",
  'text-awk-nf': "awk '{print $NF}' report.tsv",
  'fs-find-user': 'find . -user ubuntu',
  'cap-final': 'echo "#!/bin/bash" > ops.sh; echo "set -e" >> ops.sh; echo "case $1 in run) i=1; while [ $i -le 2 ]; do touch out$i.txt; i=$((i+1)); done ;; esac" >> ops.sh; chmod +x ops.sh',
  'text-sort': 'sort names.txt',
  'text-uniq': 'sort names.txt | uniq -c',
  'text-cut': 'cut -d: -f1 /etc/passwd',
  'text-sed': "sed 's/red/green/' colors.txt",
  'text-awk': "awk '{print $1}' report.tsv",
  'text-tee': 'echo done | tee status.txt',
  'user-passwd-read': 'cat /etc/passwd; cat /etc/group',
};
for (const lv of levels) {
  try {
    s.loadLevel(lv);
    s.exec(winCommands[lv.id] || lv.solution);
    if (lv.check(s.fs, s)) wins.push(lv.id);
    else fails.push(lv.id);
  } catch (e) {
    fails.push(lv.id + ': ' + e.message);
  }
}

console.log('levels total', levels.length, 'solution-wins', wins.length, 'fails', fails);
if (fails.length) {
  console.error('LEVEL FAILS', fails);
  process.exit(1);
}

// chmod levels that need precise bits
s.loadLevel(levels.find((l) => l.id === 'perm-octal'));
s.exec('chmod 600 .ssh/id_rsa');
const key = s.fs.get('/home/ubuntu/.ssh/id_rsa');
assert(key && key.mode === 0o600, 'octal mode got ' + key?.mode?.toString(8));

s.loadLevel(levels.find((l) => l.id === 'perm-symbolic'));
s.exec('chmod go-w shared.txt');
const sh = s.fs.get('/home/ubuntu/shared.txt');
assert((sh.mode & 0o200) && !(sh.mode & 0o020) && !(sh.mode & 0o002), 'symbolic go-w got ' + sh.mode.toString(8));

console.log('SMOKE OK');

// Share + curriculum + sticky checklist
const progress = recordWin('intro-pwd', 1, 1);
const summary = summarizeCurriculum(loadProgress());
assert(summary.solvedCount >= 1, 'curriculum solvedCount');
assert(summary.learned.some((l) => l.id === 'intro-pwd'), 'curriculum learned list');

const targets = buildShareTargets({
  levelName: 'Where am I?',
  levelId: 'intro-pwd',
  commands: 1,
  par: 1,
  curriculum: summary,
});
assert(targets.linkedin.includes('linkedin.com/shareArticle'), 'linkedin url');
assert(targets.x.includes('twitter.com/intent/tweet'), 'x url');
assert(targets.facebook.includes('facebook.com/sharer'), 'facebook url');
assert(targets.text.includes('Where am I?') || targets.text.includes('learned so far'), 'linkedin body');
assert(targets.text.includes(SHARE_URL) || targets.text.includes('learn-linux'), 'share link in body');
assert(shareMessageLinkedIn({
  levelName: 'x',
  levelId: 'x',
  commands: 2,
  par: 1,
  curriculum: summary,
}).includes('What I have learned so far:'), 'linkedin curriculum section');

const ss = new ShellSession({});
ss.enterSandbox();
ss.exec('pwd');
const lv = levels.find((l) => l.id === 'intro-pwd');
const steps = solutionProgress(ss, lv);
assert(steps[0].done === true, 'sticky step done');
assert(currentStepIndex(steps) === -1, 'all steps complete');

console.log('SHARE+PROGRESS OK');
