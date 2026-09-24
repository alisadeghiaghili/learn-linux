/**
 * Virtual Ubuntu-like filesystem and process table.
 *
 * The tree is an in-memory map of absolute paths to nodes. Paths use
 * POSIX separators and normalize `.` / `..` segments.
 */

/**
 * @typedef {'file'|'dir'} NodeType
 * @typedef {Object} VNode
 * @property {NodeType} type
 * @property {string} [content] file body (UTF-8 text)
 * @property {number} mode unix mode bits (e.g. 0o755)
 * @property {string} owner
 * @property {string} group
 * @property {number} mtime epoch ms
 * @property {VNode[]} children directory entries (dirs only)
 * @property {string} name
 * @property {string} path absolute path
 */

/**
 * Normalize a path against a working directory.
 *
 * @param {string} cwd Current working directory (absolute).
 * @param {string} target Raw path from the user.
 * @returns {string} Absolute normalized path.
 */
export function normalizePath(cwd, target) {
  if (!target || target === '.') return cwd;
  const base = target.startsWith('/') ? [] : cwd.split('/').filter(Boolean);
  const parts = target.split('/');
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      base.pop();
      continue;
    }
    base.push(part);
  }
  return '/' + base.join('/');
}

/**
 * @param {string} path
 * @returns {{dir: string, base: string}}
 */
export function splitPath(path) {
  const i = path.lastIndexOf('/');
  if (i <= 0) return { dir: '/', base: path.slice(1) || '' };
  return { dir: path.slice(0, i) || '/', base: path.slice(i + 1) };
}

/**
 * @param {number} mode
 * @returns {string} rwxr-xr-x style string
 */
export function formatMode(mode, type) {
  const bits = ['r', 'w', 'x'];
  let out = type === 'dir' ? 'd' : '-';
  for (let shift = 6; shift >= 0; shift -= 3) {
    const triple = (mode >> shift) & 0o7;
    for (let b = 0; b < 3; b++) {
      out += triple & (4 >> b) ? bits[b] : '-';
    }
  }
  return out;
}

