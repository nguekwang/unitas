// Session-wide security policy. Electron's defaults are looser than a normal browser's in two places,
// and both are closed here for the one session every tab uses (session.defaultSession):
//
// 1. Permissions: with no handler, Electron grants every request (camera, microphone, location,
//    notifications, ...) to any site without asking. Here everything is denied except a short list.
// 2. Local files: Electron gives file:// pages extra privileges (the GrantFileProtocolExtraPrivileges
//    fuse), so a local HTML file can fetch() any other local file (~/.ssh, ~/.config/unitas, ...) and
//    send it out. Unitas runs on the system electron, whose fuses can't be flipped, so file:// requests
//    are filtered with webRequest instead.
const { app, session } = require('electron');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');
const store = require('./store');

const ROOT = path.join(__dirname, '..'); // Unitas's own pages and node_modules (Monaco, marked, ...)

// Harmless permissions that pages may use without asking
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);

// Subresource types a local page may load from its own folder (and below): what a saved web page
// or generated report needs to render. Everything else (fetch/XHR, iframes, plugins, ...) is refused.
const LOCAL_SUBRESOURCES = new Set(['stylesheet', 'script', 'image', 'font', 'media']);

const inside = (dir, p) => {
  const rel = path.relative(dir, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

const hasDotEntry = (dir, p) => path.relative(dir, p).split(path.sep).some(s => s.startsWith('.'));

const tabOf = wc => wc && store.tabs.find(t => !t.view.webContents.isDestroyed() && t.view.webContents === wc);

// Decide one file:// request. Exported for tests.
exports.allowFileRequest = ({ url, resourceType, webContents }) => {
  let p;
  try { p = fileURLToPath(url); } catch { return false; }
  // Opening a file as a page: the page only shows it, it can't read it back.
  // (Web pages can't navigate to file:// at all: Chromium blocks that itself.)
  if (resourceType === 'mainFrame') return true;
  // Unitas's own code (shell, vomnibar, editor with Monaco, start page)
  // (dot entries are left out: a dev checkout holds .git and stray dotfiles)
  if (inside(ROOT, p) && !hasDotEntry(ROOT, p)) return true;
  // Everything else is a subresource of a local file opened in a tab (HTML viewer, Markdown preview, ...)
  const t = tabOf(webContents);
  if (!t || !t.file || !LOCAL_SUBRESOURCES.has(resourceType)) return false;
  // A file directly in the home folder would otherwise expose all of ~ (including dotfiles)
  const dir = path.dirname(t.file);
  if (dir === os.homedir() || dir === path.parse(dir).root) return path.dirname(p) === dir && !hasDotEntry(dir, p);
  return inside(dir, p) && !hasDotEntry(dir, p);
};

exports.init = (ses = session.defaultSession) => {
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));

  ses.webRequest.onBeforeRequest({ urls: ['file:///*'] }, (details, callback) => {
    const ok = exports.allowFileRequest(details);
    if (!ok) console.warn(`blocked local file request (${details.resourceType}): ${details.url}`);
    callback({ cancel: !ok });
  });

  // No <webview> anywhere: Unitas never uses it, and a page that managed to add one would get a guest
  // with its own webPreferences
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-attach-webview', ev => ev.preventDefault());
  });
};

// Unitas's own UI pages (tab strip, vomnibar) carry a preload API, so they must never load anything else:
// a link dropped on the tab strip would otherwise replace it with a web page. They open no popups either.
exports.lockAppView = wc => {
  wc.on('will-navigate', e => e.preventDefault());
  wc.on('will-redirect', e => e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
};
