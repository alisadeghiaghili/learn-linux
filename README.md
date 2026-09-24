# learn-linux

Interactive Ubuntu / Linux shell trainer: sandbox terminal, live filesystem
tree, leveled challenges with command-golf scoring and shareable progress.

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
- **109 levels** in 12 sequences: intro, files, text/filters, permissions, admin,
  processes, filesystems/devices, packages, networking, security, services, shell
- **LPIC-oriented depth** — objective, learn notes, common mistakes, sticky checklist
- **Command golf** — best count vs par (localStorage + cookie)
- **Celebration + share** — LinkedIn / X / Facebook posts include your curriculum
- **Live visualization** — FS tree with neon current step + process table
- **Shell habits** — pipes, redirection, Tab word completion, history

## Commands (selection)

Navigation: `pwd` `ls` `cd` `find` `stat`  
Files: `mkdir` `touch` `rm` `cp` `mv` `cat` `echo` `ln` `tee`  
Text: `head` `tail` `wc` `grep` `sort` `uniq` `cut` `sed` `awk` `tr` `diff`  
Perms/users: `chmod` `chown` `id` `useradd` `usermod` `passwd` `su` `sudo`  
Processes: `ps` `top` `kill` `killall` `jobs`  
System: `df` `du` `mount` `lsblk` `uname` `dmesg` `which` `man`  
Packages: `apt` `dpkg`  
Network: `ip` `ifconfig` `ss` `ping` `curl` `nslookup`  
Services: `systemctl` `journalctl` `crontab`  
Session: `clear` `history` `reset` `undo` `levels` `hint` `steps` `curriculum` `sandbox` `help`

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
js/fs.js               virtual filesystem + processes + runtime state
js/parser.js           tokenize, pipes, redirections
js/commands.js         core commands
js/commands-extra.js   text tools, users, net, packages, services
js/commands-gap.js     ACL, SSH keys, sudoers, ip add/route, kill -l
js/shell.js            pipelines, undo, meta
js/levels.js           catalog index
js/levels-core.js      intro + files
js/levels-text.js      filters & streams
js/levels-advanced.js  permissions, admin, proc, fs, pkg, net, security, services, shell
js/levels-gap.js       control-flow, ACL/SSH, network write, quiz drills
js/progress.js         persistence + curriculum summary
js/share.js            social share posts
js/confetti.js         celebration
js/solution.js         sticky checklist
js/ui.js               terminal, tree, goal panel
js/app.js              bootstrap
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

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

Simulated Ubuntu userspace — not a real kernel. No networking, no interactive editors,
simplified `find` and privilege model. Good enough to learn the shell habits that matter.
