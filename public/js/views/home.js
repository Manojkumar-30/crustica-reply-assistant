import { h, clear, toast } from '../ui.js';
import { STAR_TYPES } from '../data.js';
import { PLATFORM_CHIPS, PLATFORM_MAP, OBJ_CHIPS, TONE_PRESETS, TONE_CHIPS, LENGTH_CHIPS, EMOJI_CHIPS, STRATEGIES, EXAMPLES, titleFor, groupOf } from '../config.js';
import { getSettings, addHistory, updateHistory, wantsSignature } from '../store.js';
import { replyEngine } from '../replyEngine.js';
import { knowledgeFrom } from '../brand.js';
import { mainReplyCard, altCard } from '../components.js';

const st = { init: false, platform: '', rating: 5, ig: 'Instagram Comment', objective: 'interested', text: '', context: '', offer: '', branch: '', tone: 'warm', length: 'medium', emoji: 'natural', result: null, view: 'form', loading: false, error: false, regen: 0, historyId: null, more: false };
let root;
const HEADINGS = { google: 'Google Review', instagram: 'Instagram Reply', influencer: 'Influencer Reply' };
const PLACEHOLDER = { google: 'Paste the review here...', instagram: 'Paste their comment or DM...', influencer: 'Paste their message here...' };

function initDefaults() {
  const d = getSettings().defaults;
  st.tone = TONE_PRESETS[d.tone] ? d.tone : 'warm';
  st.length = d.length || 'medium';
  st.emoji = d.emoji === 'none' ? 'none' : d.emoji === 'fun' ? 'fun' : 'natural';
  st.init = true;
}

/** Fill the form from outside (history, saved, examples). */
export function preset(p) {
  if (!st.init) initDefaults();
  Object.assign(st, { platform: p.platform ?? '', rating: p.rating || 5, ig: p.ig || 'Instagram Comment', objective: p.objective || 'interested', text: p.text || '', context: p.context || '', offer: '', result: null, view: 'form', error: false, regen: 0, historyId: null });
  if (location.hash !== '#/' && location.hash !== '') location.hash = '#/'; else if (root) render(root);
}

function buildOpts() {
  const s = getSettings(), d = s.defaults, map = PLATFORM_MAP[st.platform] || PLATFORM_MAP[''];
  const platform = st.platform === 'instagram' ? st.ig : map.platform;
  const influence = st.platform === 'influencer' || (st.platform === 'instagram' && st.ig === 'Instagram DM');
  return {
    category: map.category, platform, type: st.platform === 'google' ? STAR_TYPES[st.rating] : '', rating: st.platform === 'google' ? st.rating : 0,
    tones: (TONE_PRESETS[st.tone] || TONE_PRESETS.warm).tones, length: st.length, emoji: st.emoji, language: d.language, who: d.who, branch: st.branch || s.branch || '',
    signature: wantsSignature(st.platform === 'instagram' ? 'instagram' : st.platform), objective: influence ? st.objective : '', regen: st.regen, context: st.context, offer: st.offer, branches: s.branches, brand: { ...s.brand }, knowledge: knowledgeFrom(s),
  };
}

export function render(el) {
  root = el; if (!st.init) initDefaults();
  clear(el);
  const wrap = h('div', { class: 'home' + (st.view === 'result' && (st.result || st.error) ? ' has-result' : '') });
  wrap.append(h('section', { class: 'input-col' }, form()), h('section', { class: 'result-col', id: 'results', 'aria-live': 'polite' }, resultBody()));
  el.append(wrap);
}

const chipRow = (items, current, onPick, cls = '') => h('div', { class: 'chips scroll-chips', role: 'radiogroup' }, items.map(([id, label]) => h('button', {
  type: 'button', role: 'radio', 'aria-checked': String(current === id), class: 'chip ' + cls + (current === id ? ' on' : ''), onclick: () => onPick(id),
}, label)));

