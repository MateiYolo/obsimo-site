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
- `src/models.js` : vinyle (pochette + disque qui sort et tourne), bouteille de sauce, carte générique
- `src/hifi/` : modèle du vinyle repris du mockup-vinyl-generator, chargement des textures précalculées (`baked.js`) et leur génération (`bake.js`, page `bake.html`)
- `src/main.js` : liste, gestes de rotation, menu, page détail, galerie, panier
- `src/audio.js` : extraits audio (fichier ou boucle générative de démo)
- `src/shopify.js` : requêtes Storefront API et création du panier/checkout
- `src/tour.js` : dates de concert depuis l'API Bandsintown 
