export const CATEGORIES = [
  { id: 'google', icon: 'star', title: 'Google Review', sub: 'For Google Maps reviews.' },
  { id: 'instagram', icon: 'camera', title: 'Instagram', sub: 'For comments, DMs and mentions.' },
  { id: 'influencer', icon: 'users', title: 'Influencer', sub: 'For collaboration, barter, pricing and creator messages.' },
  { id: 'customer', icon: 'chat', title: 'Customer Message', sub: 'For WhatsApp, direct messages and general communication.' },
  { id: 'complaint', icon: 'flag', title: 'Complaint', sub: 'For unhappy customers and negative feedback.' },
  { id: 'appreciation', icon: 'heart', title: 'Appreciation', sub: 'For positive customer feedback.' },
];
export const PLATFORMS = ['Google Maps', 'Instagram Comment', 'Instagram DM', 'Influencer DM', 'WhatsApp', 'Facebook', 'General Customer Message'];
export const TYPES = ['5 Star Positive', '4 Star Positive', '3 Star Mixed', '2 Star Negative', '1 Star Negative', 'Food Complaint', 'Service Complaint', 'Payment Complaint', 'Pricing Complaint', 'Delivery Complaint', 'Ambience Complaint', 'Collaboration Request', 'Influencer Proposal', 'Customer Question', 'Customer Appreciation', 'General'];
export const CATEGORY_DEFAULTS = {
  google: { platform: 'Google Maps', type: '5 Star Positive' },
  instagram: { platform: 'Instagram Comment', type: 'General' },
  influencer: { platform: 'Influencer DM', type: 'Collaboration Request' },
  customer: { platform: 'WhatsApp', type: 'General' },
  complaint: { platform: 'General Customer Message', type: 'Food Complaint' },
  appreciation: { platform: 'General Customer Message', type: 'Customer Appreciation' },
};
export const STAR_TYPES = { 1: '1 Star Negative', 2: '2 Star Negative', 3: '3 Star Mixed', 4: '4 Star Positive', 5: '5 Star Positive' };
export const TONES = [
  { id: 'warm', label: 'Warm' }, { id: 'friendly', label: 'Friendly' }, { id: 'premium', label: 'Premium' }, { id: 'professional', label: 'Professional' },
  { id: 'apologetic', label: 'Apologetic' }, { id: 'casual', label: 'Casual' }, { id: 'elegant', label: 'Elegant' }, { id: 'energetic', label: 'Energetic' },
];
export const LENGTHS = [{ id: 'short', label: 'Short' }, { id: 'medium', label: 'Medium' }, { id: 'detailed', label: 'Detailed' }];
export const LENGTH_HINT = { short: '1–2 sentences', medium: '3–5 sentences', detailed: '5–8 sentences' };
export const EMOJIS = [{ id: 'none', label: 'No Emoji' }, { id: 'minimal', label: 'Minimal' }, { id: 'natural', label: 'Natural' }, { id: 'fun', label: 'Fun' }];
export const LANGUAGES = [{ id: 'en', label: 'English' }, { id: 'kn', label: 'ಕನ್ನಡ Kannada' }, { id: 'hi', label: 'हिन्दी Hindi' }, { id: 'ta', label: 'தமிழ் Tamil' }, { id: 'mixed', label: 'Mixed (English + local)' }];
export const WHO = [{ id: 'team', label: 'Crustica Team' }, { id: 'manager', label: 'Restaurant Manager' }, { id: 'owner', label: 'Owner' }, { id: 'social', label: 'Social Media Team' }, { id: 'support', label: 'Customer Support' }];
export const OBJECTIVES = [
  ['first', 'First Reply'], ['interested', 'Interested'], ['ratecard', 'Ask Rate Card'], ['mediakit', 'Ask Media Kit'], ['barter', 'Barter'], ['paid', 'Paid'],
  ['negotiate', 'Negotiate'], ['betterprice', 'Ask Better Price'], ['deliverables', 'Ask Deliverables'], ['counter', 'Counter Offer'], ['accept', 'Accept'], ['availability', 'Ask Availability'], ['confirmvisit', 'Confirm Visit'],
  ['followup', 'Follow-Up'], ['aftervisit', 'After Visit'], ['decline', 'Decline Politely'],
];
export const REPHRASE = [['natural', 'More natural'], ['polite', 'More polite'], ['casual', 'More casual'], ['premium', 'More premium'], ['emotional', 'More emotional'], ['shorter', 'Shorter'], ['longer', 'Longer'], ['lessai', 'Less AI-like']];
export const QUICK = [['shorter', 'Make it shorter'], ['human', 'Make it more human'], ['polite', 'Make it polite'], ['premium', 'Make it premium'], ['warmth', 'Add a little warmth'], ['noemoji', 'Remove emojis'], ['instagram', 'Instagram style'], ['google', 'Google review style'], ['owner', 'Sound like the owner'], ['lessai', "Don't sound AI-generated"]];
export const SAVED_GROUPS = ['Google Reviews', 'Instagram', 'Influencers', 'Complaints', 'Positive Reviews', 'General'];