/**
 * Deep-clone a plain object tree (VNode graph is a tree, not a DAG).
 * @param {any} value
 * @returns {any}
 */
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class VirtualFS {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.user]
   * @param {string} [opts.host]
   * @param {string} [opts.cwd]
   * @param {Object} [opts.treeSpec] serializable tree from levels
   */
  constructor(opts = {}) {
    this.user = opts.user || 'ubuntu';
    this.host = opts.host || 'learn';
    this.rootUser = 'root';
    /** @type {Map<string, VNode>} */
    this.nodes = new Map();
    this.cwd = opts.cwd || `/home/${this.user}`;
    this.processes = [];
    this.env = {
      HOME: `/home/${this.user}`,
      USER: this.user,
      SHELL: '/bin/bash',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      PWD: this.cwd,
      LANG: 'C.UTF-8',
      ...(opts.env || {}),
    };
    this._nextPid = 100;
    /** Simulated admin/runtime state (users, packages, services). */
    this.runtime = {
      users: [
        { name: 'root', uid: 0, gid: 0, groups: ['root'], home: '/root', shell: '/bin/bash' },
        { name: this.user, uid: 1000, gid: 1000, groups: [this.user, 'sudo'], home: `/home/${this.user}`, shell: '/bin/bash' },
      ],
      packages: ['bash', 'coreutils', 'grep', 'sudo', 'systemd', 'apt'],
      services: { ssh: 'active', cron: 'active', nginx: 'inactive' },
    };
    this.sudoOk = false;
    this.seed(opts.treeSpec || defaultTree(this.user));
  }

  /**
   * Build the node map from a serializable nested spec.
   * Spec node: { type: 'dir'|'file', content?, mode?, owner?, children?: {name: spec} }
   * @param {Object} spec
   */
  seed(spec) {
    this.nodes.clear();
    this._ingest('/', spec['/'] || spec.root || spec, this.rootUser);
    // Ensure standard skeleton exists even if a level used a sparse tree.
    for (const p of [
      '/',
      '/bin',
      '/usr',
      '/usr/bin',
      '/usr/local',
      '/usr/local/bin',
      '/etc',
      '/tmp',
      '/var',
      '/var/log',
      '/proc',
      '/home',
      `/home/${this.user}`,
    ]) {
      if (!this.nodes.has(p)) {
        this._ensureDir(p);
      }
    }
    if (!this.nodes.has(this.cwd)) {
      this._ensureDir(this.cwd);
    }
    this.env.PWD = this.cwd;
    this.env.HOME = `/home/${this.user}`;
    this.env.PATH = '/usr/local/bin:/usr/bin:/bin';
  }

  /**
   * @param {string} path
   * @param {Object} spec
   * @param {string} owner
   */
  _ingest(path, spec, owner) {
    if (!spec || typeof spec !== 'object') return;
    const type = spec.type === 'file' ? 'file' : 'dir';
    /** @type {VNode} */
    const node = {
      type,
      name: splitPath(path).base || '/',
      path,
      mode: spec.mode ?? (type === 'dir' ? 0o755 : 0o644),
      owner: spec.owner || owner,
      group: spec.group || spec.owner || owner,
      mtime: Date.now(),
      content: type === 'file' ? spec.content ?? '' : undefined,
      children: type === 'dir' ? [] : undefined,
    };
    this.nodes.set(path, node);
    if (type === 'dir' && spec.children) {
      for (const [name, child] of Object.entries(spec.children)) {
        const childPath = path === '/' ? `/${name}` : `${path}/${name}`;
        this._ingest(childPath, child, node.owner);
        const childNode = this.nodes.get(childPath);
        if (childNode) node.children.push(childNode);
      }
    }
  }

  /** @param {string} path */
  _ensureDir(path) {
    if (path === '/' || this.nodes.has(path)) return this.nodes.get(path);
    const { dir, base } = splitPath(path);
    this._ensureDir(dir);
    const parent = this.nodes.get(dir);
    if (!parent) return undefined;
    /** @type {VNode} */
    const node = {
      type: 'dir',
      name: base,
      path,
      mode: 0o755,
      owner: this.rootUser,
      group: this.rootUser,
      mtime: Date.now(),
      children: [],
    };
    this.nodes.set(path, node);
    parent.children.push(node);
    return node;
  }

  /**
   * @param {string} path absolute
   * @returns {VNode|undefined}
   */
  get(path) {
    return this.nodes.get(normalizePath('/', path));
  }

  /**
   * @param {string} path
   * @returns {boolean}
   */
  exists(path) {
    return this.nodes.has(normalizePath('/', path));
  }

  /**
   * @param {string} path
   * @returns {VNode|undefined}
   */
  getNode(path) {
    return this.get(path);
  }

  /**
   * Resolve user path to absolute.
   * @param {string} target
   */
  resolve(target) {
    if (target === '~') return this.env.HOME;
    if (target.startsWith('~/')) {
      return normalizePath(this.env.HOME, target.slice(2));
    }
    return normalizePath(this.cwd, target);
  }

  /**
   * List directory children sorted (dirs first, then name).
   * @param {string} path
   * @returns {VNode[]}
   */
  list(path) {
    const node = this.get(path);
    if (!node || node.type !== 'dir') return [];
    return [...node.children].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * @param {string} dirPath
   * @param {string} name
   * @param {NodeType} type
   * @param {Object} [opts]
   * @returns {VNode}
   * @throws {Error} with .code
   */
  create(dirPath, name, type, opts = {}) {
    const absDir = normalizePath('/', dirPath);
    const parent = this.get(absDir);
    if (!parent) {
      const err = new Error(`cannot create '${name}': No such file or directory`);
      err.code = 'ENOENT';
      throw err;
    }
    if (parent.type !== 'dir') {
      const err = new Error(`cannot create '${name}': Not a directory`);
      err.code = 'ENOTDIR';
      throw err;
    }
    if (parent.children.some((c) => c.name === name)) {
      const err = new Error(`cannot create '${name}': File exists`);
      err.code = 'EEXIST';
      throw err;
    }
    const path = absDir === '/' ? `/${name}` : `${absDir}/${name}`;
    /** @type {VNode} */
    const node = {
      type,
      name,
      path,
      mode: opts.mode ?? (type === 'dir' ? 0o755 : 0o644),
      owner: opts.owner || this.user,
      group: opts.group || opts.owner || this.user,
      mtime: Date.now(),
      content: type === 'file' ? opts.content ?? '' : undefined,
      children: type === 'dir' ? [] : undefined,
    };
    this.nodes.set(path, node);
    parent.children.push(node);
    parent.mtime = Date.now();
    return node;
  }

  /**
   * Remove a node (optionally recursive).
   * @param {string} path
   * @param {{recursive?: boolean, force?: boolean}} [opts]
   */
  remove(path, opts = {}) {
    const abs = normalizePath('/', path);
    const node = this.get(abs);
    if (!node) {
      if (opts.force) return;
      const err = new Error(`cannot remove '${path}': No such file or directory`);
      err.code = 'ENOENT';
      throw err;
    }
    if (abs === '/') {
      const err = new Error("it is dangerous to operate recursively on '/'");
      err.code = 'EPERM';
      throw err;
    }
    if (node.type === 'dir' && node.children.length && !opts.recursive) {
      const err = new Error(`cannot remove '${path}': Directory not empty`);
      err.code = 'ENOTEMPTY';
      throw err;
    }
    // drop subtree
    const stack = [node];
    while (stack.length) {
      const cur = stack.pop();
      if (cur.children) stack.push(...cur.children);
      this.nodes.delete(cur.path);
    }
    const { dir } = splitPath(abs);
    const parent = this.get(dir);
    if (parent && parent.children) {
      parent.children = parent.children.filter((c) => c.path !== abs);
      parent.mtime = Date.now();
    }
  }

  /**
   * Move or rename.
   * @param {string} from
   * @param {string} to
   */
  move(from, to) {
    const src = this.get(from);
    if (!src) {
      const err = new Error(`cannot stat '${from}': No such file or directory`);
      err.code = 'ENOENT';
      throw err;
    }
    const destAbs = normalizePath('/', to);
    let destDirPath;
    let destName;
    const destNode = this.get(destAbs);
    if (destNode && destNode.type === 'dir') {
      destDirPath = destAbs;
      destName = src.name;
    } else {
      const parts = splitPath(destAbs);
      destDirPath = parts.dir;
      destName = parts.base;
    }
    // unlink from old parent
    const srcParts = splitPath(src.path);
    const srcParent = this.get(srcParts.dir);
    if (srcParent) {
      srcParent.children = srcParent.children.filter((c) => c.path !== src.path);
    }
    this._rekey(src, destDirPath === '/' ? `/${destName}` : `${destDirPath}/${destName}`);
    const destParent = this.get(destDirPath);
    if (!destParent || destParent.type !== 'dir') {
      const err = new Error(`cannot move to '${to}': No such file or directory`);
      err.code = 'ENOENT';
      throw err;
    }
    // replace existing dest file
    const existing = destParent.children.find((c) => c.name === destName);
    if (existing) {
      this.remove(existing.path, { recursive: true, force: true });
    }
    src.name = destName;
    destParent.children.push(src);
    destParent.mtime = Date.now();
  }

  /**
   * @param {VNode} node
   * @param {string} newPath
   */
  _rekey(node, newPath) {
    const oldPath = node.path;
    const stack = [[node, newPath]];
    while (stack.length) {
      const [cur, path] = stack.pop();
      this.nodes.delete(cur.path);
      cur.path = path;
      cur.name = splitPath(path).base || '/';
      this.nodes.set(path, cur);
      if (cur.children) {
        for (const child of cur.children) {
          const childPath = path === '/' ? `/${child.name}` : `${path}/${child.name}`;
          stack.push([child, childPath]);
        }
      }
    }
  }

  /**
   * Copy file or directory tree.
   * @param {string} from
   * @param {string} to
   * @param {{recursive?: boolean}} [opts]
   */
  copy(from, to, opts = {}) {
    const src = this.get(from);
    if (!src) {
      const err = new Error(`cannot stat '${from}': No such file or directory`);
      err.code = 'ENOENT';
      throw err;
    }
    if (src.type === 'dir' && !opts.recursive) {
      const err = new Error(`-r not specified; omitting directory '${from}'`);
      err.code = 'EISDIR';
      throw err;
    }
    const destAbs = normalizePath('/', to);
    let destDirPath;
    let destName;
    const destNode = this.get(destAbs);
    if (destNode && destNode.type === 'dir') {
      destDirPath = destAbs;
      destName = src.name;
    } else {
      const parts = splitPath(destAbs);
      destDirPath = parts.dir;
      destName = parts.base || src.name;
    }
    const destParent = this.get(destDirPath);
    if (!destParent || destParent.type !== 'dir') {
      const err = new Error(`cannot create regular file '${to}': No such file or directory`);
      err.code = 'ENOENT';
      throw err;
    }
    this._copyInto(src, destParent, destName);
  }

  /**
   * @param {VNode} src
   * @param {VNode} destParent
   * @param {string} name
   */
  _copyInto(src, destParent, name) {
    const path = destParent.path === '/' ? `/${name}` : `${destParent.path}/${name}`;
    /** @type {VNode} */
    const clone = {
      type: src.type,
      name,
      path,
      mode: src.mode,
      owner: src.owner,
      group: src.group,
      mtime: Date.now(),
      content: src.type === 'file' ? src.content : undefined,
      children: src.type === 'dir' ? [] : undefined,
    };
    const existing = destParent.children.find((c) => c.name === name);
    if (existing) this.remove(existing.path, { recursive: true, force: true });
    this.nodes.set(path, clone);
    destParent.children.push(clone);
    if (src.type === 'dir' && src.children) {
      for (const child of src.children) {
        this._copyInto(child, clone, child.name);
      }
    }
  }

  /**
   * Change working directory.
   * @param {string} target
   */
  chdir(target) {
    const abs = this.resolve(target);
    const node = this.get(abs);
    if (!node) {
      const err = new Error(`bash: cd: ${target}: No such file or directory`);
      err.code = 'ENOENT';
      throw err;
    }
    if (node.type !== 'dir') {
      const err = new Error(`bash: cd: ${target}: Not a directory`);
      err.code = 'ENOTDIR';
      throw err;
    }
    this.cwd = abs;
    this.env.PWD = abs;
  }

  /**
   * Prompt path with ~ contraction.
   * @returns {string}
   */
  promptPath() {
    const home = this.env.HOME;
    if (this.cwd === home) return '~';
    if (this.cwd.startsWith(home + '/')) return '~' + this.cwd.slice(home.length);
    return this.cwd;
  }

  /**
   * Snapshot for undo.
   * @returns {{cwd: string, nodes: any, processes: any[], env: any, user: string, host: string}}
   */
  serialize() {
    /** @type {Record<string, any>} */
    const nodes = {};
    for (const [path, node] of this.nodes) {
      nodes[path] = deepClone({
        type: node.type,
        name: node.name,
        path: node.path,
        mode: node.mode,
        owner: node.owner,
        group: node.group,
        mtime: node.mtime,
        content: node.content,
        children: node.children ? node.children.map((c) => c.path) : undefined,
      });
    }
    return {
      cwd: this.cwd,
      user: this.user,
      host: this.host,
      env: { ...this.env },
      processes: deepClone(this.processes),
      nodes,
    };
  }

  /**
   * Restore from serialize() snapshot.
   * @param {any} snap
   */
  restore(snap) {
    this.cwd = snap.cwd;
    this.user = snap.user;
    this.host = snap.host;
    this.env = { ...snap.env };
    this.processes = deepClone(snap.processes || []);
    this.nodes.clear();
    /** @type {Record<string, VNode>} */
    const rebuilt = {};
    for (const [path, raw] of Object.entries(snap.nodes)) {
      rebuilt[path] = {
        ...raw,
        children: raw.type === 'dir' ? [] : undefined,
      };
      this.nodes.set(path, rebuilt[path]);
    }
    for (const node of Object.values(rebuilt)) {
      if (node.type !== 'dir' || !snap.nodes[node.path]?.children) continue;
      for (const childPath of snap.nodes[node.path].children) {
        const child = rebuilt[childPath];
        if (child) node.children.push(child);
      }
    }
  }

  /**
   * Spawn a fake process (for ps/kill levels).
   * @param {string} cmd
   * @param {Object} [opts]
   */
  spawnProcess(cmd, opts = {}) {
    const pid = this._nextPid++;
    const proc = {
      pid,
      cmd,
      user: opts.user || this.user,
      state: opts.state || 'S',
      cpu: opts.cpu ?? 0.0,
      mem: opts.mem ?? 0.1,
    };
    this.processes.push(proc);
    return proc;
  }

  /**
   * @param {number} pid
   * @returns {boolean} true if killed
   */
  killProcess(pid, signal = 'TERM') {
    const idx = this.processes.findIndex((p) => p.pid === pid);
    if (idx === -1) return false;
    if (signal === 'KILL' || this.processes[idx].state !== 'Z') {
      this.processes.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Recursive size in bytes (text length as proxy).
   * @param {string} path
   * @returns {number}
   */
  sizeOf(path) {
    const node = this.get(path);
    if (!node) return 0;
    if (node.type === 'file') return (node.content || '').length || 1;
    return node.children.reduce((acc, c) => acc + this.sizeOf(c.path), 0);
  }

  /**
   * Walk matching names (simple substring / glob-lite).
   * @param {string} startPath
   * @param {(node: VNode) => boolean} pred
   * @returns {VNode[]}
   */
  find(startPath, pred) {
    const start = this.get(startPath);
    /** @type {VNode[]} */
    const out = [];
    if (!start) return out;
    const stack = [start];
    while (stack.length) {
      const node = stack.pop();
      if (pred(node)) out.push(node);
      if (node.type === 'dir' && node.children) {
        stack.push(...node.children);
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }
}

/**
 * Default sandbox / home tree.
 * @param {string} user
 */
export function defaultTree(user) {
  return {
    '/': {
      type: 'dir',
      mode: 0o755,
      owner: 'root',
      children: {
        bin: { type: 'dir', owner: 'root' },
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
              },
            },
            local: { type: 'dir', owner: 'root', children: { bin: { type: 'dir', owner: 'root' } } },
            share: { type: 'dir', owner: 'root' },
          },
        },
        etc: {
          type: 'dir',
          owner: 'root',
          children: {
            hostname: { type: 'file', owner: 'root', content: 'learn\n' },
            'os-release': {
              type: 'file',
              owner: 'root',
              content:
                'NAME="Ubuntu"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\n',
            },
            passwd: {
              type: 'file',
              owner: 'root',
              content: `root:x:0:0:root:/root:/bin/bash\n${user}:x:1000:1000:Ubuntu User:/home/${user}:/bin/bash\n`,
            },
          },
        },
        tmp: { type: 'dir', mode: 0o777, owner: 'root' },
        var: {
          type: 'dir',
          owner: 'root',
          children: {
            log: {
              type: 'dir',
              owner: 'root',
              children: {
                'syslog': {
                  type: 'file',
                  owner: 'root',
                  content: 'Jan  1 00:00:01 learn systemd[1]: Started Session.\n',
                },
              },
            },
          },
        },
        proc: { type: 'dir', owner: 'root' },
        home: {
          type: 'dir',
          owner: 'root',
          children: {
            [user]: {
              type: 'dir',
              owner: user,
              children: {
                'notes.txt': {
                  type: 'file',
                  owner: user,
                  content: 'Welcome to Ubuntu.\nLearn the shell.\nShip real work.\n',
                },
                projects: {
                  type: 'dir',
                  owner: user,
                  children: {
                    'hello.py': {
                      type: 'file',
                      owner: user,
                      content: 'print("hello ubuntu")\n',
                    },
                  },
                },
                '.bashrc': {
                  type: 'file',
                  mode: 0o644,
                  owner: user,
                  content: 'export PS1="\\u@\\h:\\w$ "\n',
                },
              },
            },
          },
        },
      },
    },
  };
}
