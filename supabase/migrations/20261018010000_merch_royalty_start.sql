-- Reversement au frère : 200 € dus au 18 oct. 2026, puis 2 € par vinyle sur les ventes à partir de cette date.
-- Le 1er Life Balance (vert transparent, 300 ex.) est épuisé : archivé, on ne vend plus que le swirl.
-- Déjà appliqué sur la base Obsimo le 18 oct. 2026.
insert into public.merch_settings (key, value)
  values ('royalty', '{"name": "Matei", "opening_cents": 20000, "since": "2026-10-18T13:19:32Z"}')
  on conflict (key) do nothing;
update public.merch_products set active = false where id = 'life-balance';
