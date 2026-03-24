# Guide pour générer un fichier JSON d'affiche

Ce document explique à une IA comment produire un fichier `.json` importable dans l'éditeur d'affiches Nexans.

---

## Contexte

L'application est un éditeur d'affiches de lignes de production. L'affiche se compose de :

```
┌─────────────────────────────────────────────────────┐
│  HEADER  (référence, nom process, sous-titre, logo) │
├─────────────────────────────────────────────────────┤
│  LÉGENDE  (types de tags, automatique)              │
├────────┬───┬──────────────────────┬───┬─────────────┤
│        │   │  ÉTAPE 1  │ ÉTAPE 2 │   │             │
│ ENTRÉE │ › │  ÉTAPE 3  │ ÉTAPE 4 │ › │   SORTIE    │
│        │   │  ÉTAPE 5  │         │   │             │
├────────┴───┴──────────────────────┴───┴─────────────┤
│  IMAGE BANDEAU  (optionnelle)                       │
├─────────────────────────────────────────────────────┤
│  FOOTER  (version, format, ligne — automatique)     │
└─────────────────────────────────────────────────────┘
```

Le JSON représente **toutes les données** de cette affiche. L'utilisateur l'importe via le bouton "Importer JSON" de l'onglet Export.

---

## Structure complète du JSON

```jsonc
{
  // ── En-tête ──
  "header": {
    "reference": "37019",              // Référence de la ligne (affiché en gros)
    "processName": "Extrusion",        // Nom du process
    "subtitle": "Fil isolé coloré",    // Sous-titre (optionnel, peut être "")
    "logoDataUrl": null                // Logo en base64 data URL, ou null (affiche "Nexans" par défaut)
  },

  // ── Paramètres de mise en page ──
  "format": "A1-paysage",     // Format papier (voir liste ci-dessous)
  "customW": 800,             // Largeur en mm (utilisé seulement si format = "Personnalisé")
  "customH": 500,             // Hauteur en mm (idem)
  "maxCols": 0,               // Nombre max de colonnes d'étapes (0 = auto)
  "fontScale": 1,             // Multiplicateur de taille de police (0.5 à 3)
  "qrSize": 32,               // Taille de base des QR codes en pixels (16 à 80)
  "forceFormat": false,        // true = hauteur fixe, contenu coupé si trop grand
  "bookendWidth": 220,        // Largeur des panneaux entrée/sortie en pixels
  "bgImageHeight": 25,        // Hauteur de l'image bandeau en % de la page (5 à 60)
  "pdfResolution": 3,         // Résolution PDF : 1 (96 DPI), 2, 3 (300 DPI), 4

  // ── Panneau Entrée (gauche, vert) ──
  "entree": {
    "tags": [],                // Tags du panneau lui-même (voir format Tag ci-dessous)
    "sections": [              // Catégories d'entrée
      {
        "id": "e_sec_1",
        "title": "Matière",
        "items": [
          {
            "id": "e_item_1",
            "name": "Fil de cuivre",
            "tags": [
              { "id": "e_tag_1", "type": "IC", "url": "" },
              { "id": "e_tag_2", "type": "PC", "url": "" }
            ]
          }
        ]
      }
    ]
  },

  // ── Étapes du process (zone centrale) ──
  "steps": [
    {
      "id": "step_1",
      "title": "Extrusion",
      "tags": [],              // Tags au niveau de l'étape (affichés dans le header noir)
      "operations": [
        // Opération normale
        {
          "id": "op_1",
          "name": "Alimentation HDPE",
          "tags": [
            { "id": "op_tag_1", "type": "SWI", "url": "" }
          ]
        },
        // Point de contrôle (barre bleue, pas de tags)
        {
          "id": "op_2",
          "isControlPoint": true,
          "name": "Point de contrôle"
        }
      ]
    }
  ],

  // ── Panneau Sortie (droite, rouge) ──
  "sortie": {
    "tags": [],
    "sections": [
      // Même structure que entree.sections
    ]
  },

  // ── Image de fond ──
  "backgroundImage": null      // Image en base64 data URL, ou null
}
```

