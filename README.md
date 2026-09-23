# learn-linux

Interactive Ubuntu / Linux shell trainer — a filesystem analog of
[learnGitBranching](https://github.com/pcottle/learnGitBranching).

Type real shell commands in a sandbox. The **filesystem tree** and **process table**
update live. Guided levels teach navigation, files, pipes, permissions, and processes,
with command-golf scoring against a par.

## Run

No build step. Serve the folder as static files (ES modules need HTTP, not `file://`):

```bash
# any static server works
python -m http.server 5173
# open http://localhost:5173/
```

Or open via any static host / editor preview that serves the directory root.

## Features

- **Sandbox** — free play with `undo`, `reset`, `help`
- **Levels** — sequences: Introduction, Files, Text & pipes, Permissions, Processes, System
- **Command golf** — track your best command count vs par (localStorage)
- **Live visualization** — tree of `/` with cwd highlight + process table
- **Pipes and redirection** — `|`, `>`, `>>`, `<`, `;`
- **Authentic errors** — Ubuntu-style messages (`No such file or directory`, `Permission denied`)

## Commands

Navigation: `pwd` `ls` `cd` `find`  
Files: `mkdir` `rmdir` `touch` `rm` `cp` `mv` `cat` `echo`  
Text: `head` `tail` `wc` `grep`  
Perms: `chmod` `chown`  
Processes: `ps` `kill` `jobs`  
System: `df` `du` `free` `uname` `which` `man` `whoami` `hostname`  
Session: `clear` `history` `reset` `undo` `levels` `hint` `sandbox` `help` `solution`

## URL parameters

| Param | Effect |
|-------|--------|
| `?level=intro-pwd` | open a level |
| `?NODEMO` | skip intro dialog |
| `?command=pwd;ls` | run commands on load |

Example: `/?NODEMO&level=files-mkdir`

## Architecture

```text
index.html
css/styles.css
js/fs.js       virtual filesystem + processes
js/parser.js   tokenize, pipes, redirections
js/commands.js command implementations
js/shell.js    pipelines, undo, meta commands
js/levels.js   level catalog + progress
js/ui.js       terminal, tree, modals
js/app.js      bootstrap
```

See [DESIGN.md](./DESIGN.md) for visual system and level model.

## Tests

Core logic is pure ES modules. Quick smoke from Node (optional):

```bash
node --input-type=module -e "
import { VirtualFS, defaultTree } from './js/fs.js';
import { ShellSession } from './js/shell.js';
const s = new ShellSession({});
s.enterSandbox();
s.exec('mkdir demo && touch demo/a.txt');
const n = s.fs.get('/home/ubuntu/demo/a.txt');
if (!n) throw new Error('touch failed');
console.log('smoke ok');
"
```

## Scope (v1)

Simulated Ubuntu userspace — not a real kernel. No networking, no interactive editors,
simplified `find` and privilege model. Good enough to learn the shell habits that matter.
