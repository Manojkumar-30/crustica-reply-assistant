/**
 * Local rule-based reply engine (no AI, no network): weighted intent scoring, sentiment, topics, entities,
 * template composition and text transforms. Runs in the browser (and in Node for tests).
 * Never invents facts, discounts, refunds or policies.
 */

const DEFAULT_BRAND = {
  name: 'Crustica Pizza',
  tagline: 'For The Love Of Veg',
  signature: '— Team Crustica 🍕',
  contact: '',
};

/* ---------- utils ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const EMOJI_RE = /(?:\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)/gu;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const uniq = (a) => [...new Set(a)];
function list(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function splitSentences(t) { return t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean); }
function tidy(s) {
  return s.replace(/[ \t]+/g, ' ').replace(/ +([.,!?])/g, '$1').replace(/([!?.])\1{2,}/g, '$1$1').replace(/\n{3,}/g, '\n\n').replace(/ \n/g, '\n').trim();
}
function clean(t) {
  return String(t || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/<\/?[a-z_]+>/gi, ' ').replace(/\s+/g, ' ').trim();
}

/* ---------- lexicons ---------- */
const ITEM_DEFS = [
  ['vegetarian options', /\bveg(?:etarian)?\s+(?:options?|choices?|menu|food)\b/i, false],
  ['margherita', /\bmargherita\b/i, false], ['sourdough base', /\bsourdough\b/i, false], ['pizza', /\bpizzas?\b/i, false],
  ['crust', /\bcrust\b/i, false], ['base', /\bbase\b/i, false], ['pasta', /\bpasta\b/i, false], ['lasagna', /\blasagn?a\b/i, false],
  ['garlic bread', /\bgarlic bread\b/i, false], ['burger', /\bburgers?\b/i, false], ['sandwich', /\bsandwich(?:es)?\b/i, false],
  ['salad', /\bsalads?\b/i, false], ['dessert', /\bdesserts?\b/i, false], ['tiramisu', /\btiramisu\b/i, false], ['brownie', /\bbrownies?\b/i, false],
  ['fries', /\bfries\b/i, false], ['risotto', /\brisotto\b/i, false], ['gnocchi', /\bgnocchi\b/i, false], ['calzone', /\bcalzones?\b/i, false],
  ['nachos', /\bnachos\b/i, false], ['soup', /\bsoup\b/i, false], ['cheese', /\bcheese\b/i, false], ['toppings', /\btoppings?\b/i, false],
  ['sauce', /\bsauce\b/i, false], ['mojito', /\bmojitos?\b/i, true], ['cold coffee', /\bcold coffee\b/i, true], ['coffee', /\bcoffee\b/i, true],
  ['shake', /\bshakes?\b/i, true], ['juice', /\bjuices?\b/i, true], ['lemonade', /\blemonade\b/i, true], ['mocktail', /\bmocktails?\b/i, true],
  ['tea', /\btea\b/i, true], ['drink', /\bdrinks?\b/i, true],
];
const QUALITY_RE = /\b(bland|tasteless|salty|oily|greasy|undercooked|overcooked|raw|burnt|cold|stale|soggy|hard|dry|average|mediocre|watery|rubbery|overpriced|too sweet|too spicy|too sour)\b/gi;
const NEG_PHRASES = ['not good', 'not great', 'not worth', 'nothing special', 'not up to', "wasn't good", "was not good", "isn't good", 'not happy', 'not tasty', 'not fresh', 'not at all'];
const NEG_WORDS = ['pathetic', 'bad', 'worst', 'terrible', 'horrible', 'awful', 'poor', 'disappoint', 'slow', 'late', 'delay', 'rude', 'ignored', 'dirty', 'bland', 'tasteless', 'salty', 'oily', 'cold', 'stale', 'overpriced', 'expensive', 'costly', 'average', 'mediocre', 'unhygienic', 'waste', 'avoid', 'unprofessional', 'cheat', 'forced', 'refused', 'noisy', 'crowded', 'waiting', 'worse', 'issue', 'problem', 'complain', 'never again', 'disgust', 'force', 'not accept', "don't accept", 'do not accept', 'no discount', 'self-service', 'self service', 'no cash'];
const POS_WORDS = ['love', 'best', 'great', 'amazing', 'awesome', 'delicious', 'tasty', 'yummy', 'perfect', 'excellent', 'fantastic', 'good', 'nice', 'lovely', 'wonderful', 'superb', 'fresh', 'friendly', 'recommend', 'favourite', 'favorite', 'happy', 'gave up', 'go-to', 'worth', 'must try', 'crispy', 'cozy', 'cosy', 'beautiful', 'enjoy', 'thank', 'wow', 'fabulous', 'brilliant', 'will come again', 'definitely come'];
const OTHER_POS = [['ambience', /\b(ambien?ce|vibe|decor|interiors?|music|seating)\b/i], ['service', /\b(service|staff|waiters?|hospitality|team)\b/i]];
const FLAG_RES = {
  service: /\b(service|slow|wait(?:ing)?|late|delay(?:ed)?|ignored|self[- ]service|attend|order took|took (?:so )?long)\b/i,
  staff: /\b(rude|staff|waiters?|manager|behaviou?r|attitude|server)\b/i,
  payment: /\b(cash|payment|pre-?paid|upi|card|bill|charged|overcharged|refund|advance|paid)\b/i,
  pricing: /\b(expensive|costly|overpriced|pricey|price|pricing|rates?|discounts?|offers?|coupons?|value for money)\b/i,
  delivery: /\b(deliver(?:y|ed)|rider|zomato|swiggy|packag(?:ing|ed)|parcel|takeaway|take-away)\b/i,
  ambience: /\b(noisy|crowded|dirty|hot|smell|smelly|music|ambien?ce|seating|cramped|loud)\b/i,
};
const SERIOUS_RE = /\b(hair in|food poisoning|poison|sick|vomit|diarrh|insect|cockroach|\bfly\b|flies|worm|lizard|stomach|hospital|hygien|fssai|consumer court|lawyer|legal|police|fraud|scam|cheated|harass|discriminat|abus|threat)/i;
const LOCATIONS = ['Banaswadi', 'Kalyan Nagar', 'Kammanahalli', 'Rajasthan', 'Indiranagar', 'HRBR', 'Bangalore', 'Bengaluru'];
const COLLAB_RE = /\b(collab|collaborat|followers|barter|promo|sponsor|rate card|budget|creator|influencer|reel|media kit|paid partnership|brand deal|feature you|shoutout)/i;
const QUESTION_RE = /\?|\b(do you|are you|is there|what time|timings?|open|menu|jain|vegan|reservation|book(?:ing)?|table for|available|how much|delivery to|home delivery)\b/i;

/* ---------- analysis ---------- */
function findItems(sl) {
  const out = [];
  for (const [name, re, bev] of ITEM_DEFS) {
    const m = re.exec(sl);
    if (m) out.push({ name, bev, idx: m.index });
  }
  // sourdough + base/crust overlap: keep the more specific one
  const hasSd = out.some((o) => o.name === 'sourdough base');
  return out.filter((o) => !(hasSd && (o.name === 'base' || o.name === 'crust') && out.find((x) => x.name === 'sourdough base' && Math.abs(x.idx - o.idx) < 12)))
    .sort((a, b) => a.idx - b.idx);
}
function scoreWords(sl) {
  let s = sl, neg = 0, pos = 0;
  for (const p of NEG_PHRASES) while (s.includes(p)) { neg += 1; s = s.replace(p, ' '); }
  for (const w of NEG_WORDS) if (s.includes(w)) neg += 1;
  for (const w of POS_WORDS) if (s.includes(w)) pos += 1;
  return { pos, neg };
}

let DICT = null;
const EXTRA_WORDS = ['delicious', 'amazing', 'awesome', 'fantastic', 'excellent', 'wonderful', 'sourdough', 'vegetarian', 'delivery', 'discount', 'service', 'terrible', 'horrible', 'disappointed', 'expensive', 'collaboration', 'followers', 'reservation', 'recommend', 'experience', 'beautiful', 'restaurant', 'collaborate', 'influencer', 'complimentary', 'unhygienic', 'unprofessional'];
function dict() {
  if (DICT) return DICT;
  const set = new Set();
  const add = (w) => String(w).toLowerCase().split(/[^a-z]+/).forEach((x) => { if (x.length >= 7) set.add(x); });
  [...POS_WORDS, ...NEG_WORDS, ...ITEM_DEFS.map((d) => d[0]), ...Object.values(TOPIC_GROUPS).flat(), ...Object.values(INTENT_RULES).flatMap((r) => Object.keys(r.w)), ...EXTRA_WORDS].forEach(add);
  return (DICT = set);
}
function within1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    const d = [];
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) d.push(i);
    return d.length === 1 || (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]);
  }
  const [sh, lg] = la < lb ? [a, b] : [b, a];
  let i = 0; while (i < sh.length && sh[i] === lg[i]) i++;
  return sh.slice(i) === lg.slice(i + 1);
}
/** Fixes one-letter typos in long known words ("delicous", "sourdogh") so the rules still match. */
function correctTypos(text) {
  const D = dict();
  return text.replace(/\p{L}{7,}/gu, (tok) => {
    const low = tok.toLowerCase();
    if (D.has(low)) return tok;
    const hits = [...D].filter((w) => w[0] === low[0] && within1(low, w));
    if (hits.length !== 1) return tok;
    return tok[0] === tok[0].toUpperCase() && tok[0] !== tok[0].toLowerCase() ? hits[0][0].toUpperCase() + hits[0].slice(1) : hits[0];
  });
}

function analyze(raw, o = {}) {
  const text = correctTypos(clean(raw));
  const low = text.toLowerCase();
  const clauses = text.split(/(?<=[.!?])\s+|\bbut\b|\bhowever\b|\bthough\b|\balthough\b|;|\n/i).map((c) => c.trim()).filter(Boolean);
  const positives = [], complaints = [], itemsSeen = [];
  const flags = { service: false, staff: false, payment: false, pricing: false, delivery: false, ambience: false };
  let posScore = 0, negScore = 0;

  for (const c of clauses) {
    const cl = c.toLowerCase().replace(/pizza hut|domino'?s/g, 'competitor');
    const its = findItems(cl);
    its.forEach((i) => itemsSeen.push(i));
    const { pos, neg } = scoreWords(cl);
    const quals = []; let m; QUALITY_RE.lastIndex = 0;
    while ((m = QUALITY_RE.exec(cl))) quals.push({ q: m[1].toLowerCase().replace(/^too /, ''), idx: m.index });
    const negClause = neg > pos || quals.length > 0 && neg >= pos;
    if (negClause) {
      negScore += Math.max(neg, 1); posScore += pos * 0.4;
      for (const q of quals) {
        const before = its.filter((i) => i.idx < q.idx);
        const it = before.length ? before[before.length - 1] : its[0] || null;
        complaints.push({ item: it ? it.name : null, quality: q.q });
      }
      let flagged = false;
      for (const k of Object.keys(FLAG_RES)) if (FLAG_RES[k].test(cl)) { flags[k] = true; flagged = true; }
      if (!quals.length && its.length && !flagged) complaints.push({ item: its[0].name, quality: null });
    } else if (pos > 0) {
      posScore += pos;
      its.forEach((i) => positives.push('the ' + i.name));
      for (const [n, re] of OTHER_POS) if (re.test(cl)) positives.push('the ' + n);
    }
  }
  const serious = SERIOUS_RE.test(low);
  if (serious) negScore += 3;

  const rating = Number(o.rating) || 0;
  const typeStr = String(o.type || '').toLowerCase();
  let sentimentKey = 'neutral';
  if (negScore > 0 && posScore > 0 && negScore * 1 >= 1 && posScore >= 1 && !(negScore >= 2 * posScore + 2)) sentimentKey = 'mixed';
  else if (negScore > posScore) sentimentKey = 'negative';
  else if (posScore > 0) sentimentKey = 'positive';
  if (rating) sentimentKey = rating >= 4 ? (negScore >= 2 && rating === 4 ? 'positive' : 'positive') : rating === 3 ? 'mixed' : 'negative';
  else if (/complaint|1 star|2 star/.test(typeStr)) sentimentKey = 'negative';
  else if (/appreciation|5 star|4 star/.test(typeStr)) sentimentKey = 'positive';
  else if (/3 star/.test(typeStr)) sentimentKey = 'mixed';

  const collab = COLLAB_RE.test(low) || /collab|influencer/.test(typeStr) || o.category === 'influencer';
  const question = QUESTION_RE.test(low) || /question/.test(typeStr);
  let intent = 'general';
  if (collab) intent = 'collab';
  else if (sentimentKey === 'negative') intent = 'complaint';
  else if (sentimentKey === 'mixed') intent = 'mixed';
  else if (sentimentKey === 'positive') intent = 'praise';
  else if (question) intent = 'question';
  if (intent === 'general' && /question/.test(typeStr)) intent = 'question';

  const itemNames = uniq(itemsSeen.map((i) => i.name));
  const beverages = uniq(itemsSeen.filter((i) => i.bev).map((i) => i.name));
  const dishes = itemNames.filter((n) => !beverages.includes(n));
  const location = (LOCATIONS.find((l) => low.includes(l.toLowerCase())) || null);
  const cleanComplaints = complaints.filter((c, i, a) => a.findIndex((x) => x.item === c.item && x.quality === c.quality) === i);

  const issueLabels = [];
  cleanComplaints.forEach((c) => issueLabels.push(c.quality && c.item ? `${cap(c.quality)} ${c.item}` : c.item ? `${cap(c.item)} quality` : cap(c.quality || '')));
  if (flags.service) issueLabels.push('Service');
  if (flags.staff && !flags.service) issueLabels.push('Staff behaviour');
  if (flags.payment) issueLabels.push('Payment experience');
  if (flags.pricing) issueLabels.push('Pricing');
  if (flags.delivery) issueLabels.push('Delivery');
  if (flags.ambience) issueLabels.push('Ambience');
  if (serious) issueLabels.push('Serious allegation');

  const risk = serious ? 'High' : (sentimentKey === 'negative' && (rating === 1 || issueLabels.length >= 3)) ? 'Medium' : sentimentKey === 'negative' ? 'Medium' : 'Low';
  const offline = serious || (sentimentKey === 'negative' && (rating <= 2 || flags.payment || issueLabels.length >= 2)) || flags.payment;
  const expectsAnswer = collab || question || /\b(please|can you|could you|let us know|reply|respond)\b/i.test(low);
  const inviteBack = !serious && sentimentKey !== 'neutral' && !(collab);
  let request = null;
  if (collab) request = /budget|rate|price|cost|paid|charge/i.test(low) ? 'Asking for collaboration budget' : /barter|free|complimentary/i.test(low) ? 'Proposing barter collaboration' : 'Collaboration interest';
  else if (question) request = 'Has a question';

  const a = {
    sentiment: cap(sentimentKey), sentimentKey, intent, rating: rating || null,
    mainIssue: issueLabels.length ? list(uniq(issueLabels).slice(0, 6)) : null,
    issues: uniq(issueLabels), complaints: cleanComplaints,
    positives: uniq(positives), items: itemNames, dishes, beverages,
    pizza: itemNames.filter((n) => /pizza|sourdough|margherita|crust|base/.test(n)),
    flags, serious, location, request, expectsAnswer, inviteBack, offline, risk,
    text,
  };
  Object.assign(a, strategy(a, o));
  return a;
}

function strategy(a, o) {
  const approach = [], avoid = [];
  let tone = 'Warm + Friendly', expecting = 'Acknowledgement', notes = [];
  if (a.intent === 'praise') {
    approach.push('Thank them warmly and sound surprised-happy.');
    if (a.positives.length) approach.push(`Mention ${list(a.positives.slice(0, 3))} specifically.`);
    approach.push('Invite them back, lightly. No hard marketing.');
    avoid.push('Copy-paste thank-you lines', 'Overdoing the sales pitch');
    expecting = 'A genuine thank-you'; tone = 'Warm + Friendly';
  } else if (a.intent === 'complaint' || a.intent === 'mixed') {
    approach.push('Acknowledge what actually went wrong, in their words.');
    if (a.mainIssue) approach.push(`Address the specific issue: ${a.mainIssue}.`);
    if (a.flags.payment) approach.push("Don't argue about payment policy in public.");
    approach.push("Don't justify the restaurant or make excuses.");
    approach.push(a.offline ? 'Invite them to continue privately with the team.' : 'Invite them back for another try.');
    approach.push('Keep it short and calm.');
    avoid.push('"That\'s not true."', '"You should have told us."', '"Nobody else complained."', 'Fake discounts, refunds or compensation', 'Asking them to remove the review');
    tone = a.intent === 'mixed' ? 'Warm + Honest' : 'Warm + Apologetic'; expecting = 'To feel heard and see action';
  } else if (a.intent === 'collab') {
    approach.push('Be friendly and interested, never desperate.');
    approach.push('Ask for media kit / rate card before discussing money.');
    approach.push('Never comment negatively on their price or follower count.');
    avoid.push('Sounding cheap or over-eager', 'Committing to budget or free products before checking', 'Commenting on their pricing');
    tone = 'Friendly + Professional'; expecting = 'A clear, positive next step';
  } else if (a.intent === 'question') {
    approach.push('Answer only what you know for sure.');
    approach.push('Offer a direct line (DM / call) if details are needed.');
    avoid.push('Guessing timings, prices or availability'); expecting = 'A quick, accurate answer'; tone = 'Friendly + Helpful';
  } else { approach.push('Reply simply and politely.'); avoid.push('Long corporate language'); }
  if (a.serious) { approach.unshift('Serious allegation: reply publicly in 2 lines, then continue privately.'); avoid.push('Debating details or blame publicly'); tone = 'Calm + Serious'; }
  if (/pricing/.test(String(o.type || '').toLowerCase()) || (a.flags.pricing && !a.flags.service && !a.complaints.length)) { approach.push('Don\'t argue about pricing; acknowledge and explain value only if needed.'); }
  return {
    approach, avoid, recommendedTone: tone, expecting,
    action: a.serious || a.offline ? 'Reply publicly + continue privately' : a.intent === 'collab' ? 'Reply in DM' : 'Reply publicly',
  };
}

/* ---------- reply pools ---------- */
function mention(a, n = 3) { return a.positives.length ? list(a.positives.slice(0, n)) : ''; }
function problems(a) {
  const np = [];
  for (const c of a.complaints) {
    if (c.item && c.quality) np.push(`the ${c.quality} ${c.item}`);
    else if (c.item) np.push(`the ${c.item}`);
  }
  if (a.flags.service || a.flags.staff) np.push(/slow|wait|late|delay|long/i.test(a.text) ? 'the wait' : 'the service');
  if (a.flags.payment) np.push('the payment experience');
  if (a.flags.delivery) np.push('the delivery');
  if (a.flags.ambience) np.push('the ambience');
  if (a.flags.pricing && !np.length) np.push('the pricing');
  return uniq(np).slice(0, 3);
}
const fillable = (s, v) => !/\{(\w+)\}/.test(s) || [...s.matchAll(/\{(\w+)\}/g)].every((m) => v[m[1]]);
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] || '');