/* ---------------- form ---------------- */
function form() {
  const f = h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); run(); } });
  f.append(h('p', { class: 'sub' }, 'Paste it. We’ll help you reply.'), h('h1', { class: 'title' }, HEADINGS[st.platform] || 'What did they say?'));

  const ta = h('textarea', { id: 'msg', class: 'field big', rows: '7', maxlength: '3000', placeholder: PLACEHOLDER[st.platform] || 'Paste their message here...', 'aria-label': 'Customer message', oninput: (e) => { st.text = e.target.value; } });
  ta.value = st.text;
  f.append(ta);

  f.append(h('label', { class: 'lbl' }, 'Where did they message you?'), chipRow(PLATFORM_CHIPS, st.platform, (id) => { st.platform = st.platform === id ? '' : id; render(root); }));

  if (st.platform === 'instagram') f.append(h('div', { class: 'segmented', role: 'radiogroup' }, ['Instagram Comment', 'Instagram DM'].map((v) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(st.ig === v), class: 'seg' + (st.ig === v ? ' on' : ''), onclick: () => { st.ig = v; render(root); },
  }, v === 'Instagram DM' ? 'DM' : 'Comment'))));

  if (st.platform === 'google') f.append(h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Star rating' }, [1, 2, 3, 4, 5].map((n) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(st.rating === n), 'aria-label': n + (n === 1 ? ' star' : ' stars'), class: 'star' + (n <= st.rating ? ' on' : ''),
    onclick: () => { st.rating = n; render(root); },
  }, '★'))));

  if (st.platform === 'influencer') f.append(chipRow(OBJ_CHIPS, st.objective, (id) => { st.objective = id; render(root); }, 'soft'));

  const s = getSettings();
  const influence = st.platform === 'influencer' || (st.platform === 'instagram' && st.ig === 'Instagram DM');
  const more = h('details', { class: 'more', open: st.more || !!st.context, ontoggle: (e) => { st.more = e.target.open; } }, h('summary', {}, 'Options'));
  more.append(h('div', { class: 'ctl' }, h('label', {}, 'Tone'), chipRow(TONE_CHIPS, st.tone, (id) => { st.tone = id; st.more = true; render(root); }, 'soft')),
    h('div', { class: 'ctl' }, h('label', {}, 'Length'), chipRow(LENGTH_CHIPS, st.length, (id) => { st.length = id; st.more = true; render(root); }, 'soft')),
    h('div', { class: 'ctl' }, h('label', {}, 'Emoji'), chipRow(EMOJI_CHIPS, st.emoji, (id) => { st.emoji = id; st.more = true; render(root); }, 'soft')));
  const cx = h('textarea', { class: 'field', rows: '2', placeholder: 'What you said earlier, e.g. “Would you like to visit us this Saturday?”', 'aria-label': 'Earlier message', oninput: (e) => { st.context = e.target.value; } }); cx.value = st.context;
  more.append(h('div', { class: 'ctl' }, h('label', {}, 'Earlier in the conversation (optional)'), cx));
  if (influence && st.objective === 'negotiate') {
    const of = h('input', { class: 'field', inputmode: 'numeric', placeholder: 'e.g. 3000', 'aria-label': 'Your offer in rupees', oninput: (e) => { st.offer = e.target.value; } }); of.value = st.offer;
    more.append(h('div', { class: 'ctl' }, h('label', {}, 'Your offer (₹)'), of));
  }
  if (s.branches.length > 1) more.append(h('div', { class: 'ctl' }, h('label', {}, 'Branch'), h('select', { class: 'field', 'aria-label': 'Branch', onchange: (e) => { st.branch = e.target.value; } },
    [['', s.branch ? s.branch : 'Not specified'], ...s.branches.filter((b) => b !== s.branch).map((b) => [b, b])].map(([v, l]) => h('option', { value: v, selected: v === st.branch }, l)))));
  f.append(more);

  f.append(h('button', { type: 'submit', class: 'btn btn-primary btn-lg', id: 'gen' }, '✨ Generate Reply'));

  f.append(h('div', { class: 'examples' }, h('span', { class: 'ex-label' }, 'Try an example:'),
    h('div', { class: 'chips scroll-chips' }, EXAMPLES.map((ex) => h('button', { type: 'button', class: 'chip small', onclick: () => {
      Object.assign(st, { platform: ex.platform, rating: ex.rating || 5, ig: ex.ig || 'Instagram Comment', objective: 'interested', text: ex.text, context: '', result: null, view: 'form', error: false, regen: 0, historyId: null });
      render(root); document.getElementById('msg')?.focus({ preventScroll: true });
    } }, ex.label)))));
  return f;
}

