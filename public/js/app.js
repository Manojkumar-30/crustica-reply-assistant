import { $, h, clear } from './ui.js';
import { applyTheme } from './store.js';
import { icon } from './icons.js';
import * as home from './views/home.js';

const lazy = {
  saved: () => import('./views/saved.js'),
  history: () => import('./views/history.js'),
  settings: () => import('./views/settings.js'),
};
const NAV = [['home', 'home', 'Home'], ['saved', 'bookmark', 'Saved'], ['history', 'clock', 'History'], ['settings', 'settings', 'Settings']];

applyTheme();

function buildNav() {
  const mk = (cls, withIcon) => NAV.map(([id, ic, label]) => h('a', { href: '#/' + (id === 'home' ? '' : id), class: cls, dataset: { id }, 'aria-label': label },
    withIcon ? h('span', { class: 'ni' }, icon(ic)) : null, h('span', { class: 'nl' }, label)));
  $('#nav').append(...mk('nav-item', true));
  $('#topnav').append(...mk('top-link', false).filter((a) => a.dataset.id !== 'home'));
}

async function route() {
  const id = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  const key = NAV.some((n) => n[0] === id) ? id : 'home';
  document.querySelectorAll('.nav-item, .top-link').forEach((a) => { const on = a.dataset.id === key; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const view = $('#view');
  let mod = key === 'home' ? home : null;
  if (!mod) {
    clear(view);
    try { mod = await lazy[key](); } catch { view.append(h('p', { class: 'muted' }, 'Could not load this page. Check your connection.')); return; }
  }
  mod.render(view);
  if (key !== 'home') window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

buildNav();
window.addEventListener('hashchange', route);
route();

/* offline pill: reply generation is fully local, so the app keeps working */
const pill = document.getElementById('offline');
const syncOnline = () => { pill.hidden = navigator.onLine; };
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
