// Mot de passe du dashboard /ventes (DASHBOARD_PASSWORD) et cookie de session signé.
// Le cookie vaut « expiration.signature » ; la clé dérive du mot de passe, donc en changer déconnecte tout le monde.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'ventes_session';
const DAYS = 60;

const password = () => process.env.DASHBOARD_PASSWORD || '';
const key = () => createHash('sha256').update(`obsimo-ventes|${password()}|${process.env.SESSION_SECRET || ''}`).digest();
const sign = (exp) => createHmac('sha256', key()).update(String(exp)).digest('base64url');

function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(given) {
  const pw = password();
  if (pw.length < 8) throw new Error('DASHBOARD_PASSWORD manquant ou trop court (8 caractères minimum)');
  // compare les empreintes : même durée quelle que soit la longueur tapée
  const h = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(given), h(pw));
}

export function sessionCookie() {
  const exp = Date.now() + DAYS * 864e5;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${DAYS * 86400}`;
}

export const logoutCookie = () => `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isLoggedIn(request) {
  if (password().length < 8) return false;
  const raw = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  return Number(exp) > Date.now() && same(sig, sign(exp));
}

// Appels planifiés (cron Vercel) : Vercel envoie « Authorization: Bearer $CRON_SECRET ».
export function isCron(request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && same(request.headers.get('authorization') || '', `Bearer ${secret}`);
}
