// Run with: npm test
// The engine is an ES module, so we import it dynamically. No test depends on random wording: the engine is seeded
// (same input -> same output) and we only assert structure, detected intents, and "nothing invented".
const assert = require('node:assert/strict');

const results = [];
function test(name, fn) { results.push([name, fn]); }

(async () => {
  const E = await import('../public/js/engine.js');
  const { localRuleEngine } = await import('../public/js/replyEngine.js');

  const BRANCHES = ['Crustica Pizza – Banaswadi', 'Crustica Pizza – Kalyan Nagar', 'Crustica Pizza – Kammanahalli'];
  const base = { branches: BRANCHES, signature: false, emoji: 'natural', length: 'medium' };
  const gen = (msg, o = {}) => E.generate(msg, { ...base, ...o });
  const has = (r, ...intents) => intents.forEach((i) => assert.ok(r.analysis.namedIntents.includes(i), `expected ${i} in ${r.analysis.namedIntents.join(', ')}`));
  const allText = (r) => r.replies.map((x) => x.text).join('\n');
  const basicShape = (r) => {
    assert.ok(r.replies.length >= 3, 'needs best + at least 2 alternatives');
    r.replies.forEach((x) => { assert.ok(x.text && x.text.trim().length > 2, 'empty reply'); assert.ok(x.label); });
    assert.ok(r.analysis.understood.length >= 2, 'understood tags');
    assert.ok(r.analysis.summary, 'summary');
    assert.ok(r.analysis.why, 'why text');
    assert.ok(Array.isArray(r.advice.approach) && r.advice.approach.length, 'suggested approach');
  };
  /** Nothing the customer did not say, and nothing Crustica did not configure. */
  function noInvention(msg, r) {
    const out = allText(r);
    const m = msg.toLowerCase();
    assert.ok(!/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(out) || /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(m), 'invented a time');
    assert.ok(!/https?:\/\//i.test(out), 'invented a URL');
    assert.ok(!/\b\d{10}\b|\+\d{2}[\s-]?\d{5}/.test(out), 'invented a phone number');
    assert.ok(!/\d\s?%/.test(out) || /\d\s?%/.test(m), 'invented a percentage');
    assert.ok(!/(refund|compensat|voucher|free of charge|money back)/i.test(out), 'promised a refund/compensation');
    assert.ok(!/(that'?s not true|you should have told|nobody else complained|remove your review)/i.test(out), 'defensive wording');
    assert.ok(!/\bwe (are|'re) open\b|\bwe close at\b|\bwe deliver to\b|\byes, we (do|deliver)\b/i.test(out), 'stated an unconfigured fact');
    assert.ok(!/(valued customer|esteemed|inconvenience caused|sincerely apologi[sz]e|strive to provide)/i.test(out), 'robotic phrase');
  }

  /* ---- sentiment + review intents ---- */
  test('positive review (Google 5 star)', () => {
    const msg = 'Gave up on Dominos and Pizza Hut for their veg options.';
    const r = gen(msg, { category: 'google', platform: 'Google Maps', rating: 5, type: '5 Star Positive' });
    assert.equal(r.analysis.sentimentLabel, 'POSITIVE'); has(r, 'POSITIVE_REVIEW', 'FOOD_PRAISE'); basicShape(r); noInvention(msg, r);
  });
  test('negative review + food complaint', () => {
    const msg = 'Visited this place last weekend. Pathetic experience. The pasta was bland and the mojitos were too salty.';
    const r = gen(msg, { category: 'google', platform: 'Google Maps' });
    assert.equal(r.analysis.sentimentLabel, 'NEGATIVE'); has(r, 'NEGATIVE_REVIEW', 'FOOD_COMPLAINT'); basicShape(r); noInvention(msg, r);
    assert.ok(r.analysis.entities.foods.includes('pasta') && r.analysis.entities.foods.includes('mojito'));
    assert.match(r.replies[0].text, /pasta/i, 'reply must mention the pasta');
    assert.match(allText(r), /private|directly|message us|reach out/i, 'invites a private conversation');
  });
  test('mixed review: positive food, negative service', () => {
    const msg = 'Pizza was good but service was very slow.';
    const r = gen(msg, {});
    assert.equal(r.analysis.sentimentLabel, 'MIXED'); has(r, 'MIXED_REVIEW', 'FOOD_PRAISE', 'SERVICE_COMPLAINT');
    assert.equal(r.analysis.positiveTopic, 'food'); assert.equal(r.analysis.negativeTopic, 'service');
    basicShape(r); noInvention(msg, r); assert.match(r.replies[0].text, /pizza/i);
  });
  test('food praise: sourdough crust', () => {
    const msg = 'Loved the sourdough crust! 😍';
    const r = gen(msg, {});
    assert.equal(r.analysis.sentimentLabel, 'POSITIVE'); has(r, 'FOOD_PRAISE'); assert.equal(r.analysis.entities.food, 'sourdough');
    assert.ok(r.analysis.topicList.includes('sourdough') && r.analysis.topicList.includes('crust'));
    assert.match(allText(r), /sourdough/i); basicShape(r); noInvention(msg, r);
  });
  test('service praise and service complaint', () => {
    has(gen('The staff was so friendly and the service was great!', {}), 'SERVICE_PRAISE');
    const bad = gen('The waiter was rude and ignored us.', {});
    assert.equal(bad.analysis.sentimentLabel, 'NEGATIVE'); has(bad, 'SERVICE_COMPLAINT');
  });
  test('typos still match (fuzzy)', () => {
    const r = gen('The pizza was delicous and the sourdogh crust was amazingg', {});
    assert.equal(r.analysis.sentimentLabel, 'POSITIVE');
  });

  /* ---- questions: never invent business facts ---- */
  test('Jain question, not configured: no invented answer', () => {
    const msg = 'Do you have Jain options?';
    const r = gen(msg, {});
    assert.equal(r.analysis.sentimentLabel, 'QUESTION'); has(r, 'JAIN_QUERY', 'MENU_QUERY'); basicShape(r); noInvention(msg, r);
    assert.ok(!/(yes|we do have|we have jain|jain-friendly)/i.test(allText(r)), 'must not claim Jain availability');
    assert.ok(r.advice.notes.some((n) => /jain/i.test(n)), 'tells the user it is not configured');
  });
  test('Jain question, configured: answers', () => {
    const r = gen('Do you have Jain options?', { knowledge: { jain: 'yes' } });
    assert.match(r.replies[0].text, /Jain-friendly/);
  });
  test('veg and vegan questions', () => {
    const veg = gen('Is it pure veg?', {}); has(veg, 'VEG_QUERY'); assert.match(veg.replies[0].text, /100% vegetarian/);
    const vegan = gen('Do you have vegan options?', {}); has(vegan, 'VEGAN_QUERY'); assert.ok(!/yes/i.test(allText(vegan)));
  });
  test('timing question, not configured', () => {
    const msg = 'What time do you close today?';
    const r = gen(msg, {});
    assert.equal(r.analysis.sentimentLabel, 'QUESTION'); has(r, 'TIMING_QUERY'); basicShape(r); noInvention(msg, r);
    assert.ok(r.advice.notes.some((n) => /opening hours/i.test(n)));
  });
  test('timing question, configured', () => {
    const r = gen('What time do you close today?', { knowledge: { openingHours: 'every day from 11 am to 11 pm' } });
    assert.match(r.replies[0].text, /11 am to 11 pm/);
  });
  test('delivery question', () => {
    const msg = 'Do you deliver to Whitefield?';
    const r = gen(msg, {}); has(r, 'DELIVERY_QUERY'); basicShape(r); noInvention(msg, r); assert.equal(r.analysis.entities.location, 'Whitefield');
    const ok = gen(msg, { knowledge: { deliveryAreas: ['We deliver to Whitefield and HSR'] } });
    assert.match(ok.replies[0].text, /Yes, we deliver to Whitefield/);
  });
  test('discount, payment, menu, price, location, reservation questions', () => {
    const d = gen('Any discount available?', {}); has(d, 'DISCOUNT_QUERY'); noInvention('Any discount available?', d); assert.ok(!/\d+\s?%|\boff\b/i.test(allText(d)));
    const p = gen('Do you accept UPI?', {}); has(p, 'PAYMENT_QUERY'); noInvention('Do you accept UPI?', p); assert.ok(!/\byes\b/i.test(allText(p)));
    has(gen('Can you send your menu?', {}), 'MENU_QUERY');
    const pr = gen('How much is a margherita?', {}); has(pr, 'PRICE_QUERY'); assert.ok(!/₹\s?\d/.test(allText(pr)));
    has(gen('Where are you located?', {}), 'LOCATION_QUERY');
    const rs = gen('Can I book a table for 6 tonight?', {}); has(rs, 'RESERVATION_QUERY'); assert.ok(!/confirmed|booked/i.test(allText(rs)), 'must not confirm a booking');
  });
  test('multiple intents in one message are all answered', () => {
    const r = gen('Loved your pizza! Do you have Jain options and what time do you close?', {});
    has(r, 'POSITIVE_REVIEW', 'JAIN_QUERY', 'TIMING_QUERY');
    const t = r.replies[0].text; assert.match(t, /pizza/i); assert.match(t, /jain/i); assert.match(t, /branch|timings|check/i);
  });

  /* ---- influencers ---- */
  test('influencer collaboration with follower count', () => {
    const msg = "Hi, I'm a food creator with 100K followers. Interested in collaboration?";
    const r = gen(msg, { category: 'influencer', platform: 'Influencer DM' });
    has(r, 'INFLUENCER_COLLAB'); assert.equal(r.analysis.entities.followers, '100K followers'); basicShape(r); noInvention(msg, r);
    assert.match(r.replies[0].text, /media kit/i); assert.ok(!/(free|complimentary|paid|₹)/i.test(allText(r)), 'no pricing/barter promises');
  });
  test('influencer rate: no automatic commitment, strategy replies work', () => {
    const msg = 'My rate is ₹5,000 for one reel.';
    const r = gen(msg, { category: 'influencer', platform: 'Influencer DM' });
    has(r, 'INFLUENCER_COLLAB', 'INFLUENCER_RATE'); assert.equal(r.analysis.entities.amount, '₹5,000');
    assert.ok(!/(budget|accept|we'll pay|deal)/i.test(allText(r)), 'must not commit'); assert.match(r.replies[0].text, /team/i);
    const n = gen(msg, { category: 'influencer', platform: 'Influencer DM', objective: 'negotiate', offer: '3000' });
    assert.match(n.replies[0].text, /₹3,000/); assert.match(n.replies[0].text, /₹5,000/);
    ['accept', 'deliverables', 'barter', 'decline'].forEach((obj) => assert.ok(gen(msg, { category: 'influencer', objective: obj }).replies.length >= 3));
  });
  test('influencer barter and follow-up', () => {
    const b = gen('Can I visit for a free meal in exchange for a reel? Happy to do a barter collab.', { category: 'influencer' });
    has(b, 'INFLUENCER_BARTER'); assert.ok(!/complimentary|free meal on us/i.test(allText(b)), 'must not promise free food');
    has(gen('Hi, just following up on my collaboration message.', { category: 'influencer' }), 'INFLUENCER_FOLLOWUP');
    has(gen("Thanks, but we're not interested in this collaboration anymore.", { category: 'influencer' }), 'INFLUENCER_DECLINE');
  });

  /* ---- platforms ---- */
  test('Instagram compliment, reaction and question stay short', () => {
    const c = gen('Best pizza ever 😍🔥', { category: 'instagram', platform: 'Instagram Comment' });
    has(c, 'INSTAGRAM_COMPLIMENT'); basicShape(c);
    c.replies.forEach((x) => assert.ok(x.text.split(/(?<=[.!?])\s+/).length <= 2 && x.text.length < 160, 'comment reply too long: ' + x.text));
    has(gen('😍🔥', { category: 'instagram', platform: 'Instagram Comment' }), 'INSTAGRAM_REACTION');
    const q = gen('When are you coming to Mysore?', { category: 'instagram', platform: 'Instagram Comment' }); has(q, 'INSTAGRAM_QUESTION');
    assert.ok(q.replies.every((x) => x.text.length < 120));
  });
  test('Instagram DM can be more detailed than a comment', () => {
    const msg = 'Loved the pizza! Do you have Jain options and what time do you close?';
    const dm = gen(msg, { category: 'instagram', platform: 'Instagram DM' }), cm = gen(msg, { category: 'instagram', platform: 'Instagram Comment' });
    assert.ok(dm.replies[0].text.length > cm.replies[0].text.length);
  });
  test('Google star ratings change the strategy', () => {
    const five = gen('Great food, loved it.', { category: 'google', platform: 'Google Maps', rating: 5 });
    const three = gen('The food was okay.', { category: 'google', platform: 'Google Maps', rating: 3 });
    const one = gen('Bad.', { category: 'google', platform: 'Google Maps', rating: 1 });
    assert.equal(five.analysis.sentimentLabel, 'POSITIVE'); assert.equal(three.analysis.sentimentLabel, 'MIXED'); assert.equal(one.analysis.sentimentLabel, 'NEGATIVE');
    assert.match(one.replies[0].text, /sorry/i); assert.match(one.replies[0].text, /reach out|message us|directly/i);
    assert.notEqual(five.replies[0].text, one.replies[0].text);
  });
  test('WhatsApp customer message: direct, no signature, no filler', () => {
    const r = gen('Can you send your menu?', { category: 'customer', platform: 'WhatsApp' });
    has(r, 'MENU_QUERY'); assert.ok(!/— Team/.test(allText(r))); assert.ok(!/We'd love to have you at Crustica/.test(r.replies[0].text));
    const sig = gen('Can you send your menu?', { category: 'customer', platform: 'WhatsApp', signature: true });
    assert.match(sig.replies[0].text, /— Team Crustica/);
  });
  test('emoji setting and length setting are respected', () => {
    const none = gen('Loved the pizza!', { emoji: 'none' });
    none.replies.forEach((x) => assert.ok(!/\p{Extended_Pictographic}/u.test(x.text.replace('— Team Crustica 🍕', '')), 'emoji found: ' + x.text));
    assert.ok(gen('Loved the pizza and the sourdough crust and the ambience!', { length: 'detailed' }).replies[0].text.length >= gen('Loved the pizza and the sourdough crust and the ambience!', { length: 'short' }).replies[0].text.length);
  });

  /* ---- unsupported / odd input, determinism ---- */
  test('odd input still returns a safe reply', () => {
    for (const msg of ['asdf qwerty', '???', 'ok', '1234567890', 'हेलो']) { const r = gen(msg, {}); assert.ok(r.replies.length >= 1 && r.replies[0].text.length > 1, msg); noInvention(msg, r); }
  });
  test('engine is deterministic for the same input', () => {
    const a = gen('Loved the pizza! Do you have Jain options?', {}), b = gen('Loved the pizza! Do you have Jain options?', {});
    assert.deepEqual(a.replies, b.replies);
    assert.notDeepEqual(a.replies, gen('Loved the pizza! Do you have Jain options?', { regen: 1 }).replies, 'regenerate gives another version');
  });

  /* ---- rephrase ---- */
  test('rephrase gives genuinely different wording and respects the mode', () => {
    const src = 'Thank you for visiting Crustica. Hope to see you again soon!';
    const seen = new Set();
    for (const v of [0, 1, 2]) seen.add(E.transform(src, 'human', { variant: v }));
    assert.ok(seen.size >= 3, 'human variants should differ');
    ['human', 'friendly', 'casual', 'professional', 'shorter', 'longer', 'premium', 'noemoji'].forEach((m) => assert.ok(E.transform(src, m, { variant: 1 }).length > 0, m));
    assert.ok(!/\p{Extended_Pictographic}/u.test(E.transform('Thank you! ❤️🍕', 'noemoji')));
    assert.ok(!/\p{Extended_Pictographic}|!/u.test(E.transform('Thanks so much! 😊 Hope to see you soon!', 'professional')));
    assert.ok(E.transform('Thank you so much! We loved having you. Hope to see you again soon!', 'shorter').length < 'Thank you so much! We loved having you. Hope to see you again soon!'.length);
    assert.ok(E.transform('Thank you for visiting.', 'longer').length > 'Thank you for visiting.'.length);
  });
  test('replyEngine interface works (async, local)', async () => {
    const r = await localRuleEngine.generate('Loved the pizza!', { ...base });
    assert.ok(r.replies.length >= 3 && r.source === 'local');
    const t = await localRuleEngine.rephrase('Thank you for visiting Crustica.', 'friendly', {});
    assert.ok(t.text);
  });

  /* ---- localStorage safety (corrupt data must not crash) ---- */
  test('store survives corrupt localStorage', async () => {
    const data = { 'cra.settings.v1': '{not json', 'cra.history.v1': '{"a":1}', 'cra.saved.v1': '[1,2,"x",{"reply":"ok"}]' };
    globalThis.localStorage = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: () => {} };
    const store = await import('../public/js/store.js?corrupt=' + Date.now());
    const s = store.getSettings();
    assert.ok(s.brand.name && Array.isArray(s.branches) && s.defaults.sigPlatforms.google === true);
    assert.deepEqual(store.getHistory(), []);
    assert.deepEqual(store.getSaved().map((x) => x.reply), ['ok']);
    store.addHistory({ reply: 'hello', original: 'x' }); assert.equal(store.getHistory().length, 1);
    delete globalThis.localStorage;
  });

  /* ---- service worker logic, simulated (a real browser is needed to prove registration) ---- */
  test('service worker: pre-caches, serves offline, drops old caches', async () => {
    const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8').replace(/__BUILD_ID__/g, 'abc123');
    const stores = { 'crustica-reply-old': new Map(), 'other-app': new Map() };
    let online = true;
    const cacheApi = {
      keys: async () => Object.keys(stores),
      delete: async (k) => delete stores[k],
      open: async (k) => { stores[k] = stores[k] || new Map(); const m = stores[k]; return { add: async (u) => { if (!online) throw new Error('offline'); m.set(new URL(u, 'https://x.test/').href, 'body:' + u); }, put: async (req, res) => { m.set(req.url, res); }, match: async (req) => m.get(typeof req === 'string' ? new URL(req, 'https://x.test/').href : req.url) }; },
      match: async (req) => { for (const m of Object.values(stores)) { const hit = m.get(typeof req === 'string' ? new URL(req, 'https://x.test/').href : req.url); if (hit) return hit; } return undefined; },
    };
    const handlers = {};
    const ctx = { self: { addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {} } }, caches: cacheApi, location: { origin: 'https://x.test' }, URL, fetch: async () => { if (!online) throw new Error('offline'); return { ok: true, type: 'basic', clone() { return this; } }; }, Promise };
    vm.runInNewContext(src, ctx);
    let installed; handlers.install({ waitUntil: (p) => { installed = p; } }); await installed;
    assert.ok(stores['crustica-reply-abc123'].size >= 20, 'pre-cached the app shell');
    let activated; handlers.activate({ waitUntil: (p) => { activated = p; } }); await activated;
    assert.ok(!stores['crustica-reply-old'] && stores['other-app'], 'old crustica caches removed, other apps untouched');
    online = false; // offline now
    const ask = (url, mode) => new Promise((resolve) => handlers.fetch({ request: { url, method: 'GET', mode }, respondWith: (p) => resolve(p) }));
    assert.equal(await (await ask('https://x.test/js/engine.js', 'cors')), 'body:./js/engine.js');
    assert.equal(await (await ask('https://x.test/some/deep/link', 'navigate')), 'body:./index.html');
    assert.equal(handlers.fetch({ request: { url: 'https://other.test/x', method: 'GET' }, respondWith: () => { throw new Error('should ignore third-party'); } }), undefined);
  });

  let failed = 0;
  for (const [name, fn] of results) {
    try { await fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n')[0]); }
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
