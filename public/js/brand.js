/** What the assistant is allowed to say as fact. Anything null/empty is never invented: replies say "let me check". */
export const brandKnowledge = {
  restaurantName: 'Crustica Pizza',
  tagline: 'For The Love Of Veg',
  branches: [],
  openingHours: null,
  deliveryAreas: [],
  menuUrl: null,
  currentOffers: [],
  reservationAvailable: false,
  phone: null,
  instagram: null,
  // extras used by the answer rules
  jain: null,
  prices: null,
  locations: null,
  payments: null,
  reservationNote: null,
};

/** Build the knowledge object from the settings stored in this browser. */
export function knowledgeFrom(settings) {
  const b = settings.brand || {};
  const lines = (t) => String(t || '').split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  return {
    ...brandKnowledge,
    restaurantName: b.name || brandKnowledge.restaurantName,
    tagline: b.tagline || brandKnowledge.tagline,
    branches: settings.branches || [],
    openingHours: b.hours || null,
    deliveryAreas: lines(b.delivery),
    menuUrl: /^https?:\/\//i.test(b.menuUrl || '') ? b.menuUrl : null,
    currentOffers: lines(b.offers),
    reservationAvailable: !!b.reservations,
    reservationNote: b.reservations || null,
    phone: b.contact || null,
    instagram: b.instagram || null,
    jain: b.jain || null,
    prices: b.prices || null,
    locations: b.locations || null,
    payments: b.payments || null,
  };
}
