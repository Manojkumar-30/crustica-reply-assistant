import { h, copyText, toast, clear } from './ui.js';
import { REPHRASE_OPTIONS } from './config.js';
import { replyEngine } from './replyEngine.js';
import { addSaved, removeSavedByReply, isSaved } from './store.js';

/** Copy button that flips to "✓ Copied" for a moment. */
export function copyButton(getText, { cls = 'btn btn-primary', onCopied, node } = {}) {
  const b = h('button', { class: cls, type: 'button', 'aria-label': 'Copy reply' }, 'Copy');
  b.addEventListener('click', async () => {
    const ok = await copyText(getText());
    toast(ok ? 'Reply copied' : 'Could not copy. Press and hold the text to copy it.');
    if (!ok) { if (node) { const r = document.createRange(); r.selectNodeContents(node); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } return; }
    b.textContent = '✓ Copied'; b.classList.add('done');
    if (onCopied) onCopied(getText());
    setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1500);
  });
  return b;
}

/**
 * Main reply card. ctx = { opts(), original, savedMeta, onUsed(text) }
 */
export function mainReplyCard(reply, ctx) {
  let text = reply.text, variant = 0;
  const body = h('p', { class: 'reply-text', tabindex: '0' }, text);
  const save = h('button', { class: 'btn btn-ghost', type: 'button' });
  const rephrase = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Rephrase');
  const warn = h('p', { class: 'warn', hidden: true }, 'Fill in the [bracketed] details before sending.');
  const card = h('article', { class: 'card reply-main fade' }, body, warn,
    h('div', { class: 'reply-actions' }, copyButton(() => text, { node: body, onCopied: (t) => ctx.onUsed && ctx.onUsed(t) }), rephrase, save));
  const paint = () => { const on = isSaved(text); save.textContent = on ? '♥ Saved' : '♡ Save'; save.setAttribute('aria-pressed', String(on)); warn.hidden = !/\[[^\]]+\]/.test(text); };
  const set = (t) => { text = t; body.textContent = t; paint(); card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); };
  save.addEventListener('click', () => {
    if (isSaved(text)) { removeSavedByReply(text); toast('Removed from saved'); } else { addSaved({ reply: text, original: ctx.original, ...ctx.savedMeta }); toast('Saved'); }
    paint();
  });
  rephrase.addEventListener('click', () => rephraseSheet(text, ctx, () => ++variant, set));
  paint();
  return card;
}

/** Compact alternative card with Copy only. */
export function altCard(reply, ctx) {
  const t = reply.text;
  return h('article', { class: 'card alt fade' },
    h('div', { class: 'alt-head' }, h('h3', {}, reply.label), copyButton(() => t, { cls: 'btn btn-ghost btn-sm', onCopied: (x) => ctx.onUsed && ctx.onUsed(x) })),
    h('p', { class: 'reply-text' }, t));
}

function rephraseSheet(text, ctx, nextVariant, onResult) {
  return sheet('Change the style', (closeFn) => h('div', { class: 'opt-list' }, REPHRASE_OPTIONS.map(([mode, label]) => {
    const b = h('button', { class: 'opt', type: 'button' }, label);
    b.addEventListener('click', async () => {
      b.textContent = 'Working…'; b.disabled = true;
      try {
        const r = await replyEngine.rephrase(text, mode, { ...ctx.opts(), variant: nextVariant() });
        closeFn(); if (r.text) onResult(r.text);
      } catch { b.textContent = label; b.disabled = false; toast('Could not change it. Try again.'); }
    });
    return b;
  })));
}

export function emptyState(title, sub) {
  return h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, title), sub ? h('p', { class: 'muted' }, sub) : null);
}

export function sheet(title, content) {
  const root = document.getElementById('sheet-root');
  const prev = document.activeElement;
  const close = () => { clear(root); document.removeEventListener('keydown', esc); prev && prev.focus && prev.focus(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-grip' }), h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, '✕')), content(close));
  clear(root).append(h('div', { class: 'sheet-backdrop', onclick: close }), panel);
  (panel.querySelector('button.opt') || panel.querySelector('button'))?.focus();
  return close;
}
