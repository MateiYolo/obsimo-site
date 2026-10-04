// Webhook Shopify : chaque commande payée devient une vente et sort le stock ; une commande remboursée ou annulée
// le remet. À brancher sur « Paiement de commande » et « Mise à jour de commande » (JSON), voir le README.

import { verifyWebhook, syncOrder } from '../_lib/shopify.js';
import { products, setting } from '../_lib/db.js';

const TOPICS = ['orders/paid', 'orders/updated', 'orders/cancelled', 'orders/create'];

export async function POST(request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers.get('x-shopify-hmac-sha256'))) {
    return new Response('Signature invalide', { status: 401 });
  }
  const topic = request.headers.get('x-shopify-topic');
  if (!TOPICS.includes(topic)) return new Response('ignoré');
  try {
    const [list, fees] = await Promise.all([products(), setting('fees')]);
    const result = await syncOrder(JSON.parse(raw), list, fees);
    return new Response(result);
  } catch (e) {
    // une erreur renvoie 500 : Shopify réessaiera (jusqu'à 8 fois sur 4 h), l'import est idempotent
    console.error('webhook shopify', topic, e);
    return new Response('erreur', { status: 500 });
  }
}
