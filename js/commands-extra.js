/**
 * Extended commands: text filters, users, devices, networking, packages, services.
 * Merged into the command table by commands.js.
 */

import { splitPath, formatMode } from './fs.js';

/**
 * @param {string} stdout
 * @param {string} [stderr]
 * @param {number} [code]
 */
const ok = (stdout = '') => ({ stdout, stderr: '', code: 0 });
const fail = (stderr, code = 1) => ({ stdout: '', stderr, code });
const line = (s = '') => (s.endsWith('\n') || s === '' ? s : s + '\n');

function readStdinOrFiles(ctx, argv, stdin) {
  const files = argv.filter((a) => !a.startsWith('-'));
  if (!files.length) return [{ name: null, text: stdin || '' }];
  return files.map((f) => {
    const abs = ctx.fs.resolve(f);
    const n = ctx.fs.get(abs);
    if (!n || n.type !== 'file') return { name: f, text: null, err: `no file ${f}` };
    return { name: f, text: n.content || '' };
  });
}

/** @type {Record<string, Function>} */
export const extraCommands = {
  // ── text filters ─────────────────────────────────────────
  sort(ctx, argv, stdin) {
    let numeric = argv.includes('-n') || argv.includes('-nr');
    let reverse = argv.includes('-r') || argv.includes('-nr');
    let unique = argv.includes('-u');
    const files = argv.filter((a) => !a.startsWith('-'));
    let text = stdin || '';
    if (files.length) {
      const n = ctx.fs.get(ctx.fs.resolve(files[0]));
      if (!n) return fail(`sort: cannot read: ${files[0]}: No such file or directory`);
      text = n.content || '';
    }
    let lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    lines.sort((a, b) => (numeric ? Number(a) - Number(b) || a.localeCompare(b) : a.localeCompare(b)));
    if (reverse) lines.reverse();
    if (unique) lines = [...new Set(lines)];
    return ok(line(lines.join('\n')));
  },

  uniq(ctx, argv, stdin) {
    const count = argv.includes('-c');
    const onlyDup = argv.includes('-d');
    let lines = (stdin || '').split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    /** @type {{s: string, n: number}[]} */
    const runs = [];
    for (const l of lines) {
      const last = runs[runs.length - 1];
      if (last && last.s === l) last.n += 1;
      else runs.push({ s: l, n: 1 });
    }
    let out = runs;
    if (onlyDup) out = out.filter((r) => r.n > 1);
    return ok(
      line(
        out
          .map((r) => (count ? `${String(r.n).padStart(7)} ${r.s}` : r.s))
          .join('\n')
      )
    );
  },

  cut(ctx, argv, stdin) {
    const fIdx = argv.indexOf('-f');
    const dIdx = argv.indexOf('-d');
    const cIdx = argv.indexOf('-c');
    const delim = dIdx !== -1 ? argv[dIdx + 1] || '\t' : '\t';
    const files = argv.filter((a) => !a.startsWith('-') && a !== delim && !(fIdx !== -1 && a === argv[fIdx + 1]) && !(cIdx !== -1 && a === argv[cIdx + 1]) && !(dIdx !== -1 && a === argv[dIdx + 1]));
    let text = stdin || '';
    if (files.length) {
      const n = ctx.fs.get(ctx.fs.resolve(files[0]));
      if (!n) return fail(`cut: ${files[0]}: No such file or directory`);
      text = n.content || '';
    }
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    if (cIdx !== -1) {
      // simple char ranges like 1-3 or 5
      const spec = argv[cIdx + 1] || '';
      const parseRanges = (s) =>
        s.split(',').map((part) => {
          const [a, b] = part.split('-').map(Number);
          return b ? [a, b] : [a, a];
        });
      const ranges = parseRanges(spec);
      return ok(
        line(
          lines
            .map((l) => ranges.map(([a, b]) => l.slice(a - 1, b)).join(''))
            .join('\n')
        )
      );
    }
    const fields = (argv[fIdx + 1] || '1')
      .split(',')
      .map((x) => Number(x.split('-')[0]));
    return ok(
      line(
        lines
          .map((l) => fields.map((f) => l.split(delim)[f - 1] ?? '').join(delim))
          .join('\n')
      )
    );
  },

  tr(ctx, argv, stdin) {
    const set1 = (argv[0] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const set2 = (argv[1] || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    let text = stdin || '';
    if (argv.includes('-d')) {
      return ok(line([...text].filter((ch) => !set1.includes(ch)).join('').replace(/\n$/, '')));
    }
    const map = new Map();
    for (let i = 0; i < set1.length; i++) map.set(set1[i], set2[i] ?? set2[set2.length - 1] ?? '');
    return ok([...text].map((ch) => (map.has(ch) ? map.get(ch) : ch)).join(''));
  },

  tee(ctx, argv, stdin) {
    const append = argv.includes('-a');
    const files = argv.filter((a) => !a.startsWith('-'));
    let out = stdin || '';
    for (const f of files) {
      const abs = ctx.fs.resolve(f);
      let n = ctx.fs.get(abs);
      if (!n) {
        const p = splitPath(abs);
        n = ctx.fs.create(p.dir, p.base, 'file', { content: '' });
      }
      n.content = append ? (n.content || '') + out : out;
      n.mtime = Date.now();
    }
    return ok(out);
  },

  sed(ctx, argv, stdin) {
    // sed 's/foo/bar/' or s/foo/bar/g
    const script = argv.find((a) => !a.startsWith('-') && /[s\/]/.test(a));
    const files = argv.filter((a) => !a.startsWith('-') && a !== script);
    let text = stdin || '';
    if (files.length) {
      const n = ctx.fs.get(ctx.fs.resolve(files[0]));
      if (!n) return fail(`sed: can't read ${files[0]}: No such file or directory`);
      text = n.content || '';
    }
    if (!script) return fail('sed: missing script');
    const m = script.match(/^s\/(.*)\/(.*)\/([g]?)$/);
    if (!m) return fail('sed: unsupported script (use s/pat/rep/)');
    const re = new RegExp(m[1], m[3] ? 'g' : '');
    return ok(text.replace(re, m[2]));
  },

  awk(ctx, argv, stdin) {
    // awk '{print $1}'  |  awk -F: '{print $1}'
    let sep = /\s+/;
    const parts = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '-F') {
        sep = new RegExp(argv[i + 1] || '\\s+');
        i++;
      } else if (!argv[i].startsWith('-')) parts.push(argv[i]);
    }
    const prog = parts[0] || '{print}';
    const files = parts.slice(1);
    let text = stdin || '';
    if (files.length) {
      const n = ctx.fs.get(ctx.fs.resolve(files[0]));
      if (!n) return fail(`awk: can't open file ${files[0]}`);
      text = n.content || '';
    }
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    const printAll = /^\{\s*print\s*\}$/.test(prog.trim());
    const printField = prog.match(/\{\s*print\s+\$([0-9]+)\s*\}/);
    const printFields = prog.match(/\{\s*print\s+\$([0-9]+)\s*,\s*\$([0-9]+)\s*\}/);
    const out = lines.map((l) => {
      const f = l.split(sep);
      if (printAll) return l;
      if (printFields) return `${f[Number(printFields[1]) - 1] ?? ''} ${f[Number(printFields[2]) - 1] ?? ''}`.trim();
      if (printField) return f[Number(printField[1]) - 1] ?? '';
      // NF / NR helpers
      if (prog.includes('NF')) return String(f.filter(Boolean).length);
      return l;
    });
    return ok(line(out.join('\n')));
  },

  xargs(ctx, argv, stdin) {
    const args = (stdin || '').trim().split(/\s+/).filter(Boolean);
    const cmd = argv[0] || 'echo';
    return ok(line(args.join(' '))); // simulated: show the assembled command result as echo-like
  },

  diff(ctx, argv, stdin) {
    const files = argv.filter((a) => !a.startsWith('-'));
    if (files.length < 2) return fail('diff: missing operand');
    const a = ctx.fs.get(ctx.fs.resolve(files[0]));
    const b = ctx.fs.get(ctx.fs.resolve(files[1]));
    if (!a || !b) return fail('diff: missing file');
    if ((a.content || '') === (b.content || '')) return ok('');
    return {
      stdout: line(`1c1\n< ${(a.content || '').trim().split('\n')[0]}\n---\n> ${(b.content || '').trim().split('\n')[0]}\n`),
      stderr: '',
      code: 1,
    };
  },

  // ── identity / users ─────────────────────────────────────
  id(ctx) {
    const u = ctx.fs.runtime?.users?.find((x) => x.name === ctx.fs.user) || {
      name: ctx.fs.user,
      uid: 1000,
      gid: 1000,
      groups: ['sudo', ctx.fs.user],
    };
    return ok(
      line(
        `uid=${u.uid}(${u.name}) gid=${u.gid}(${u.name}) groups=${(u.groups || [])
          .map((g, i) => `${1000 + i}(${g})`)
          .join(',')}`
      )
    );
  },

  groups(ctx) {
    const u = ctx.fs.runtime?.users?.find((x) => x.name === ctx.fs.user);
    return ok(line((u?.groups || [ctx.fs.user, 'sudo']).join(' ')));
  },

  useradd(ctx, argv) {
    if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) {
      return fail(`useradd: Permission denied. (Need root — try sudo)`, 1);
    }
    const name = argv.filter((a) => !a.startsWith('-')).pop();
    if (!name) return fail('useradd: missing user name');
    ctx.fs.runtime.users = ctx.fs.runtime.users || [];
    if (ctx.fs.runtime.users.some((u) => u.name === name)) {
      return fail(`useradd: user '${name}' already exists`);
    }
    const uid = 1000 + ctx.fs.runtime.users.length;
    ctx.fs.runtime.users.push({ name, uid, gid: uid, groups: [name], home: `/home/${name}`, shell: '/bin/bash' });
    const home = `/home/${name}`;
    if (!ctx.fs.exists(home)) {
      ctx.fs._ensureDir(home);
      const n = ctx.fs.get(home);
      if (n) {
        n.owner = name;
        n.group = name;
        n.mode = 0o755;
      }
    }
    return ok('');
  },

  usermod(ctx, argv) {
    if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) {
      return fail(`usermod: Permission denied. (Need root — try sudo)`, 1);
    }
    const args = argv.filter((a) => !a.startsWith('-') || a === '-aG' || a === '-G');
    // usermod -aG sudo alice
    const gIdx = argv.indexOf('-aG') !== -1 ? argv.indexOf('-aG') : argv.indexOf('-G');
    if (gIdx !== -1 && argv[gIdx + 1] && argv[gIdx + 2]) {
      const group = argv[gIdx + 1];
      const name = argv[gIdx + 2];
      const u = ctx.fs.runtime.users?.find((x) => x.name === name);
      if (!u) return fail(`usermod: user '${name}' does not exist`);
      if (!u.groups.includes(group)) u.groups.push(group);
      return ok('');
    }
    return fail('usermod: unsupported flags in sim (use -aG)');
  },

  passwd(ctx, argv) {
    const name = argv[0] || ctx.fs.user;
    return ok(`passwd: password updated successfully for ${name} (simulated)\n`);
  },

  su(ctx, argv) {
    const name = argv.filter((a) => !a.startsWith('-')).pop() || 'root';
    const prev = ctx.fs.user;
    if (name === 'root' || ctx.fs.runtime?.users?.some((u) => u.name === name)) {
      ctx.fs.user = name === 'root' ? 'root' : name;
      ctx.fs.sudoOk = ctx.fs.user === 'root';
      return ok(`switched to ${ctx.fs.user} (simulated; type whoami)\n`);
    }
    return fail(`su: user ${name} does not exist`, 1);
  },

  sudo(ctx, argv, stdin) {
    if (!argv.length) return fail('usage: sudo <command>', 1);
    ctx.fs.sudoOk = true;
    // re-dispatch one command
    return { stdout: '', stderr: '', code: 0, rerun: argv.join(' ') };
  },

  // ── files meta / devices ─────────────────────────────────
  stat(ctx, argv) {
    const p = argv.find((a) => !a.startsWith('-'));
    if (!p) return fail('stat: missing operand');
    const n = ctx.fs.get(ctx.fs.resolve(p));
    if (!n) return fail(`stat: cannot statx '${p}': No such file or directory`);
    return ok(
      line(
        [
          `  File: ${p}`,
          `  Size: ${n.type === 'dir' ? 4096 : (n.content || '').length}\tBlocks: 8\tIO Block: 4096   ${n.type === 'dir' ? 'directory' : 'regular file'}`,
          `Device: 801h/2049d\tInode: ${1000 + n.path.length}\tLinks: ${n.type === 'dir' ? 2 : 1}`,
          `Access: (${(n.mode & 0o777).toString(8).padStart(4, '0')}/${formatMode(n.mode, n.type)})  Uid: ( 1000/${n.owner})   Gid: ( 1000/${n.group})`,
        ].join('\n')
      )
    );
  },

  ln(ctx, argv) {
    const soft = argv.includes('-s');
    const args = argv.filter((a) => !a.startsWith('-'));
    if (args.length < 2) return fail('ln: missing file operand');
    const target = args[0];
    const linkPath = ctx.fs.resolve(args[1]);
    const p = splitPath(linkPath);
    if (soft) {
      const n = ctx.fs.create(p.dir, p.base, 'file', {
        content: `SYMLINK ${target}\n`,
        mode: 0o777,
      });
      n.linkTo = target;
      n.linkKind = 'soft';
      return ok('');
    }
    // hard link: same content reference (copy content + mark)
    const src = ctx.fs.get(ctx.fs.resolve(target));
    if (!src) return fail(`ln: failed to access '${target}': No such file or directory`);
    const n = ctx.fs.create(p.dir, p.base, src.type, { content: src.content, mode: src.mode });
    n.linkKind = 'hard';
    n.linkTo = src.path;
    return ok('');
  },

  lsblk() {
    return ok(
      line(
        [
          'NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS',
          'sda      8:0    0    40G  0 disk',
          '├─sda1   8:1    0    38G  0 part /',
          '└─sda2   8:2    0     2G  0 part /home',
          'sr0     11:0    1   1.2G  0 rom',
        ].join('\n')
      )
    );
  },

  mount(ctx, argv) {
    if (!argv.length) {
      return ok(
        line(
          [
            '/dev/sda1 on / type ext4 (rw,errors=remount-ro)',
            '/dev/sda2 on /home type ext4 (rw)',
            'proc on /proc type proc (rw,nosuid,nodev,noexec)',
            'tmpfs on /tmp type tmpfs (rw,nosuid,nodev)',
          ].join('\n')
        )
      );
    }
    if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) {
      return fail('mount: only root can do that (try sudo)', 1);
    }
    return ok('');
  },

  umount(ctx) {
    if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) return fail('umount: only root can do that', 1);
    return ok('');
  },

  lscpu() {
    return ok(
      line(
        [
          'Architecture:            x86_64',
          'CPU op-mode(s):          32-bit, 64-bit',
          'CPU(s):                  4',
          'Model name:              Intel(R) Core(TM) i5',
          'Thread(s) per core:      1',
          'Virtualization:          VT-x',
        ].join('\n')
      )
    );
  },

  dmesg() {
    return ok(
      line(
        [
          '[    0.000000] Linux version 6.8.0-45-generic (buildd@lcy02)',
          '[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz',
          '[    1.234567] EXT4-fs (sda1): mounted filesystem with ordered data mode',
        ].join('\n')
      )
    );
  },

  // ── processes ────────────────────────────────────────────
  top(ctx) {
    const rows = [
      'top - 12:00:00 up  1:00,  1 user,  load average: 0.08, 0.10, 0.09',
      'Tasks:  80 total,   1 running,  79 sleeping',
      '%Cpu(s):  2.0 us,  0.5 sy,  0.0 ni, 97.0 id',
      '  PID USER      PR  NI    VIRT    RES  %CPU  %MEM COMMAND',
    ];
    rows.push('    1 root      20   0  169000  12000   0.0   0.2 systemd');
    rows.push(`   42 ${ctx.fs.user.padEnd(8)}  20   0   12000   5000   0.0   0.1 bash`);
    for (const p of ctx.fs.processes) {
      rows.push(
        `${String(p.pid).padStart(5)} ${p.user.padEnd(9)}  20   0   10000   4000  ${p.cpu.toFixed(1).padStart(4)}  ${p.mem.toFixed(1).padStart(4)} ${p.cmd}`
      );
    }
    return ok(line(rows.join('\n')));
  },

  nice(ctx, argv) {
    return ok(''); // records priority on next spawn in richer sim
  },

  renice() {
    return ok('');
  },

  killall(ctx, argv) {
    const name = argv.filter((a) => !a.startsWith('-')).pop();
    if (!name) return fail('killall: not enough arguments');
    const before = ctx.fs.processes.length;
    ctx.fs.processes = ctx.fs.processes.filter((p) => !p.cmd.includes(name));
    return ctx.fs.processes.length < before ? ok('') : fail(`killall: ${name}: no process found`);
  },

  // ── networking ───────────────────────────────────────────
  ip(ctx, argv) {
    const what = argv[0] || 'addr';
    if (what === 'addr' || what === 'a') {
      return ok(
        line(
          [
            '1: lo: <LOOPBACK,UP> mtu 65536',
            '    inet 127.0.0.1/8 scope host lo',
            '2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500',
            '    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic eth0',
          ].join('\n')
        )
      );
    }
    if (what === 'route' || what === 'r') {
      return ok(line('default via 10.0.2.2 dev eth0\n10.0.2.0/24 dev eth0 proto kernel scope link'));
    }
    if (what === 'link' || what === 'l') {
      return ok(line('1: lo: <LOOPBACK,UP> mtu 65536\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500'));
    }
    return fail('ip: unsupported object in sim (addr|route|link)');
  },

  ifconfig() {
    return ok(
      line(
        [
          'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500',
          '        inet 10.0.2.15  netmask 255.255.255.0  broadcast 10.0.2.255',
          'lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536',
          '        inet 127.0.0.1  netmask 255.0.0.0',
        ].join('\n')
      )
    );
  },

  ss() {
    return ok(
      line(
        [
          'Netid  State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port',
          'tcp    LISTEN  0       128            0.0.0.0:22          0.0.0.0:*',
          'tcp    LISTEN  0       511            0.0.0.0:80          0.0.0.0:*',
          'udp    UNCONN  0       0            127.0.0.1:631         0.0.0.0:*',
        ].join('\n')
      )
    );
  },

  netstat(ctx, argv) {
    return extraCommands.ss(ctx, argv, '');
  },

  ping(ctx, argv) {
    const host = argv.filter((a) => !a.startsWith('-') && !/^\d+$/.test(a)).pop() || 'localhost';
    if (host === '10.0.2.2' || host === 'gateway') {
      return fail(`ping: ${host}: Network is unreachable`);
    }
    return ok(
      line(
        [
          `PING ${host} (127.0.0.1) 56(84) bytes of data.`,
          `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.04 ms`,
          `64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.05 ms`,
          `--- ${host} ping statistics ---`,
          '2 packets transmitted, 2 received, 0% packet loss',
        ].join('\n')
      )
    );
  },

  curl(ctx, argv) {
    const url = argv.filter((a) => !a.startsWith('-')).pop();
    if (!url) return fail('curl: try \'curl --help\'');
    return ok(line(`<!doctype html><title>ok</title><body>GET ${url} 200 OK</body>\n`));
  },

  wget(ctx, argv) {
    const url = argv.filter((a) => !a.startsWith('-')).pop();
    return ok(line(`--2026-01-01 12:00:00--  ${url}\nSaving to: 'index.html'\nindex.html saved\n`));
  },

  nslookup(ctx, argv) {
    const host = argv[0] || 'localhost';
    return ok(line(`Server:\t\t127.0.0.53\nAddress:\t127.0.0.53#53\n\nName:\t${host}\nAddress: 127.0.0.1\n`));
  },

  // ── packages ─────────────────────────────────────────────
  apt(ctx, argv, stdin) {
    const sub = argv[0];
    const pkgs = argv.slice(1).filter((a) => !a.startsWith('-'));
    ctx.fs.runtime.packages = ctx.fs.runtime.packages || ['bash', 'coreutils', 'grep', 'sudo', 'systemd'];
    if (sub === 'update') {
      return ok(line('Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nReading package lists... Done\n'));
    }
    if (sub === 'install') {
      if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) {
        return fail('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to lock the administration directory (/var/lib/dpkg/), are you root?', 100);
      }
      for (const p of pkgs) if (!ctx.fs.runtime.packages.includes(p)) ctx.fs.runtime.packages.push(p);
      return ok(
        line(
          `Reading package lists... Done\n${pkgs.map((p) => `Setting up ${p} ...`).join('\n')}\ndpkg: done.\n`
        )
      );
    }
    if (sub === 'remove' || sub === 'purge') {
      if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) return fail('E: Could not open lock file (are you root?)', 100);
      ctx.fs.runtime.packages = ctx.fs.runtime.packages.filter((p) => !pkgs.includes(p));
      return ok(line(pkgs.map((p) => `Removing ${p} ...`).join('\n') + '\n'));
    }
    if (sub === 'list') {
      return ok(line(ctx.fs.runtime.packages.map((p) => `${p}/noble,now 1.0 amd64 [installed]`).join('\n') + '\n'));
    }
    if (sub === 'search') {
      return ok(line(pkgs.map((p) => `${p}/noble 1.0 amd64\n  fake package ${p}`).join('\n') + '\n'));
    }
    if (sub === 'policy') {
      return ok(line(`${pkgs[0] || 'bash'}:\n  Installed: 5.2\n  Candidate: 5.2\n  Version table:\n *** 5.2 500\n`));
    }
    return fail('apt: unknown subcommand (update|install|remove|purge|list|search|policy)');
  },

  dpkg(ctx, argv) {
    const sub = argv[0];
    ctx.fs.runtime.packages = ctx.fs.runtime.packages || ['bash'];
    if (sub === '-l' || sub === '--list') {
      return ok(
        line(
          'ii  bash     5.2  amd64  GNU Bourne Again SHell\nii  coreutils 9.4  amd64  GNU core utilities\n'
        )
      );
    }
    if (sub === '-S') {
      return ok(line(`${argv[1] || '/bin/ls'}: coreutils`));
    }
    return fail('dpkg: unsupported in sim (-l|-S)');
  },

  snap() {
    return fail('snap: not available in this training image', 1);
  },

  // ── services ─────────────────────────────────────────────
  systemctl(ctx, argv) {
    const sub = argv.filter((a) => !a.startsWith('-'))[0];
    const unit = argv.filter((a) => !a.startsWith('-'))[1] || '';
    ctx.fs.runtime.services = ctx.fs.runtime.services || {
      ssh: 'active',
      nginx: 'inactive',
      cron: 'active',
    };
    const name = unit.replace(/\.service$/, '');
    if (sub === 'status') {
      const st = ctx.fs.runtime.services[name] || 'inactive';
      return ok(
        line(
          [
            `● ${name}.service - ${name}`,
            `     Loaded: loaded (/lib/systemd/system/${name}.service; enabled)`,
            `     Active: ${st === 'active' ? 'active (running)' : 'inactive (dead)'}`,
          ].join('\n')
        )
      );
    }
    if (sub === 'start') {
      if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) {
        return fail(`Failed to start ${name}.service: Access denied\n`, 1);
      }
      ctx.fs.runtime.services[name] = 'active';
      return ok('');
    }
    if (sub === 'stop') {
      if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) return fail(`Failed to stop ${name}.service: Access denied\n`, 1);
      ctx.fs.runtime.services[name] = 'inactive';
      return ok('');
    }
    if (sub === 'restart') {
      if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk) return fail('Access denied', 1);
      ctx.fs.runtime.services[name] = 'active';
      return ok('');
    }
    if (sub === 'enable' || sub === 'disable') {
      return ok('');
    }
    if (sub === 'list-units' || sub === 'list-unit-files') {
      return ok(
        line(
          Object.entries(ctx.fs.runtime.services)
            .map(([k, v]) => `${k}.service loaded ${v === 'active' ? 'active' : 'inactive'} ${k}`)
            .join('\n')
        )
      );
    }
    return fail('systemctl: use status|start|stop|restart|enable|disable|list-units');
  },

  service(ctx, argv) {
    return extraCommands.systemctl(ctx, ['status', argv[0] || 'ssh'], '');
  },

  journalctl(ctx, argv) {
    const unitIdx = argv.indexOf('-u');
    const unit = unitIdx !== -1 ? argv[unitIdx + 1] : null;
    const lines = [
      'Jan 01 12:00:01 learn systemd[1]: Started Session 1 of user ubuntu.',
      'Jan 01 12:00:02 learn sshd[800]: Server listening on 0.0.0.0 port 22.',
      'Jan 01 12:00:03 learn kernel: EXT4-fs (sda1): mounted filesystem.',
    ];
    if (unit) {
      const name = unit.replace(/\.service$/, '');
      return ok(line(lines.filter((l) => l.includes(name) || l.includes('systemd')).join('\n') + '\n'));
    }
    return ok(line(lines.join('\n') + '\n'));
  },

  crontab(ctx, argv) {
    const list = argv.includes('-l');
    const edit = argv.includes('-e');
    if (list) return ok(line('*/5 * * * * /home/ubuntu/health.sh\n'));
    if (edit) return ok(line('crontab: installed (simulated edit)\n'));
    return fail('crontab: usage crontab -l|-e');
  },

  at() {
    return fail('at: not installed in this training image');
  },

  shutdown(ctx, argv) {
    return ok(line('Shutdown scheduled. (simulated — machine keeps running)\n'));
  },

  reboot() {
    return ok(line('Reboot scheduled. (simulated)\n'));
  },
};
