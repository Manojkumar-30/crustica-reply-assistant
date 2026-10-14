export const PLATFORM_CHIPS = [['google', 'Google Review'], ['instagram', 'Instagram'], ['customer', 'Customer'], ['influencer', 'Influencer'], ['whatsapp', 'WhatsApp']];
export const PLATFORM_MAP = {
  google: { category: 'google', platform: 'Google Maps', title: 'Google' },
  instagram: { category: 'instagram', platform: 'Instagram Comment', title: 'Instagram' },
  influencer: { category: 'influencer', platform: 'Influencer DM', title: 'Influencer' },
  whatsapp: { category: 'customer', platform: 'WhatsApp', title: 'WhatsApp' },
  customer: { category: 'customer', platform: 'General Customer Message', title: 'Customer' },
  '': { category: 'customer', platform: 'General Customer Message', title: 'Customer' },
};
export const OBJ_CHIPS = [['interested', 'Interested'], ['negotiate', 'Negotiate'], ['ratecard', 'Ask Rate'], ['barter', 'Barter'], ['decline', 'Decline'], ['followup', 'Follow Up']];
export const TONE_PRESETS = {
  warm: { label: 'Warm & Human', tones: ['warm', 'friendly'] },
  friendly: { label: 'Friendly', tones: ['friendly'] },
  professional: { label: 'Professional', tones: ['professional'] },
  casual: { label: 'Casual', tones: ['casual', 'friendly'] },
  premium: { label: 'Premium', tones: ['premium', 'warm'] },
};
export const EXAMPLES = [
  { label: '5★ Review', platform: 'google', rating: 5, text: 'Gave up on Dominos and Pizza Hut for their veg options.' },
  { label: 'Complaint', platform: 'google', rating: 1, text: 'Visited this place last weekend. Pathetic experience. The pasta was bland and the mojitos were too salty.' },
  { label: 'Influencer', platform: 'influencer', text: "Hi, I'm a food creator with 100K followers. Interested in collaboration?" },
  { label: 'Sourdough', platform: 'instagram', ig: 'Instagram Comment', text: 'Loved the sourdough crust! 😍' },
  { label: 'Jain question', platform: 'customer', text: 'Do you have Jain options?' },
  { label: 'Timing question', platform: 'whatsapp', text: 'What time do you close today?' },
];
export const REPHRASE_OPTIONS = [['human', 'More Human'], ['friendly', 'More Friendly'], ['professional', 'More Professional'], ['shorter', 'Short'], ['longer', 'Detailed'], ['casual', 'Casual'], ['premium', 'Premium'], ['noemoji', 'No Emoji']];
export const TONE_CHIPS = [['warm', 'Human'], ['friendly', 'Friendly'], ['professional', 'Professional'], ['casual', 'Casual']];
export const LENGTH_CHIPS = [['short', 'Short'], ['medium', 'Medium'], ['detailed', 'Detailed']];
export const EMOJI_CHIPS = [['none', 'Off'], ['natural', 'Natural'], ['fun', 'Fun']];
export const STRATEGIES = [['accept', 'Accept'], ['negotiate', 'Negotiate'], ['deliverables', 'Ask for Deliverables'], ['barter', 'Offer Barter'], ['decline', 'Decline']];

/** Short title for saved/history items, e.g. "Google – 5 Star". */
export function titleFor(rec) {
  const base = (PLATFORM_MAP[rec.platformKey] || {}).title || (rec.category === 'google' ? 'Google' : rec.category === 'instagram' ? 'Instagram' : rec.category === 'influencer' ? 'Influencer' : 'Customer');
  if (base === 'Google' && rec.rating) return `Google – ${rec.rating} Star`;
  if (base === 'Instagram' && rec.igKind) return `Instagram – ${rec.igKind === 'Instagram DM' ? 'DM' : 'Comment'}`;
  return base;
}
/** Filter group for Saved/History: Google, Instagram, Influencer, or Customer (which includes WhatsApp). */
export function groupOf(rec) {
  const k = rec.platformKey || '';
  if (k === 'google' || rec.category === 'google') return 'Google';
  if (k === 'instagram' || rec.category === 'instagram') return 'Instagram';
  if (k === 'influencer' || rec.category === 'influencer') return 'Influencer';
  return 'Customer';
}
