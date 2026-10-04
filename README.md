# Obsimo · Shop

Boutique headless pour Obsimo : une seule page qui défile, avec uniquement les produits en 3D qui tournent sur eux-mêmes
(rotation au doigt ou à la souris, torsion à deux doigts). Un clic ouvre la fiche : infos, prix, photos, panier, extraits audio.
Le catalogue et le paiement viennent de Shopify (Storefront API), et le checkout reste hébergé par Shopify.

```bash
npm install
npm run dev        # http://localhost:5173 (et sur ton réseau local pour tester sur téléphone)
npm run build
```

## Brancher Shopify

1. Admin Shopify → Paramètres → Applications → Développer des applications → créer une app, activer la
   **Storefront API** (lecture produits + paniers) et copier le jeton public.
2. `cp .env.example .env.local`, puis renseigner `VITE_SHOPIFY_DOMAIN` et `VITE_SHOPIFY_TOKEN`.

Sans ces variables, le site utilise le catalogue de démo de `src/catalog.js`.

### Conventions dans l'admin

- **Type de produit ou tag** `vinyle` → modèle vinyle, `sauce` → bouteille, sinon une carte simple.
- **Texte alternatif des images** : `cover`, `back`, `disc` (PNG vu de dessus, fond transparent) ou `label` sont
  utilisés par la 3D ; toutes les autres images sont les photos de la page détail.
- **Métachamps** (namespace `custom`) : `preview_audio` (URL d'un mp3 de 30 s), `accent` (couleur hex),
  `kicker` (ligne courte), `details` (JSON `[{"title","body"}]`), et pour les sauces `liquid`, `label`, `ink`, `heat`.

## Langues (FR / EN)

Le site s'affiche en français si la première langue du navigateur est le français, en anglais pour tout le reste.
`?lang=fr` ou `?lang=en` force une langue (pratique pour tester), tout comme le lien « English / Français » du footer ;
le choix est gardé dans le navigateur. Les textes de l'interface sont dans `src/i18n.js` (les éléments de
`index.html` portent un attribut `data-i18n*`, leur version française reste dans le HTML pour Google).

