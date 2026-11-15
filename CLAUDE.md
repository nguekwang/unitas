# Unitas — Claude Code handoff notes

## Goal
An "all-in-one tabbed app" built on Chromium (Electron) that runs on Arch Linux.
It combines a browser, an editor, and PDF/MD/HTML viewers in one window, and also
embeds **a UI/UX equivalent to the VS Code extension version of Claude Code, using the Claude Agent SDK**. It should handle IaC as well.

## Handoff: where the last session stopped (2026-11-15, remote session)
The first session ran locally on the user's Arch machine (system `electron43`); the second ran in remote
Claude Code (Electron 43 from npm + Xvfb) and continued from there.

**Verified (all sessions)** by driving Electron's real input path (see "Testing" below): NORMAL/INSERT switching
(focus-based, `i`, Esc, autofocused fields), j/k/5j/d/G/gg scrolling (page, Monaco, PDF), unmapped keys reach
the page, `f` / `F` / `yf` hints, `gi`, `/` + Enter, `n` `N` with counts (`3n`, `2N`), `v` / `V` + `y`, `yy`,
`]]`, `H`, local and global marks (`ma` `` `a ``, `mA` `` `A `` switches tab or reopens the page), J/K,
`g0` `g$` (with counts), `^`, `t` `x` `X` `yt`, `<<` `>>`, `gu` `gU` (with counts and query strings), `p` `P`,
vomnibar (`o` `O` `T` `ge` `gE`, Shift+Enter, history, Esc, search keywords `w tokyo` / `aw pacman`), `:q`,
`:w`, `?`, `:settings` live reload, popups as tabs with `window.opener`, DevTools panel (below).

**DevTools close paths (verified, no uncaught exceptions):** toggling twice, `wc.closeDevTools()`, the DevTools renderer crashing or closing, `x` with the panel open, reload with it open,
quitting with it open. Note: with `setDevToolsWebContents`, Electron 43 reports `isDevToolsOpened()` = false
and never emits `devtools-closed`, so the panel is tracked through its own webContents (`destroyed`,
`render-process-gone`). F12 was removed afterwards (no function-key bindings): `:devtools` only.

