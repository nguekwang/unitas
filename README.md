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
npm install              # builds node-pty (needs base-devel and python)
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

## Keys (Vimium C style, no Ctrl shortcuts)

Unitas works like the Vimium C browser extension, built into the app. In **NORMAL** mode mapped keys
control the app and never reach the page; unmapped keys and every Ctrl/Alt combination go to the page
as usual. Focusing a text field (or pressing `i`) switches to **INSERT**; `Esc` leaves it.
The mode is shown at the right of the tab strip. Press `?` for every key. Counts work: `5j`, `3gt`.

| Keys | Action |
|---|---|
| `j` `k` · `h` `l` | Scroll down / up · left / right |
| `d` `u` · `gg` `G` · `zH` `zL` | Half page down / up · top / bottom · far left / right |
| `f` / `F` / `yf` | Link hints: open / open in new tab / copy link URL |
| `gi` | Focus the first text input |
| `/` `n` `N` | Find (all matches highlighted) / next / previous |
| `v` / `V` | Visual / visual line mode: `hjkl` `w` `b` `0` `$` `gg` `G` move, `o` swap ends, `y` copy |
| `m`{a-z} / `` ` ``{a-z} | Set / jump to a mark on this page (`A-Z`: global marks; ``` `` ``` jumps back) |
| `[[` `]]` | Follow the previous / next link |
| `o` / `O` | Vomnibar: open a URL, history entry, search or file / same in a new tab |
| `T` | Vomnibar: search open tabs |
| `ge` / `gE` | Edit the current URL / and open in a new tab |
| `:` | Command line: `:w` save, `:q` close tab, `:e` open file, `:p` Markdown preview, `:settings`, `:help` |
| `H` `L` · `r` | Back / forward · reload |
| `J` `K` · `gt` `gT` · `g0` `g$` · `^` | Next / previous tab · first / last tab · previously visited tab |
| `t` · `x` · `X` · `yt` · `<<` `>>` | New / close / restore / duplicate tab · move tab left / right |
| `yy` · `p` `P` | Copy the URL · open the copied URL here / in a new tab |
| `gu` `gU` | Go up the URL / to its root |
| `e` | Edit the file being viewed (HTML etc.) |
| `:term` | Terminal tab (see below) |
| `F12` / `:devtools` | Developer tools for this tab, docked inside the window (right, or below in a tall window) |

In the vomnibar, `"<keyword> <terms>"` uses a search engine: `w tokyo` (Wikipedia), `aw pacman` (ArchWiki),
`gh electron`, `y lofi`, `d …` (DuckDuckGo), `g …` (Google). `Shift+Enter` opens in a new tab.

### Settings

`:settings` opens `~/.config/unitas/settings.json` in the editor; changes apply as soon as it is saved.

```json
{
  "keyMappings": ["map <space> scrollPageDown", "unmap x"],
  "linkHintCharacters": "sadjklewcmpgh",
  "scrollStepSize": 100,
  "smoothScroll": true,
  "grabBackFocus": false,
  "searchUrl": "https://www.google.com/search?q=%s",
  "searchEngines": ["w: https://en.wikipedia.org/w/index.php?search=%s Wikipedia"]
}
```

Command names for `map` are listed in `background/all_commands.js`. Ctrl mappings are rejected.
History (`history.json`) and marks (`marks.json`) are kept in the same folder.

## Terminal

`:term` opens a terminal tab (xterm.js + node-pty) running `$SHELL`, in the folder of the file being viewed
(else the home folder). It starts in **INSERT** mode, so every key goes to the shell, Ctrl keys included.
In a terminal `Esc` also goes to the shell (vim, less, fzf need it): **`Shift+Esc`** returns to NORMAL mode,
where `j` `k` `d` `u` `gg` `G` scroll the scrollback, `J` `K` switch tabs, and `i` (or a click) goes back
to the shell. `yt` opens another shell in the same folder. `exit` closes the tab; closing the tab ends the
shell. Map a key with `map <keys> openTerminal`.

## Popups open as tabs

Pages never open a separate window. `window.open` popups (e.g. "Sign in with ..." login windows) and
`target=_blank` links open as tabs in the same window. Web pages keep the opener link, so login popups can
report back and close themselves; the tab then closes and the opening page comes back.

## Layout

The structure follows Vimium C: a background part (main process) and a content part (inside pages).

- `main.js` … entry point: window, app lifecycle
- `background/` … main process (Vimium C `background/`)
  - `browser.js` tabs · `store.js` shared state · `all_commands.js` commands · `key_mappings.js` default keys + map/unmap
  - `run_commands.js` runs commands · `run_keys.js` keys in the PDF viewer · `tab_commands.js` · `open_urls.js`
  - `completion.js` vomnibar suggestions · `normalize_urls.js` typed text → URL/file/search
  - `browsing_data_manager.js` history · `tools.js` marks · `clipboard.js` · `settings.js` · `ports.js` IPC
  - `terminal.js` shells for terminal tabs · `vomnibar.js` · `help_dialog.js` · `ui_css.js` · `content_bundle.js` builds and registers the content script
- `content/` … content script, run in every page in an isolated world (Vimium C `content/` + `lib/`)
  - `key_handler.js` modes and key sequences · `insert.js` · `scroller.js` · `link_hints.js` · `local_links.js` · `link_actions.js`
  - `mode_find.js` · `visual.js` · `marks.js` · `hud.js` · `dom_ui.js` · `help_dialog.js` · `commands.js` · `port.js` · `frontend.js`
  - `utils.js` · `keyboard_utils.js` · `dom_utils.js`
- `shell.html` / `shell-preload.js` … tab strip + mode badge
- `vomnibar.html` / `vomnibar-preload.js` … the vomnibar overlay
- `editor.html` / `editor-preload.js` … Monaco + Markdown preview (marked + DOMPurify)
- `terminal.html` / `terminal-preload.js` … terminal tab (xterm.js); its shell runs in `background/terminal.js` (node-pty)
- `start.html` … new tab page · `ui.css` … hints / HUD / find bar / help styles

## Known limitations (minimal version)

- No bookmarks, or Chrome extensions
- The content script runs in the top frame only: keys typed inside an iframe go to the iframe
- Files changed outside the app are not reloaded automatically
- Closing a tab with unsaved changes does not ask for confirmation
- Electron's extension support is limited (uBlock etc. would need separate work)
