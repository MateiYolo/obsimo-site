// Tour dates from Bandsintown. Configure VITE_BANDSINTOWN_APP_ID (Bandsintown for Artists → Settings → General →
// Get API key) in .env.local. VITE_BANDSINTOWN_ARTIST can override the artist: a name, or "id_<artist id>".
// Without a key no dates are shown.

const ARTIST = import.meta.env.VITE_BANDSINTOWN_ARTIST || 'Obsimo';
const APP_ID = import.meta.env.VITE_BANDSINTOWN_APP_ID;

export const bandsintownEnabled = !!(ARTIST && APP_ID);

// venues Bandsintown only knows by their street address: address (lowercase, without spaces) → real venue name
const VENUES = {
  amwriezenerbhf: 'Kantine am Berghain',
  amwriezenerbahnhof: 'Kantine am Berghain',
};
const venueFromAddress = (a = '') => VENUES[a.toLowerCase().replace(/[\s.]/g, '')] || a;

const toEvent = (e) => {
  const offer = e.offers?.find((o) => o.type === 'Tickets') || e.offers?.[0];
  return {
    id: e.id,
    datetime: e.datetime,
    // events without a real venue on Bandsintown get the event title as venue name: show the address instead
    venue: (e.venue?.name && e.venue.name !== e.title ? e.venue.name : venueFromAddress(e.venue?.street_address)) || e.venue?.name || '',
    city: e.venue?.city || '',
    country: e.venue?.country || '',
    tickets: offer?.url || null,
    soldOut: offer?.status === 'sold out' || e.sold_out === true,
    url: e.url,
  };
};

let cache;
export function fetchDates() {
  if (!bandsintownEnabled) return Promise.resolve([]);
  cache ??= fetch(`https://rest.bandsintown.com/artists/${encodeURIComponent(ARTIST)}/events?app_id=${APP_ID}&date=upcoming`)
    .then(async (res) => {
      // a wrong app_id comes back as 401/403 (or an error object): say so instead of showing an empty tour
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body)) {
        throw new Error(`Bandsintown ${res.status} ${body?.message || body?.Message || body?.errorMessage || ''}`.trim());
      }
      return body.map(toEvent);
    })
    .catch((e) => {
      cache = null; // retry next time the page opens
      throw e;
    });
  return cache;
}
