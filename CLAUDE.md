# Unitas — Claude Code handoff notes

## Goal
An "all-in-one tabbed app" built on Chromium (Electron) that runs on Arch Linux.
It combines a browser, an editor, and PDF/MD/HTML viewers in one window, and also
embeds **a UI/UX equivalent to the VS Code extension version of Claude Code, using the Claude Agent SDK**. It should handle IaC as well.

## Current state (stage 1 done: confirmed to launch)
- `main.js` … tab management with `WebContentsView`. Routes input to URL/PDF/HTML/image/MD-or-text
- `shell.html` + `shell-preload.js` … tab strip (the back/forward/reload/address/open/edit toolbar was removed)
- `palette.html` + `palette-preload.js` … search palette / command line (transparent overlay `WebContentsView`): tabs, commands, URL/search/file path, vim-style `:w` `:q` `:e` `:p` aliases
- vi-style modes, app-wide (`main.js`): NORMAL (default; single keys control the app, printable keys are blocked from the page) / INSERT (keys go to the page, Esc returns). Mode badge in the tab strip. Clicking a text field enters INSERT (`before-mouse-event` + `document.activeElement` check)
  - **No Ctrl shortcuts** (user rule). The application menu is removed (`Menu.setApplicationMenu(null)`) to drop Electron's default accelerators. Editor save/preview are `:w` / `:p` (sent to the editor over `editor:cmd`)
  - Movement keys (hjkl, d/u, gg/G) are sent to the page as arrow/Page/Home/End keys via `sendInputEvent`
- Popups never open a window: `setWindowOpenHandler` → `createWindow` wraps the popup's `webContents` in a tab, keeping `window.opener` (login popups work). Non-web tabs (editor/viewers) get a plain tab with `deny`, so the editor preload is never inherited
- `editor.html` + `editor-preload.js` … Monaco (AMD, v0.52.2) + marked + DOMPurify. MD gets a left/right split live preview
- `start.html` … new tab page
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
- Integrated terminal (xterm.js + node-pty) to run `tofu plan` / `ansible-playbook --check`
- AI flow: Claude generates/edits IaC → **always show the plan/diff in the UI** → apply only after user approval. Never auto-approve apply commands
- To confirm (ask the user): is the IaC target "cloud/servers" or "configuration management of the Arch environment itself"?

## Principles
- Keep it minimal. Order: launch → PKGBUILD → Claude chat (read-only) → edit approval → IaC
- User: Yoshi (chats in Japanese, uses Arch Linux, prefers workflows that can be completed from mobile; wants the app, code comments, docs and PRs in English)
