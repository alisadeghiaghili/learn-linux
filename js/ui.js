/**
 * DOM UI: terminal (wordwise Tab, history, ghost hint), FS tree, neon goal
 * checklist, win celebration + social share, level dialogs.
 */

import { formatMode } from './fs.js';
import { levels, sequences, levelsIn, getLevel } from './levels.js';
import { loadProgress, recordWin, summarizeCurriculum, nextLevelId } from './progress.js';
import { buildShareTargets, shareWithClipboard, SHARE_URL } from './share.js';
import { launchConfetti, playFanfare } from './confetti.js';
import { solutionProgress, currentStepIndex, solutionSteps } from './solution.js';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
      // tables
      if (t.includes('|')) {
        t = t
          .split(/\n{2,}/)
          .map((chunk) => {
            const lines = chunk.split('\n').filter((l) => l.trim());
            if (lines.length >= 2 && lines.every((l) => l.includes('|'))) {
              const rows = lines.filter((l) => !/^\|[\s:-]+\|$/.test(l.replace(/\s/g, '')));
              const [head, ...body] = rows;
              const cells = (row) =>
                row
                  .replace(/^\||\|$/g, '')
                  .split('|')
                  .map((c) => c.trim())
                  .map((c) => `<td>${c}</td>`)
                  .join('');
              return `<table class="md-table"><thead><tr>${head
                .replace(/^\||\|$/g, '')
                .split('|')
                .map((c) => `<th>${c.trim()}</th>`)
                .join('')}</tr></thead><tbody>${body
                .map((r) => `<tr>${cells(r)}</tr>`)
                .join('')}</tbody></table>`;
            }
            return `<p>${chunk.trim().replace(/\n/g, '<br>')}</p>`;
          })
          .join('');
      } else {
        t = t
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
      }
      html += t;
    }
  }
  return html;
}

const CLEAR_SEQ = '\x1b[2J\x1b[H';

const BASE_COMMANDS = [
  'pwd',
  'whoami',
  'hostname',
  'uname -a',
  'ls',
  'ls -a',
  'ls -l',
  'ls -la',
  'cd projects',
  'cd ..',
  'cd /etc',
  'cd /var/log',
  'mkdir notes',
  'mkdir -p src/app/components',
  'touch todo.txt',
  'touch notes/todo.txt',
  'cat notes/todo.txt',
  'cat /etc/passwd',
  'cat /etc/group',
  'cat /etc/os-release',
  'echo hello ubuntu',
  'echo one > notes.log',
  'echo two >> notes.log',
  'rm junk.txt',
  'cp report.txt backup.txt',
  'cp notes.txt notes-copy.txt',
  'mv draft.txt final.txt',
  'head -n 2 long.txt',
  'tail -n 2 long.txt',
  'wc -l long.txt',
  'grep ERROR app.log',
  'grep error app.log',
  'grep ERROR app.log | wc -l',
  'grep ERROR app.log | wc -l > error_count.txt',
  'chmod +x run.sh',
  'chmod 600 .ssh/id_rsa',
  'chmod go-w shared.txt',
  'chmod u+s run.sh',
  'find . -name "*.log"',
  'find /var/lib/apt -type d',
  'ls /etc',
  'ls /var/log',
  'ls /var/cache/apt',
  'ls /var/lib/apt',
  'du projects',
  'df',
  'ps',
  'jobs',
  'top',
  'true',
  'false',
  'echo $HOME',
  'echo $PATH',
  'id',
  'sort names.txt',
  'uniq -c',
  'cut -d: -f1 /etc/passwd',
  "sed 's/red/green/' colors.txt",
  "awk '{print $1}' report.tsv",
  'echo done | tee status.txt',
  'ln notes.txt notes-hard',
  'ln -s notes.txt notes-soft',
  'stat notes.txt',
  'mount',
  'lsblk',
  'dmesg',
  'uname -a',
  'sudo apt update',
  'sudo apt install curl',
  'sudo apt remove curl',
  'apt list --installed',
  'apt policy bash',
  'dpkg -l',
  'ip addr',
  'ip route',
  'ss',
  'ping -c 2 127.0.0.1',
  'curl http://localhost/',
  'cat /etc/hosts',
  'nslookup localhost',
  'ifconfig',
  'sudo useradd alice',
  'sudo usermod -aG sudo alice',
  'passwd',
  'crontab -l',
  'systemctl status ssh',
  'sudo systemctl start nginx',
  'sudo systemctl stop nginx',
  'sudo systemctl enable nginx',
  'systemctl list-units',
  'journalctl -u ssh',
  'which ls',
  'man ls',
  'cat /etc/passwd',
  'cat /etc/group',
  'cat /var/log/auth.log',
  'help',
  'hint',
  'steps',
  'levels',
  'curriculum',
  'reset',
  'undo',
  'sandbox',
  'clear',
  'history',
  'solution',
];

