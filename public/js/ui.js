/** DOM helpers. All text goes through textContent, never innerHTML. */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0;top:0;left:0' }); ta.value = text;
  document.body.append(ta); ta.focus(); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
  ta.remove(); return ok;
}

export function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Today, ' + time;
  const y = new Date(now - 864e5); if (d.toDateString() === y.toDateString()) return 'Yesterday, ' + time;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + time;
}
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Chip group: single or multi (max 3) select. */
export function chips({ items, selected, multi = false, onChange, cls = '' }) {
  const sel = new Set(multi ? selected : [selected]);
  const wrap = h('div', { class: 'chips ' + cls, role: multi ? 'group' : 'radiogroup' });
  const paint = () => [...wrap.children].forEach((b) => {
    const on = sel.has(b.dataset.id); b.classList.toggle('on', on); b.setAttribute(multi ? 'aria-pressed' : 'aria-checked', String(on));
  });
  for (const it of items) {
    wrap.append(h('button', {
      type: 'button', class: 'chip', dataset: { id: it.id }, role: multi ? null : 'radio',
      onclick: () => {
        if (multi) {
          if (sel.has(it.id)) { if (sel.size > 1) sel.delete(it.id); } else { sel.add(it.id); if (sel.size > 3) sel.delete([...sel][0]); }
        } else { sel.clear(); sel.add(it.id); }
        paint(); onChange(multi ? [...sel] : it.id);
      },
    }, it.label));
  }
  paint(); return wrap;
}
export function select({ id, label, options, value, onChange }) {
  const s = h('select', { id, class: 'field', onchange: (e) => onChange(e.target.value) },
    options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: v === value }, l); }));
  return h('div', { class: 'ctl' }, h('label', { for: id }, label), s);
}
