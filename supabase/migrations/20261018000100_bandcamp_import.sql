-- Ventes Bandcamp jusqu'au 18 oct. 2026 (export CSV des commandes merch, 20 commandes, 21 lignes ; le fichier,
-- qui contient des données personnelles, n'est pas versionné). Règles validées avec Obsimo :
--   - chaque article au prix Shopify (les prix Bandcamp étaient majorés pour compenser la commission), commission 0 ;
--   - la commande du 20/12/2025 (50 € pour 1 vinyle) compte pour 1 vinyle à 25 € ;
--   - taxes exclues (ce n'est pas du CA), port facturé repris dans le total (à confirmer par Obsimo) ;
--   - tous les Life Balance sont antérieurs au 7 sept. 2026 : vert transparent.
-- Idempotent : external_id = id de transaction Bandcamp. Heure inconnue : midi à Paris.

select public.merch_record_sale(o.p || jsonb_build_object(
         'channel', 'bandcamp',
         'fees_cents', 0,
         'total_cents', (select sum((l->>'qty')::int * (l->>'unit_price_cents')::int) from jsonb_array_elements(o.p->'lines') l)
                        + (o.p->>'shipping_cents')::int))
  from (values
    ('{"external_id": "1075058345", "occurred_at": "2024-08-28 12:00 Europe/Paris", "shipping_cents": 300, "lines": [{"product_id": "carte-postale", "label": "Carte postale vinyle", "qty": 1, "unit_price_cents": 1000}]}'::jsonb),
    ('{"external_id": "1121336347", "occurred_at": "2025-04-17 12:00 Europe/Paris", "shipping_cents": 450, "lines": [{"product_id": "carte-postale", "label": "Carte postale vinyle", "qty": 1, "unit_price_cents": 1000}]}'),
    ('{"external_id": "3283966454", "occurred_at": "2025-04-17 12:00 Europe/Paris", "shipping_cents": 600, "lines": [{"product_id": "carte-postale", "label": "Carte postale vinyle", "qty": 1, "unit_price_cents": 1000}]}'),
    ('{"external_id": "2160323544", "occurred_at": "2025-08-22 12:00 Europe/Paris", "shipping_cents": 600, "lines": [{"product_id": "carte-postale", "label": "Carte postale vinyle", "qty": 1, "unit_price_cents": 1000}]}'),
    ('{"external_id": "2134425500", "occurred_at": "2025-09-19 12:00 Europe/Paris", "shipping_cents": 800, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 2, "unit_price_cents": 2500}]}'),
    ('{"external_id": "4165264043", "occurred_at": "2025-09-25 12:00 Europe/Paris", "shipping_cents": 3500, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "1277763950", "occurred_at": "2025-09-26 12:00 Europe/Paris", "shipping_cents": 700, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "1579140194", "occurred_at": "2025-09-26 12:00 Europe/Paris", "shipping_cents": 1400, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "195446779", "occurred_at": "2025-10-01 12:00 Europe/Paris", "shipping_cents": 700, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "3849286002", "occurred_at": "2025-10-13 12:00 Europe/Paris", "shipping_cents": 700, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "1966005031", "occurred_at": "2025-10-17 12:00 Europe/Paris", "shipping_cents": 700, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "596076041", "occurred_at": "2025-10-29 12:00 Europe/Paris", "shipping_cents": 3500, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "2317096341", "occurred_at": "2025-12-04 12:00 Europe/Paris", "shipping_cents": 700, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "678594951", "occurred_at": "2025-12-11 12:00 Europe/Paris", "shipping_cents": 700, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "2099681522", "occurred_at": "2025-12-17 12:00 Europe/Paris", "shipping_cents": 3500, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "803616520", "occurred_at": "2025-12-20 12:00 Europe/Paris", "shipping_cents": 3500, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}]}'),
    ('{"external_id": "398892719", "occurred_at": "2026-02-07 12:00 Europe/Paris", "shipping_cents": 3800, "lines": [{"product_id": "life-balance-vert", "label": "Vinyle Life Balance vert transparent", "qty": 1, "unit_price_cents": 2500}, {"product_id": "sauce-piquhans", "label": "Sauce piquante Piqu''hans", "qty": 1, "unit_price_cents": 800}]}'),
    ('{"external_id": "3602846256", "occurred_at": "2026-08-21 12:00 Europe/Paris", "shipping_cents": 300, "lines": [{"product_id": "carte-postale", "label": "Carte postale vinyle", "qty": 1, "unit_price_cents": 1000}]}'),
    ('{"external_id": "1632526429", "occurred_at": "2026-09-30 12:00 Europe/Paris", "shipping_cents": 2800, "lines": [{"product_id": "8-days-in-sweden", "label": "Vinyle 8 Days in Sweden (précommande)", "qty": 1, "unit_price_cents": 3000}]}'),
    ('{"external_id": "3075521990", "occurred_at": "2026-10-02 12:00 Europe/Paris", "shipping_cents": 700, "lines": [{"product_id": "8-days-in-sweden", "label": "Vinyle 8 Days in Sweden (précommande)", "qty": 1, "unit_price_cents": 3000}]}')
  ) o(p);