**Fixed in the remote session:** find counted the HUD's own text ("/foo 1 / 3") and the find bar's input as
matches (HUD now draws text with `::before`; the bar's match is subtracted); `2N` / `3n` did one step only
(steps are now sequential in `ports.js`); `127.0.0.1:8000/...` opened as https and a bare `host:port` IP was
searched (IPs/localhost → http); a page that failed to load kept the previous page's URL/title in the tab.

**Integrated terminal (done):** `:term` → `terminal.html` (xterm.js 6 + fit addon) + `background/terminal.js`
(node-pty 1.1, N-API, so a binary built against Node runs in Electron without electron-rebuild). In a terminal,
Esc goes to the shell and **Shift+Esc** leaves INSERT (pending user confirmation). `exit` closes the tab;
closing the tab kills the shell. Editor and terminal pages share `data-unitas-app` + `unitas:app-scroll` /
`unitas:app-focus` events. PKGBUILD prunes node-pty to `lib/` + `pty.node` (63MB → ~0.2MB); `makepkg` still
not run on a real Arch machine.

**Open threads**
- Own editor to replace Monaco (user's choice: modeled on Monaco's source, which is in
  `node_modules/monaco-editor/esm/vs/editor`; scope includes completion and the diff view; Electron stays,
  see issue #1). Not started: the directory layout is still being discussed. Draft, files at the root:
  `editor-buffer.js` (piece tree), `editor-model.js` (lines/positions, undo, EOL), `editor-tokenize.js`
  (Monarch-like highlighting), `editor-view.js` (viewport rendering, scrolling, mouse), `editor-edit.js`
  (cursor, typing, IME), `editor-find.js`, `editor-suggest.js`, `editor-diff.js`
- Question to the user, asked in the remote session: Monaco's own Ctrl keys (Ctrl+Z, Ctrl+F) still work in the
  editor. Block them too and use `u` (undo) / `/` (find) in NORMAL mode like vim?
- Terminal: confirm Shift+Esc as the way out of INSERT; default key for `openTerminal` (none yet); paste into
  the terminal (no Ctrl+Shift+V by the no-Ctrl rule; middle-click paste only for now).
- Chrome extensions: skipped by the user for now (see below).

**Testing recipe** (the harness scripts lived in a temp folder and are not in the repo)
- Launch with `--inspect=9339 --remote-debugging-port=9333`. Connect to the main process inspector
  (`http://127.0.0.1:9339/json/list`) and evaluate code there: `process.mainModule.require('./background/store')`
  gives the tabs; `tab.view.webContents.sendInputEvent({type:'keyDown'|'char'|'keyUp', keyCode, modifiers})`
  sends keys through the same path as a real keyboard (CDP `Input.dispatchKeyEvent` does not trigger the app's
  key handling). Read the mode from `tab.mode` / `tab.pending`; check pages with `executeJavaScript`.
- Serve test pages with `python3 -m http.server`. Smooth scrolling only animates while the window is visible.
- Remote/cloud: there is no system Electron. `npm i --no-save electron@43` (re-run it after any `npm i`, which
  removes it) and `xvfb-run -a npx electron --no-sandbox --inspect=9339 .` work. In the inspector, install a
  `process.on('uncaughtException')` collector first: Electron's default error dialog would block under Xvfb.
- The page UI lives in a closed shadow root, so hints/HUD can't be read from the page: use `capturePage()`.
- `sendInputEvent` `char` events can't type non-ASCII text (Japanese becomes garbage): test IME text by output.

**User preferences learned this session**
- Chats in Japanese, but everything in the repo (UI, code comments, docs, commits, PRs) is in English
- **Key rule (2026-11-15):** every shortcut uses only QWERTY letter keys, `,` `.` `/`, Enter, and Shift with
  those (so `J`, `G`, `?`, `<`, `>` are fine). Enter as little as possible. Esc is allowed (leave a mode / cancel;
  Shift+Esc leaves INSERT in a terminal, where Esc goes to the shell). Never F1-F12, Delete, digits,
  Ctrl, Alt or Super, and never "press twice quickly" gestures (so no `:` `^` `$` `` ` `` `[` `]`, no counts like `5j`). j/k stay scroll keys.
  Keys should be stateless: one key per command, no sequences like `gg` / `yy` (marks and hint labels, which
  pick a target, are the exception). Rare commands are run from the status bar instead of getting a key.
  The default keymap still breaks these
  rules: redesign pending user approval.
- **Screen layout (2026-11-15, qutebrowser-like, not built yet):** one permanent status bar at the bottom
  (mode, pending key, URL / file path, scroll %) that also takes all input: open/commands (`o`) and find (`/`),
  with completions shown above it. No vomnibar overlay, no in-page find bar, no HUD (messages go to the bar).
  Tab strip stays at the top: tabs are fully detached floating rounded rectangles, without numbers.
- Visual mode (select + copy only) is wanted in web pages (exists) and in PDFs too (Chromium's PDF viewer
  is a plugin the content script can't select in: needs a PDF.js-based viewer, pending user approval)
- Nothing may open a separate window (popups, DevTools → tabs/panels)
- Few directories: only `background/` and `content/`; other files stay at the root
- File and folder names are always kebab-case (`editor-buffer.js`, not `editor_buffer.js` or `editorBuffer.js`).
  All files follow it (renamed 2026-11-15). Exceptions: conventional names (`CLAUDE.md`, `README.md`, `PKGBUILD`).
  "cf. Vimium C ..." comments keep Vimium C's own snake_case paths
- j/k = scroll down/up; J = next tab, K = previous tab
- Commit + push to `main` when asked; leave out `package.json`'s `claude` dependency, `bun.lock` and the
  stray dotfiles in the repo root (`.bashrc`, `.zshrc`, `.mcp.json`, ...), which are not part of the app

## Current state (stage 1 done: confirmed to launch)
- `main.js` … entry point; tabs are in `background/browser.js` (`WebContentsView`). Input routing: `background/normalize-urls.js`
- `shell.html` + `shell-preload.js` … tab strip only (no toolbar, no +/× buttons)
- **Vimium C-style keys, structured like Vimium C** (own code, not imported; Vimium C is Apache-2.0):
  - `background/` = main process (browser.js tabs, key-mappings, all-commands, run-commands, run-keys, completion, ports, ...)
  - `content/` = content script, concatenated at startup into `userData/preload/content.js` and registered with
    `session.defaultSession.registerPreloadScript` (sandboxed preloads can't `require` local files). Runs in every top frame,
    popups included; skips iframes, `shell.html`, `vomnibar.html`, and the PDF viewer
  - Key differences from Vimium C (user's choice): `J` = next tab, `K` = previous tab
  - Modes: NORMAL (only mapped keys are taken) / INSERT (focus-based, or `i`) / VISUAL / HINTS / FIND / MARK. Badge in the tab strip
  - **No Ctrl shortcuts** (user rule): no app menu, Ctrl mappings rejected in settings. Editor save/preview: `:w` / `:p`
  - j/k scroll (not arrow keys): scrollable-element search like Vimium C; Monaco via `unitas:editor-scroll` events;
    PDF via the viewer frame's `viewer.viewport.setPosition` (background/run-keys.js)
  - Find uses `webContents.findInPage`; link hints click with real `sendInputEvent` mouse events
  - Settings: `~/.config/unitas/settings.json` (`:settings`), plus history.json, marks.json
- Popups never open a window: `setWindowOpenHandler` → `createWindow` wraps the popup's `webContents` in a tab, keeping `window.opener` (login popups work). Non-web tabs (editor/viewers) get a plain tab with `deny`
- DevTools: `:devtools` (no key: function keys are never bound) → `browser.toggleDevTools`: the DevTools frontend is loaded into our own `WebContentsView` via `setDevToolsWebContents` and docked beside the page (no separate window)
- Chrome extensions: tested LINE and Claude in Chrome (2026-11-15). Electron lacks sidePanel/debugger/tabGroups/nativeMessaging, so Claude in Chrome can't run; LINE might with `electron-chrome-extensions`. User chose to skip extensions for now
- `editor.html` + `editor-preload.js` … Monaco (AMD, v0.52.2) + marked + DOMPurify. MD gets a left/right split live preview
- `start.html` … new tab page
- `terminal.html` + `terminal-preload.js` … terminal tab (xterm.js); shells run in `background/terminal.js` (node-pty). IPC bound to terminal tabs only
- Confirmed launching on Electron 45 + Xvfb: Monaco (including workers), built-in PDF viewer, MD split, all shortcuts (even with focus inside the PDF viewer)
- Gotchas:
  - Load marked / DOMPurify **before** Monaco's `loader.js` (loaded after, they register as AMD modules and the globals disappear)
  - `file:read/write` is limited to the calling editor tab's own file (no path argument). Editor tabs block `will-navigate`
  - An allowed folder (project folder) is planned for stage 3, for Claude
  - The default user agent is stripped of `unitas/x` and `Electron/x` (otherwise Google shows a bot CAPTCHA)

## Next tasks

### 1. PKGBUILD (Arch) — written; makepkg/namcap not yet verified on a real Arch machine
- `PKGBUILD` is at the repo root. It builds from the local checkout via `$startdir`
- Only Monaco's `min/` is used, so `dev/ esm/ min-maps/` are deleted (103MB → 17MB)
- Argument handling works even when Arch's electron launcher puts flags before the app path (`process.defaultApp`)
- Depend on the system `electron` package (don't bundle Electron)
  - `depends=('electron')`, `makedepends=('npm')`
  - Put the app in `/usr/lib/unitas/`, together with `node_modules` from `npm install --omit=dev`
  - `/usr/bin/unitas` launcher: `exec electron /usr/lib/unitas "$@"`
  - `/usr/share/applications/unitas.desktop` and an icon
- Verify with `makepkg -si` and `namcap`. Remove the `electron` devDependency from package.json (the system one is used)
- Note: the dev machine has `electron39/42/43` but no plain `electron`; run with `electron43 .` for now

### 2. Claude Code integration (Agent SDK)
- In the main process, use `query()` from `@anthropic-ai/claude-agent-sdk` and stream the results to the renderer over IPC
- Match the UI to Claude Code for VS Code: chat in a right sidebar, tool call display,
  file edits approved/rejected in **Monaco's diff editor**, `@file` mentions, pass the current file/selection as context, permission prompts
- Auth: pass a token issued by `claude setup-token` to the SDK as the `CLAUDE_CODE_OAUTH_TOKEN` environment variable.
  Store it with Electron `safeStorage` (libsecret/kwallet on Linux). Never put it in a config file in plain text
  - Note: subscription OAuth tokens are for personal use. If distributing to others, switch to an API key (`ANTHROPIC_API_KEY`) (check the latest terms of use)
- The agent's `cwd` is the open project folder. File IO is restricted to allowed paths on the main side

### 3. IaC support
- Monaco: syntax and schema completion for Terraform/OpenTofu (HCL), YAML (Ansible/K8s), Pulumi (TS/Python)
- Integrated terminal (done, `:term`) to run `tofu plan` / `ansible-playbook --check`
- AI flow: Claude generates/edits IaC → **always show the plan/diff in the UI** → apply only after user approval. Never auto-approve apply commands
- To confirm (ask the user): is the IaC target "cloud/servers" or "configuration management of the Arch environment itself"?

## Principles
- Keep it minimal, and keep the directory count small (user prefers few directories: `background/` + `content/` only).
- Keep it minimal. Order: launch → PKGBUILD → Claude chat (read-only) → edit approval → IaC
- User: Yoshi (chats in Japanese, uses Arch Linux, prefers workflows that can be completed from mobile; wants the app, code comments, docs and PRs in English)
