# Unitas

A browser, editor, and PDF/MD/HTML viewer combined into one tabbed window, built on Chromium (Electron).

## Install (Arch Linux)

```bash
git clone https://github.com/nguekwang/unitas.git
cd unitas
makepkg -si               # uses the system electron; npm fetches the libraries at build time
unitas ./note.md
```

## Running during development

```bash
sudo pacman -S electron   # use the system Electron
npm install
npm start                 # start with an empty tab
npm start -- ./note.md    # start with a file
```

## How input is opened

| Input | Opens as |
|---|---|
| `http(s)://…` / `example.com` | Browser (Chromium) |
| Search terms | Google search |
| `.pdf` | Chromium's built-in PDF viewer |
| `.html` `.htm` | Rendered HTML |
| Images | Shown as-is |
| `.md` | Monaco editor + live preview on the right (split) |
| Other text | Monaco editor |

## Modes and keys (vi-style, no Ctrl shortcuts)

Unitas starts in **NORMAL** mode: single keys control the app and never reach the page.
In **INSERT** mode every key goes to the page. The current mode is shown at the right of the tab strip.

| Key (NORMAL) | Action |
|---|---|
| `i` / `Esc` | INSERT mode / back to NORMAL (clicking a text field also enters INSERT; clicking elsewhere returns to NORMAL) |
| `o` | Search palette: tabs, commands, URLs, web search, file paths |
| `O` | Search palette prefilled with the current address |
| `:` | Command line: `:w` save, `:q` close tab, `:e` open file, `:p` Markdown preview, `:tabnew` |
| `t` / `x` | New tab / close tab |
| `J` `K` · `gt` `gT` | Next / previous tab |
| `1`–`8` / `9` | Go to that tab / the last tab |
| `H` / `L` | Back / forward |
| `r` | Reload |
| `h` `j` `k` `l` | Move / scroll (sent to the page as arrow keys, so they move the cursor in the editor) |
| `d` `u` / `Space` · `gg` `G` | Page down / up · top / bottom |
| `e` | Open the file being viewed (HTML etc., not PDF) in the editor |

There is no application menu, so Electron's default Ctrl accelerators (reload, zoom, quit, ...) are gone too.
Ctrl/Alt key combinations still reach the page untouched (copy/paste, Monaco's own editing keys).

## Popups open as tabs

Pages never open a separate window. `window.open` popups (e.g. "Sign in with ..." login windows) and
`target=_blank` links open as tabs in the same window. Web pages keep the opener link, so login popups can
report back and close themselves; the tab then closes and the opening page comes back.

## Layout

- `main.js` … tab management (`WebContentsView`), input classification, NORMAL/INSERT modes, popups as tabs, file IO
- `shell.html` / `shell-preload.js` … tab strip UI
- `palette.html` / `palette-preload.js` … search palette / command line (overlay view)
- `editor.html` / `editor-preload.js` … Monaco + Markdown preview (marked + DOMPurify)
- `start.html` … new tab page

## Known limitations (minimal version)

- No tab reordering, bookmarks, history UI, or extensions
- Files changed outside the app are not reloaded automatically
- Closing a tab with unsaved changes does not ask for confirmation
- Electron's extension support is limited (uBlock etc. would need separate work)
