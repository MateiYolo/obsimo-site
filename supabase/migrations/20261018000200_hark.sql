-- Vente à Hark (disquaire) : 5 Life Balance à 13 €, déjà payés, comptés en septembre 2026 (jour inconnu : le 15).
-- 2 vert transparent (fin du tirage 2025) et 3 swirl. Canal Disquaire : pas de commission, ni seuil ni reversement.
-- Idempotent (external_id).

select public.merch_record_sale('{
  "channel": "wholesale", "external_id": "hark-2026-09", "occurred_at": "2026-09-15 12:00 Europe/Paris",
  "payment_method": "transfer", "total_cents": 6500, "fees_cents": 0, "note": "Hark",
  "lines": [
    {"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 2, "unit_price_cents": 1300},
    {"product_id": "life-balance-swirl", "label": "Vinyle Life Balance swirl", "qty": 3, "unit_price_cents": 1300}
  ]
}'::jsonb);