function parseLineWords(value) {
  const endsWithSpace = /\s$/.test(value);
  const trimmed = value.replace(/\s+$/, '');
  if (!trimmed) return { head: [], current: '', afterSpace: endsWithSpace };
  const parts = trimmed.split(/\s+/);
  if (endsWithSpace) return { head: parts, current: '', afterSpace: true };
  return { head: parts.slice(0, -1), current: parts[parts.length - 1], afterSpace: false };
}

export class UI {
  constructor(session) {
    this.session = session;
    this.root = document.getElementById('app');
    this.historyIdx = -1;
    this.draft = '';
    this.flashPath = null;
    this.wordCycle = [];
    this.wordIdx = 0;
    this.wordKey = '';
    this.measureCtx = null;
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
          <button type="button" data-action="steps" class="btn">Steps</button>
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
          <div id="term" class="term" tabindex="-1"></div>
          <div class="term-hint" id="term-hint" hidden></div>
          <div class="term-input-row">
            <span id="prompt" class="prompt"></span>
            <div class="term-input-wrap" id="term-input-wrap">
              <div class="term-ghost" id="term-ghost" aria-hidden="true"></div>
              <input id="cmdline" class="cmdline" autocomplete="off" spellcheck="false" dir="ltr"
                aria-label="Command input" />
            </div>
          </div>
        </section>
        <section class="pane pane-viz" aria-label="Visualization">
          <div class="pane-header">
            <span>filesystem</span>
            <span id="cwd-badge" class="cwd-badge"></span>
          </div>
          <div id="breadcrumb" class="breadcrumb"></div>
          <div id="goal-panel" class="goal-panel"></div>
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
      ghost: document.getElementById('term-ghost'),
      inputWrap: document.getElementById('term-input-wrap'),
      termHint: document.getElementById('term-hint'),
      tree: document.getElementById('tree'),
      breadcrumb: document.getElementById('breadcrumb'),
      goalPanel: document.getElementById('goal-panel'),
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
    this.el.cmdline.addEventListener('input', () => this.syncGhost());
    this.el.term.addEventListener('click', () => this.focusInput());
    this.focusInput();
  }

  focusInput() {
    if (this.el.modalRoot.querySelector('.modal')) return;
    const input = this.el.cmdline;
    input.focus();
    const len = input.value.length;
    try {
      input.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }

  onAction(action) {
    if (action === 'levels') this.showLevels();
    if (action === 'sandbox') {
      this.session.enterSandbox();
      this.printSystem('Sandbox mode. Free play — type `help` for commands.');
    }
    if (action === 'hint') this.printSystem(this.session.hint());
    if (action === 'steps') this.printSystem(this.stepsText());
    if (action === 'undo') this.session.undo();
    if (action === 'reset') this.session.reset();
    this.focusInput();
  }

  stepsText() {
    const level = this.session.level;
    if (!level) return 'Sandbox has no goal checklist. Open Levels for a challenge.';
    const steps = solutionProgress(this.session, level);
    const cur = currentStepIndex(steps);
    const lines = steps.map((s, i) => {
      const mark = s.done ? '[done]' : i === cur ? '[NOW ]' : '[    ]';
      return `${mark} ${s.command}${s.note ? `  — ${s.note}` : ''}`;
    });
    return `Goal: ${level.objective || level.name}\n` + lines.join('\n');
  }

  onKey(e) {
    const input = this.el.cmdline;
    if (e.key === 'Tab') {
      this.applyTab(e);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      this.wordCycle = [];
      this.wordKey = '';
      this.syncGhost();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.el.modalRoot.querySelector('.modal')) return;
      const value = input.value;
      input.value = '';
      this.wordCycle = [];
      this.wordKey = '';
      this.runLine(value);
      this.focusInput();
      this.syncGhost();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const hist = this.session.history;
      if (!hist.length) return;
      if (this.historyIdx === hist.length) this.draft = input.value;
      if (this.historyIdx === -1) this.historyIdx = hist.length;
      this.historyIdx = Math.max(0, this.historyIdx - 1);
      input.value = hist[this.historyIdx] || '';
      this.wordCycle = [];
      this.syncGhost();
      this.focusInput();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const hist = this.session.history;
      if (this.historyIdx === -1) return;
      this.historyIdx = Math.min(hist.length, this.historyIdx + 1);
      input.value = this.historyIdx >= hist.length ? this.draft : hist[this.historyIdx] || '';
      this.wordCycle = [];
      this.syncGhost();
      this.focusInput();
      return;
    }
    if (e.key === 'c' && e.ctrlKey) {
      this.appendRaw(
        `<div class="term-line"><span class="prompt-echo">${esc(this.promptText())}</span> ${esc(input.value)}^C</div>`
      );
      input.value = '';
      this.syncGhost();
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      this.el.term.innerHTML = '';
    }
  }

