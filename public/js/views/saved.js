import { h, clear, toast, fmtDate } from '../ui.js';
import { getSaved, updateSaved, deleteSaved } from '../store.js';
import { emptyState, copyButton } from '../components.js';
import { groupOf, titleFor } from '../config.js';
import { preset } from './home.js';

let filter = 'All';
const FILTERS = ['All', 'Google', 'Instagram', 'Influencer', 'Customer'];

export function render(el) {
  clear(el).append(h('header', { class: 'page-head' }, h('h1', { class: 'title' }, 'Saved Replies')));
  el.append(h('div', { class: 'chips scroll-chips', role: 'radiogroup', 'aria-label': 'Filter' }, FILTERS.map((f) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(filter === f), class: 'chip' + (filter === f ? ' on' : ''), onclick: () => { filter = f; render(el); },
  }, f === 'Customer' ? 'Customer / WhatsApp' : f))));
  const list = getSaved().filter((x) => filter === 'All' || groupOf(x) === filter);
  if (!list.length) { el.append(emptyState('Save your best replies here so you can reuse them anytime. ❤️')); return; }
  const wrap = h('div', { class: 'stack' });
  list.forEach((s) => wrap.append(card(s, el)));
  el.append(wrap);
}

function card(s, el) {
  let text = s.reply;
  const body = h('p', { class: 'reply-text' }, text);
  const edit = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Edit');
  edit.addEventListener('click', () => {
    const ta = h('textarea', { class: 'field', rows: '5', 'aria-label': 'Edit saved reply' }); ta.value = text;
    const save = h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => { text = ta.value.trim() || text; updateSaved(s.id, { reply: text }); toast('Updated'); render(el); } }, 'Save changes');
    body.replaceWith(h('div', { class: 'stack-sm' }, ta, save)); ta.focus();
  });
  return h('article', { class: 'card fade' },
    h('div', { class: 'alt-head' }, h('h3', {}, s.title || titleFor(s)), h('time', { class: 'muted' }, s.ts ? fmtDate(s.ts) : '')),
    s.original ? h('p', { class: 'snippet' }, s.original) : null,
    body,
    h('div', { class: 'reply-actions' }, copyButton(() => text, { cls: 'btn btn-primary btn-sm' }), edit,
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => preset({ platform: s.platformKey || '', text: s.original || '' }) }, 'Reuse'),
      h('button', { class: 'btn btn-ghost btn-sm danger', type: 'button', 'aria-label': 'Delete saved reply', onclick: () => { deleteSaved(s.id); toast('Deleted'); render(el); } }, 'Delete')));
}