/* ---------------- actions ---------------- */
function setLoading(on) {
  st.loading = on;
  const b = document.getElementById('gen'); if (!b) return;
  b.disabled = on; clear(b);
  if (on) b.append('✨ Thinking', h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
  else b.append('✨ Generate Reply');
}

export async function run() {
  if (st.loading) return;
  if (!st.text.trim()) { toast('Paste a message first.'); document.getElementById('msg')?.focus(); return; }
  st.error = false; setLoading(true);
  try {
    const r = await replyEngine.generate(st.text.slice(0, 3000), buildOpts());
    st.result = r; st.view = 'result'; st.loading = false;
    const best = r.replies[0], map = PLATFORM_MAP[st.platform] || PLATFORM_MAP[''];
    const rec = {
      message: st.text, original: st.text, platform: st.platform === 'instagram' ? st.ig : map.platform, platformKey: st.platform, category: map.category, igKind: st.platform === 'instagram' ? st.ig : '',
      rating: st.platform === 'google' ? st.rating : 0, detectedIntent: r.analysis.namedIntents?.[0] || 'GENERAL_MESSAGE', intents: r.analysis.namedIntents || [], reply: best.text, label: best.label, sentiment: r.analysis.sentimentLabel,
    };
    if (st.historyId) updateHistory(st.historyId, rec); else st.historyId = addHistory(rec).id;
    render(root); window.scrollTo(0, 0);
  } catch { st.loading = false; st.error = true; st.view = 'result'; render(root); window.scrollTo(0, 0); }
}

/* ---------------- result ---------------- */
function resultBody() {
  if (st.error && st.view === 'result') {
    return h('div', { class: 'result' }, backBtn(), h('div', { class: 'card error fade' }, h('h2', {}, 'Something went wrong'), h('p', { class: 'muted' }, 'We couldn’t create the reply right now. Please try again.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'button', onclick: run }, 'Try Again'), h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.view = 'form'; st.error = false; render(root); } }, 'Edit Message'))));
  }
  const r = st.result;
  if (!r) return h('div', { class: 'ready' }, h('div', { class: 'ready-pizza', 'aria-hidden': 'true' }, '🍕'), h('p', { class: 'empty-title' }, 'Ready when you are 🍕'), h('p', { class: 'muted' }, 'Paste a customer message and we’ll help you respond.'));
  const a = r.analysis, adv = r.advice;
  const ctx = {
    opts: buildOpts, original: st.text,
    savedMeta: { title: titleFor({ platformKey: st.platform, rating: st.platform === 'google' ? st.rating : 0, igKind: st.platform === 'instagram' ? st.ig : '' }), group: groupOf({ platformKey: st.platform }), platformKey: st.platform, label: 'Recommended Reply' },
    onUsed: (text) => { if (st.historyId) updateHistory(st.historyId, { reply: text, used: true }); },
  };

  const out = h('div', { class: 'result' }, backBtn());
  const tags = [...(a.understood || [])];
  const e = a.entities || {};
  if (e.dietary && !tags.some((t) => /jain|veg/i.test(t.label))) tags.push({ emoji: '🌿', label: e.dietary[0].toUpperCase() + e.dietary.slice(1) });
  if (e.food && tags.length < 6) tags.push({ emoji: '🍽️', label: e.food[0].toUpperCase() + e.food.slice(1) });
  if (e.followers) tags.push({ emoji: '👥', label: e.followers });
  if (e.amount) tags.push({ emoji: '₹', label: e.amount.replace('₹', '') });
  if (e.day) tags.push({ emoji: '📅', label: e.day[0].toUpperCase() + e.day.slice(1) });
  out.append(h('div', { class: 'card understood fade' }, h('div', { class: 'u-title' }, 'I understood this as:'),
    h('div', { class: 'tagrow' }, tags.slice(0, 7).map((t, i) => h('span', { class: 'utag' + (i === 0 ? ' first' : '') }, t.emoji ? t.emoji + ' ' : '', t.label)))));

  if (a.rateDetected || (a.namedIntents || []).includes('INFLUENCER_RATE')) {
    const cur = STRATEGIES.some(([id]) => id === st.objective) ? st.objective : '';
    out.append(h('div', { class: 'card strat fade' }, h('div', { class: 'u-title' }, a.rateDetected ? `They mentioned ${a.rateDetected}. How do you want to reply?` : 'How do you want to reply?'),
      chipRow(STRATEGIES, cur, (id) => { st.objective = id; st.more = true; st.regen += 1; run(); }, 'soft')));
  }

  out.append(h('h3', { class: 'sec' }, 'Recommended reply'), mainReplyCard(r.replies[0], ctx));
  if (r.replies.length > 1) out.append(h('h3', { class: 'sec' }, 'Other ways to say it'), ...r.replies.slice(1).map((x) => altCard(x, ctx)));

  const approach = (adv.approach || []).slice(0, 4);
  if (approach.length) out.append(h('p', { class: 'approach fade' }, h('b', {}, '💡 Suggested approach: '), approach.slice(0, 2).join(' ')));
  out.append(h('details', { class: 'card why fade' }, h('summary', {}, 'Why this reply?'), h('p', {}, a.why || ''),
    approach.length ? h('ul', { class: 'why-list' }, approach.map((x) => h('li', {}, x))) : null,
    ...(adv.notes || []).map((n) => h('p', { class: 'note' }, n))));
  out.append(h('div', { class: 'row center' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.regen += 1; run(); } }, 'Try another version')));
  return out;
}

function backBtn() {
  return h('button', { class: 'back', type: 'button', onclick: () => { st.view = 'form'; render(root); window.scrollTo(0, 0); } }, '← Back');
}
