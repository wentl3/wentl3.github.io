// Page-wide selection (`07` §1); every view reads one state
import { DEFAULTS, parseSelection, selectionQuery } from "./lib/share.js";

const state = { ...DEFAULTS, ...parseSelection(typeof location !== "undefined" ? location.search : "") };
const listeners = new Set();

export function getSelection() { return { ...state }; }

/** Merge a patch; notify only when something changed. Returns the changed keys. */
export function setSelection(patch) {
  const changed = Object.keys(patch).filter((k) => patch[k] !== state[k]);
  if (!changed.length) return [];
  Object.assign(state, patch);
  try {
    history.replaceState(null, "", `${location.pathname}${selectionQuery(state)}${location.hash}`);
  } catch { /* file:// or tests */ }
  for (const fn of listeners) fn(getSelection(), changed);
  return changed;
}

export function onSelection(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function shareUrl() {
  return `${location.origin}${location.pathname}${selectionQuery(state)}`;
}
