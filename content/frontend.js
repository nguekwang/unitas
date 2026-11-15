// Content script entry point (cf. Vimium C content/frontend.ts): get settings and key mappings from
// the main process and start listening. Runs in every tab, at document start, in an isolated world.
(() => {
  function apply(p) {
    if (!p) return;
    Object.assign(Settings, p.settings || {});
    DomUI.setCss(p.css || '');
    KeyHandler.setMappings(p.mappings || []);
  }

  Port.invoke('init').then(apply);
  Port.on('settings', apply);
  Port.on('run', ({ name, count }) => KeyHandler.run(name, count || 1));
  Port.on('hud', ({ text }) => HUD.tip(text));
  addEventListener('DOMContentLoaded', () => KeyHandler.report());
})();
