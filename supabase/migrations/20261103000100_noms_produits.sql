-- ⚠️ NE PLUS LANCER À LA MAIN : appliqué automatiquement par le serveur (api/_lib/patches.js) au premier chargement
-- du dashboard. Gardé pour mémoire.
-- Noms des produits au même format partout : « Type / Nom » (3 nov. 2026). Peut être relancé sans risque.
-- Le nom sert à l'affichage et aux ventes saisies à la main ; Shopify et SumUp sont reliés par leurs handles et noms
-- en caisse, qui ne changent pas.
update public.merch_products as p set name = v.name
  from (values
    ('8-days-in-sweden', 'Vinyle / 8 Days in Sweden'),
    ('life-balance-swirl', 'Vinyle / Life Balance (swirl)'),
    ('life-balance-plus', 'Vinyle / Life Balance + (transparent édition 2)'),
    ('life-balance-vert', 'Vinyle / Life Balance (transparent édition 1)'),
    ('bundle-vinyles', 'Pack / 8 Days in Sweden + Life Balance'),
    ('sauce-piquhans', 'Hot sauce / Piqu''hans'),
    ('carte-postale', 'Carte postale / Vinyle'),
    ('affiche', 'Affiche / Tournée')
  ) as v(id, name)
 where p.id = v.id;
