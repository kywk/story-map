/**
 * OPTIONAL host client module: full-page StoryMap view + Markdown/StoryMap toggle.
 *
 * This file is a Docusaurus site example, not part of @story-map/remark-story-map.
 * The package intentionally stops at emitting a `.story-map-host` placeholder and
 * mounting the renderer; a full-page view belongs to the host because it
 * manipulates Docusaurus theme DOM, the docs sidebar, the route lifecycle, and
 * host CSS. `docs/docusaurus-full-page.md` explains the trade-off and the wiring.
 *
 * Behaviour: for a `story-map: true` document (host stamped with
 * data-story-map-document="true") the page defaults to a full-viewport map,
 * mirroring Obsidian's "Open as Story Map". The navbar and the collapsible docs
 * sidebar stay available. A floating button toggles back to the Markdown view,
 * and the choice is remembered per path for the session. Ordinary pages that
 * merely mention a StoryMap are untouched.
 *
 * Register it from the site's client plugin (see
 * examples/docusaurus/story-map-client-plugin.cjs) and load
 * examples/docusaurus/story-map-full-page.css through the theme customCss.
 */

const STORAGE_KEY = 'story-map-view-preference';
const ACTIVE_CLASS = 'story-map-view-active';
const TOGGLE_CLASS = 'story-map-toggle';
const DOC_HOST_SELECTOR = '.story-map-host[data-story-map-document="true"]';
const SIDEBAR_HIDDEN_SELECTOR = '[class*="docSidebarContainerHidden"]';
const COLLAPSE_BUTTON_SELECTOR = 'button[class*="collapseSidebarButton"]';
const EXPAND_BUTTON_SELECTOR = 'button[class*="expandButton"]';

// Localise these two labels for your site.
const LABEL_MAP = 'Story map view';
const LABEL_MARKDOWN = 'Markdown view';

let toggleButton = null;
let viewActive = false;
let collapsedByUs = false;

function readPreferences() {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function isMarkdownPreferred(path) {
  return readPreferences()[path] === 'markdown';
}

function writePreference(path, view) {
  try {
    const preferences = readPreferences();
    preferences[path] = view;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // sessionStorage unavailable; the toggle still works for the current view.
  }
}

function isSidebarHidden() {
  return Boolean(document.querySelector(SIDEBAR_HIDDEN_SELECTOR));
}

/** Collapse the Docusaurus docs sidebar, retrying until hydration is ready. */
function collapseSidebar(attempt = 0) {
  if (isSidebarHidden()) {
    collapsedByUs = true;
    return;
  }

  const button = document.querySelector(COLLAPSE_BUTTON_SELECTOR);
  if (button) {
    button.click();
    collapsedByUs = true;
  }

  if (attempt < 5) {
    window.setTimeout(() => collapseSidebar(attempt + 1), 150);
  }
}

/** Restore the sidebar if this module collapsed it. */
function expandSidebar(attempt = 0) {
  if (!isSidebarHidden()) {
    collapsedByUs = false;
    return;
  }

  const button = document.querySelector(EXPAND_BUTTON_SELECTOR);
  if (button) button.click();

  if (attempt < 5) {
    window.setTimeout(() => expandSidebar(attempt + 1), 150);
  }
}

function ensureToggle() {
  if (toggleButton && toggleButton.isConnected) return toggleButton;

  toggleButton = document.querySelector(`.${TOGGLE_CLASS}`);
  if (toggleButton) return toggleButton;

  toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = TOGGLE_CLASS;
  toggleButton.addEventListener('click', () => {
    applyView(!document.body.classList.contains(ACTIVE_CLASS), true);
  });
  document.body.appendChild(toggleButton);
  return toggleButton;
}

function updateToggle(active) {
  const button = ensureToggle();
  button.textContent = active ? LABEL_MARKDOWN : LABEL_MAP;
  button.setAttribute('aria-pressed', String(active));
}

function applyView(active, persist) {
  if (active === viewActive) {
    updateToggle(active);
    return;
  }

  viewActive = active;
  document.body.classList.toggle(ACTIVE_CLASS, active);
  updateToggle(active);

  if (active) {
    collapseSidebar();
  } else if (collapsedByUs) {
    expandSidebar();
  }

  if (persist) {
    writePreference(window.location.pathname, active ? 'storymap' : 'markdown');
  }
}

function sync() {
  if (typeof document === 'undefined' || !document.body) return;

  const hosts = document.querySelectorAll(DOC_HOST_SELECTOR);
  if (hosts.length === 0) {
    if (viewActive) applyView(false, false);
    if (toggleButton && toggleButton.isConnected) toggleButton.remove();
    toggleButton = null;
    return;
  }

  ensureToggle();
  applyView(!isMarkdownPreferred(window.location.pathname), false);
}

export function onRouteDidUpdate() {
  sync();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => sync(), { once: true });
  } else {
    sync();
  }
}