  allCompletions() {
    const extra = this.session.level?.steps?.map((s) => s.command) || [];
    const sol = this.session.level?.solution ? [this.session.level.solution] : [];
    return [...new Set([...extra, ...sol, ...BASE_COMMANDS, ...this.session.history.slice().reverse()])];
  }

  matchingCommands(head, current) {
    const cur = current.toLowerCase();
    return this.allCompletions().filter((cmd) => {
      const words = cmd.split(/\s+/);
      if (words.length <= head.length) {
        if (head.length && words.length === head.length) {
          return words.every((w, i) => w === head[i]);
        }
        return false;
      }
      for (let i = 0; i < head.length; i++) {
        if (words[i] !== head[i]) return false;
      }
      if (!cur) return true;
      return (words[head.length] || '').toLowerCase().startsWith(cur);
    });
  }

  nextWords(head, current) {
    const matches = this.matchingCommands(head, current);
    const words = [];
    const push = (w) => {
      if (w && !words.includes(w)) words.push(w);
    };
    const hint = this.nextHintCommand();
    if (hint) {
      const hw = hint.split(/\s+/);
      if (head.every((h, i) => hw[i] === h)) push(hw[head.length]);
    }
    for (const cmd of matches) push(cmd.split(/\s+/)[head.length]);
    return words.filter((w) => !current || w.toLowerCase().startsWith(current.toLowerCase()));
  }

  nextHintCommand() {
    const level = this.session.level;
    if (!level) return null;
    const steps = solutionProgress(this.session, level);
    const idx = currentStepIndex(steps);
    return idx >= 0 ? steps[idx].command : null;
  }

  measureText(text) {
    if (!this.measureCtx) this.measureCtx = document.createElement('canvas').getContext('2d');
    const ctx = this.measureCtx;
    if (!ctx) return text.length * 7.2;
    ctx.font = getComputedStyle(this.el.cmdline).font || '13.5px monospace';
    return ctx.measureText(text).width;
  }

  /** Ghost shows only the rest of the current word — never stacks on placeholder. */
  syncGhost() {
    const value = this.el.cmdline.value;
    this.el.ghost.dataset.visible = '0';
    this.el.ghost.textContent = '';
    this.el.inputWrap.classList.remove('has-ghost');
    if (!value) return;

    const { head, current, afterSpace } = parseLineWords(value);
    const words = this.nextWords(head, afterSpace ? '' : current);
    const first = words[0];
    if (!first) return;

    if (afterSpace) {
      this.el.ghost.textContent = first;
      this.el.ghost.style.left = `${this.measureText(value) + 2}px`;
      this.el.ghost.dataset.visible = '1';
      this.el.inputWrap.classList.add('has-ghost');
      return;
    }
    if (!first.toLowerCase().startsWith(current.toLowerCase()) || first.length <= current.length) return;
    this.el.ghost.textContent = first.slice(current.length);
    this.el.ghost.style.left = `${this.measureText(value) + 2}px`;
    this.el.ghost.dataset.visible = '1';
    this.el.inputWrap.classList.add('has-ghost');
  }