**Fiches produits** : le titre, l'accroche et la description des 5 produits sont dans `src/catalog.js` (`COPY`),
en français et en anglais (l'anglais reprend le texte de la fiche Shopify, le français est sa traduction). Ils
remplacent ceux de Shopify champ par champ : **modifier le texte d'une fiche se fait donc là**, dans les deux
langues ; Shopify garde le prix, le stock, les photos et les champs absents de `COPY`. Un produit absent de `COPY`
affiche le texte Shopify, demandé dans la langue du visiteur (`@inContext`, traductions de l'app Translate & Adapt).
Le checkout Shopify s'ouvre aussi dans la langue du visiteur.

## Brancher Bandsintown (page Tour)

La page Tour (`/#tour`) liste les prochaines dates et se met à jour toute seule à partir de ton compte Bandsintown.

1. [Bandsintown for Artists](https://artists.bandsintown.com) → Settings → General → **Get API key**.
2. Dans `.env.local` : `VITE_BANDSINTOWN_APP_ID=` suivi de la clé. L'artiste est `Obsimo` par défaut
   (`VITE_BANDSINTOWN_ARTIST` permet d'en changer, avec un nom ou `id_<identifiant>`).

Sans clé, la page n'affiche aucune date. Chaque ligne (date · ville · lieu) mène à la billetterie Bandsintown ;
une date marquée sold out s'affiche barrée et n'est plus cliquable.

## Vinyle 3D haute fidélité

Le vinyle reprend le modèle du [mockup-vinyl-generator](https://github.com/MateiYolo/mockup-vinyl-generator)
(`src/hifi/objects.js` et `src/hifi/textures.js`, copiés tels quels à part un point d'entrée pour les textures) :
disque avec sillons et reflet anisotrope, étiquettes papier, pochette arrondie avec vernis sélectif.

Ses textures procédurales (sillons, fibres du carton, papier des étiquettes, vernis) prendraient 1 à 2 s de calcul au
chargement ; elles sont donc précalculées dans `public/assets/hifi/baked/` (~850 Ko). À relancer après un changement
de `src/hifi/textures.js` ou un nouveau masque de vernis (`varnishFront` / `varnishBack` dans `src/catalog.js`) :
`npm run dev`, puis ouvrir `/bake.html` et attendre « terminé ». Un masque pas encore baké marche quand même, mais est
calculé au chargement (avertissement dans la console).

Champs `model` d'un vinyle : `cover`, `back`, `disc` (PNG du disque vu de dessus, fond transparent), `label`, `labelB`,
`varnishFront`, `varnishBack` (masques du vernis), ou à défaut des couleurs : `sleeve`, `edge`, `discFill`, `discColor`.

## Structure

- `src/scene.js` : le canvas WebGL unique ; chaque objet suit un emplacement vide de la page (scroll natif), rotation et transition vers la fiche
- `src/ventes/`, `api/`, `supabase/` : le dashboard des ventes (voir plus bas)
- `src/models.js` : vinyle (pochette + disque qui sort et tourne), bouteille de sauce, carte générique

## Bouteille de sauce

La bouteille reprend les proportions de la vraie (50 ml, corps droit, épaule ronde, long goulot, bouchon à vis).
Champs `model` d'une sauce : `art` (l'étiquette à plat, encre noire sur blanc, 104 × 67 mm), `holo` (le blanc devient
un sticker holographique dont les reflets arc-en-ciel bougent avec l'angle), `liquid`, `cap`, `capMetal`, ou à défaut
d'`art` une étiquette dessinée dans le code : `label`, `ink`, `heat`. L'étiquette de La Sauce Piqu'hans est
`public/assets/sauce/piquhans-label.webp`, rendue depuis le PDF d'impression.

## Carte postale vinyle

Une carte postale qui se joue sur platine (152 × 105,7 mm, trou central sur l'axe). Au recto, le visuel sous un film
gravé : les sillons sont calculés dans le shader (reflet anisotrope qui suit les cercles autour du trou, quelques
silences entre les pistes, un léger arc-en-ciel selon l'angle). Au dos, une carte postale classique (trait central,
lignes d'adresse) avec le sticker holographique Obsimo en guise de timbre. Un produit Shopify dont le titre contient « carte postale » ou « postcard » prend
ce modèle. Champs `model` : `recto` (le visuel, centré sur le trou), `sticker` (encre noire sur blanc, fond
transparent, tiré du PDF d'impression). Fichiers dans `public/assets/postcard/`.
- `src/hifi/` : modèle du vinyle repris du mockup-vinyl-generator, chargement des textures précalculées (`baked.js`) et leur génération (`bake.js`, page `bake.html`)
- `src/main.js` : liste, gestes de rotation, menu, page détail, galerie, panier
- `src/audio.js` : extraits audio (fichier ou boucle générative de démo)
- `src/shopify.js` : requêtes Storefront API et création du panier/checkout
- `src/tour.js` : dates de concert depuis l'API Bandsintown 

## SEO

- `index.html` : titre, description, canonical `https://www.obsimo.com/`, balises Open Graph (`public/og-image.jpg`),
  favicons, et un JSON-LD `MusicGroup` dont `sameAs` liste les profils officiels (Spotify, Bandcamp, Instagram…) :
  à tenir à jour avec les liens du footer.
- Les dates Bandsintown sont ajoutées en JSON-LD `MusicEvent` (`eventsLd` dans `src/main.js`).
- `public/robots.txt`, `public/sitemap.xml`. `vercel.json` renvoie `X-Robots-Tag: noindex` sur tout autre domaine que
  `www.obsimo.com` (URLs `*.vercel.app`), pour que Google n'indexe qu'une seule version du site.

## Dashboard des ventes (/ventes)

`obsimo.com/ventes/`, protégé par mot de passe : toutes les ventes de merch au même endroit (site, concerts, Bandcamp),
le stock, et les comptes (CA, commissions, coût de revient, marge, dépenses) par mois. Export CSV pour la compta.

- **Site** : chaque commande Shopify payée arrive en direct par webhook et sort le stock ; remboursée ou annulée,
  elle le remet.
- **Concerts** : les ventes de la caisse SumUp sont importées tous les matins (cron Vercel) ou avec le bouton
  « Sync SumUp ». Chaque article de la caisse est associé à un produit par son nom (« Vinyle », « Hot Sauce »…) ; un
  nom inconnu apparaît dans « À traiter » pour être associé une fois pour toutes. Le concert du soir est retrouvé
  dans les dates Bandsintown.
- **Bandcamp, espèces, le reste** : bouton « Nouvelle vente » (ou la touche N).
- **Packs** : un pack vendu sort ses composants du stock (le bundle sort les deux vinyles).
- **Stock** : commencer par un « Inventaire » de chaque produit (ce qu'il reste vraiment), puis « Réassort » à chaque
  livraison. L'onglet Stock peut aussi renvoyer ce stock vers Shopify (accès Admin requis).

Navigation : barre latérale, palette ⌘K (pages, actions, produits, ventes récentes), raccourcis « G puis lettre »
pour changer de page, `?` pour la liste des raccourcis. Les pages ont des liens partageables (`#/ventes?nuit=…`).

Sur téléphone : barre d'onglets en bas (Aperçu, Ventes, « + » au centre pour saisir une vente, Concerts, Menu),
fenêtres qui montent du bas, cibles tactiles d'au moins 40 px. Pendant un concert (dernière vente en caisse de moins
de 12 h), l'aperçu commence par « Ce soir » : total, espèces et carte de la soirée. La saisie remplit le concert en
cours, met les produits les plus vendus en concert en premier avec le stock restant, calcule la monnaie à rendre en
espèces, et la notification propose « Annuler » en cas d'erreur. Les données se rechargent quand on revient sur l'appli. Pour l'installer comme une appli : Safari →
Partager → « Sur l'écran d'accueil » (Android : menu → « Installer l'application ») ; un appui long sur l'icône
propose « Nouvelle vente » et « Stock » sur Android.

Le code : `ventes/index.html` + `src/ventes/` (la page, en React avec les composants [shadcn/ui](https://ui.shadcn.com)
dans `src/ventes/components/ui/` et Tailwind v4 ; `components.json` permet d'en ajouter avec la CLI shadcn), `api/` (fonctions Vercel : `ventes.js` pour le dashboard,
`webhooks/shopify.js`, `cron/sumup.js`), `supabase/migrations/` (tables `merch_*` dans le projet Supabase Obsimo, RLS
sans policy : seule la clé secrète côté serveur y accède). En local, `npm run dev` sert aussi les fonctions de `api/`
avec les variables de `.env.local`.

### Variables Vercel (projet obsimo-website)

| Variable | Rôle |
| --- | --- |
| `DASHBOARD_PASSWORD` | mot de passe du dashboard (8 caractères minimum ; le changer déconnecte tout le monde) |
| `SUPABASE_URL` | `https://gzmbrpzeajjmoluceryb.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → clé secrète (`sb_secret_…`), ou l'ancienne `service_role` |
| `SHOPIFY_WEBHOOK_SECRET` | la clé de signature des webhooks (voir ci-dessous) |
| `SUMUP_API_KEY` | SumUp → Profil → Développeurs → clé API secrète (`sup_sk_…`) |
| `CRON_SECRET` | n'importe quelle longue chaîne aléatoire : protège l'import automatique SumUp |
| `SHOPIFY_ADMIN_TOKEN` *(facultatif)* | jeton Admin API (`shpat_…`), ou `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` d'une app du Dev Dashboard : import de l'historique des commandes et envoi du stock vers Shopify (droits `read_orders`, `read_products`, `read_inventory`, `write_inventory`, `read_locations`) |

### Webhook Shopify

Admin Shopify → Paramètres → Notifications → Webhooks → **Créer un webhook**, deux fois : événements
« Paiement de commande » et « Mise à jour de commande », format JSON, URL `https://www.obsimo.com/api/webhooks/shopify`.
La clé affichée en bas de cette page (« Vos webhooks seront signés avec… ») va dans `SHOPIFY_WEBHOOK_SECRET`.
