import { h, clear, fmtDate, debounce } from '../ui.js';
import { getHistory, deleteHistory } from '../store.js';
import { emptyState, copyButton, sheet } from '../components.js';
import { titleFor } from '../config.js';
import { preset } from './home.js';

let q = '';

export function render(el) {
  clear(el).append(h('header', { class: 'page-head' }, h('h1', { class: 'title' }, 'History')));
  const all = getHistory();
  if (!all.length) { el.append(emptyState('Your reply history will appear here.')); return; }
  const list = h('div', { class: 'stack' });
  const search = h('input', { type: 'search', class: 'field', placeholder: 'Search, e.g. pasta', 'aria-label': 'Search history', value: q });
  const paint = () => {
    clear(list);
    const items = all.filter((x) => !q || `${x.original} ${x.reply} ${x.platform}`.toLowerCase().includes(q.toLowerCase()));
    if (!items.length) list.append(emptyState('No matching replies.', 'Try another word.'));
    items.forEach((x) => list.append(h('article', { class: 'card hist fade' },
      h('button', { class: 'hist-open', type: 'button', onclick: () => open(x, el) },
        h('div', { class: 'alt-head' }, h('h3', {}, titleFor(x)), h('time', {}, fmtDate(x.ts))), h('p', { class: 'snippet' }, x.original)),
      h('div', { class: 'reply-actions' }, copyButton(() => x.reply, { cls: 'btn btn-primary btn-sm' }),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => reuse(x) }, 'Reuse')))));
  };
  search.addEventListener('input', debounce(() => { q = search.value.trim(); paint(); }, 150));
  el.append(search, list); paint();
}

const reuse = (x) => preset({ platform: x.platformKey || '', rating: x.rating || 5, ig: x.igKind || 'Instagram Comment', text: x.original });

function open(x, el) {
  sheet(titleFor(x), (close) => h('div', { class: 'stack-sm' },
    h('p', { class: 'muted' }, fmtDate(x.ts)),
    h('div', { class: 'quote' }, x.original),
    h('p', { class: 'reply-text' }, x.reply),
    h('div', { class: 'reply-actions' }, copyButton(() => x.reply),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { close(); reuse(x); } }, 'Reuse'),
      h('button', { class: 'btn btn-ghost danger', type: 'button', onclick: () => { deleteHistory(x.id); close(); render(el); } }, 'Delete'))));
}
