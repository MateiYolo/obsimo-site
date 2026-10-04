// Import quotidien des ventes SumUp (cron Vercel, voir vercel.json). Protégé par CRON_SECRET.

import { isCron } from '../_lib/auth.js';
import { sumupConfigured, syncSumup } from '../_lib/sumup.js';

export async function GET(request) {
  if (!isCron(request)) return new Response('Non autorisé', { status: 401 });
  if (!sumupConfigured()) return new Response('SumUp non configuré');
  try {
    return Response.json(await syncSumup());
  } catch (e) {
    console.error('cron sumup', e);
    return new Response(e.message, { status: 500 });
  }
}
