import { h, clear, toast, debounce } from '../ui.js';
import { LANGUAGES, DEFAULT_SETTINGS } from '../data.js';
import { TONE_PRESETS } from '../config.js';
import { getSettings, saveSettings, getHistory, getSaved, clearHistory } from '../store.js';

const SIG_PLATFORMS = [['google', 'Google'], ['instagram', 'Instagram'], ['influencer', 'Influencer'], ['whatsapp', 'WhatsApp'], ['customer', 'Customer']];

export function render(el) {
  clear(el);
  const s = structuredClone(getSettings());
  s.defaults.tone = s.defaults.tone || 'warm';
  const commit = debounce(() => { saveSettings(s); toast('Saved'); }, 500);

  const field = (label, obj, key, o = {}) => {
    const input = h(o.area ? 'textarea' : 'input', { class: 'field', rows: o.area ? '3' : null, type: o.area ? null : (o.type || 'text'), placeholder: o.ph || '', 'aria-label': label, oninput: (e) => { obj[key] = e.target.value; commit(); } });
    input.value = obj[key] || '';
    return h('div', { class: 'ctl' }, h('label', {}, label), input);
  };
  const pick = (label, obj, key, options) => h('div', { class: 'ctl' }, h('label', {}, label),
    h('select', { class: 'field', 'aria-label': label, onchange: (e) => { obj[key] = e.target.value; commit(); } }, options.map(([v, l]) => h('option', { value: v, selected: String(obj[key]) === String(v) }, l))));
  const toggle = (label, on, set) => {
    const b = h('button', { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label, class: 'switch' + (on ? ' on' : ''), onclick: () => { on = !on; b.setAttribute('aria-checked', String(on)); b.classList.toggle('on', on); set(on); commit(); } }, h('i'));
    return h('div', { class: 'toggle-row' }, h('span', {}, label), b);
  };

  el.append(h('header', { class: 'page-head' }, h('h1', { class: 'title' }, 'Settings')));
  el.append(h('section', { class: 'card stack-sm' },
    field('Brand name', s.brand, 'name'),
    field('Tagline', s.brand, 'tagline'),
    pick('Default tone', s.defaults, 'tone', Object.entries(TONE_PRESETS).map(([k, v]) => [k, v.label])),
    pick('Default emoji', s.defaults, 'emoji', [['none', 'No emoji'], ['minimal', 'Minimal'], ['natural', 'Natural'], ['fun', 'Fun']]),
    pick('Default length', s.defaults, 'length', [['short', 'Short'], ['medium', 'Medium'], ['detailed', 'Detailed']]),
    field('Signature', s.brand, 'signature', { ph: '— Team Crustica 🍕' }),
    toggle('Add signature to replies', s.defaults.signature, (v) => { s.defaults.signature = v; }),
    h('div', { class: 'ctl' }, h('label', {}, 'Add the signature on'), h('div', { class: 'chips' }, SIG_PLATFORMS.map(([k, label]) => {
      const b = h('button', { type: 'button', class: 'chip' + (s.defaults.sigPlatforms[k] ? ' on' : ''), 'aria-pressed': String(!!s.defaults.sigPlatforms[k]), onclick: () => { s.defaults.sigPlatforms[k] = !s.defaults.sigPlatforms[k]; b.classList.toggle('on', s.defaults.sigPlatforms[k]); b.setAttribute('aria-pressed', String(s.defaults.sigPlatforms[k])); commit(); } }, label);
      return b;
    }))),
    pick('Language', s.defaults, 'language', LANGUAGES.map((l) => [l.id, l.label]))));

  const branchList = h('div', {});
  const paintBranches = () => {
    clear(branchList);
    s.branches.forEach((b, i) => branchList.append(h('div', { class: 'branch' }, h('span', {}, b), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove ' + b, onclick: () => { s.branches.splice(i, 1); paintBranches(); commit(); } }, '✕'))));
  };
  paintBranches();
  const nb = h('input', { class: 'field', placeholder: 'Crustica Pizza – New branch', 'aria-label': 'New branch name' });

  el.append(h('details', { class: 'card acc' }, h('summary', {}, 'Business details (optional)'),
    h('p', { class: 'muted' }, 'The assistant only states what you fill in. Anything empty becomes “let me check and get back to you”.'),
    h('div', { class: 'stack-sm' },
      field('Opening hours', s.brand, 'hours', { ph: 'e.g. every day, 11 am to 11 pm' }),
      pick('Jain options', s.brand, 'jain', [['', 'Not sure'], ['yes', 'Yes'], ['no', 'No']]),
      field('Delivery areas', s.brand, 'delivery', { area: true, ph: 'e.g. We deliver to Banaswadi and Kalyan Nagar' }),
      field('Menu link', s.brand, 'menuUrl', { type: 'url', ph: 'https://…' }),
      field('Current offers', s.brand, 'offers', { area: true, ph: 'Leave empty if none' }),
      field('Reservation info', s.brand, 'reservations', { area: true }),
      field('Price information', s.brand, 'prices', { area: true }),
      field('Branch addresses (Name: address, one per line)', s.brand, 'locations', { area: true, ph: 'Banaswadi: 1st Main Rd' }),
      field('Payment options', s.brand, 'payments', { area: true, ph: 'e.g. UPI, cards and cash accepted' }),
      field('Phone / contact to share when moving a chat offline', s.brand, 'contact', { ph: 'Phone or email' }),
      field('Instagram', s.brand, 'instagram', { ph: '@crusticapizza' }),
      field('Google Maps link', s.brand, 'google', { ph: 'https://maps.app.goo.gl/…' }))));

  el.append(h('details', { class: 'card acc' }, h('summary', {}, 'Branches'),
    branchList, h('div', { class: 'row' }, nb, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { if (nb.value.trim()) { s.branches.push(nb.value.trim()); nb.value = ''; paintBranches(); commit(); } } }, 'Add')),
    h('div', { class: 'stack-sm', style: 'margin-top:10px' }, pick('Default branch', s, 'branch', [['', 'Ask each time'], ...s.branches.map((b) => [b, b])]))));

  el.append(h('details', { class: 'card acc' }, h('summary', {}, 'Your data'),
    h('p', { class: 'muted' }, 'Everything is stored on this device only.'),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
        const blob = new Blob([JSON.stringify({ settings: getSettings(), history: getHistory(), saved: getSaved() }, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: 'crustica-reply-backup.json' }); document.body.append(a); a.click(); a.remove();
      } }, 'Export backup'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm danger', onclick: () => { if (confirm('Delete all reply history on this device?')) { clearHistory(); toast('History cleared'); } } }, 'Clear history'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm danger', onclick: () => { if (confirm('Reset all settings?')) { saveSettings(structuredClone(DEFAULT_SETTINGS)); render(el); } } }, 'Reset settings'))));
}
