import { DEFAULT_SETTINGS } from './data.js';
import { uid } from './ui.js';

/**
 * Everything is stored in this browser's localStorage only. Reads are defensive: corrupt or unexpected data
 * never crashes the app, it just falls back to defaults.
 */
const K = { settings: 'cra.settings.v1', history: 'cra.history.v1', saved: 'cra.saved.v1' };
export const SIG_DEFAULT = { google: true, instagram: false, influencer: false, whatsapp: false, customer: false };
const MAX_HISTORY = 100;

const mem = {}; // fallback when localStorage is blocked (private mode) or full
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function readRaw(k) {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
}
function write(k, v) {
  mem[k] = v;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked or full: memory copy still works for this session */ }
}
function readList(k) {
  const v = readRaw(k);
  if (Array.isArray(v)) return v.filter((x) => isObj(x) && typeof x.reply === 'string');
  return Array.isArray(mem[k]) ? mem[k] : [];
}
const str = (v, d = '') => (typeof v === 'string' ? v : d);

let settingsCache = null;
export function getSettings() {
  if (settingsCache) return settingsCache;
  const raw = readRaw(K.settings);
  const s = isObj(raw) ? raw : (isObj(mem[K.settings]) ? mem[K.settings] : {});
  const D = DEFAULT_SETTINGS;
  const brand = { ...D.brand, ...(isObj(s.brand) ? s.brand : {}) };
  for (const key of Object.keys(brand)) brand[key] = str(brand[key], str(D.brand[key]));
  const defaults = { ...D.defaults, ...(isObj(s.defaults) ? s.defaults : {}) };
  if (!Array.isArray(defaults.tones)) defaults.tones = D.defaults.tones;
  defaults.sigPlatforms = { ...SIG_DEFAULT, ...(isObj(defaults.sigPlatforms) ? defaults.sigPlatforms : {}) };
  settingsCache = {
    ...D, ...(isObj(s) ? s : {}), brand, defaults,
    colors: { ...D.colors, ...(isObj(s.colors) ? s.colors : {}) },
    branches: Array.isArray(s.branches) ? s.branches.filter((b) => typeof b === 'string' && b.trim()) : [...D.branches],
    branch: str(s.branch),
  };
  return settingsCache;
}
export function saveSettings(s) { settingsCache = s; write(K.settings, s); applyTheme(s); }
export function applyTheme(s = getSettings()) {
  const r = document.documentElement.style;
  r.setProperty('--green', s.colors.primary); r.setProperty('--red', s.colors.accent);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = s.colors.primary;
}

/** Should this platform get the signature? Master switch AND the per-platform switch. */
export function wantsSignature(platformKey) {
  const d = getSettings().defaults;
  return !!d.signature && !!d.sigPlatforms[platformKey || 'customer'];
}

export const getHistory = () => readList(K.history);
export function addHistory(item) {
  const list = getHistory(); const rec = { id: uid(), ts: Date.now(), fav: false, ...item };
  list.unshift(rec); write(K.history, list.slice(0, MAX_HISTORY)); return rec;
}
export function updateHistory(id, patch) { const l = getHistory(); const i = l.findIndex((x) => x.id === id); if (i > -1) { Object.assign(l[i], patch); write(K.history, l); } return l[i]; }
export function deleteHistory(id) { write(K.history, getHistory().filter((x) => x.id !== id)); }
export function clearHistory() { write(K.history, []); }

export const getSaved = () => readList(K.saved);
export function addSaved(item) {
  const l = getSaved(); if (l.some((x) => x.reply === item.reply)) return null;
  const rec = { id: uid(), ts: Date.now(), ...item }; l.unshift(rec); write(K.saved, l); return rec;
}
export function updateSaved(id, patch) { const l = getSaved(); const i = l.findIndex((x) => x.id === id); if (i > -1) { Object.assign(l[i], patch); write(K.saved, l); } }
export function deleteSaved(id) { write(K.saved, getSaved().filter((x) => x.id !== id)); }
export function removeSavedByReply(reply) { write(K.saved, getSaved().filter((x) => x.reply !== reply)); }
export const isSaved = (reply) => getSaved().some((x) => x.reply === reply);
