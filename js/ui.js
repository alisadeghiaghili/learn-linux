/**
 * DOM UI: terminal pane, filesystem tree, process table, modals, toolbar.
 */

import { formatMode } from './fs.js';
import { levels, sequences, levelsIn, loadProgress, recordWin, getLevel } from './levels.js';

/**
 * Escape HTML special characters.
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tiny markdown: **bold**, `code`, fenced blocks, paragraphs.
 * @param {string} text
 * @returns {string}
 */
function md(text) {
  const blocks = String(text).split(/```/);
  let html = '';
  for (let i = 0; i < blocks.length; i += 1) {
    if (i % 2 === 1) {
      html += `<pre class="md-pre">${esc(blocks[i].replace(/^\w*\n/, ''))}</pre>`;
    } else {
      let t = esc(blocks[i]);
      t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      html += t;
    }
  }
  return html;
}

const CLEAR_SEQ = '\x1b[2J\x1b[H';

export class UI {
  /**
   * @param {import('./shell.js').ShellSession} session
   */
  constructor(session) {
    this.session = session;
    this.root = document.getElementById('app');
    this.historyIndex = -1;
    this.flashPath = null;
    this._bindSession();
    this._renderShell();
    this.refresh();
  }

  _bindSession() {
    this.session.onOutput = (line) => this.appendExec(line);
    this.session.onChange = () => this.refresh();
    this.session.onWin = (level) => this.showWin(level);
  }

  _renderShell() {
    this.root.innerHTML = `
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">$_</span>
          <span class="brand-name">learn-linux</span>
          <span class="brand-sub">Ubuntu CLI</span>
        </div>
        <div class="topbar-meta">
          <span id="mode-badge" class="badge">sandbox</span>
          <span id="level-title" class="level-title"></span>
        </div>
        <div class="topbar-actions">
          <button type="button" data-action="levels" class="btn">Levels</button>
          <button type="button" data-action="sandbox" class="btn">Sandbox</button>
          <button type="button" data-action="hint" class="btn">Hint</button>
          <button type="button" data-action="undo" class="btn">Undo</button>
          <button type="button" data-action="reset" class="btn btn-accent">Reset</button>
        </div>
      </header>
      <main class="main">
        <section class="pane pane-terminal" aria-label="Terminal">
          <div class="pane-header">
            <span>terminal</span>
            <span id="cmd-count" class="muted"></span>
          </div>
          <div id="term" class="term" tabindex="0"></div>
          <div class="term-input-row">
            <span id="prompt" class="prompt"></span>
            <input id="cmdline" class="cmdline" autocomplete="off" spellcheck="false" aria-label="Command input" />
          </div>
        </section>
        <section class="pane pane-viz" aria-label="Visualization">
          <div class="pane-header">
            <span>filesystem</span>
            <span id="cwd-badge" class="cwd-badge"></span>
          </div>
          <div id="breadcrumb" class="breadcrumb"></div>
          <div id="tree" class="tree"></div>
          <div class="pane-header pane-header-sub">
            <span>processes</span>
          </div>
          <div id="procs" class="procs"></div>
        </section>
      </main>
      <div id="modal-root"></div>
    `;

    this.el = {
      term: document.getElementById('term'),
      prompt: document.getElementById('prompt'),
      cmdline: document.getElementById('cmdline'),
      tree: document.getElementById('tree'),
      breadcrumb: document.getElementById('breadcrumb'),
      procs: document.getElementById('procs'),
      cwdBadge: document.getElementById('cwd-badge'),
      levelTitle: document.getElementById('level-title'),
      modeBadge: document.getElementById('mode-badge'),
      cmdCount: document.getElementById('cmd-count'),
      modalRoot: document.getElementById('modal-root'),
    };

    this.root.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.onAction(btn.getAttribute('data-action')));
    });

    this.el.cmdline.addEventListener('keydown', (e) => this.onKey(e));
    this.el.term.addEventListener('click', () => this.el.cmdline.focus());
    this.el.cmdline.focus();
  }

  /**
   * @param {string} action
   */
  onAction(action) {
    if (action === 'levels') this.showLevels();
    if (action === 'sandbox') {
      this.session.enterSandbox();
      this.printSystem('Sandbox mode. Free play — type `help` for commands.');
    }
    if (action === 'hint') this.printSystem(this.session.hint());
    if (action === 'undo') this.session.undo();
    if (action === 'reset') this.session.reset();
  }

  /**
   * @param {KeyboardEvent} e
   */
  onKey(e) {
    const input = this.el.cmdline;
    if (e.key === 'Enter') {
      const value = input.value;
      input.value = '';
      this.historyIndex = -1;
      this.runLine(value);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = this.session.history;
      if (!hist.length) return;
      if (this.historyIndex === -1) this.historyIndex = hist.length;
      this.historyIndex = Math.max(0, this.historyIndex - 1);
      input.value = hist[this.historyIndex] || '';
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = this.session.history;
      if (this.historyIndex === -1) return;
      this.historyIndex += 1;
      if (this.historyIndex >= hist.length) {
        this.historyIndex = -1;
        input.value = '';
      } else {
        input.value = hist[this.historyIndex] || '';
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      this.complete(input);
    }
    if (e.key === 'c' && e.ctrlKey) {
      this.appendRaw(`${esc(this.promptText())} ${esc(input.value)}^C\n`);
      input.value = '';
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      this.el.term.innerHTML = '';
    }
  }

  /**
   * @param {HTMLInputElement} input
   */
  complete(input) {
    const parts = input.value.split(/\s+/);
    const last = parts[parts.length - 1] || '';
    const names = ['ls', 'cd', 'pwd', 'mkdir', 'touch', 'cat', 'rm', 'cp', 'mv', 'echo', 'grep', 'wc', 'head', 'tail', 'chmod', 'find', 'ps', 'kill', 'help', 'man'];
    if (parts.length <= 1) {
      const hit = names.filter((n) => n.startsWith(last));
      if (hit.length === 1) {
        parts[parts.length - 1] = hit[0] + ' ';
        input.value = parts.join(' ');
      }
      return;
    }
    const dir = this.session.fs.cwd;
    const children = this.session.fs.list(dir).map((c) => c.name);
    const hits = children.filter((n) => n.startsWith(last));
    if (hits.length === 1) {
      parts[parts.length - 1] = hits[0];
      input.value = parts.join(' ');
    }
  }

  /**
   * @param {string} line
   */
  runLine(line) {
    const prompt = this.promptText();
    const results = this.session.exec(line);
    if (!results.length) {
      this.appendRaw(
        `<div class="term-line"><span class="prompt-echo">${esc(prompt)}</span> ${esc(line)}</div>`
      );
      this.refresh();
      return;
    }
    for (const r of results) {
      if (r.specialClear) {
        this.el.term.innerHTML = '';
        continue;
      }
      if (r._printed) continue;
      const shown = r.input || line;
      if (shown.trim()) {
        this.appendRaw(
          `<div class="term-line"><span class="prompt-echo">${esc(r.prompt || prompt)}</span> ${esc(shown)}</div>`
        );
      }
      this.appendOutput(r.stdout, r.stderr);
    }
    this.refresh();
  }

  promptText() {
    return this.session.prompt();
  }

  /**
   * @param {import('./shell.js').ExecLine} line
   */
  appendExec(line) {
    if (line.specialClear) {
      this.el.term.innerHTML = '';
      return;
    }
    if (line.input && line.input.trim()) {
      this.appendRaw(
        `<div class="term-line"><span class="prompt-echo">${esc(line.prompt || this.promptText())}</span> ${esc(line.input)}</div>`
      );
    }
    this.appendOutput(line.stdout, line.stderr);
    // mark so runLine does not double-print meta results
    line._printed = true;
    this.scrollTerm();
  }

  /**
   * @param {string} stdout
   * @param {string} stderr
   */
  appendOutput(stdout, stderr) {
    if (stdout) {
      this.appendRaw(`<pre class="term-out">${esc(stdout.replace(CLEAR_SEQ, ''))}</pre>`);
    }
    if (stderr) {
      this.appendRaw(`<pre class="term-err">${esc(stderr)}</pre>`);
    }
    this.scrollTerm();
  }

  /**
   * @param {string} text
   */
  printSystem(text) {
    this.appendRaw(`<pre class="term-sys">${esc(text)}</pre>`);
    this.scrollTerm();
  }

  /**
   * @param {string} html
   */
  appendRaw(html) {
    this.el.term.insertAdjacentHTML('beforeend', html);
    this.scrollTerm();
  }

  scrollTerm() {
    this.el.term.scrollTop = this.el.term.scrollHeight;
  }

  refresh() {
    const fs = this.session.fs;
    this.el.prompt.textContent = this.promptText() + ' ';
    this.el.cwdBadge.textContent = fs.promptPath();
    this.el.cmdCount.textContent = this.session.level
      ? `commands: ${this.session.commandCount}${this.session.level.par ? ` / par ${this.session.level.par}` : ''}`
      : 'sandbox';
    this.el.modeBadge.textContent = this.session.level ? this.session.level.sequence : 'sandbox';
    this.el.levelTitle.textContent = this.session.level ? this.session.level.name : 'Free play';
    this.renderTree();
    this.renderProcs();
  }

  renderTree() {
    const fs = this.session.fs;
    const root = fs.get('/');
    if (!root) {
      this.el.tree.innerHTML = '';
      return;
    }
    this.el.breadcrumb.innerHTML = this.crumbs(fs.cwd);
    this.el.tree.innerHTML = this.renderNode(root, 0);
  }

  /**
   * @param {string} cwd
   */
  crumbs(cwd) {
    const parts = cwd.split('/').filter(Boolean);
    let acc = '';
    const items = [`<span class="crumb root">/</span>`];
    for (const p of parts) {
      acc += '/' + p;
      items.push(`<span class="crumb">${esc(p)}</span>`);
    }
    return items.join('<span class="crumb-sep">/</span>');
  }

  /**
   * @param {import('./fs.js').VNode} node
   * @param {number} depth
   * @returns {string}
   */
  renderNode(node, depth) {
    const fs = this.session.fs;
    const isCwd = node.path === fs.cwd;
    const inCwd = fs.cwd === node.path || fs.cwd.startsWith(node.path + '/') || node.path === '/';
    // Expand: always show root; show path to cwd; show first level of cwd
    const showChildren =
      node.path === '/' ||
      fs.cwd.startsWith(node.path) ||
      node.path.startsWith(fs.cwd);

    // Hide noisy system dirs unless we are inside them
    const noisy = new Set(['/bin', '/usr', '/etc', '/var', '/proc', '/tmp']);
    if (noisy.has(node.path) && !fs.cwd.startsWith(node.path)) {
      return this.leafRow(node, depth, isCwd, true);
    }

    if (node.type === 'dir') {
      let html = this.leafRow(node, depth, isCwd, false);
      if (showChildren) {
        const kids = fs.list(node.path);
        // Limit deep noise: only auto-expand ancestors of cwd + cwd itself + cwd children
        const shouldExpand =
          node.path === '/' ||
          fs.cwd === node.path ||
          fs.cwd.startsWith(node.path + '/') ||
          node.path === fs.cwd;
        if (shouldExpand) {
          for (const k of kids) {
            // Under cwd, show all; under ancestors only the branch leading to cwd
            if (
              node.path !== fs.cwd &&
              node.path !== '/' &&
              !fs.cwd.startsWith(node.path + '/') &&
              k.path !== fs.cwd &&
              !fs.cwd.startsWith(k.path + '/') &&
              !k.path.startsWith(fs.cwd)
            ) {
              continue;
            }
            if (node.path === '/' && !['home', 'tmp', 'etc'].includes(k.name) && !fs.cwd.startsWith(k.path)) {
              // keep home/tmp/etc always; others only if cwd
              if (!k.path.startsWith(fs.cwd)) continue;
            }
            html += this.renderNode(k, depth + 1);
          }
        }
      }
      return html;
    }
    return this.leafRow(node, depth, isCwd, false);
  }

  /**
   * @param {import('./fs.js').VNode} node
   * @param {number} depth
   * @param {boolean} isCwd
   * @param {boolean} collapsed
   */
  leafRow(node, depth, isCwd, collapsed) {
    const icon = node.type === 'dir' ? '▸' : '·';
    const cls = node.type === 'dir' ? 'dir' : 'file';
    const exec = node.type === 'file' && node.mode & 0o111 ? ' exec' : '';
    const flash = this.flashPath === node.path ? ' flash' : '';
    const mode = formatMode(node.mode, node.type);
    const size = node.type === 'dir' ? '' : String((node.content || '').length) + 'B';
    return `<div class="tree-row ${cls}${exec}${isCwd ? ' cwd' : ''}${flash}" style="padding-left:${8 + depth * 14}px" data-path="${esc(node.path)}">
      <span class="tree-icon">${icon}</span>
      <span class="tree-name">${esc(node.name)}${node.type === 'dir' ? '/' : ''}</span>
      <span class="tree-meta">${esc(mode)} ${size}</span>
    </div>`;
  }

  renderProcs() {
    const fs = this.session.fs;
    const procs = [
      { pid: 1, user: 'root', state: 'S', cpu: 0.0, mem: 0.2, cmd: '/sbin/init' },
      { pid: 42, user: fs.user, state: 'S', cpu: 0.0, mem: 0.1, cmd: 'bash' },
      ...fs.processes,
    ];
    let html = `<table class="proc-table"><thead><tr><th>PID</th><th>USER</th><th>ST</th><th>%CPU</th><th>COMMAND</th></tr></thead><tbody>`;
    for (const p of procs) {
      html += `<tr><td>${p.pid}</td><td>${esc(p.user)}</td><td>${esc(p.state)}</td><td>${p.cpu.toFixed(1)}</td><td class="proc-cmd">${esc(p.cmd)}</td></tr>`;
    }
    html += '</tbody></table>';
    this.el.procs.innerHTML = html;
  }

  /**
   * Briefly highlight a path in the tree.
   * @param {string} path
   */
  flash(path) {
    this.flashPath = path;
    this.renderTree();
    setTimeout(() => {
      if (this.flashPath === path) {
        this.flashPath = null;
        this.renderTree();
      }
    }, 600);
  }

  // ── Modals ───────────────────────────────────────────────

  /**
   * @param {string} html
   */
  openModal(html) {
    this.el.modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  }

  closeModal() {
    this.el.modalRoot.innerHTML = '';
    this.el.cmdline.focus();
  }

  showLevels() {
    const progress = loadProgress();
    let body = `<div class="modal-head"><h2>Levels</h2><button type="button" class="btn" data-close>Close</button></div>`;
    body += `<div class="levels-scroll">`;
    for (const seq of sequences) {
      body += `<section class="seq"><h3>${esc(seq.name)}</h3><p class="muted">${esc(seq.about)}</p><div class="level-list">`;
      for (const lv of levelsIn(seq.id)) {
        const rec = progress[lv.id];
        const done = rec ? ' done' : '';
        const score = rec ? `${rec.best} / ${lv.par}` : '—';
        body += `<button type="button" class="level-card${done}" data-level="${esc(lv.id)}">
          <span class="level-card-name">${esc(lv.name)}</span>
          <span class="level-card-score">${score}</span>
        </button>`;
      }
      body += `</div></section>`;
    }
    body += `</div>`;
    this.openModal(body);
    this.el.modalRoot.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModal()));
    this.el.modalRoot.querySelectorAll('[data-level]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-level');
        this.closeModal();
        this.startLevel(id);
      });
    });
  }

  /**
   * @param {string} id
   */
  startLevel(id) {
    const level = getLevel(id);
    if (!level) return;
    this.session.loadLevel(level);
    this.el.term.innerHTML = '';
    this.printSystem(`Level: ${level.name}`);
    this.showDialog(level);
  }

  /**
   * @param {any} level
   */
  showDialog(level) {
    const steps = level.dialog || [];
    let idx = 0;
    const show = () => {
      if (idx >= steps.length) {
        this.closeModal();
        this.refresh();
        return;
      }
      const step = steps[idx];
      if (step.type === 'modal') {
        this.openModal(`
          <div class="modal-head"><h2>${esc(step.title)}</h2></div>
          <div class="modal-body">${md(step.body)}</div>
          <div class="modal-foot">
            <span class="muted">${idx + 1} / ${steps.length}</span>
            <button type="button" class="btn btn-accent" data-next>${idx + 1 === steps.length ? 'Start' : 'Next'}</button>
          </div>
        `);
      } else if (step.type === 'demo') {
        this.openModal(`
          <div class="modal-head"><h2>Demo</h2></div>
          <div class="modal-body">
            ${md(step.before || '')}
            <div class="demo-box">
              <div class="demo-cmd"><span class="prompt-echo">ubuntu@learn:~$</span> ${esc(step.command)}</div>
              <pre class="demo-out">…</pre>
            </div>
            ${md(step.after || '')}
          </div>
          <div class="modal-foot">
            <span class="muted">${idx + 1} / ${steps.length}</span>
            <div class="btn-row">
              <button type="button" class="btn" data-run>Run demo</button>
              <button type="button" class="btn btn-accent" data-next>${idx + 1 === steps.length ? 'Start' : 'Next'}</button>
            </div>
          </div>
        `);
        const runBtn = this.el.modalRoot.querySelector('[data-run]');
        if (runBtn) {
          runBtn.addEventListener('click', async () => {
            const { runDemo } = await import('./shell.js');
            const result = runDemo(level, step.command);
            const out = this.el.modalRoot.querySelector('.demo-out');
            if (out) out.textContent = result.stdout || result.stderr || '(no output)';
          });
        }
      }
      const next = this.el.modalRoot.querySelector('[data-next]');
      if (next) {
        next.addEventListener('click', () => {
          idx += 1;
          show();
        });
      }
    };
    show();
  }

  /**
   * @param {any} level
   */
  showWin(level) {
    const used = this.session.commandCount;
    const par = level.par || used;
    const rec = recordWin(level.id, used, par);
    const beat = used <= par;
    const next = this.nextLevel(level.id);
    this.openModal(`
      <div class="win-card">
        <div class="win-kicker">Level complete</div>
        <h2 class="win-title">${esc(level.name)}</h2>
        <div class="win-score ${beat ? 'beat' : ''}">
          <span class="win-used">${used}</span>
          <span class="win-sep">/</span>
          <span class="win-par">${par}</span>
          <span class="win-label">commands vs par</span>
        </div>
        ${level.solution ? `<p class="win-sol">Reference: <code>${esc(level.solution)}</code></p>` : ''}
        <p class="muted">Best: ${rec.best}</p>
        <div class="modal-foot">
          <button type="button" class="btn" data-close>Stay</button>
          ${next ? `<button type="button" class="btn btn-accent" data-next-level="${esc(next.id)}">Next: ${esc(next.name)}</button>` : `<button type="button" class="btn btn-accent" data-close>All sequences done — sandbox</button>`}
        </div>
      </div>
    `);
    this.el.modalRoot.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModal()));
    const nb = this.el.modalRoot.querySelector('[data-next-level]');
    if (nb) {
      nb.addEventListener('click', () => {
        const id = nb.getAttribute('data-next-level');
        this.closeModal();
        this.startLevel(id);
      });
    }
  }

  /**
   * @param {string} id
   * @returns {import('./levels.js').Level|undefined}
   */
  nextLevel(id) {
    const all = sequences.flatMap((s) => levelsIn(s.id));
    const i = all.findIndex((l) => l.id === id);
    return i >= 0 ? all[i + 1] : undefined;
  }
}