  /** Tab completes one word (or cycles candidates) — never the whole command. */
  applyTab(e) {
    e.preventDefault();
    const input = this.el.cmdline;
    const value = input.value;
    const { head, current, afterSpace } = parseLineWords(value);
    const cycleKey = `${head.join(' ')}|${afterSpace ? '' : current}`;

    if (!value) {
      const hint = this.nextHintCommand();
      const firstWord = hint ? hint.split(/\s+/)[0] : 'ls';
      input.value = firstWord;
      this.wordCycle = [firstWord];
      this.wordIdx = 0;
      this.wordKey = firstWord;
      this.focusInput();
      this.syncGhost();
      return;
    }

    const options = this.nextWords(head, afterSpace ? '' : current);
    if (!options.length) {
      this.syncGhost();
      return;
    }

    if (cycleKey !== this.wordKey || !this.wordCycle.length) {
      this.wordKey = cycleKey;
      this.wordCycle = options;
      this.wordIdx = 0;
    } else {
      this.wordIdx = (this.wordIdx + 1) % this.wordCycle.length;
    }

    const chosen = this.wordCycle[this.wordIdx] || options[0];
    const headText = head.length ? `${head.join(' ')} ` : '';
    input.value = `${headText}${chosen}`;
    this.focusInput();
    this.syncGhost();

    if (this.wordCycle.length > 1) {
      const preview = this.wordCycle.slice(0, 6).join(' · ');
      this.el.termHint.hidden = false;
      this.el.termHint.innerHTML = `Tab word <strong>${this.wordIdx + 1}/${this.wordCycle.length}</strong>: <code>${esc(preview)}</code>${
        this.wordCycle.length > 6 ? ' …' : ''
      }`;
    } else {
      this.updateHintBar();
    }
  }

  updateHintBar() {
    const hint = this.nextHintCommand();
    if (!hint) {
      this.el.termHint.hidden = true;
      this.el.termHint.textContent = '';
      this.el.cmdline.placeholder = 'Type a command — help · levels · hint · steps';
      return;
    }
    this.el.termHint.hidden = false;
    this.el.termHint.innerHTML = `Next: <code>${esc(hint)}</code> <span class="par-note">· Tab completes word-by-word</span>`;
    this.el.cmdline.placeholder = '';
  }

  promptText() {
    return this.session.prompt();
  }

  runLine(line) {
    const prompt = this.promptText();
    const results = this.session.exec(line);
    this.historyIdx = -1;
    this.draft = '';
    if (!results.length) {
      this.appendRaw(
        `<div class="term-line"><span class="prompt-echo">${esc(prompt)}</span> ${esc(line)}</div>`
      );
      this.refresh();
      this.focusInput();
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
    this.focusInput();
  }

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
    line._printed = true;
    this.scrollTerm();
  }

  appendOutput(stdout, stderr) {
    if (stdout) this.appendRaw(`<pre class="term-out">${esc(String(stdout).replace(CLEAR_SEQ, ''))}</pre>`);
    if (stderr) this.appendRaw(`<pre class="term-err">${esc(stderr)}</pre>`);
    this.scrollTerm();
  }