---

## Types de tags

Les tags représentent des documents ou contrôles associés à chaque élément. Chaque tag a exactement 3 champs :

```jsonc
{
  "id": "tag_unique_123",     // Identifiant unique (string, n'importe quel format)
  "type": "SWI",              // Un parmi : "SWI", "IC", "LC", "AQE"
  "url": ""                   // URL pour le QR code. "" = pas de QR code affiché
}
```

| Type | Signification | Couleur |
|------|--------------|---------|
| `SWI` | Standard Work Instruction | Rouge |
| `IC` | Instruction de contrôle | Orange |
| `LC` | Liste de contrôle | Vert |
| `AQE` | Appareil qualité embarqué | Violet |

> **Note** : le type `PC` (Point de contrôle, bleu) existe dans le code mais n'est plus dans la liste `TAG_TYPES` de l'éditeur. Il reste fonctionnel si utilisé dans le JSON.

---

## Formats papier valides

Valeurs acceptées pour le champ `format` :

| Valeur | Dimensions (mm) |
|--------|-----------------|
| `A0-paysage` | 1189 × 841 |
| `A1-paysage` | 841 × 594 |
| `A2-paysage` | 594 × 420 |
| `A3-paysage` | 420 × 297 |
| `A4-paysage` | 297 × 210 |
| `A0-portrait` | 841 × 1189 |
| `A1-portrait` | 594 × 841 |
| `A2-portrait` | 420 × 594 |
| `A3-portrait` | 297 × 420 |
| `A4-portrait` | 210 × 297 |
| `Personnalisé` | utilise `customW` × `customH` |

---

## Règles pour les IDs

- Chaque `id` doit être **unique** dans tout le JSON.
- Le format est libre (string). Exemples : `"step_1"`, `"a1b2c3"`, `"_142"`.
- Astuce simple : utiliser un préfixe + compteur (`"s1"`, `"s2"`, `"op1"`, `"op2"`, `"t1"`, ...).

---

## Règles pour les opérations

Chaque étape contient un tableau `operations`. Il y a **deux types** :

### Opération normale
```json
{ "id": "op_1", "name": "Alimentation", "tags": [{ "id": "t1", "type": "SWI", "url": "" }] }
```
Affichée avec une lettre cerclée (A, B, C...) et ses tags.

### Point de contrôle
```json
{ "id": "op_2", "isControlPoint": true, "name": "Point de contrôle" }
```
Affiché comme une barre bleue. **Pas de champ `tags`.**

Les lettres sont attribuées automatiquement : seules les opérations normales reçoivent une lettre (A, B, C...), les points de contrôle sont ignorés dans le comptage.

---

## Règles pour les QR codes

- Un QR code apparaît sur le poster **uniquement si `url` est non-vide**.
- Mettre `"url": ""` si aucun QR n'est souhaité (le tag s'affiche quand même, sans QR).
- L'URL doit faire **moins de ~130 caractères** pour être lisible.

---

## Recommandations de génération

1. **Toujours inclure tous les champs** listés dans la structure, même avec des valeurs par défaut.
2. **Ne pas inventer de types de tags** en dehors de `SWI`, `IC`, `LC`, `AQE`.
3. **Laisser `logoDataUrl` et `backgroundImage` à `null`** — ces images sont ajoutées via l'interface.
4. **Adapter `fontScale` et `maxCols` au contenu** :
   - Beaucoup d'étapes (>6) → augmenter `maxCols` (4-6) et réduire `fontScale` (0.7-0.8)
   - Peu d'étapes (2-3) → laisser `maxCols: 0` (auto) et `fontScale: 1`
5. **Format recommandé** : `A1-paysage` pour la plupart des lignes de production.
6. **Organiser les sections entrée/sortie par catégorie** : Matière, Informations, Équipements, Protocoles...

---

## Exemple complet minimal

