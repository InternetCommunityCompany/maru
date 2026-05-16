// Bridge page wired by `index.html`. The only job here is to register the
// MARU panel; everything interesting runs inside `devtools-panel.html` once
// the user opens the tab. The WXT polyfill aliases `browser` to `chrome` in
// the DevTools page context, so the Chrome-only `devtools.panels` namespace
// is reachable through it.
browser.devtools.panels.create("MARU", "/icon/96.png", "/devtools-panel.html");
