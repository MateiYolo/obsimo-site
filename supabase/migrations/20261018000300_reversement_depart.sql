-- Reversement au frère (Matei) : 200 € dus au 18 oct. 2026, puis 2 € par vinyle seulement sur les ventes à partir de
-- cette date. Déjà en base (ajouté le 18 oct. 2026 à 13 h 19 UTC) ; ne fait rien s'il existe. Modifiable dans Réglages.
insert into public.merch_settings (key, value)
  values ('royalty', '{"name": "Matei", "opening_cents": 20000, "since": "2026-10-18T13:19:32Z"}')
  on conflict (key) do nothing;