```json
{
  "header": {
    "reference": "LIG-001",
    "processName": "Assemblage câble",
    "subtitle": "Câble haute tension 3x50mm²",
    "logoDataUrl": null
  },
  "format": "A1-paysage",
  "customW": 800,
  "customH": 500,
  "maxCols": 0,
  "fontScale": 1,
  "qrSize": 32,
  "forceFormat": false,
  "bookendWidth": 220,
  "bgImageHeight": 25,
  "pdfResolution": 3,
  "entree": {
    "tags": [],
    "sections": [
      {
        "id": "es1",
        "title": "Matière",
        "items": [
          { "id": "ei1", "name": "Conducteur cuivre", "tags": [{ "id": "et1", "type": "IC", "url": "" }] },
          { "id": "ei2", "name": "Isolant XLPE", "tags": [{ "id": "et2", "type": "IC", "url": "" }] }
        ]
      },
      {
        "id": "es2",
        "title": "Informations",
        "items": [
          { "id": "ei3", "name": "Ordre de fabrication", "tags": [{ "id": "et3", "type": "SWI", "url": "" }] }
        ]
      }
    ]
  },
  "steps": [
    {
      "id": "s1",
      "title": "Préparation",
      "tags": [],
      "operations": [
        { "id": "o1", "name": "Coupe conducteur", "tags": [{ "id": "ot1", "type": "SWI", "url": "" }] },
        { "id": "o2", "name": "Dénudage", "tags": [{ "id": "ot2", "type": "SWI", "url": "" }, { "id": "ot3", "type": "IC", "url": "" }] }
      ]
    },
    {
      "id": "s2",
      "title": "Extrusion isolant",
      "tags": [{ "id": "st1", "type": "SWI", "url": "" }],
      "operations": [
        { "id": "o3", "name": "Chargement granulés", "tags": [{ "id": "ot4", "type": "IC", "url": "" }] },
        { "id": "o4", "name": "Extrusion", "tags": [{ "id": "ot5", "type": "SWI", "url": "" }, { "id": "ot6", "type": "IC", "url": "" }] },
        { "id": "o5", "isControlPoint": true, "name": "Contrôle épaisseur" },
        { "id": "o6", "name": "Refroidissement", "tags": [{ "id": "ot7", "type": "IC", "url": "" }] }
      ]
    },
    {
      "id": "s3",
      "title": "Assemblage",
      "tags": [],
      "operations": [
        { "id": "o7", "name": "Câblage", "tags": [{ "id": "ot8", "type": "SWI", "url": "" }] },
        { "id": "o8", "name": "Gainage", "tags": [{ "id": "ot9", "type": "SWI", "url": "" }, { "id": "ot10", "type": "IC", "url": "" }] },
        { "id": "o9", "isControlPoint": true, "name": "Test diélectrique" }
      ]
    }
  ],
  "sortie": {
    "tags": [],
    "sections": [
      {
        "id": "ss1",
        "title": "Produit fini",
        "items": [
          { "id": "si1", "name": "Câble assemblé", "tags": [{ "id": "sot1", "type": "IC", "url": "" }] }
        ]
      },
      {
        "id": "ss2",
        "title": "Documents",
        "items": [
          { "id": "si2", "name": "PV de contrôle", "tags": [{ "id": "sot2", "type": "LC", "url": "" }] },
          { "id": "si3", "name": "Fiche qualité", "tags": [{ "id": "sot3", "type": "AQE", "url": "" }] }
        ]
      }
    ]
  },
  "backgroundImage": null
}
```

---

## Erreurs courantes à éviter

| Erreur | Conséquence |
|--------|-------------|
| Oublier `isControlPoint: true` sur un point de contrôle | Affiché comme opération normale sans tags (crash possible) |
| Mettre des `tags` sur un point de contrôle | Ignoré mais inutile |
| IDs dupliqués | Comportement imprévisible (suppression en chaîne, etc.) |
| Type de tag invalide (ex: `"QC"`) | Tag invisible, couleur manquante |
| `format` invalide (ex: `"A1"`) | Dimensions non trouvées, fallback sur customW/customH |
| Oublier le champ `tags: []` sur une étape ou un item | Erreur JavaScript à l'affichage |
| Mettre `fontScale: 0` | Tout devient invisible |