function pickOne(pool, v, r) {
  const ok = pool.filter((s) => fillable(s, v));
  return fill(ok[Math.floor(r() * ok.length)] || '', v);
}

const P = {
  pos: {
    open: ['Thank you so much! ❤️', 'Thank you for the love! ❤️', 'This made our day, thank you!', 'Aww, thank you! ❤️', 'Thanks a lot for the lovely words!', "That's so nice to read, thank you! ❤️"],
    openPro: ['Thank you for the wonderful review.', 'Thank you for taking the time to write this.', 'Thank you for the kind words.'],
    spec: ["So happy you loved {m}! ❤️ Thanks for choosing Crustica.", "So glad you loved {m}! ❤️", "So happy you enjoyed {m}.", 'Really glad {m} worked for you.', 'Great to hear you loved {m}.', 'Happy {m} was a hit with you.'],
    specNone: ["We're so glad you had a good time with us.", "Really happy you enjoyed your visit."],
    mid: ['The whole team will be happy to read this.', 'Messages like this mean a lot to us.', 'Our team will love hearing this.'],
    midSd: ['Our sourdough crust is slow-fermented for 24 hours, so this really means a lot.', 'We take a lot of pride in our sourdough, so this means a lot.'],
    extra: ["Do tell us what you'd like to try next time."],
    close: ['Hope to see you again soon! 🍕', 'See you next time!', 'Do drop by again soon. 🌿', 'Thanks for choosing us! 🍕'],
    closePro: ['We look forward to welcoming you again.', 'We hope to see you at Crustica again soon.'],
    short: ['Thank you so much{forM}! ❤️', 'This made our day, thank you! 🍕', 'So happy you loved it! See you soon ❤️'],
  },
  pos4: {
    open: ['Thank you for the lovely review! ❤️', 'Thanks so much for the kind review!'],
    spec: ["Glad you enjoyed your visit{espM}.", "So happy you had a good time{espM}."],
    issue: ["We noticed what you said about {np}, and we'll work on it.", "Thanks for pointing out {np}. We'll take it to the team."],
    close: ['Hope your next visit is a full 5 stars! 🍕', "Hope to see you again soon. 🍕"],
    short: ['Thank you for the lovely review! ❤️ Hope your next visit is a full 5 stars 🍕'],
  },
  mixed: {
    open: ['Thanks for being honest with us. 🙏', 'Thank you for sharing this openly. 🙏'],
    openPro: ['Thank you for sharing your experience in detail.'],
    spec: ["Glad {m} worked for you, but sorry about {np}.", "Sorry about {np}. That's not how we want a visit to go.", "Really happy about {m}, and sorry that {np} didn't match up."],
    specNone: ["We'd love to know what would have made your visit better."],
    mid: ["We understand how frustrating {slow} can be, and we'll work on improving that part of the experience.", "We're passing this on to the team.", "This helps, and we'll share it with the team."],
    close: ["We'd love another chance to do better. 🍕", "Hope to welcome you back and get it right. 🍕"],
    short: ["Thanks for being honest with us. 🙏 Sorry about {np}, we'd love another chance to get it right."],
  },
  neg: {
    open: ['Thanks for being honest with us.', 'Thank you for telling us about this.', 'Thanks for letting us know.'],
    openPro: ['Thank you for sharing your experience, and we are sorry it did not meet your expectations.', 'Thank you for your honest review. We are sorry we let you down.'],
    spec: ["We're sorry {items} didn't hit the mark. 🙏 That's not the experience we want you to have.", "Sorry about {np}. That's not what we want you to experience.", "We're sorry about {np}. It should have been better.", "We're sorry that {np} fell short of the standard we aim for."],
    specPos: ["We're glad you enjoyed {m}, but we're sorry about {np}. 🙏", "Glad {m} worked for you, but we're sorry about {np}.", "Happy you enjoyed {m}, and sorry that {np} let the visit down."],
    mid: ["We understand how frustrating {slow} can be, and we'll work on improving that part of the experience.", "We'll definitely share this feedback with our team.", "We're sharing this with the team.", "We've passed this on to the team."],
    invite: ["Could you message us{atC}? We'd like to understand what happened.", "If you're okay with it, please reach out to us{atC} so we can look into this properly."],
    close: ["We'd love another chance to make it right. 🙏", "Thanks again for letting us know."],
    closePro: ['We hope to have the opportunity to serve you better.'],
    one: ["We're sorry to hear that your experience wasn't what you expected. We'd genuinely like to understand what happened and look into it with our team. Please reach out to us{atC} so we can discuss this properly."],
    serious: ["This is serious and we're sorry to hear it. Please contact us{atC} so we can look into it right away."],
    two: ["We're sorry your visit fell short, and thank you for telling us. We'd like to understand what happened, so please reach out to us{atC}. We'd love another chance to make it right. 🙏"],
    shortNp: ["Sorry about {np}. Please reach out to us{atC} so we can look into it. 🙏", "We're sorry about {np}. Please message us{atC} so we can look into it. 🙏"],
    short: ["Sorry about this. Please reach out to us{atC} so we can look into it. 🙏"],
  },
  price: {
    open: ['Thanks for sharing your thoughts.'],
    spec: ["We understand pricing can feel different depending on what you compare it with."],
    mid: ['We put a lot of care into our sourdough and ingredients, but we really appreciate you giving us a try.'],
    close: ['❤️🍕'],
    short: ['Thanks for sharing this. We put a lot of care into our sourdough and ingredients, and we appreciate you giving us a try. ❤️'],
  },
  igpos: {
    rec: ['You just made our day! 😍🍕 Thank you for the love!', 'Thank you! ❤️ So glad you loved {m}!', 'This made our day! ❤️ Thank you 🍕', 'Thank youuu! ❤️🍕 So happy you loved it!'],
    friendly: ['Thank youuu! ❤️🍕 So happy you loved it!', 'Aww thank you! ❤️ Glad you loved {m} 🍕'],
    brand: ['This made our day! ❤️ Thank you for the love. More cheesy goodness coming your way! 🍕', 'So happy to hear this! ❤️ We make every pizza with a lot of care. 🌿'],
    casual: ['You just made the Crustica team smile! 😍🍕', 'Okay this made our day 😍 Thank you!'],
    short: ['Thank you! ❤️🍕', 'Thanks for the love! ❤️'],
  },
  question: {
    open: ['Thanks for reaching out! 😊', 'Hi, thanks for asking!'],
    body: ["Could you send us a quick message with your details? The team will get back to you with the right information.", "Please DM us{atC} and the team will help you out."],
    close: ['Talk soon. 🍕'],
    short: ['Thanks for asking! Please DM us{atC} and the team will help. 🍕'],
  },
  general: {
    open: ['Thank you for reaching out! ❤️', 'Thanks for your message! 😊'],
    body: ['We really appreciate you writing to us.'],
    close: ['Hope to see you at Crustica soon. 🍕'],
    short: ['Thanks for your message! ❤️'],
  },
};