  printSystem(text) {
    this.appendRaw(`<pre class="term-sys">${esc(text)}</pre>`);
    this.scrollTerm();
  }

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
    this.renderGoal();
    this.renderTree();
    this.renderProcs();
    this.updateHintBar();
  }

  renderGoal() {
    const level = this.session.level;
    const panel = this.el.goalPanel;
    if (!level) {
      panel.innerHTML = `<div class="goal-empty">No active goal — open <strong>Levels</strong> or type <code>levels</code></div>`;
      return;
    }
    const steps = solutionProgress(this.session, level);
    const cur = currentStepIndex(steps);
    const learn = (level.learn || [])
      .map((l) => `<li>${md(l)}</li>`)
      .join('');
    const mistakes = (level.mistakes || [])
      .map((m) => `<li>${esc(m)}</li>`)
      .join('');
    const items = steps
      .map((s, i) => {
        const cls = s.done ? 'is-done' : i === cur ? 'is-current' : '';
        const chip = s.done ? '✓' : i === cur ? 'NOW' : String(i + 1);
        return `<li class="${cls}">
          ${i === cur ? '<span class="now-chip">now</span>' : ''}
          <span class="step-idx">${chip}</span>
          <code>${esc(s.command)}</code>
          ${s.note ? `<span class="step-note">${esc(s.note)}</span>` : ''}
        </li>`;
      })
      .join('');
    panel.innerHTML = `
      <div class="goal-card">
        <div class="goal-kicker">Goal</div>
        <p class="objective">${esc(level.objective || level.name)}</p>
        <div class="goal-kicker">Checklist</div>
        <ol class="sol-steps">${items}</ol>
        <div class="goal-kicker">Why this matters</div>
        <ul class="learn-list">${learn}</ul>
        ${mistakes ? `<div class="goal-kicker">Common mistakes</div><ul class="mistake-list">${mistakes}</ul>` : ''}
      </div>
    `;
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

  renderNode(node, depth) {
    const fs = this.session.fs;
    const isCwd = node.path === fs.cwd;
    const showChildren =
      node.path === '/' || fs.cwd.startsWith(node.path) || node.path.startsWith(fs.cwd);
    const noisy = new Set(['/bin', '/sbin', '/usr', '/etc', '/var', '/proc', '/tmp', '/opt', '/mnt', '/media', '/boot', '/dev', '/run', '/srv', '/root']);
    if (noisy.has(node.path) && !fs.cwd.startsWith(node.path) && node.path !== '/') {
      // still show if student is listing that path recently — keep collapsed row
    }

    if (node.type === 'dir') {
      let html = this.leafRow(node, depth, isCwd);
      if (showChildren) {
        const kids = fs.list(node.path);
        const shouldExpand =
          node.path === '/' || fs.cwd === node.path || fs.cwd.startsWith(node.path + '/');
        if (shouldExpand) {
          for (const k of kids) {
            if (node.path === '/' && !['home', 'tmp', 'etc', 'var', 'usr'].includes(k.name)) {
              if (!k.path.startsWith(fs.cwd)) continue;
            }
            if (
              noisy.has(k.path) &&
              k.path !== fs.cwd &&
              !fs.cwd.startsWith(k.path + '/') &&
              !k.path.startsWith(fs.cwd)
            ) {
              html += this.leafRow(k, depth + 1, false);
              continue;
            }
            html += this.renderNode(k, depth + 1);
          }
        }
      }
      return html;
    }
    return this.leafRow(node, depth, isCwd);
  }

  leafRow(node, depth, isCwd) {
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

  openModal(html) {
    this.el.modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
  }

  closeModal() {
    this.el.modalRoot.innerHTML = '';
    this.focusInput();
  }

  showLevels() {
    const progress = loadProgress();
    const summary = summarizeCurriculum(progress);
    let body = `<div class="modal-head"><h2>Levels</h2><button type="button" class="btn" data-close>Close</button></div>
      <p class="muted">${summary.solvedCount} / ${summary.total} solved · progress saved in this browser (localStorage + cookie)</p>`;
    body += `<div class="levels-scroll">`;
    for (const seq of sequences) {
      body += `<section class="seq"><h3>${esc(seq.name)}</h3><p class="muted">${esc(seq.about)}</p><div class="level-list">`;
      for (const lv of levelsIn(seq.id)) {
        const rec = progress[lv.id];
        const done = rec?.solved ? ' done' : '';
        const score = rec?.solved ? `${rec.bestCommands ?? rec.best ?? '—'} / ${lv.par}` : '—';
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

  showCurriculum() {
    const summary = summarizeCurriculum(loadProgress());
    const learned = summary.learned.map((l) => `<li><strong>${esc(l.seriesTitle)}:</strong> ${esc(l.name)}</li>`).join('');
    const remain = summary.remaining
      .slice(0, 8)
      .map((l) => `<li>${esc(l.name)}</li>`)
      .join('');
    this.printSystem(
      `Curriculum ${summary.solvedCount}/${summary.total} (${summary.percent}%)\nLearned:\n${
        summary.learned.map((l) => `• ${l.seriesTitle}: ${l.name}`).join('\n') || '(none yet)'
      }\nNext: ${summary.next ? summary.next.name : 'all done'}`
    );
  }

  startLevel(id) {
    const level = getLevel(id);
    if (!level) return;
    this.session.loadLevel(level);
    this.el.term.innerHTML = '';
    this.printSystem(`Level: ${level.name}`);
    this.printSystem(`Goal: ${level.objective || ''}`);
    this.showDialog(level);
  }

  showDialog(level) {
    const steps = level.dialog || [];
    let idx = 0;
    const show = () => {
      if (idx >= steps.length) {
        this.closeModal();
        this.refresh();
        this.focusInput();
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

  showWin(level) {
    const used = this.session.commandCount;
    const par = level.par || used;
    const rec = recordWin(level.id, used, par);
    const beat = used <= par;
    const progress = loadProgress();
    const curriculum = summarizeCurriculum(progress);
    const next = nextLevelId(level.id, progress) || null;
    const share = buildShareTargets({
      levelName: level.name,
      levelId: level.id,
      commands: used,
      par,
      curriculum,
    });
    const cheers = [
      'Clean work. That is real shell muscle memory.',
      'Solid. You did not just type — you understood the filesystem.',
      'Nice. LPIC habits are stacking up.',
      'Done. The tree moved because you know what the command does.',
    ];
    const cheer = cheers[Math.floor(Math.random() * cheers.length)];
    const learnedPreview =
      curriculum.learned
        .map((l) => `<li>${esc(l.seriesTitle)}: ${esc(l.name)}</li>`)
        .join('') || `<li>Solve more levels to build your curriculum list.</li>`;

    const bodyHtml = `
      <div class="celebrate" aria-live="polite">
        <div class="celebrate-visual" aria-hidden="true">
          <div class="celebrate-ring"></div>
          <div class="celebrate-star">★</div>
        </div>
        <div class="celebrate-badge">LEVEL CLEARED</div>
        <h3 class="celebrate-title">${esc(level.name)}</h3>
        <p class="celebrate-sub">${esc(sequences.find((s) => s.id === level.sequence)?.name || level.sequence)} · <code>${esc(level.id)}</code></p>
        <p class="celebrate-cheer">${esc(cheer)}</p>
        <div class="celebrate-stats">
          <div class="win-score ${beat ? 'beat' : ''}">
            <span class="win-used">${used}</span>
            <span class="win-sep">/</span>
            <span class="win-par">${par}</span>
            <span class="win-label">commands vs par</span>
          </div>
          ${level.solution ? `<p class="win-sol">Reference: <code>${esc(level.solution)}</code></p>` : ''}
        </div>
        <div class="celebrate-progress">
          <div class="prog-track"><div class="prog-fill" style="width:${curriculum.percent}%"></div></div>
          <div class="par-note">${curriculum.solvedCount} / ${curriculum.total} levels solved · saved in this browser</div>
        </div>
        <div class="share-block">
          <div class="next-title">Share what you learned (includes your curriculum)</div>
          <div class="learned-preview">
            <ul>${learnedPreview}</ul>
          </div>
          <div class="share-row" role="group" aria-label="Share">
            <button type="button" class="share-btn linkedin" data-share="linkedin">LinkedIn</button>
            <button type="button" class="share-btn x" data-share="x">X / Twitter</button>
            <button type="button" class="share-btn facebook" data-share="facebook">Facebook</button>
            <button type="button" class="share-btn copy" data-share="copy">Copy post</button>
          </div>
          <div class="share-status" data-share-status hidden></div>
          <p class="par-note">Post text lists what you have learned so far and links to ${esc(SHARE_URL)}</p>
        </div>
        ${
          next
            ? `<div class="celebrate-next">Up next: <strong>${esc(next.name)}</strong></div>`
            : `<div class="celebrate-next">All sequences done — enjoy sandbox mode.</div>`
        }
      </div>
    `;

    const actions = [
      {
        label: 'Stay here',
        className: 'btn',
        onClick: () => this.focusInput(),
      },
    ];
    if (next) {
      actions.push({
        label: `Next: ${next.name}`,
        className: 'btn btn-accent',
        onClick: () => this.startLevel(next.id),
      });
    } else {
      actions.push({
        label: 'Browse levels',
        className: 'btn btn-accent',
        onClick: () => this.showLevels(),
      });
    }

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const confetti = launchConfetti(4800);
    playFanfare();

    const foot = actions
      .map(
        (a, i) =>
          `<button type="button" class="${a.className}" data-act="${i}">${esc(a.label)}</button>`
      )
      .join('');
    this.openModal(`
      ${bodyHtml}
      <div class="modal-foot">${foot}</div>
    `);
    this.el.modalRoot.querySelector('.modal')?.classList.add('modal-celebrate');

    this.el.modalRoot.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-act'));
        confetti?.stop();
        this.closeModal();
        actions[idx]?.onClick();
      });
    });
    this.el.modalRoot.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const kind = btn.getAttribute('data-share');
        const status = this.el.modalRoot.querySelector('[data-share-status]');
        const result = await shareWithClipboard(kind, share);
        if (!status) return;
        status.hidden = false;
        if (kind === 'copy') {
          status.textContent = result.copied
            ? 'Post copied — includes your full learned list and the link.'
            : 'Copy failed — select text manually.';
          return;
        }
        status.textContent = result.copied
          ? 'Share dialog opened. Post copied — paste if the network strips the text.'
          : 'Share dialog opened.';
      });
    });
  }
}