export const DEFAULT_SETTINGS = {
  brand: {
    name: 'Crustica Pizza', tagline: 'For The Love Of Veg',
    description: 'Artisan vegetarian sourdough pizza. 100% vegetarian, slow-fermented sourdough, fresh ingredients, casual premium experience and a welcoming atmosphere.',
    signature: '— Team Crustica 🍕', contact: '', emojis: '🍕 ❤️ 🌿 😊 🙏', preferredTone: 'warm',
    dishes: 'Sourdough pizza, Pasta, Mojito', complaints: 'Service waiting time, Payment experience', policies: '',
    instagram: '', google: '',
    hours: '', delivery: '', jain: '', menuUrl: '', offers: '', reservations: '', prices: '', locations: '',
  },
  colors: { primary: '#0F5132', accent: '#C0392B' },
  branches: ['Crustica Pizza – Banaswadi', 'Crustica Pizza – Kalyan Nagar', 'Crustica Pizza – Kammanahalli', 'Crustica Pizza – Rajasthan'],
  branch: '',
  defaults: { tones: ['warm', 'friendly'], length: 'medium', emoji: 'natural', language: 'en', who: 'team', signature: true },
};

export const DEMOS = [
  { id: 1, group: 'Google Review', title: '5 Star Google Review', category: 'google', rating: 5, text: 'Gave up on Dominos and Pizza Hut for their veg options.' },
  { id: 2, group: 'Google Review', title: 'Negative Google Review', category: 'google', rating: 1, text: "Visited this place last weekend. Pathetic experience. They don't accept cash and forced us to pay prepaid, and there's no discount on anything even though other places give offers. The pizza was just average, the pasta was bland and the mojito was too salty. Everything is self-service so I don't understand what we are paying for. Not going back." },
  { id: 3, group: 'Instagram', title: 'Instagram Comment', category: 'instagram', platform: 'Instagram Comment', text: 'Best pizza ever 😍' },
  { id: 4, group: 'Influencer', title: 'Influencer DM', category: 'influencer', platform: 'Instagram DM', text: "Hi, we'd love to collaborate with Crustica. We have 100K followers. Can you let us know your collaboration budget?" },
  { id: 5, group: 'Complaint', title: 'Customer Complaint', category: 'complaint', type: 'Service Complaint', text: 'Pizza was good but the service was very slow.' },
  { id: 6, group: 'Appreciation', title: 'Customer Appreciation', category: 'appreciation', text: 'Loved the ambience and sourdough crust. Will definitely come again.' },
];
export const PLACEHOLDERS = {
  google: 'Paste the Google review here…', instagram: 'Best pizza ever 😍', influencer: 'Hi, we’d love to collaborate with Crustica…',
  customer: 'Loved the pizza, but the service was slow…', complaint: 'Paste the complaint here…', appreciation: 'Loved the sourdough base. Best veg pizza I’ve had in Bangalore.',
};