/* influencer templates: [rec, warm, pro, short] */
const COLLAB = {
  first: [
    "Hi! Thanks for reaching out 😊 We'd be happy to explore a collaboration. Could you share your media kit and collaboration options with us? We'll take a look and get back to you. 🍕❤️",
    "Hey, thanks for thinking of us! ❤️ We love working with creators who enjoy good food. Tell us a little about your idea and share your media kit, and we'll take it from there. 🍕",
    'Thank you for your interest in collaborating with Crustica. Could you please share your media kit and some examples of previous work so we can review the opportunity?',
    'Thanks for reaching out! 🍕 Could you share your media kit so we can take a look?',
  ],
  interested: [
    "Hi! Thanks for reaching out 😊 We'd be happy to explore a collaboration. Could you share your media kit and collaboration options with us? We'll take a look and get back to you. 🍕❤️",
    "This honestly sounds fun! ❤️ We'd love to explore a collaboration. Tell us more about your idea and your audience. 🍕",
    'Thank you for the proposal. We are interested in exploring this further. Please share more details on your content plan and audience.',
    "Sounds interesting! 🍕 Let's chat. Could you share more details?",
  ],
  ratecard: [
    'Thanks for getting in touch! 🍕 Could you please share your rate card or collaboration packages? That will help us see what would work best on both sides.',
    "Hey, thank you so much! ❤️ To help us plan, could you share your rate card and the kind of content you usually create? We'd love to see what fits.",
    'Thank you for your message. Could you please share your rate card and available collaboration packages for our review?',
    'Thanks! Could you share your rate card? 🍕',
  ],
  mediakit: [
    "Thank you for reaching out! 🍕 Could you share your media kit, along with your audience demographics and a few past brand collaborations? That'll help us a lot.",
    "Thanks for thinking of Crustica! ❤️ We'd love to see your media kit and some of your past food content before we chat further.",
    'Thank you for your interest. Please share your media kit, audience insights and examples of previous collaborations so we can evaluate the fit.',
    'Thanks! Please share your media kit when you can 🍕',
  ],
  negotiate: [
    "Thank you for sharing your rates. 🙏 We really like your content. Our budget for this kind of collaboration is a little different, so could we discuss a structure that works for both of us? We're open to a mix of [deliverables / experience].",
    "We really enjoy your content, thank you for sharing the details! ❤️ Our budget is a bit tighter for this one. Can we find a format that works for both of us?",
    'Thank you for sharing your rate card. We value your work, and would like to discuss whether the scope or deliverables can be adjusted to fit our current budget.',
    'Thanks for the details! Could we talk about a format that fits our budget? 🙏',
  ],
  accept: [
    "That sounds great, we'd love to go ahead! ❤️ Let's lock the details: [deliverables], [date] and [amount]. We'll confirm everything on our side shortly. 🍕",
    "Yay, let's do it! ❤️ Thank you so much. We'll share the next steps and align on [date / deliverables]. 🍕",
    'Thank you for the proposal. We are happy to proceed on the terms discussed: [deliverables], [date], [amount]. Kindly confirm so we can finalise.',
    "Sounds good, let's do it! 🍕 Sharing next steps shortly.",
  ],
  counter: [
    "Thank you for the proposal, we really like your work. 🙏 Based on what we have planned, we'd be happy to offer [amount / terms] for [deliverables]. Let us know if that works for you.",
    "Thanks so much! ❤️ We'd love to work together. Could we meet at [amount / terms] for [deliverables]? Happy to chat if you'd like.",
    'Thank you for your proposal. After review, we would like to propose [amount / terms] for [deliverables]. Please let us know if this works for you.',
    'Thanks! Could we do [amount / terms]? 🙏',
  ],
  barter: [
    "Thanks for reaching out! 🍕 We'd love to host you for a barter collaboration: a complimentary experience at Crustica in exchange for content. Could you share your media kit and the kind of content you'd create?",
    "Hey! ❤️ We love the idea of having you over. We usually do barter collaborations where you enjoy a meal with us and create content. Would that interest you?",
    'Thank you for your interest. We are open to a barter collaboration, with a meal experience at Crustica in exchange for content. Please share your media kit and proposed deliverables.',
    'Would you be open to a barter collab? A meal on us for content 🍕',
  ],
  paid: [
    "Thank you for reaching out! 🍕 We'd be open to discussing a paid collaboration. Could you share your rate card and the deliverables you'd suggest, so we can see what works?",
    "Thanks for thinking of us! ❤️ We're open to a paid collaboration. Share your rate card and what you'd create, and we'll check it with the team. 🍕",
    'Thank you for your message. We are open to exploring a paid collaboration. Please share your rate card and proposed deliverables for review.',
    'Open to a paid collab! Could you share your rate card? 🍕',
  ],
  availability: [
    "Thanks so much! 🍕 When would you be available to visit? Share a couple of dates and time slots that suit you, and we'll do our best to plan around them.",
    "We'd love to host you! ❤️ What days work for you? Send a few options and we'll sort out a time. 🍕",
    'Thank you. Could you please share your available dates and preferred time slots so we can schedule your visit?',
    'What dates work for you? 🍕',
  ],
  confirmvisit: [
    "Perfect, we're all set! ❤️ We'll see you on [date] at [time] at [branch]. Can't wait to host you. 🍕",
    "Yay, confirmed! 🍕 We'll be expecting you on [date] at [time]. Can't wait to have you at Crustica! ❤️",
    'This is to confirm your visit on [date] at [time] at [branch]. We look forward to hosting you.',
    'Confirmed for [date], [time]! See you at Crustica 🍕',
  ],
  followup: [
    "Hi! 🍕 Just following up on our earlier conversation. Wanted to check whether you've had a chance to look at it. No rush at all; happy to continue whenever it suits you.",
    "Hey! ❤️ Gently circling back on our chat. Let us know if you're still interested. 🍕",
    'Following up on our previous conversation. Please let us know if you would like to continue, and we would be happy to proceed.',
    'Hi! Following up on our chat 🍕 Let us know?',
  ],
  decline: [
    "Thank you so much for thinking of Crustica. 🙏 We're not able to take this up right now, but we really appreciate you reaching out and we'll keep you in mind for the future.",
    "Thanks so much for reaching out, we really appreciate it! ❤️ We're not planning collaborations of this kind at the moment, but we'd love to stay in touch.",
    'Thank you for your proposal. After consideration, we will not be able to proceed at this time. We appreciate your interest and wish you the very best.',
    "Thanks for reaching out! Can't take this up right now, but we appreciate it. 🙏",
  ],
  aftervisit: [
    "It was wonderful having you at Crustica! ❤️ Thank you so much for visiting. When your content is ready, please tag us and share the link so we can celebrate it with our team. 🍕",
    "So lovely to host you! 🍕 We hope you enjoyed everything. Tag us when your post goes live, we'd love to reshare it. ❤️",
    'Thank you for visiting Crustica. We hope you enjoyed the experience. Please share the content link and tag us once it is published.',
    'Loved hosting you! 🍕 Tag us when you post ❤️',
  ],
};
const COLLAB_LABELS = {
  first: 'First Collaboration Reply', interested: 'Interested', ratecard: 'Ask for Rate Card', mediakit: 'Ask for Media Kit', negotiate: 'Negotiate Price',
  accept: 'Accept Proposal', counter: 'Counter Offer', barter: 'Barter Collaboration', paid: 'Paid Collaboration', availability: 'Ask for Availability',
  confirmvisit: 'Confirm Visit', followup: 'Follow-Up', decline: 'Decline Politely', aftervisit: 'Collaboration After Visit',
};

/* local-language fallback (AI gives richer output when configured) */
const LOCAL_LANG = {
  hi: {
    pos: ['बहुत-बहुत शुक्रिया! ❤️', 'हमें बहुत खुशी है कि आपको {m} पसंद आया।', 'आपका प्यार हमारी टीम के लिए बहुत मायने रखता है।', 'जल्द ही फिर मिलेंगे! 🍕'],
    neg: ['आपने ईमानदारी से बताया, इसके लिए शुक्रिया।', 'हमें खेद है कि आपका अनुभव अच्छा नहीं रहा।', 'हम इसे अपनी टीम के साथ देखेंगे।', 'कृपया हमसे सीधे संपर्क करें ताकि हम इसे सही से समझ सकें। 🙏'],
    mix: ['आपके ईमानदार रिव्यू के लिए शुक्रिया। 🙏', 'हमें खुशी है कि कुछ चीज़ें आपको पसंद आईं, और जो कमी रही उसके लिए हमें खेद है।', 'हम इसे अपनी टीम तक पहुँचाएँगे।', 'उम्मीद है आपको अगली बार बेहतर अनुभव दे पाएँगे। 🍕'],
    gen: ['आपके संदेश के लिए शुक्रिया! 😊', 'कृपया हमें DM करें, हमारी टीम आपकी मदद करेगी।', 'Crustica में फिर मिलेंगे। 🍕'],
  },
  kn: {
    pos: ['ತುಂಬಾ ಧನ್ಯವಾದಗಳು! ❤️', 'ನಿಮಗೆ {m} ಇಷ್ಟವಾಯಿತು ಎಂದು ತಿಳಿದು ನಮ್ಮ ತಂಡಕ್ಕೆ ತುಂಬಾ ಖುಷಿಯಾಯಿತು.', 'ನಿಮ್ಮ ಪ್ರೀತಿ ನಮಗೆ ತುಂಬಾ ಮುಖ್ಯ.', 'ಮತ್ತೆ ಬೇಗ ಭೇಟಿಯಾಗೋಣ! 🍕'],
    neg: ['ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಹಂಚಿಕೊಂಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು.', 'ನಿಮ್ಮ ಅನುಭವ ಚೆನ್ನಾಗಿರಲಿಲ್ಲ ಎಂದು ಕೇಳಿ ಬೇಸರವಾಗಿದೆ.', 'ಇದನ್ನು ನಮ್ಮ ತಂಡದೊಂದಿಗೆ ಪರಿಶೀಲಿಸುತ್ತೇವೆ.', 'ದಯವಿಟ್ಟು ನಮ್ಮನ್ನು ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ. 🙏'],
    mix: ['ನಿಮ್ಮ ಪ್ರಾಮಾಣಿಕ ಅಭಿಪ್ರಾಯಕ್ಕೆ ಧನ್ಯವಾದಗಳು. 🙏', 'ಕೆಲವು ವಿಷಯಗಳು ನಿಮಗೆ ಇಷ್ಟವಾದದ್ದು ಸಂತೋಷ, ಕೊರತೆಗಳಿಗಾಗಿ ಕ್ಷಮೆ ಇರಲಿ.', 'ಇದನ್ನು ನಮ್ಮ ತಂಡಕ್ಕೆ ತಿಳಿಸುತ್ತೇವೆ.', 'ಮುಂದಿನ ಬಾರಿ ಇನ್ನೂ ಉತ್ತಮ ಅನುಭವ ನೀಡುತ್ತೇವೆ. 🍕'],
    gen: ['ನಿಮ್ಮ ಸಂದೇಶಕ್ಕೆ ಧನ್ಯವಾದಗಳು! 😊', 'ದಯವಿಟ್ಟು ನಮಗೆ DM ಮಾಡಿ, ನಮ್ಮ ತಂಡ ಸಹಾಯ ಮಾಡುತ್ತದೆ.', 'Crustica ನಲ್ಲಿ ಮತ್ತೆ ಸಿಗೋಣ. 🍕'],
  },
  ta: {
    pos: ['மிக்க நன்றி! ❤️', 'உங்களுக்கு {m} பிடித்தது என்பதில் எங்கள் குழுவுக்கு மிகுந்த மகிழ்ச்சி.', 'உங்கள் அன்பு எங்களுக்கு மிகவும் முக்கியம்.', 'விரைவில் மீண்டும் சந்திப்போம்! 🍕'],
    neg: ['உங்கள் கருத்தைப் பகிர்ந்ததற்கு நன்றி.', 'உங்கள் அனுபவம் சிறப்பாக இல்லை என்பதற்கு வருந்துகிறோம்.', 'இதை எங்கள் குழுவுடன் பார்க்கிறோம்.', 'தயவுசெய்து எங்களை நேரடியாகத் தொடர்புகொள்ளுங்கள். 🙏'],
    mix: ['உங்கள் நேர்மையான கருத்துக்கு நன்றி. 🙏', 'சில விஷயங்கள் பிடித்தது மகிழ்ச்சி, குறைகளுக்கு வருந்துகிறோம்.', 'இதை எங்கள் குழுவிடம் தெரிவிப்போம்.', 'அடுத்த முறை இன்னும் சிறந்த அனுபவம் தருவோம். 🍕'],
    gen: ['உங்கள் செய்திக்கு நன்றி! 😊', 'தயவுசெய்து எங்களுக்கு DM செய்யுங்கள், எங்கள் குழு உதவும்.', 'Crustica-வில் மீண்டும் சந்திப்போம். 🍕'],
  },
};
function localLang(lang, a, style) {
  const L = LOCAL_LANG[lang];
  const key = a.intent === 'praise' ? 'pos' : a.intent === 'complaint' ? 'neg' : a.intent === 'mixed' ? 'mix' : 'gen';
  const m = a.positives.map((p) => p.replace(/^the /, '')).slice(0, 2).join(', ') || 'pizza';
  const parts = L[key].map((s) => s.replace('{m}', m));
  if (style === 'short') return parts.length > 2 ? parts[0] + ' ' + parts[parts.length - 1] : parts.join(' ');
  if (style === 'professional') return parts.join(' ').replace(EMOJI_RE, '').trim();
  return parts.join(' ');
}

/* ---------- composer ---------- */
const LEN = { short: 'short', medium: 'medium', detailed: 'detailed' };

function compose(kind, a, o, style, r) {
  const contact = (o.knowledge && o.knowledge.phone) || (o.brand && o.brand.contact) || '';
  const m = mention(a), np = problems(a).length ? list(problems(a)) : '';
  const itemNames = uniq(a.complaints.filter((c) => c.item).map((c) => 'the ' + c.item));
  const slow = (a.flags.service || a.flags.staff) && /slow|wait|late|delay|long/i.test(a.text) ? 'slow service' : '';
  const v = { m, np, items: itemNames.length ? list(itemNames.slice(0, 3)) : '', slow, atC: contact ? ` at ${contact}` : ' directly', forM: m ? ` for loving ${m}` : '', espM: m ? `, especially ${list(a.positives.slice(0, 2))}` : '' };
  const len = LEN[o.length] || 'medium';
  const pro = style === 'professional';
  const pk = (arr) => pickOne(arr, v, r);
  let parts = [];

  if (style === 'short' && !(a.serious && kind === 'neg') && P[kind] && P[kind].short) return pickOne(P[kind].shortNp && np ? P[kind].shortNp : P[kind].short, { ...v, np: np || 'your experience' }, r);
  const P_ = P[kind];
  if (kind === 'pos') {
    const goTo = /(gave up|go-to|goto|switched|only veg|favou?rite)/i.test(a.text) && /veg/i.test(a.text);
    parts.push(pk(pro ? P_.openPro : P_.open));
    parts.push(goTo && !pro ? "We're so happy Crustica has become your go-to for vegetarian pizza." : m ? pk(P_.spec) : pk(P_.specNone));
    if (goTo && !pro) parts.push('We believe veg deserves to be just as exciting and indulgent.');
    else if (len !== 'short' && !pro) parts.push(a.items.some((i) => /sourdough|crust|base/.test(i)) && r() > 0.3 ? pk(P_.midSd) : pk(P_.mid));
    if (len === 'detailed') parts.push(pk(P_.extra));
    parts.push(pk(pro ? P_.closePro : P_.close));
  } else if (kind === 'pos4') {
    parts.push(pk(P_.open), pk(P_.spec));
    if (np) parts.push(pk(P_.issue));
    parts.push(pk(P_.close));
  } else if (kind === 'mixed') {
    parts.push(pk(pro ? P_.openPro : P_.open));
    parts.push(np ? pk(P_.spec) : pk(P_.specNone));
    if (len !== 'short') parts.push(v.slow ? fill(P_.mid[0], v) : pk(P_.mid));
    parts.push(pk(P_.close));
  } else if (kind === 'neg') {
    if (a.serious) { parts.push(pk(pro ? P_.openPro : P_.open), pk(P_.serious)); }
    else if (!np) parts.push(pk(a.rating === 2 ? P_.two : P_.one));
    else {
      parts.push(pk(pro ? P_.openPro : P_.open));
      if (np) parts.push(pk(m ? P_.specPos : P_.spec));
      if (len !== 'short') parts.push(v.slow ? fill(P_.mid[0], v) : pk(P_.mid));
      parts.push(pk(P_.invite));
      if (len === 'detailed') parts.push('We really do appreciate you taking the time to write.');
      parts.push(pk(pro ? P_.closePro : P_.close));
    }
  } else if (kind === 'price') {
    parts.push(pk(P_.open), pk(P_.spec), pk(P_.mid), pk(P_.close));
  } else if (kind === 'question' || kind === 'general') {
    parts.push(pk(P_.open), pk(P_.body));
    if (len !== 'short') parts.push(pk(P_.close));
  }
  return parts.join(' ');
}

