# learn-linux Design Notes

## Product goal

An interactive Ubuntu/Linux CLI trainer modeled after [learnGitBranching](https://github.com/pcottle/learnGitBranching):
a browser sandbox + leveled challenges where the learner types real shell commands and watches a live filesystem visualization update.

## Style anchor

Ubuntu Desktop chrome + GNOME Terminal, crossed with a game HUD.
Not generic dark SaaS. The page should feel like a terminal session embedded in a learning game.

## Palette

| Role | Hex | Notes |
|------|-----|-------|
| Canvas / app bg | `#1A0A14` | deep aubergine near-black |
| Terminal surface | `#2C001E` | Ubuntu brand aubergine |
| Panel / card | `#3D1230` | elevated purple |
| Ink | `#F4EDEB` | warm cream |
| Muted ink | `#B89AA8` | secondary labels |
| Accent | `#E95420` | Ubuntu orange (focus, success CTA, prompts) |
| Success | `#38B26A` | level clear |
| Danger | `#E05A4F` | command errors |
| Directory | `#5B9BD5` | tree folders |
| File | `#F0C040` | tree files |
| Exec / special | `#C39BD3` | scripts, sockets |

## Typography

- UI / display: `Ubuntu, "Segoe UI", system-ui, sans-serif`
- Mono: `"Ubuntu Mono", "Cascadia Code", "Consolas", monospace`
- Scale: 12 / 14 / 16 / 20 / 28 / 40
- Body weight 400; titles 500–600; no decorative display faces

## Layout system

- Full-viewport app shell, no page scroll
- Top bar 52px: brand, sequence/level title, actions (Levels, Sandbox, Hint, Undo, Reset)
- Main split: terminal ~58% left, viz ~42% right (stacks vertically under 900px)
- Terminal: scrollback + input line with orange prompt `ubuntu@learn:~$`
- Viz: path breadcrumb, file tree (primary), process table when a level needs it
- Modals: level intro dialog stack + win card with command-golf score
- Spacing rhythm: 4 / 8 / 12 / 16 / 24 / 32; density is high (tool UI), not marketing airy

## Signature moments

1. **Tree pulse** — `mkdir` / `touch` / `rm` / `cd` briefly highlights the affected node in Ubuntu orange.
2. **Level clear card** — aubergine card slides in with score `n / par`, beats par in green.
3. **Authentic errors** — `bash: …: Permission denied` / `No such file or directory` in the real message shape.

## Level model (mirrors LGB)

```text
id, name, hint, par, solution,
start: { cwd, tree, env, processes },
disabled: { command: true },
dialog: [ { type: modal | demo, … } ],
check(fs, session) -> boolean
```

Sequences (tabs conceptually):
1. **intro** — pwd, ls, cd, whoami, echo
2. **files** — mkdir, touch, cat, rm, cp, mv
3. **text** — head, tail, wc, grep, pipes, redirection
4. **permissions** — chmod, ls -l, ownership
5. **processes** — ps, kill
6. **system** — find, df, du, uname, env

## Visualization mapping (git tree → linux)

| learnGitBranching | learn-linux |
|-------------------|-------------|
| commit graph | filesystem tree |
| HEAD / branch labels | cwd badge + highlight |
| remote refs | process table (side panel) |
| command golf | same (best score vs par) |

## Architecture

Pure client-side ES modules, no backend, no build step required.

```text
index.html
css/styles.css
js/fs.js       virtual filesystem + processes
js/parser.js   tokenize, pipes, redirections
js/commands.js command implementations
js/shell.js    execute pipeline, session undo stack
js/levels.js   level catalog
js/ui.js       terminal, tree, modals
js/app.js      bootstrap
```

## Out of scope (v1)

Real kernel/syscalls, networking (`ssh`, `curl`), full `find` expression grammar,
interactive editors (`vim`, `less`), real `sudo` privilege model beyond a simple root flag.
