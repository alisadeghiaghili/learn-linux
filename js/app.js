/**
 * Application bootstrap for learn-linux.
 */

import { ShellSession } from './shell.js';
import { UI } from './ui.js';
import { getLevel, levels, sequences, levelsIn } from './levels.js';
import { loadProgress } from './progress.js';

/**
 * Read URL params.
 * @returns {{level?: string, command?: string, nodemo?: boolean}}
 */
function readParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    level: q.get('level') || q.get('level_id') || undefined,
    command: q.get('command') || undefined,
    nodemo: q.has('NODEMO') || q.has('nodemo'),
  };
}

function boot() {
  const session = new ShellSession({});
  session.enterSandbox();
  const ui = new UI(session);

  // Welcome line
  ui.printSystem('learn-linux — interactive Ubuntu shell trainer.');
  ui.printSystem('Type `help` for commands, `levels` or the toolbar to start a challenge.');

  const params = readParams();
  if (params.level) {
    const level = getLevel(params.level);
    if (level) {
      session.loadLevel(level);
      ui.refresh();
      if (params.nodemo) {
        ui.printSystem(`Level: ${level.name}`);
      } else {
        ui.startLevel(level.id);
      }
    }
  }

  if (params.command) {
    // Execute shared permalink commands after a tick
    setTimeout(() => {
      for (const stmt of params.command.split(';')) {
        if (stmt.trim()) ui.runLine(stmt.trim());
      }
    }, 50);
  }

  // First-visit intro
  const progress = loadProgress();
  const anyDone = Object.keys(progress).length > 0;
  if (!params.level && !params.nodemo && !anyDone) {
    ui.openModal(`
      <div class="modal-head"><h2>learn-linux</h2></div>
      <div class="modal-body">
        <p>An interactive Ubuntu / Linux shell trainer with a live filesystem tree.</p>
        <p>Type real commands and watch the <strong>filesystem tree</strong> update live.</p>
        <ul class="modal-list">
          <li><code>levels</code> or the toolbar — guided challenges with command golf</li>
          <li><code>sandbox</code> — free play</li>
          <li><code>undo</code> / <code>reset</code> — experiment safely</li>
          <li><code>help</code> — command list</li>
        </ul>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" data-close>Sandbox</button>
        <button type="button" class="btn btn-accent" data-start>Start first level</button>
      </div>
    `);
    const close = document.querySelector('#modal-root [data-close]');
    const start = document.querySelector('#modal-root [data-start]');
    if (close) close.addEventListener('click', () => ui.closeModal());
    if (start) {
      start.addEventListener('click', () => {
        ui.closeModal();
        const first = levelsIn(sequences[0].id)[0];
        if (first) ui.startLevel(first.id);
      });
    }
  }

  // Debug hook for tests / console
  window.learnLinux = { session, ui, levels, sequences };
}

boot();