function chooseKind(a, o) {
  const t = String(o.type || '').toLowerCase();
  if (a.intent === 'collab') return 'collab';
  if (a.intent === 'praise') {
    if (o.rating === 4 || /4 star/.test(t)) return 'pos4';
    if (o.platform === 'Instagram Comment' && a.text.length < 160) return 'igpos';
    return 'pos';
  }
  if (a.intent === 'mixed' && o.category !== 'complaint' && !/complaint/.test(t)) return 'mixed';
  if (a.intent === 'complaint' || a.intent === 'mixed') {
    if (/pricing/.test(t) || (a.flags.pricing && !a.flags.service && !a.flags.payment && !a.complaints.length)) return 'price';
    return 'neg';
  }
  if (a.intent === 'question') return 'question';
  return 'general';
}

function applyTones(text, tones, kind) {
  let t = text;
  const has = (x) => tones.includes(x);
  if (has('casual')) t = t.replace(/Thank you so much/g, 'Thanks a ton').replace(/We're so happy/g, "We're stoked").replace(/Hope to see you again soon/g, 'Catch you soon');
  if (has('premium') || has('elegant')) t = t.replace(/Thank you so much/g, 'Thank you').replace(/We're so happy/g, "We're delighted").replace(/Hope to see you again soon/g, "We'd be delighted to host you again").replace(/See you again soon!/g, 'We look forward to welcoming you again.').replace(/This honestly made our day!/g, 'This truly made our day.');
  if (has('energetic')) t = t.replace(/\. (?=[A-Z])/g, (m, i) => (i < 60 ? '! ' : m)).replace(/(?<=[a-z])\.$/, '!');
  if (has('apologetic') && /^(neg|mixed)$/.test(kind) && !/sorry/i.test(t)) t = "We're really sorry your visit wasn't what you expected. " + t;
  return t;
}

function limitEmoji(text, mode) {
  if (mode === 'none') return tidy(text.replace(EMOJI_RE, ''));
  const found = text.match(EMOJI_RE) || [];
  if (mode === 'fun' || !found.length) return text;
  const max = mode === 'minimal' ? 1 : 2;
  let seen = 0;
  return tidy(text.replace(EMOJI_RE, (e) => (++seen <= max ? e : '')));
}

const ROBOTIC = [
  [/we (?:sincerely |truly )?apologi[sz]e for (?:any |the )?inconvenience(?: caused)?/gi, "we're sorry about this"],
  [/your (?:valuable |valued )?feedback is (?:highly |greatly )?(?:valuable|appreciated|important) to us/gi, 'thanks for telling us'],
  [/we (?:highly |greatly )?appreciate your valuable feedback/gi, 'thanks for being honest with us'],
  [/we strive (?:to provide|for) (?:the best|excellence)[^.!]*/gi, 'we care about getting this right'],
  [/we hope to serve you again/gi, 'hope to welcome you back soon'],
  [/\b(?:valued|esteemed) customers?\b/gi, 'guest'],
  [/inconvenience caused/gi, 'the trouble'],
  [/unparalleled experience/gi, 'great experience'],
];
function scrub(text) {
  let t = text;
  for (const [re, rep] of ROBOTIC) t = t.replace(re, rep);
  return tidy(t.replace(/\s—\s/g, ', ').replace(/(^|[.!?]\s)([a-z])/g, (m, p, c) => p + c.toUpperCase()));
}
const BANNED_PROMISE = /\b(refund|discount|compensat|voucher|coupon|free of charge|complimentary|money back|% off)\b/i;
function qualityIssues(text, customerText = '') {
  const issues = [];
  if (BANNED_PROMISE.test(text) && !BANNED_PROMISE.test(customerText)) issues.push('promise');
  if (/(that'?s not true|you should have told|nobody else complained|remove your review|you are wrong)/i.test(text)) issues.push('defensive');
  if ((text.match(EMOJI_RE) || []).length > 5) issues.push('emoji');
  if (ROBOTIC.some(([re]) => { re.lastIndex = 0; return re.test(text); })) issues.push('robotic');
  return issues;
}

function signatureFor(o, kind, platform) {
  const b = Object.assign({}, DEFAULT_BRAND, o.brand || {});
  if (o.signature === false || platform === 'Instagram Comment') return '';
  const who = o.who || 'team';
  if (who === 'owner') return `— Owner, ${b.name.replace(/ Pizza$/, '')}`;
  if (who === 'manager') return `— Manager${o.branch ? ', ' + o.branch.replace(/^Crustica Pizza\s*[–-]\s*/, '') : ''}, ${b.name.replace(/ Pizza$/, '')}`;
  if (who === 'support') return `— ${b.name.replace(/ Pizza$/, '')} Customer Support`;
  if (who === 'social') return '';
  return b.signature || '';
}

function finalize(text, o, kind) {
  let t = scrub(text);
  t = limitEmoji(t, o.emoji || 'natural');
  const sig = signatureFor(o, kind, o.platform);
  return sig && !t.includes(sig) ? `${t}\n${sig}` : t;
}

/* ---------- intents ---------- */
const INTENT_LABEL = {
  reaction: 'Reaction', appreciation: 'Appreciation', complaint: 'Complaint', feedback: 'Feedback', price: 'Price enquiry', menu: 'Menu enquiry', hours: 'Availability enquiry',
  location: 'Location enquiry', delivery: 'Delivery enquiry', reservation: 'Reservation enquiry', offers: 'Offer enquiry', collab: 'Collaboration enquiry', proposal: 'Influencer proposal',
  negotiation: 'Negotiation', followup: 'Follow-up', confirmation: 'Confirmation', cancellation: 'Cancellation', recommendation: 'Recommendation', expansion: 'Question', general: 'General conversation',
};
const QUESTION_INTENTS = ['price', 'menu', 'hours', 'location', 'delivery', 'reservation', 'offers', 'expansion', 'recommendation', 'payment'];
const AMOUNT_RE = /(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d+)?)\s?(k)?|([\d,]+)\s?(?:rupees|rs\b|inr\b)/i;
const REACTION_RE = /^(?:[\s\W_]|yum+(?:m+y*)?|yummy|wow+|nice|super|great|love(?: it)?|awesome|amazing|fire|lit|mmm+|omg|so good|good|best)+$/i;

function fmtINR(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function parseAmount(t) {
  const m = AMOUNT_RE.exec(t || ''); if (!m) return null;
  let n = parseFloat((m[1] || m[3]).replace(/,/g, '')); if (m[2]) n *= 1000; return Number.isFinite(n) && n > 0 ? n : null;
}

/* ---------- weighted intent rules (local, rule-based) ---------- */
const INTENT_RULES = {
  MENU_QUERY: { query: true, min: 5, w: { menu: 5, 'do you have': 3, 'do you serve': 4, available: 2, options: 3, 'any options': 3, 'on the menu': 4, 'send menu': 6, 'share menu': 6, dessert: 1, 'gluten': 4, 'what do you serve': 5 } },
  JAIN_QUERY: { query: true, min: 5, w: { jain: 8, 'no onion': 5, 'no garlic': 5, 'without onion': 5, 'without garlic': 5 } },
  VEG_QUERY: { query: true, min: 6, w: { 'pure veg': 7, 'is it veg': 7, 'are you veg': 7, 'all veg': 6, 'veg or non': 7, 'non veg': 6, 'non-veg': 6, eggless: 5, egg: 3, vegetarian: 3 } },
  VEGAN_QUERY: { query: true, min: 5, w: { vegan: 8, 'dairy free': 6, 'dairy-free': 6, 'plant based': 6, 'plant-based': 6, 'no cheese': 3 } },
  PRICE_QUERY: { query: true, min: 5, w: { price: 5, prices: 5, cost: 5, 'how much': 6, rate: 3, pricing: 5, 'what is the price': 7, "what's the price": 7 } },
  LOCATION_QUERY: { query: true, min: 5, w: { where: 3, location: 5, address: 6, located: 5, 'how to reach': 6, directions: 5, 'which branch': 5, nearest: 4, 'near me': 4, 'google map': 4, 'where are you': 6 } },
  TIMING_QUERY: { query: true, min: 5, w: { 'what time': 5, open: 3, close: 4, closing: 5, timings: 6, timing: 6, hours: 4, 'opening hours': 7, 'till what time': 7, 'open today': 6, 'open on': 5 } },
  DELIVERY_QUERY: { query: true, min: 5, w: { deliver: 6, delivery: 6, 'home delivery': 7, swiggy: 3, zomato: 3, takeaway: 4, 'take away': 4, 'order online': 5 } },
  RESERVATION_QUERY: { query: true, min: 5, w: { book: 3, booking: 5, reserve: 6, reservation: 7, 'table for': 7, 'a table': 4, 'book a table': 8 } },
  DISCOUNT_QUERY: { query: true, min: 5, w: { discount: 6, offer: 5, offers: 5, coupon: 6, deal: 4, combo: 3, 'promo code': 6, 'happy hour': 5 } },
  PAYMENT_QUERY: { query: true, min: 5, w: { upi: 5, card: 3, cash: 3, payment: 5, 'pay by': 4, 'accept card': 7, 'accept upi': 7, 'do you accept': 4, 'online payment': 5, cod: 4 } },
  INFLUENCER_COLLAB: { min: 6, w: { collab: 6, collaboration: 6, collaborate: 6, creator: 5, influencer: 6, followers: 4, reel: 3, 'brand partnership': 7, partnership: 4, 'media kit': 3, content: 2, blogger: 5, 'food blogger': 6, 'content creator': 7 } },
  INFLUENCER_RATE: { min: 6, w: { 'my rate': 7, 'rate card': 6, charges: 5, 'per reel': 6, 'per post': 6, budget: 4, 'paid collab': 6, 'paid collaboration': 7, fee: 4, 'for one reel': 5, 'for a reel': 5 } },
  INFLUENCER_BARTER: { min: 8, w: { barter: 8, 'free meal': 5, complimentary: 4, 'in exchange': 5, 'free food': 5 } },
  INFLUENCER_NEGOTIATION: { min: 6, w: { negotiable: 6, 'can you do': 3, 'best price': 4, 'too high': 4, flexible: 3, 'final price': 5, 'lower rate': 6 } },
  INFLUENCER_FOLLOWUP: { min: 6, w: { 'following up': 7, 'follow up': 6, 'any update': 6, 'did you get': 4, 'checking in': 5, reminder: 4, "haven't heard": 6 } },
  INFLUENCER_DECLINE: { min: 6, w: { 'not interested': 6, 'will pass': 5, 'cannot proceed': 5, "can't proceed": 5, 'no longer interested': 8 } },
};
const ASKING_RE = /\?|^(do|does|can|could|is|are|will|what|when|where|how|which|any|please)\b|\b(do you|can you|could you|can i|is there|are there|please (?:send|share)|let me know|how much|available)\b/;

const TOPIC_GROUPS = {
  food: ['pizza', 'pasta', 'sourdough', 'crust', 'cheese', 'topping', 'sauce', 'garlic bread', 'dessert', 'mojito', 'drink', 'beverage'],
  dietary: ['jain', 'veg', 'vegetarian', 'vegan', 'eggless', 'no onion', 'no garlic'],
  service: ['service', 'staff', 'waiter', 'employee', 'waiting', 'delay', 'slow', 'table', 'self service', 'self-service'],
  payment: ['cash', 'card', 'upi', 'payment', 'prepaid', 'bill', 'discount'],
  delivery: ['delivery', 'deliver', 'swiggy', 'zomato', 'order', 'takeaway'],
};

const NAMED_LABEL = {
  POSITIVE_REVIEW: ['😊', 'Positive review'], FOOD_PRAISE: ['🍕', 'Food praise'], SERVICE_PRAISE: ['🙌', 'Service praise'], NEGATIVE_REVIEW: ['😕', 'Negative review'],
  FOOD_COMPLAINT: ['🍝', 'Food complaint'], SERVICE_COMPLAINT: ['⏱️', 'Service complaint'], MIXED_REVIEW: ['🙂', 'Mixed review'], MENU_QUERY: ['📋', 'Menu question'],
  JAIN_QUERY: ['🌿', 'Jain options'], VEG_QUERY: ['🥦', 'Veg question'], VEGAN_QUERY: ['🌱', 'Vegan question'], PRICE_QUERY: ['💰', 'Price question'],
  LOCATION_QUERY: ['📍', 'Location question'], TIMING_QUERY: ['🕐', 'Timing question'], DELIVERY_QUERY: ['🛵', 'Delivery question'], RESERVATION_QUERY: ['🪑', 'Reservation question'],
  DISCOUNT_QUERY: ['🏷️', 'Offer question'], PAYMENT_QUERY: ['💳', 'Payment question'], INSTAGRAM_COMPLIMENT: ['💬', 'Instagram compliment'], INSTAGRAM_QUESTION: ['❓', 'Instagram question'],
  INSTAGRAM_REACTION: ['😍', 'Reaction'], INFLUENCER_COLLAB: ['🤝', 'Influencer · Collaboration'], INFLUENCER_RATE: ['💼', 'Rate discussion'], INFLUENCER_BARTER: ['🎁', 'Barter'],
  INFLUENCER_NEGOTIATION: ['🗣️', 'Negotiation'], INFLUENCER_FOLLOWUP: ['🔔', 'Follow-up'], INFLUENCER_DECLINE: ['🙏', 'Decline'], GENERAL_APPRECIATION: ['❤️', 'Appreciation'],
  GENERAL_COMPLAINT: ['😕', 'Complaint'], GENERAL_MESSAGE: ['💬', 'General message'], CONFIRMATION: ['✅', 'Confirmation'], CANCELLATION: ['↩️', 'Cancellation'],
  FOLLOWUP: ['🔔', 'Follow-up'], RECOMMENDATION: ['⭐', 'Recommendation'], EXPANSION_QUERY: ['🗺️', 'Question'],
};
const NAMED_TO_INTERNAL = {
  MENU_QUERY: 'menu', JAIN_QUERY: 'menu', VEG_QUERY: 'menu', VEGAN_QUERY: 'menu', PRICE_QUERY: 'price', LOCATION_QUERY: 'location', TIMING_QUERY: 'hours', DELIVERY_QUERY: 'delivery',
  RESERVATION_QUERY: 'reservation', DISCOUNT_QUERY: 'offers', PAYMENT_QUERY: 'payment',
};

const norm = (t) => String(t || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function hasKeyword(low, kw) {
  if (/[^a-z0-9' -]/.test(kw)) return low.includes(kw);
  return new RegExp('(?:^|[^a-z0-9])' + escRe(kw).replace(/ /g, '\\s+') + '(?:s|es)?(?![a-z0-9])').test(low);
}
/** Weighted keyword scoring. Returns [{id, score}] for rules that clear their minimum, strongest first. */
function scoreRules(low, asking) {
  const out = [];
  for (const [id, rule] of Object.entries(INTENT_RULES)) {
    let score = 0;
    for (const [kw, w] of Object.entries(rule.w)) if (hasKeyword(low, kw)) score += w;
    if (rule.query && !asking) score *= 0.35; // a mention is not a question
    if (score >= rule.min) out.push({ id, score: Math.round(score * 10) / 10 });
  }
  return out.sort((x, y) => y.score - x.score);
}

function extractEntities(a, o = {}) {
  const t = a.text, low = norm(t);
  const first = (re) => { const m = re.exec(t); return m ? m[1] || m[0] : null; };
  const foods = TOPIC_GROUPS.food.filter((w) => hasKeyword(low, w));
  const dietary = (/\bjain\b|\bvegan\b|\beggless\b|no onion|no garlic|\bvegetarian\b|\bveg\b|gluten/.exec(low) || [null])[0];
  const fol = /(\d+(?:\.\d+)?\s?[km]?)\s*followers/i.exec(t);
  const amt = parseAmount(t);
  return {
    food: foods[0] || null, foods, beverage: a.beverages[0] || null, dietary: dietary ? dietary.trim() : null,
    location: first(/\b(Banaswadi|Kalyan Nagar|Kammanahalli|Indiranagar|Koramangala|HSR|Whitefield|Hebbal|Yelahanka|Jayanagar|Marathahalli|Bangalore|Bengaluru|Mysore|Mysuru|Mangalore|Chennai|Hyderabad|Mumbai|Delhi|Pune)\b/i),
    day: first(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tonight|tomorrow|weekend)\b/i),
    time: first(/\b(\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i), amount: amt ? fmtINR(amt) : null, followers: fol ? fol[1].replace(/\s/g, '').toUpperCase() + ' followers' : null,
    platformMention: first(/\b(instagram|google|zomato|swiggy|whatsapp|facebook)\b/i), partySize: first(/\bfor (\d{1,2})\b/i),
    branch: (o.branches || []).map(shortBranch).concat(['Banaswadi', 'Kalyan Nagar', 'Kammanahalli']).find((b) => low.includes(b.toLowerCase())) || null,
    percentages: [...t.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((m) => m[1] + '%'),
    starRating: o.rating || (/(\d)\s?-?\s?stars?\b/i.exec(t) || [])[1] || ((t.match(/[⭐★]/g) || []).length || null),
    platform: o.platform || null,
    complaintKeywords: uniq([...a.complaints.map((c) => c.quality).filter(Boolean), ...NEG_WORDS.filter((w) => w.length > 3 && low.includes(w))]).slice(0, 8),
  };
}
const TOPIC_KEYWORDS = {
  pizza: ['pizza'], sourdough: ['sourdough'], crust: ['crust', 'base'], pasta: ['pasta'], mojito: ['mojito'],
  drinks: ['drink', 'beverage', 'mocktail', 'coffee', 'shake', 'juice', 'lemonade', 'tea', 'mojito'],
  food: ['food', 'dish', 'meal', 'taste', 'dessert', 'cheese', 'topping', 'sauce', 'garlic bread', 'tasty', 'delicious'],
  service: ['service', 'self service', 'self-service', 'waiting', 'wait', 'slow', 'delay'], staff: ['staff', 'waiter', 'waitress', 'employee', 'manager', 'server'],
  delivery: ['delivery', 'deliver', 'swiggy', 'zomato', 'takeaway'], payment: ['payment', 'cash', 'card', 'upi', 'prepaid', 'bill'],
  discount: ['discount', 'offer', 'coupon', 'deal', 'combo'], price: ['price', 'cost', 'expensive', 'pricey', 'costly', 'pricing'],
  jain: ['jain'], vegetarian: ['veg', 'vegetarian', 'pure veg'], vegan: ['vegan'], location: ['location', 'address', 'branch', 'located'],
  timing: ['open', 'close', 'closing', 'timing', 'timings', 'hours'], reservation: ['reservation', 'book', 'booking', 'table'],
  influencer: ['influencer', 'creator', 'followers', 'reel', 'blogger'], collaboration: ['collab', 'collaboration', 'collaborate', 'partnership', 'barter'],
};
function topicList(low) { return Object.entries(TOPIC_KEYWORDS).filter(([, ws]) => ws.some((w) => hasKeyword(low, w))).map(([k]) => k); }
function extractTopics(low) {
  const out = {};
  for (const [g, words] of Object.entries(TOPIC_GROUPS)) { const hit = words.filter((w) => hasKeyword(low, w)); if (hit.length) out[g] = hit; }
  return out;
}

/**
 * Full detection pass: named intents (spec list) + the internal ids that drive reply writing.
 */
function analyzeIntents(a, o) {
  const t = a.text, low = norm(t);
  const words = low.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const neg = a.sentimentKey === 'negative' || a.sentimentKey === 'mixed' || (a.sentimentKey === 'neutral' && /complaint/i.test(o.type || ''));
  const ig = o.category === 'instagram' || /instagram/i.test(o.platform || '');
  if (words.length <= 3 && (REACTION_RE.test(t.trim()) || !words.length) && !/\?/.test(t)) return { internal: ['reaction'], named: [ig ? 'INSTAGRAM_REACTION' : 'GENERAL_APPRECIATION'], scores: [], asking: false };

  const asking = ASKING_RE.test(low);
  const sc = scoreRules(low, asking);
  const S = (id) => (sc.find((x) => x.id === id) || {}).score || 0;
  const named = [], internal = [];

  const collab = a.intent === 'collab' || S('INFLUENCER_COLLAB') >= 6 || S('INFLUENCER_BARTER') >= 8 || (S('INFLUENCER_RATE') >= 7 && /reel|post|collab|creator|followers/.test(low));
  if (collab && !/\b(menu|deliver|timings?)\b/.test(low)) {
    named.push('INFLUENCER_COLLAB'); internal.push('proposal');
    if (parseAmount(t) || S('INFLUENCER_RATE') >= 6) { named.push('INFLUENCER_RATE'); internal.push('negotiation'); }
    if (S('INFLUENCER_BARTER') >= 8) named.push('INFLUENCER_BARTER');
    if (S('INFLUENCER_NEGOTIATION') >= 6) { named.push('INFLUENCER_NEGOTIATION'); if (!internal.includes('negotiation')) internal.push('negotiation'); }
    if (S('INFLUENCER_FOLLOWUP') >= 6) named.push('INFLUENCER_FOLLOWUP');
    if (S('INFLUENCER_DECLINE') >= 6) named.push('INFLUENCER_DECLINE');
    return { internal, named: [...new Set(named)], scores: sc, asking, collab: true };
  }

  const foodPos = a.positives.some((p) => !/service|ambience/.test(p)), svcPos = a.positives.includes('the service');
  const foodNeg = a.complaints.length > 0, svcNeg = a.flags.service || a.flags.staff;
  if (a.sentimentKey === 'positive') {
    named.push('POSITIVE_REVIEW'); internal.push('appreciation');
    if (foodPos) named.push('FOOD_PRAISE'); if (svcPos) named.push('SERVICE_PRAISE');
    if (ig) named.push('INSTAGRAM_COMPLIMENT'); if (!foodPos && !svcPos && !ig) named.push('GENERAL_APPRECIATION');
  } else if (a.sentimentKey === 'mixed') {
    named.push('MIXED_REVIEW'); internal.push('complaint');
    if (foodPos) named.push('FOOD_PRAISE'); if (svcPos) named.push('SERVICE_PRAISE');
    if (foodNeg) named.push('FOOD_COMPLAINT'); if (svcNeg) named.push('SERVICE_COMPLAINT');
  } else if (neg) {
    named.push('NEGATIVE_REVIEW'); internal.push('complaint');
    if (foodNeg) named.push('FOOD_COMPLAINT'); if (svcNeg) named.push('SERVICE_COMPLAINT'); if (!foodNeg && !svcNeg) named.push('GENERAL_COMPLAINT');
  }

  if (/^(yes|yeah|yep|yup|sure|ok|okay|done|confirmed|works|sounds good|perfect|that works|see you)\b/.test(low) && words.length <= 10) { internal.push('confirmation'); named.push('CONFIRMATION'); }
  if (/\b(cancel|can'?t make it|cannot make it|won'?t be able|unable to come|postpone|reschedul)/.test(low)) { internal.push('cancellation'); named.push('CANCELLATION'); }
  if (/\b(following up|follow up|any update|did you see|reminder|waiting for (?:your )?(?:reply|response)|haven'?t heard)\b/.test(low)) { internal.push('followup'); named.push('FOLLOWUP'); }
  if (a.sentimentKey === 'neutral' && /\b(feedback|suggestion|suggest that|should add|would be nice|improve)\b/.test(low)) internal.push('feedback');

  if (asking && (!neg || /\?/.test(t))) {
    const q = sc.filter((x) => INTENT_RULES[x.id] && INTENT_RULES[x.id].query).map((x) => x.id);
    let qs = q;
    if (qs.some((x) => ['JAIN_QUERY', 'VEG_QUERY', 'VEGAN_QUERY'].includes(x))) qs = qs.filter((x) => x !== 'MENU_QUERY');
    if (neg) qs = qs.filter((x) => !['PRICE_QUERY', 'DISCOUNT_QUERY'].includes(x));
    if (qs.includes('MENU_QUERY') && !/\b(menu|jain|vegan|gluten|eggless|egg|veg)\b|do you (?:have|serve)/.test(low) && qs.some((x) => ['DELIVERY_QUERY', 'DISCOUNT_QUERY', 'RESERVATION_QUERY'].includes(x))) qs = qs.filter((x) => x !== 'MENU_QUERY');
    if (qs.includes('PAYMENT_QUERY') && qs.includes('DISCOUNT_QUERY') && !/\b(upi|card|cash|pay)/.test(low)) qs = qs.filter((x) => x !== 'PAYMENT_QUERY');
    if (qs.some((x) => ['JAIN_QUERY', 'VEG_QUERY', 'VEGAN_QUERY'].includes(x))) named.push('MENU_QUERY');
    qs.forEach((x) => { named.push(x); internal.push(NAMED_TO_INTERNAL[x]); });
    if (/\b(when (?:are|will) you|come to|coming to|open (?:a |an )?(?:branch|outlet|store)|launch(?:ing)? in)\b/.test(low) && /\b(com(?:e|ing)|open|launch|branch|outlet)\b/.test(low)) { internal.push('expansion'); named.push(ig ? 'INSTAGRAM_QUESTION' : 'EXPANSION_QUERY'); }
    if (/\b(recommend|suggest|what should i (?:order|try|get)|best thing|must try|what'?s good)\b/.test(low)) { internal.push('recommendation'); named.push('RECOMMENDATION'); }
    if (ig && qs.length && !named.includes('INSTAGRAM_QUESTION')) named.push('INSTAGRAM_QUESTION');
  }
  const ctx = String(o.context || '').toLowerCase();
  if (!internal.length && ctx && words.length <= 8) { internal.push('confirmation'); named.push('CONFIRMATION'); }
  if (!internal.length) { internal.push(a.sentimentKey === 'neutral' ? 'general' : 'feedback'); named.push('GENERAL_MESSAGE'); }
  return { internal: [...new Set(internal)], named: [...new Set(named)], scores: sc, asking };
}

function detectIntents(a, o) { return analyzeIntents(a, o).internal.map((id) => ({ id })); }

const SENT_LABEL = { POSITIVE: ['😊', 'Positive'], NEGATIVE: ['😕', 'Negative'], MIXED: ['🙂', 'Mixed'], QUESTION: ['❓', 'Question'], NEUTRAL: ['💬', 'Neutral'] };
function sentimentLabel(a, info) {
  if (info.collab) return 'NEUTRAL';
  if (a.sentimentKey === 'mixed') return 'MIXED';
  if (a.sentimentKey === 'negative') return 'NEGATIVE';
  if (a.sentimentKey === 'positive') return 'POSITIVE';
  return info.asking || info.internal.some((i) => QUESTION_INTENTS.includes(i)) ? 'QUESTION' : 'NEUTRAL';
}
function topicsOf(a) {
  const pos = a.positives.some((p) => !/service|ambience/.test(p)) ? 'food' : a.positives.includes('the service') ? 'service' : a.positives.includes('the ambience') ? 'ambience' : null;
  const neg = a.complaints.length ? 'food' : (a.flags.service || a.flags.staff) ? 'service' : a.flags.payment ? 'payment' : a.flags.delivery ? 'delivery' : a.flags.pricing ? 'pricing' : a.flags.ambience ? 'ambience' : null;
  return { positiveTopic: pos, negativeTopic: neg };
}

/** Public helper: detect everything about a message without writing a reply. */
function detectIntent(message, o = {}) {
  const a = analyze(message, o), info = analyzeIntents(a, o), sent = sentimentLabel(a, info);
  return { intent: info.named[0], intents: info.named, sentiment: sent, scores: info.scores, topics: extractTopics(norm(a.text)), entities: extractEntities(a, o), topicList: topicList(norm(a.text)), ...topicsOf(a) };
}

function whyText(a, info, ids, ctx) {
  const q = { price: 'pricing', hours: 'opening hours', location: 'where Crustica is', delivery: 'delivery', reservation: 'booking a table', offers: 'offers', payment: 'payment options', expansion: 'when Crustica is coming to their city', recommendation: 'what to order' };
  const parts = [];
  if (ids.includes('reaction')) parts.push('reacted warmly');
  if (ids.includes('appreciation')) parts.push(a.positives.length ? `liked ${list(a.positives.slice(0, 2))}` : 'enjoyed their experience');
  if (ids.includes('complaint')) {
    const unhappy = a.mainIssue ? `was unhappy about ${a.mainIssue.toLowerCase()}` : 'was unhappy with their experience';
    parts.push(a.sentimentKey === 'mixed' && a.positives.length ? `liked ${list(a.positives.slice(0, 2))} but ${unhappy}` : unhappy);
  }
  const jainish = info.named.find((n) => ['JAIN_QUERY', 'VEG_QUERY', 'VEGAN_QUERY'].includes(n));
  ids.forEach((i) => { if (i === 'menu') parts.push(`is asking about ${jainish === 'JAIN_QUERY' ? 'Jain options' : jainish === 'VEGAN_QUERY' ? 'vegan options' : jainish === 'VEG_QUERY' ? 'vegetarian options' : 'the menu'}`); else if (q[i]) parts.push(`is asking about ${q[i]}`); });
  if (ids.includes('proposal')) parts.push('wants to collaborate with Crustica');
  if (ids.includes('negotiation')) parts.push('is talking about money for the collaboration');
  if (ids.includes('confirmation')) parts.push('is confirming a plan');
  if (ids.includes('cancellation')) parts.push('wants to cancel or change plans');
  if (!parts.length) parts.push('sent a general message');
  const acts = [];
  if (ids.includes('reaction') || ids.includes('appreciation')) acts.push('acknowledges the compliment');
  if (ids.includes('complaint')) acts.push('acknowledges the issue without arguing and offers a way to continue privately');
  if (ids.some((i) => QUESTION_INTENTS.includes(i))) acts.push(ctx.unknown.length ? 'answers what Crustica has confirmed and says it will check the rest' : 'answers the question');
  if (ids.includes('proposal')) acts.push('stays friendly and asks for what the team needs next');
  if (ids.includes('confirmation')) acts.push('confirms the plan using the earlier message');
  if (!acts.length) acts.push('replies simply and politely');
  const joined = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
  const acted = acts.length > 1 ? acts.slice(0, -1).join(', ') + ' and ' + acts[acts.length - 1] : acts[0];
  return `The customer ${joined}, so the reply ${acted}.`;
}

function summarize(a, ids) {
  const m = a.positives.slice(0, 2).join(' and ');
  const P_ = {
    reaction: 'They are reacting to something they enjoyed.',
    appreciation: m ? `They are appreciating ${m}.` : 'They are appreciating their experience.',
    complaint: a.mainIssue ? `They are unhappy about: ${a.mainIssue.toLowerCase()}.` : 'They are unhappy with their experience.',
    feedback: 'They are sharing feedback.', price: 'They are asking about pricing.', menu: 'They are asking about the menu or availability of an item.',
    hours: 'They are asking about opening hours.', location: 'They are asking where Crustica is.', delivery: 'They are asking about delivery.',
    reservation: 'They want to book a table.', offers: 'They are asking about offers.', collab: 'They are interested in collaborating.',
    proposal: 'They are proposing an influencer collaboration.', negotiation: 'They are discussing money for the collaboration.',
    followup: 'They are following up on an earlier message.', confirmation: 'They are confirming something.', cancellation: 'They want to cancel or change plans.',
    recommendation: 'They want a recommendation.', expansion: 'They are asking if Crustica is coming to their city.', general: 'They are making general conversation.',
  };
  return ids.map((i) => P_[i.id]).filter(Boolean).join(' ');
}

/* ---------- business facts (never invented) ---------- */
function mapKnowledge(k) {
  if (!k) return {};
  const o = {};
  if (k.openingHours) o.hours = k.openingHours;
  if (k.deliveryAreas && k.deliveryAreas.length) o.delivery = k.deliveryAreas.join('; ');
  if (k.menuUrl) o.menuUrl = k.menuUrl;
  if (k.currentOffers && k.currentOffers.length) o.offers = k.currentOffers.join('; ');
  if (k.reservationNote) o.reservations = k.reservationNote; else if (k.reservationAvailable) o.reservations = 'Reservations are available.';
  if (k.phone) o.contact = k.phone;
  if (k.jain) o.jain = k.jain;
  if (k.prices) o.prices = k.prices;
  if (k.locations) o.locations = k.locations;
  if (k.payments) o.payments = k.payments;
  return o;
}
function getFacts(o) {
  const b = Object.assign({}, o.brand || {}, mapKnowledge(o.knowledge));
  const locs = String(b.locations || '').split(/\n|;/).map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(':'); return i > 0 ? { name: l.slice(0, i).trim(), addr: l.slice(i + 1).trim() } : { name: l, addr: '' }; });
  return { hours: String(b.hours || '').trim(), delivery: String(b.delivery || '').trim(), jain: String(b.jain || '').toLowerCase(), menuUrl: String(b.menuUrl || '').trim(), offers: String(b.offers || '').trim(), reservations: String(b.reservations || '').trim(), prices: String(b.prices || '').trim(), payments: String(b.payments || '').trim(), locs };
}
const shortBranch = (n) => String(n).replace(/^Crustica Pizza\s*[–-]\s*/i, '');
function cleanArea(s) { return s ? s.replace(/[?.!,]+$/, '').trim() : ''; }

/** Returns { text, unknown } for one question intent. st: std | casual | pro */
function answerFor(id, a, o, k, st) {
  const t = a.text, low = t.toLowerCase(), pro = st === 'pro';
  const E = (s) => (pro ? '' : ' ' + s);
  const branches = (o.branches || []).map(shortBranch);
  const multi = branches.length > 1 && !o.branch;
  switch (id) {
    case 'hours':
      if (k.hours) return { text: `We're open ${k.hours}.${E('😊')}` };
      return { unknown: 'timings', text: multi ? `Could you let us know which Crustica branch you're asking about? Timings can differ, and we'll confirm.` : `Let me check our timings and get back to you.${E('😊')}` };
    case 'price':
      if (k.prices) return { text: `${k.prices}${E('🍕')}` };
      return { unknown: 'prices', text: `Let me check the exact price for you and get back to you.${E('😊')}` };
    case 'offers':
      if (k.offers) return { text: `We currently have ${k.offers}.${E('😊')}` };
      return { unknown: 'offers', text: `We don't want to give you wrong information, so let me check the current offers and get back to you.${E('😊')}` };
    case 'menu': {
      if (/\b(send|share|show|see|get)\b.*\bmenu\b|\bmenu\b.*\b(please|pls|link|share|send)\b|^menu\??$/.test(low)) {
        return k.menuUrl ? { text: `Absolutely! Here's our menu: ${k.menuUrl}${E('🍕🌿')}` } : { unknown: 'menu link', text: `Absolutely! We'd be happy to share our menu with you.${E('🍕🌿')}` };
      }
      if (/jain/.test(low)) {
        if (k.jain === 'yes') return { text: `Yes, we do have Jain-friendly options.${E('🌿')} If you'd like, we can help you pick something from the menu.` };
        if (k.jain === 'no') return { text: `Sorry, we don't have Jain options at the moment.${E('🙏')}` };
        return { unknown: 'Jain options', text: multi ? `We'd be happy to help with Jain options! Could you let us know which Crustica branch you're planning to visit? We'll check what's available there.${E('😊')}` : `Let me check on Jain options and get back to you.${E('😊')}` };
      }
      if (/\b(is it|are you|pure|all) (?:pure )?veg(?:etarian)?\b|\bveg or non[- ]?veg\b|\bnon[- ]?veg\b/.test(low)) return { text: `Yes, everything we serve is 100% vegetarian.${E('🌿')}` };
      const m = /\b(?:do you (?:have|serve)|have any|any)\s+([a-z' -]{3,28}?)(?:\s+(?:options?|items?|on the menu)|\?|\.|,| and |$)/i.exec(t);
      const item = m ? m[1].replace(/^(a|an|the|any)\s+/i, '').trim() : '';
      return { unknown: 'menu item', text: item ? `Let me check if we have ${item} and get back to you.${E('😊')}` : `Let me check that on the menu and get back to you.${E('😊')}` };
    }
    case 'location': {
      const wanted = o.branch ? [shortBranch(o.branch)] : branches.filter((b) => low.includes(b.toLowerCase()));
      const loc = k.locs.find((l) => wanted.some((w) => l.name.toLowerCase().includes(w.toLowerCase()))) || (k.locs.length === 1 ? k.locs[0] : null);
      if (loc && loc.addr) return { text: `We're at ${loc.addr}.${E('📍')} We'd love to have you visit!` };
      if (multi && wanted.length === 0) return { unknown: 'address', text: `We'd be happy to help! Which area are you looking for — ${branches.length > 1 ? branches.slice(0, -1).join(', ') + ' or ' + branches[branches.length - 1] : branches[0]}?` };
      return { unknown: 'address', text: `Let me share the exact location with you shortly.${E('📍')}` };
    }
    case 'delivery': {
      const m = /deliver(?:y|ed)?(?:\s+(?:to|in|at))?\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)/.exec(t) || /\b(?:in|to)\s+(Whitefield|Indiranagar|Koramangala|HSR|Hebbal|Yelahanka|Jayanagar|Marathahalli|Electronic City|Banaswadi|Kalyan Nagar|Kammanahalli|Bellandur)\b/i.exec(t);
      const area = m ? cleanArea(m[1]) : '';
      if (k.delivery && area && k.delivery.toLowerCase().includes(area.toLowerCase())) return { text: `Yes, we deliver to ${area}!${E('🍕')}` };
      if (k.delivery && !area) return { text: `${k.delivery}${E('🍕')}` };
      if (area) return { unknown: 'delivery areas', text: `Let me check delivery to ${area} and get back to you.${E('😊')}` };
      return { unknown: 'delivery areas', text: `Could you share your exact area or PIN code? We'll help you check the delivery availability.${E('😊')}` };
    }
    case 'reservation': {
      const n = /\bfor\s+(\d{1,2})\b/.exec(low), when = /\b(tonight|today|tomorrow|this (?:weekend|saturday|sunday)|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/.exec(low), tm = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/.exec(low);
      const what = `${n ? ' for ' + n[1] + ' people' : ''}${when ? ' ' + when[1] : ''}${tm ? ' at ' + tm[0] : ''}`;
      const base = k.reservations ? `${k.reservations} ` : '';
      return { unknown: k.reservations ? null : 'reservation rules', text: tm ? `${base}Let me check availability${what} and confirm with you shortly.${E('😊')}` : `${base}Absolutely, let me help you check availability${what}. What time were you looking for?` };
    }
    case 'expansion': {
      const m = /\b(?:to|in)\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)/.exec(t);
      const place = m ? cleanArea(m[1]) : '';
      if (o.platform === 'Instagram Comment') return { text: `${place || 'Hmm'} 👀❤️ Stay tuned… you never know! 🍕` };
      return { text: `Thanks for asking!${place ? ` We've noted ${place}.` : ''} We don't have anything to announce right now, but we'd love to be there someday.${E('🍕')}` };
    }
    case 'payment':
      if (k.payments) return { text: `${k.payments}${E('😊')}` };
      return { unknown: 'payment options', text: `Let me check which payment options we have and get back to you.${E('😊')}` };
    case 'recommendation':
      return { text: `Happy to help you pick!${E('😊')} Do you like something classic and cheesy, or a bit more adventurous? Everything we serve is 100% vegetarian.${E('🌿')}` };
    default: return { text: '' };
  }
}

const REACTIONS = ['❤️🍕 You just made our day!', 'Right?! 😍🍕 So glad you loved it!', 'Thank you! ❤️🍕', 'Aww yes! 🍕❤️ Thank you!', 'So happy you loved it! 🍕'];

function confirmationReply(a, o, st, r) {
  const src = `${a.text} ${o.context || ''}`;
  const day = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tonight|tomorrow)\b/i.exec(a.text) || /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tonight|tomorrow)\b/i.exec(src);
  const tm = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i.exec(a.text) || /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i.exec(o.context || '');
  const when = day ? `${cap(day[1].toLowerCase())}${tm ? ' at ' + tm[0] : ''} it is` : tm ? `${tm[0]} it is` : '';
  if (st === 'pro') return when ? `Noted, thank you. ${when}. We look forward to hosting you.` : 'Noted, thank you. We look forward to it.';
  if (st === 'short') return when ? `Perfect! ${when} 😊` : 'Perfect! 😊🍕';
  return when ? `Perfect! 😊 ${when}. Looking forward to having you at Crustica! 🍕❤️` : 'Perfect! 😊 Looking forward to it! 🍕❤️';
}

/** One reply in one style. */
function buildReply(a, ids, o, st, r, ctx) {
  const has = (x) => ids.includes(x);
  const KEY = { hours: /open|clos|timing|hours|what time/, menu: /menu|jain|vegan|gluten|egg|veg|do you (?:have|serve)|options/, price: /how much|price|cost|rate/, location: /where|location|address|located|branch/, delivery: /deliver|zomato|swiggy|takeaway/, reservation: /book|reserv|table/, offers: /discount|offer|coupon|deal|combo/, payment: /upi|card|cash|payment|pay/, expansion: /come|coming|open|launch/, recommendation: /recommend|suggest|order|try/ };
  const pos_ = (i) => { const m = KEY[i] && KEY[i].exec(a.text.toLowerCase()); return m ? m.index : 999; };
  const qs = ids.filter((i) => QUESTION_INTENTS.includes(i)).sort((x, y) => pos_(x) - pos_(y));
  const pro = st === 'professional' || st === 'pro';
  const ast = pro ? 'pro' : st === 'casual' ? 'casual' : 'std';
  if (has('reaction')) return pro ? 'Thank you, we really appreciate it.' : st === 'short' ? 'Thank you! ❤️🍕' : pickOne(REACTIONS, {}, r);
  if (has('confirmation') && !qs.length) return confirmationReply(a, o, st === 'short' ? 'short' : ast, r);
  if (has('cancellation')) return pro ? 'Thank you for letting us know. We would be happy to reschedule whenever it suits you.' : st === 'short' ? 'No problem at all, thanks for letting us know! 🙏' : "No problem at all, thanks for letting us know! 🙏 Happy to reschedule whenever suits you. What day works?";
  if (has('followup') && !qs.length) return pro ? 'Thank you for following up. We are checking on this and will get back to you shortly.' : "Thanks for checking in! 😊 Let me check on this and get back to you shortly.";

  const wordsIn = a.text.split(/\s+/).length;
  const len = wordsIn <= 5 && o.length !== 'detailed' ? 'short' : wordsIn >= 70 ? 'detailed' : (o.length || 'medium');
  const oo = { ...o, length: st === 'short' ? 'short' : len };
  const answers = qs.map((q) => answerFor(q, a, o, ctx.k, ast));
  ctx.unknown.push(...answers.filter((x) => x.unknown).map((x) => x.unknown));
  const ansText = answers.map((x) => x.text).filter(Boolean);
  let lead = '';

  if (has('appreciation') && !has('complaint')) {
    const kind = chooseKind({ ...a, intent: 'praise' }, oo);
    if (qs.length) {
      const P_ = P.pos, v = { m: mention(a) };
      lead = [pickOne(pro ? P_.openPro : P_.open, v, r), v.m ? pickOne(P_.spec, v, r) : ''].filter(Boolean).join(' ');
      if (st === 'short') lead = pickOne(['Thank you! ❤️', 'So glad you loved it! ❤️', 'Thanks! 😊'], {}, r);
    } else if (kind === 'igpos') return pickOne(P.igpos[st === 'short' ? 'short' : st === 'casual' ? 'casual' : pro ? 'brand' : 'rec'], { m: mention(a, 2) }, r);
    else return compose(kind, a, oo, st === 'short' ? 'short' : pro ? 'professional' : 'std', r);
  } else if (has('complaint')) {
    const kind = (a.intent === 'mixed' && o.category !== 'complaint') ? 'mixed' : chooseKind({ ...a, intent: 'complaint' }, oo);
    lead = compose(kind === 'pos' ? 'neg' : kind, a, oo, st === 'short' ? 'short' : pro ? 'professional' : 'std', r);
  }
  if (lead && ansText.length) return `${lead} ${ansText.join(' ')}`;
  if (ansText.length) {
    const body = st === 'short' ? ansText.slice(0, 2).join(' ') : ansText.join(' ');
    const tail = st === 'short' || pro || ids.includes('expansion') || /whatsapp|general customer/i.test(o.platform || '') || ansText.length > 2 || /\?$/.test(ansText[ansText.length - 1]) || a.text.length < 25 ? '' : pickOne(["We'd love to have you at Crustica. 🍕", 'Hope to see you soon! 🍕', ''], {}, r);
    return `${body}${tail ? ' ' + tail : ''}`;
  }
  if (lead) return lead;
  if (has('feedback')) return pro ? 'Thank you for sharing this. We have noted it and will share it with the team.' : "Thanks for sharing this, it's really helpful! 🙏 We'll pass it on to the team.";
  return pro ? 'Thank you for your message. Please let us know how we can help.' : st === 'short' ? 'Thanks for your message! 😊' : "Thanks for your message! 😊 Let us know if there's anything we can help you with. 🍕";
}

/* ---------- influencer ---------- */
Object.assign(COLLAB, {
  checkin: [
    "Thanks for checking in! 😊 We haven't forgotten you. Let me check with the team and get back to you soon. 🍕",
    "Hey, thanks for the nudge! ❤️ Checking with the team and we'll come back to you shortly. 🍕",
    'Thank you for following up. We are discussing this with the team and will get back to you shortly.',
    'Thanks for checking in! Back to you soon 🍕',
  ],
  theirdecline: [
    "Totally understand, thank you for letting us know! 😊 We'd love to stay in touch for the future. 🍕",
    "No worries at all, thanks for telling us! ❤️ The door is always open. 🍕",
    'Thank you for letting us know. We understand, and would be glad to stay in touch for future opportunities.',
    'No problem, thanks for letting us know! 😊',
  ],
  negotiate: [
    "Thanks for sharing your rate! 😊 We'd love to explore this, but {rate} is a little above our current budget. Would you be open to {offer}? Happy to discuss the deliverables and make it work for both sides.",
    "Thank you so much for sharing this, we really like your content! ❤️ {rate} is a bit above what we've planned for this one. Could we work with {offer}? We're happy to be flexible on the deliverables.",
    'Thank you for sharing your rate. We value your work, but {rate} is above our current budget for this collaboration. Would {offer} work for you, with the deliverables adjusted accordingly?',
    'Thanks for sharing! {rate} is a bit above our budget. Would {offer} work? 🙏',
  ],
  counter: [
    "Thank you for the proposal, we really like your work. 🙏 Based on what we've planned, we can offer {offer} for [deliverables]. Let us know if that works for you.",
    "Thanks so much! ❤️ We'd love to work together. Could we meet at {offer} for [deliverables]? Happy to chat if you'd like.",
    'Thank you for your proposal. After review, we would like to propose {offer} for [deliverables]. Please let us know if this works for you.',
    'Thanks! Could we do {offer}? 🙏',
  ],
  accept: [
    "That sounds great, we'd love to go ahead! ❤️ Let's lock the details: [deliverables], [date] and {rate}. We'll confirm everything on our side shortly. 🍕",
    "Yay, let's do it! ❤️ Thank you so much. We'll share the next steps and align on [date] and [deliverables]. 🍕",
    'Thank you for the proposal. We are happy to proceed on the terms discussed: [deliverables], [date], {rate}. Kindly confirm so we can finalise.',
    "Sounds good, let's do it! 🍕 Sharing next steps shortly.",
  ],
  betterprice: [
    "Thanks for sharing your rate! 😊 We really like your content. Is there any flexibility on the pricing, or a package that bundles a few deliverables together?",
    "We love your content, thank you for the details! ❤️ Would you be open to a slightly lower rate, or a package deal? We'd love to make this work.",
    'Thank you for sharing your rate. Is there any flexibility on pricing, or a bundled package of deliverables, that we could consider?',
    'Thanks! Any flexibility on the rate? 🙏',
  ],
  deliverables: [
    "Thanks for reaching out! 😊 Before we talk numbers, could you tell us exactly what you'd deliver? For example, the number of reels, stories and posts, and the timeline.",
    "Thanks so much! ❤️ Could you share what's included: reels, stories, posts and when they'd go live? That'll help us a lot.",
    'Thank you for your proposal. Could you please confirm the exact deliverables (formats, quantity and timeline) so we can evaluate?',
    'Thanks! What deliverables are included? 🍕',
  ],
});
COLLAB_LABELS.betterprice = 'Ask for Better Price'; COLLAB_LABELS.deliverables = 'Ask for Deliverables';

Object.assign(COLLAB, {
  ratereceived: [
    "Thanks for sharing your rate! 😊 We'll check this with the team and get back to you. Could you also share your media kit and what the deliverables would include?",
    "Thank you for the details, we appreciate it! ❤️ Let us run this by the team. Could you tell us exactly what's included (reels, stories, timeline)? 🍕",
    'Thank you for sharing your rate. We will review it with the team and get back to you. Could you please share your media kit and the proposed deliverables?',
    "Thanks for sharing! We'll check with the team and come back to you. 🙏",
  ],
  barteracknowledge: [
    "Thanks for reaching out! 😊 We're happy to look at a barter idea. Could you share your media kit and what you'd create? We'll check with the team and get back to you. 🍕",
    "Hey, thanks for the idea! ❤️ Share your media kit and what you have in mind, and we'll check with the team. 🍕",
    'Thank you for the proposal. We are open to reviewing a barter collaboration. Please share your media kit and proposed deliverables, and we will revert after discussing with the team.',
    "Thanks! Please share your media kit and we'll check with the team. 🍕",
  ],
});

function collabReplies(a, o, ctx) {
  const rateN = parseAmount(a.text);
  let obj = COLLAB[o.objective] ? o.objective : 'first';
  const nm = (ctx.info && ctx.info.named) || [];
  if (obj === 'first' || obj === 'interested') {
    if (nm.includes('INFLUENCER_DECLINE')) obj = 'theirdecline';
    else if (nm.includes('INFLUENCER_FOLLOWUP')) obj = 'checkin';
    else if (nm.includes('INFLUENCER_BARTER')) obj = 'barteracknowledge';
  }
  if ((obj === 'first' || obj === 'interested') && (rateN || nm.includes('INFLUENCER_NEGOTIATION'))) { obj = 'ratereceived'; ctx.notes.push(`${rateN ? 'Their rate (' + fmtINR(rateN) + ') was detected. ' : ''}The reply does not commit to any price. Choose Accept, Negotiate, Ask for Deliverables, Offer Barter or Decline to reply with a decision.`); }
  const offerRaw = String(o.offer || '').trim();
  const offerN = parseAmount(offerRaw) || (/^[\d,]+(?:\.\d+)?\s?k?$/i.test(offerRaw) ? (parseFloat(offerRaw.replace(/[,k\s]/gi, '')) * (/k$/i.test(offerRaw) ? 1000 : 1)) || null : null);
  const v = { rate: rateN ? fmtINR(rateN) : 'your rate', offer: offerN ? fmtINR(offerN) : '[your offer]' };
  if (/\[your offer\]/.test(COLLAB[obj].join('')) && !offerN) ctx.notes.push('Add your offer amount in the field above, or replace [your offer] before sending.');
  return COLLAB[obj].map((s) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] || ''));
}

/* ---------- public: generate ---------- */
const LABELS = { best: 'Recommended Reply', casual: 'Friendly', professional: 'Professional', short: 'Short' };

function capSentences(t, n) { const ss = splitSentences(t); return ss.length > n ? ss.slice(0, n).join(' ') : t; }

function generate(text, o = {}) {
  const a = analyze(text, o);
  const info = analyzeIntents(a, o), intents = info.internal.map((id) => ({ id })), ids = info.internal;
  const seed = hash(a.text + (o.regen || 0) + (o.type || '') + (o.rating || '') + (o.context || ''));
  const tones = (o.tones && o.tones.length ? o.tones : ['warm', 'friendly']).map((t) => String(t).toLowerCase());
  const lang = ['hi', 'kn', 'ta'].includes(o.language) ? o.language : 'en';
  const ctx = { k: getFacts(o), unknown: [], notes: [], info };
  const kind = ids.includes('proposal') || ids.includes('collab') ? 'collab' : chooseKind(a, o);
  const rr = (n) => mulberry32(seed + n);
  let variants;

  if (kind === 'collab') {
    const arr = collabReplies(a, o, ctx);
    variants = [['best', arr[0]], ['casual', arr[1]], ['professional', arr[2]], ['short', arr[3]]];
  } else if (lang !== 'en') {
    const base = localLang(lang, a, 'rec');
    variants = [['best', base], ['casual', base + (a.intent === 'praise' ? ' ❤️' : '')], ['professional', localLang(lang, a, 'professional')], ['short', localLang(lang, a, 'short')]];
  } else {
    const proTone = tones.includes('professional') && !tones.includes('warm');
    const best = applyTones(buildReply(a, ids, o, proTone || o.who === 'support' ? 'professional' : 'std', rr(0), ctx), tones, kind);
    const casual = applyTones(buildReply(a, ids, { ...o, length: o.length === 'short' ? 'medium' : o.length }, 'casual', rr(7), ctx), ['casual'], kind);
    const pro = buildReply(a, ids, o, 'professional', rr(13), ctx);
    const sh = buildReply(a, ids, o, 'short', rr(29), ctx);
    variants = [['best', best], ['casual', casual], ['professional', pro], ['short', sh]];
  }

  if (/Instagram Comment/i.test(o.platform || '') && kind !== 'collab' && !ids.includes('reaction')) variants = variants.map(([id, t]) => [id, capSentences(t, id === 'short' ? 1 : 2)]);
  const out = variants.map(([id, t]) => {
    const emoji = id === 'professional' && o.emoji !== 'none' ? 'minimal' : o.emoji;
    return { id, label: LABELS[id], text: finalize(t, { ...o, emoji }, kind) };
  });
  const seen = new Set();
  const replies = out.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));

  const pub = publicAnalysis(a);
  const sent = sentimentLabel(a, info);
  pub.intents = info.named.map((n) => (NAMED_LABEL[n] || ['', n])[1]);
  pub.namedIntents = info.named;
  pub.intentIds = ids;
  pub.summary = summarize(a, intents);
  pub.sentimentLabel = sent;
  pub.topics = extractTopics(norm(a.text));
  pub.entities = extractEntities(a, o);
  pub.entities.questionType = (info.named.find((n) => /_QUERY$/.test(n)) || null);
  pub.topicList = topicList(norm(a.text));
  Object.assign(pub, topicsOf(a));
  pub.scores = info.scores;
  pub.rateDetected = parseAmount(a.text) ? fmtINR(parseAmount(a.text)) : null;
  pub.understood = [{ emoji: SENT_LABEL[sent][0], label: SENT_LABEL[sent][1], kind: 'sentiment' }, ...info.named.slice(0, 3).map((n) => ({ emoji: (NAMED_LABEL[n] || ['', ''])[0], label: (NAMED_LABEL[n] || ['', n])[1], kind: 'intent' }))];
  pub.why = whyText(a, info, ids, ctx);
  const adv = advice(a, o, replies, ids, ctx);
  return { analysis: pub, replies, advice: adv, kind, placeholders: replies.some((x) => /\[[^\]]+\]/.test(x.text)) };
}

function publicAnalysis(a) {
  const { text, ...rest } = a;
  return rest;
}

function advice(a, o, replies, ids, ctx) {
  const notes = [...ctx.notes];
  const unk = [...new Set(ctx.unknown)];
const NOTE = {
    timings: "Opening hours aren't configured yet. Check the current branch timings before replying.",
    prices: "Prices aren't configured yet. Check the exact price before replying.",
    offers: "Current offers aren't configured. Check with the team before promising any offer.",
    'delivery areas': "Delivery areas aren't configured yet. Check the area before replying.",
    'Jain options': "Jain availability isn't configured yet. Check with the kitchen before replying.",
    'menu item': "Menu availability for that item isn't configured. Check with the kitchen before replying.",
    'menu link': 'No menu link is configured. Attach the menu or paste the link before sending.',
    address: "The branch address isn't configured yet. Add it or check before replying.",
    'reservation rules': "Reservation availability isn't configured. Confirm the table before replying.",
    'payment options': "Payment options aren't configured yet. Check before replying.",
  };
  unk.forEach((u) => notes.push(NOTE[u] || `${u} isn't configured yet. Check before replying.`));
  if (unk.length) notes.push('The reply says the team will check, so it is safe to send. Add these under Settings → Business details to answer directly next time.');
  if (a.flags.pricing && !a.flags.service && a.sentimentKey === 'negative') notes.push("Don't argue about price. Acknowledge, mention value only if needed.");
  if (replies.some((x) => /\[[^\]]+\]/.test(x.text))) notes.push('Fill in the [bracketed] details before sending.');

  const approach = [];
  const qs = ids.filter((i) => QUESTION_INTENTS.includes(i));
  if (ids.includes('reaction')) approach.push('Keep it short and warm. No long reply needed.');
  if (ids.includes('confirmation')) approach.push('Confirm the plan using what was said earlier.');
  if (qs.length) approach.push(qs.length > 1 ? 'Answer every question, in the order asked.' : 'Answer the question first.', 'Only state facts Crustica has confirmed. Say you will check the rest.');
  if (ids.includes('appreciation')) approach.push(a.positives.length ? `Thank them and mention ${a.positives.slice(0, 2).join(' and ')}.` : 'Thank them warmly.');
  if (a.intent === 'complaint' || a.intent === 'mixed') approach.push(...a.approach.slice(0, 4));
  if (a.intent === 'collab') approach.push(...a.approach.slice(0, 3));
  if (!approach.length) approach.push(...a.approach.slice(0, 3));
  const plat = o.platform === 'Instagram Comment' ? 'Keep it short and casual for a comment.' : o.platform === 'Google Maps' ? 'Slightly more polished: this is public and affects reputation.' : o.platform === 'WhatsApp' ? 'Direct and helpful.' : '';
  if (plat) approach.push(plat);

  return {
    expecting: a.expecting, tone: a.recommendedTone, avoid: a.avoid, approach: [...new Set(approach)].slice(0, 6), action: a.action, notes,
    continuePrivately: !!(a.offline || a.serious || a.intent === 'collab'),
    best: replies[0] && replies[0].text, alternative: replies[1] && replies[1].text,
    beforePosting: a.intent === 'complaint' || a.intent === 'mixed'
      ? ['Acknowledge the issue', 'Stay calm', 'Be specific', "Don't argue", "Don't blame", "Don't make excuses", 'Offer a way to continue privately'] : null,
  };
}

/* ---------- transforms (rephrase / quick buttons) ---------- */
const TRANSFORMS = {
  natural: 'More natural', polite: 'More polite', casual: 'More casual', premium: 'More premium', emotional: 'More emotional',
  shorter: 'Shorter', longer: 'Longer', lessai: 'Less AI-like',
};
const QUICK = {
  shorter: 'Make it shorter', human: 'Make it more human', polite: 'Make it polite', premium: 'Make it premium', warmth: 'Add a little warmth',
  noemoji: 'Remove emojis', instagram: 'Make it Instagram style', google: 'Make it Google review style', owner: "Make it sound like the owner", lessai: "Don't sound AI-generated",
};

/* ---------- rephrase: phrase banks give genuinely different wording; `o.variant` cycles through the options ---------- */
const BANK = {
  human: [
    [/Thank you for visiting Crustica\.?/gi, ['Really glad you stopped by Crustica! ❤️', 'So happy to have you at Crustica!', 'Thanks for spending some pizza time with us! 🍕']],
    [/(?:This made our day, thank you|That's so nice to read, thank you|Thank you so much|Thank you for the love|Aww, thank you|Thanks a lot for the lovely words)!/gi, ['Honestly, this made our day!', "That's so kind of you, thank you!", 'Reading this made the whole team smile!', "Aww, you're too kind!"]],
    [/So happy you (enjoyed|loved) /gi, ["We're really glad you $1 ", 'It makes us so happy that you $1 ', 'Love hearing that you $1 ']],
    [/Really glad (.+?) worked for you\./gi, ["We're so glad $1 won you over.", 'Happy $1 hit the spot.']],
    [/Hope to see you again soon!?/gi, ['Hope we see you back soon!', 'Come back and see us soon!', "We'd love to have you back soon!"]],
    [/See you next time!/gi, ["Can't wait to see you again!", 'See you again soon!']],
    [/Do drop by again soon\./gi, ['Come by again soon!', 'Drop in again whenever you like!']],
    [/Thanks for choosing us!/gi, ['Thanks for picking Crustica!', 'Glad you chose us!']],
    [/Thanks for being honest with us\./gi, ['Thanks for telling us straight.', 'We appreciate you being upfront with us.', 'Thanks for being so open about it.']],
    [/Thank you for telling us about this\./gi, ['Thanks for flagging this with us.', 'We appreciate you telling us.']],
    [/Thanks for letting us know\./gi, ['Thanks for telling us.', 'Good that you let us know.']],
    [/We'll definitely share this feedback with our team\./gi, ["We'll make sure the team hears about this.", 'This will definitely go to the team.']],
    [/We're sharing this with the team\./gi, ["We'll make sure the team hears about this.", 'We are taking this to the team.']],
    [/We'd love another chance to make it right\./gi, ["We'd really like to make it right.", 'Give us a chance to put this right.']],
    [/Could you message us directly\?/gi, ['Would you mind messaging us directly?', 'Could you drop us a message?']],
    [/Let me check (.+?) and get back to you\./gi, ["I'll check $1 and come back to you.", "Give me a moment to check $1, and I'll get back to you."]],
  ],
  friendly: [
    [/Thank you so much/g, ['Thanks so much', 'Thank you so much', 'Thanks a million']],
    [/Thank you for (.+?)\./g, ['Thanks so much for $1!', 'Thank you for $1! 😊']],
    [/We're so happy/g, ["We're thrilled", "We're so glad", "We're over the moon"]],
    [/Hope to see you again soon!?/gi, ['Hope to see you again soon! 😊', "Can't wait to see you again! 🍕", 'See you soon! ❤️']],
    [/Let me check (.+?) and get back to you\./gi, ["Let me check $1 and I'll get right back to you! 😊"]],
  ],
  casual: [
    [/Thank you so much/g, ['Thanks a ton', 'Thanks a lot', 'Big thanks']],
    [/Thank you/g, ['Thanks', 'Cheers', 'Thanks a lot']],
    [/We are /g, ["We're "]], [/We would/g, ["We'd"]], [/Could you/g, ['Can you']],
    [/Hope to (?:welcome you back|see you again) soon/gi, ['See you soon', 'Catch you soon', 'Come by again soon']],
    [/Absolutely/g, ['Sure', 'Of course']],
    [/We look forward to welcoming you again\.?/g, ['See you soon!', 'Come by again soon!']],
  ],
  professional: [
    [/Thanks a ton|Thanks so much|Thanks a lot|Thanks a million|Big thanks|Thanks|Cheers/g, ['Thank you', 'Thank you very much']],
    [/Aww, |Honestly, /g, ['']],
    [/We're (?:so happy|really glad|so glad|thrilled|stoked)|So happy|Really glad|Glad/g, ['We are pleased', 'We are delighted', 'We are glad']],
    [/Hope to see you again soon!?|Hope we see you back soon!?|See you (?:again )?soon!?|Come by again soon!?/gi, ['We look forward to welcoming you again.', 'We hope to see you at Crustica again soon.']],
    [/Let me check/g, ['We will check']],
    [/Could you message us directly\?/g, ['Please contact us directly.']],
    [/Can you/g, ['Could you']],
  ],
};
const MORE_LINES = {
  pos: ['We put a lot of care into every pizza, so hearing this makes our day.', 'The whole team will be so happy to read this.', "We'd love to hear what you try next time."],
  neg: ["We've noted this with the team.", "We'd like to understand what happened so we can do better.", 'We want every visit to be a good one.'],
  ask: ["Let us know if there's anything else we can help with.", 'Happy to help with anything else you need.'],
};
function applyBank(t, bank, v) {
  let n = 0;
  for (const [re, alts] of bank) t = t.replace(re, (m, g1) => alts[(v + n++) % alts.length].replace(/\$1/g, g1 || ''));
  return t;
}
const fixCaps = (t) => t.replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
const PLEASANTRY = /see you|hope|come by|drop by|drop in|thanks for choosing|glad you chose|look forward|can't wait|catch you/i;

function transform(text, key, o = {}) {
  let t = text, sig = '';
  const idx = t.lastIndexOf('\n—');
  if (idx > -1) { sig = t.slice(idx); t = t.slice(0, idx); }
  const v = Math.abs(parseInt(o.variant, 10) || 0);
  const sents = splitSentences(t);
  switch (key) {
    case 'shorter': {
      let keep = sents.filter((x) => !PLEASANTRY.test(x));
      if (!keep.length) keep = sents.slice(0, 1);
      if (keep.length > 2) keep = [keep[0], keep[keep.length - 1]];
      if (keep.length === sents.length && keep.length > 1) keep = keep.slice(0, 1);
      t = keep.join(' ');
      break;
    }
    case 'longer':
    case 'detailed': {
      const ctx = /sorry|honest|feedback|let us know what happened/i.test(t) ? 'neg' : /\?|check|branch|get back to you/i.test(t) ? 'ask' : 'pos';
      const lines = MORE_LINES[ctx].filter((x) => !t.includes(x));
      const add = [lines[v % lines.length], lines[(v + 1) % lines.length]].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 2);
      const closer = sents.length > 1 && PLEASANTRY.test(sents[sents.length - 1]) ? sents[sents.length - 1] : '';
      t = closer ? `${sents.slice(0, -1).join(' ')} ${add.join(' ')} ${closer}` : `${t} ${add.join(' ')}`;
      break;
    }
    case 'casual':
      t = fixCaps(applyBank(t, BANK.casual, v));
      break;
    case 'friendly': {
      const before = t;
      t = applyBank(t, BANK.friendly, v);
      if (!/sorry/i.test(t)) t = t.replace(/\.(\s|$)/, '!$1');
      if (!/[❤️😊🍕]/.test(t)) t += v % 2 ? ' 🍕' : ' 😊';
      else if (t === before && !/see you|welcome you|hope/i.test(t)) t += ' Hope to see you soon! 😊';
      break;
    }
    case 'professional':
      t = fixCaps(applyBank(t.replace(EMOJI_RE, ''), BANK.professional, v).replace(/!+/g, '.').split("We'll").join('We will').split("we'll").join('we will').split("We're").join('We are').split("we're").join('we are').split("I'll").join('I will'));
      break;
    case 'human': {
      const before = t;
      t = fixCaps(applyBank(scrub(t), BANK.human, v));
      if (t === before) t += [' Really glad you reached out. ❤️', " Hope that helps! 😊", ' Thanks again, truly.'][v % 3];
      break;
    }
    case 'polite':
      if (!/thank/i.test(t)) t = 'Thank you for reaching out. ' + t;
      t = t.replace(/\bPlease reach out/g, 'Please do reach out').replace(/\bWe'll\b/g, 'We will');
      if (!/please|kindly/i.test(t)) t += ' Please let us know if we can help in any way.';
      break;
    case 'premium':
      t = t.replace(/Thank you so much/g, 'Thank you').replace(/We're so (happy|glad)/g, "We're delighted").replace(/See you again soon!?/g, 'We look forward to welcoming you again.').replace(/Hope to see you again soon/g, "We'd be delighted to welcome you again").replace(/!+/g, '.').replace(EMOJI_RE, '');
      t = tidy(t) + (/sorry/i.test(t) ? '' : ' 🌿');
      break;
    case 'emotional':
      t = t.replace(/^Thank you so much/, 'From the bottom of our hearts, thank you').replace(/^Thank you/, 'Truly, thank you').replace(/^Thanks/, 'Truly, thanks');
      if (!/❤️/.test(t)) t += ' ❤️';
      if (!/means (so )?(a lot|the world)/i.test(t)) t = t.replace(/\s*(❤️)?$/, ' It means more than you know.$1');
      break;
    case 'lessai':
    case 'natural':
      t = scrub(t).replace(/\bWe are\b/g, "We're").replace(/\bWe will\b/g, "We'll").replace(/\bdo not\b/gi, "don't").replace(/\bThank you for (?:your )?(?:valuable )?(?:feedback|review)\b\.?/g, 'Thanks for telling us').replace(/Dear [^,]+,\s*/g, '').replace(/Kindly /g, 'Please ');
      t = t.replace(/\b(Furthermore|Moreover|Additionally),?\s*/g, '').replace(/\bassist you\b/g, 'help you').replace(/\bregarding\b/g, 'about');
      break;
    case 'warmth':
      if (!/❤️/.test(t)) t = t.replace(/([.!])(\s|$)/, '$1 ❤️$2');
      if (!/hope|see you|welcome/i.test(t)) t += ' Hope to see you soon.';
      break;
    case 'noemoji': t = t.replace(EMOJI_RE, ''); break;
    case 'instagram': t = limitEmoji(sents.slice(0, 2).join(' ').replace(/\s+/g, ' '), 'natural'); if (!EMOJI_RE.test(t)) t += ' 🍕'; EMOJI_RE.lastIndex = 0; sig = ''; break;
    case 'google': if (!/team/i.test(t)) t += ' — Team Crustica'; break;
    case 'owner':
      t = t.replace(/^This honestly made our day!/, 'This honestly made my day!').replace(/\bour team\b/g, 'me and our team');
      sig = '\n— Owner, Crustica';
      break;
    default: break;
  }
  return tidy(t) + sig;
}

/* Improve my reply */
const HUMANIZE_MAP = [
  [/sorry for (?:your|the) bad experience/gi, "We're sorry your experience wasn't what you expected"],
  [/sorry for (?:any )?inconvenience(?: caused)?/gi, "we're sorry about this"],
  [/we will check (?:this|the) issue/gi, "we'll definitely look into this with our team"],
  [/we will look into (?:this|it)/gi, "we'll look into this with our team"],
  [/please (?:visit|come) again/gi, 'hope to welcome you back soon'],
  [/thanks? for (?:the )?feedback/gi, 'thank you for taking the time to share this'],
];
function improve(reply, o = {}) {
  let base = clean(reply);
  for (const [re, rep] of HUMANIZE_MAP) base = base.replace(re, rep);
  base = scrub(base).replace(/\bwe're\b/g, "We're");
  base = base.replace(/(^|[.!?]\s)([a-z])/g, (m, p, c) => p + c.toUpperCase());
  if (!/[.!?]$/.test(base)) base += '.';
  const thanks = 'Thank you for taking the time to share it with us.';
  const human = /thank/i.test(base) ? base : `${base} ${thanks}`;
  const variants = [
    ['human', 'More human', human],
    ['polite', 'More polite', (/thank/i.test(base) ? '' : 'Thank you for letting us know. ') + base.replace(/\bWe'll\b/, 'We will') + ' Please feel free to reach out to us directly if you would like to talk this through.'],
    ['professional', 'More professional', tidy(base.replace(EMOJI_RE, '').replace(/!/g, '.').replace(/\bWe'll\b/g, 'We will').replace(/\bwe'll\b/g, 'we will')) + (/thank/i.test(base) ? '' : ' Thank you for sharing your experience.')],
    ['friendly', 'More friendly', human.replace(/\.$/, '') + '. Hope to see you again soon ❤️🍕'],
    ['shorter', 'Shorter', splitSentences(base)[0] || base],
  ];
  return variants.map(([id, label, t]) => ({ id, label, text: limitEmoji(tidy(t), o.emoji || 'natural') }));
}

export {
  correctTypos, topicList, capSentences, analyze, generate, transform, improve, scrub, limitEmoji, qualityIssues, clean, finalize, detectIntent, analyzeIntents, extractEntities, extractTopics,
  scoreRules, INTENT_RULES, TRANSFORMS, QUICK, COLLAB_LABELS, DEFAULT_BRAND, detectIntents, NAMED_LABEL, fmtINR, parseAmount,
};
