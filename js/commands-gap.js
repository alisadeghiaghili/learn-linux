/**
 * Gap-closing commands: ACL, SSH keys, sudoers, network write, kill -l.
 */

const ok = (stdout = '') => ({ stdout, stderr: '', code: 0 });
const fail = (stderr, code = 1) => ({ stdout: '', stderr, code });
const line = (s = '') => (s.endsWith('\n') || s === '' ? s : s + '\n');

function needRoot(ctx, what) {
  if (ctx.fs.user === 'root' || ctx.fs.sudoOk) return null;
  return fail(`${what}: Permission denied (try sudo)`, 1);
}

function ensureDirChain(fs, dirPath) {
  const parts = dirPath.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    if (!fs.exists(cur)) {
      const parent = cur.slice(0, cur.lastIndexOf('/')) || '/';
      const name = cur.slice(cur.lastIndexOf('/') + 1);
      fs.create(parent === '' ? '/' : parent, name, 'dir', { mode: 0o700 });
    }
  }
}

export const gapCommands = {
  getfacl(ctx, argv) {
    const p = argv.filter((a) => !a.startsWith('-'))[0];
    if (!p) return fail('Usage: getfacl FILE...');
    const n = ctx.fs.get(ctx.fs.resolve(p));
    if (!n) return fail(`getfacl: ${p}: No such file or directory`);
    const bits = (m, s) => {
      const v = (m >> s) & 7;
      return `${v & 4 ? 'r' : '-'}${v & 2 ? 'w' : '-'}${v & 1 ? 'x' : '-'}`;
    };
    const a = n.acl || {};
    const rows = [
      `# file: ${p}`,
      `# owner: ${n.owner}`,
      `# group: ${n.group}`,
      `user::${bits(n.mode, 6)}`,
    ];
    if (a.user) rows.push(`user:${a.user}:rw-`);
    rows.push(`group::${bits(n.mode, 3)}`);
    if (a.group) rows.push(`group:${a.group}:r--`);
    rows.push('mask::rw-');
    rows.push(`other::${bits(n.mode, 0)}`);
    return ok(line(rows.join('\n')));
  },

  setfacl(ctx, argv) {
    const args = argv.filter((a) => a !== '-m' && a !== '-x' && !a.startsWith('--'));
    const spec = args.find((a) => /^[ugo]:/.test(a));
    const p = args.filter((a) => !/^[ugo]:/.test(a) && !a.startsWith('-')).pop();
    if (!spec || !p) return fail('Usage: setfacl -m u:user:rw FILE');
    const n = ctx.fs.get(ctx.fs.resolve(p));
    if (!n) return fail(`setfacl: ${p}: No such file or directory`);
    if (ctx.fs.user !== 'root' && !ctx.fs.sudoOk && n.owner !== ctx.fs.user) {
      return fail(`setfacl: ${p}: Operation not permitted`, 1);
    }
    const [kind, name] = spec.split(':');
    n.acl = n.acl || {};
    if (kind === 'u') n.acl.user = name;
    if (kind === 'g') n.acl.group = name;
    return ok('');
  },

  'ssh-keygen'(ctx, argv) {
    const fIdx = argv.indexOf('-f');
    const path = fIdx !== -1 ? argv[fIdx + 1] : '.ssh/id_rsa';
    const abs = ctx.fs.resolve(path);
    const parent = abs.slice(0, abs.lastIndexOf('/'));
    const base = abs.slice(abs.lastIndexOf('/') + 1);
    ensureDirChain(ctx.fs, parent);
    ctx.fs.create(parent, base, 'file', {
      content: '-----BEGIN OPENSSH PRIVATE KEY-----\nSIMULATED\n-----END OPENSSH PRIVATE KEY-----\n',
      mode: 0o600,
    });
    ctx.fs.create(parent, `${base}.pub`, 'file', {
      content: `ssh-rsa SIMULATEDPUB ${ctx.fs.user}@learn\n`,
      mode: 0o644,
    });
    return ok(
      line(
        [
          'Generating public/private rsa key pair.',
          `Your identification has been saved in ${path}`,
          `Your public key has been saved in ${path}.pub`,
        ].join('\n')
      )
    );
  },

  ssh(ctx, argv) {
    const host = argv.filter((a) => !a.startsWith('-')).pop() || 'localhost';
    return ok(line(`Welcome to Ubuntu 24.04 (simulated login to ${host})\n`));
  },

  scp() {
    return ok(line('simulated: file transferred\n'));
  },

  visudo() {
    return ok(line('visudo: /etc/sudoers parsed OK (simulated)\n'));
  },

  ip(ctx, argv) {
    const what = argv[0] || 'addr';
    const rest = argv.slice(1);
    ctx.fs.runtime.net = ctx.fs.runtime.net || {
      addrs: ['1: lo    inet 127.0.0.1/8 scope host lo', '2: eth0  inet 10.0.2.15/24 brd 10.0.2.255'],
      routes: ['default via 10.0.2.2 dev eth0', '10.0.2.0/24 dev eth0 proto kernel scope link'],
    };
    const writing = (what === 'addr' || what === 'a' || what === 'route' || what === 'r') &&
      (rest[0] === 'add' || rest[0] === 'del' || rest[0] === 'delete');
    if (writing) {
      const denied = needRoot(ctx, 'ip');
      if (denied) return denied;
    }
    if (what === 'addr' || what === 'a') {
      if (rest[0] === 'add') {
        ctx.fs.runtime.net.addrs.push(`3: dummy0 inet ${rest.slice(1).join(' ')}`);
        return ok('');
      }
      if (rest[0] === 'del' || rest[0] === 'delete') {
        const spec = rest.slice(1).join(' ');
        ctx.fs.runtime.net.addrs = ctx.fs.runtime.net.addrs.filter((a) => !a.includes(spec));
        return ok('');
      }
      return ok(line(ctx.fs.runtime.net.addrs.join('\n') + '\n'));
    }
    if (what === 'route' || what === 'r') {
      if (rest[0] === 'add') {
        ctx.fs.runtime.net.routes.push(rest.slice(1).join(' '));
        return ok('');
      }
      if (rest[0] === 'del' || rest[0] === 'delete') {
        const spec = rest.slice(1).join(' ');
        ctx.fs.runtime.net.routes = ctx.fs.runtime.net.routes.filter((r) => !r.includes(spec));
        return ok('');
      }
      return ok(line(ctx.fs.runtime.net.routes.join('\n') + '\n'));
    }
    if (what === 'link' || what === 'l') {
      return ok(line('1: lo: <LOOPBACK,UP> mtu 65536\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500'));
    }
    return fail('ip: use addr|route|link (add/del needs sudo)');
  },

  'systemctl-cat'(ctx, argv) {
    const unit = argv[0] || 'ssh.service';
    return ok(
      line(
        [
          '[Unit]',
          `Description=${unit.replace('.service', '')}`,
          'After=network.target',
          '',
          '[Service]',
          'ExecStart=/usr/sbin/sshd -D',
          'Restart=on-failure',
          '',
          '[Install]',
          'WantedBy=multi-user.target',
        ].join('\n')
      )
    );
  },
};

/**
 * Merge gap commands and wrap kill for -l.
 * @param {Record<string, Function>} commands
 */
export function mergeGapCommands(commands) {
  const baseKill = commands.kill.bind(commands);
  commands.kill = (ctx, argv, stdin) => {
    if (argv.includes('-l') || argv.includes('-L')) {
      return ok(
        line(
          [
            ' 1) SIGHUP\t2) SIGINT\t3) SIGQUIT\t4) SIGILL',
            ' 9) SIGKILL\t15) SIGTERM\t18) SIGCONT\t19) SIGSTOP',
          ].join('\n')
        )
      );
    }
    return baseKill(ctx, argv, stdin);
  };
  Object.assign(commands, gapCommands);
}
