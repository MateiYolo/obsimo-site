// Retrouve le concert d'une vente en caisse à partir des dates Bandsintown du site (VITE_BANDSINTOWN_APP_ID) :
// une vente faite entre 8 h et 8 h le lendemain appartient au concert de ce jour-là (heure de Paris).

const TZ = 'Europe/Paris';
const dayOf = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date); // AAAA-MM-JJ

export async function eventFinder() {
  const appId = process.env.VITE_BANDSINTOWN_APP_ID || process.env.BANDSINTOWN_APP_ID;
  const artist = process.env.VITE_BANDSINTOWN_ARTIST || 'Obsimo';
  const byDay = new Map();
  if (appId) {
    try {
      const res = await fetch(
        `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events?app_id=${encodeURIComponent(appId)}&date=all`,
      );
      for (const e of (await res.json()) || []) {
        const day = String(e.datetime || '').slice(0, 10); // datetime est en heure locale du lieu
        const where = [e.venue?.city, e.venue?.name].filter(Boolean).join(' · ');
        if (day && where) byDay.set(day, where);
      }
    } catch {}
  }
  return (timestamp) => {
    if (!timestamp) return null;
    const day = dayOf(new Date(new Date(timestamp).getTime() - 8 * 3600e3));
    return byDay.get(day) || null;
  };
}
