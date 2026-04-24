<!--
version: 1.1.2
date: 2026-04-24
modifications:
  - Refonte complète : ancien modèle plat remplacé par la documentation du système DAG
  - Ajout line[].size et line[].next[] (connexions DAG)
  - Ajout champs globaux bgImageHeight et lineEdgeGap
  - Documentation computeLayout, getLineLabel, largeurs de colonnes variables
  - Documentation routing des flèches H-V-H
  - Ajout section plan technique (machineLabel, légende partagée)
-->

# Ligne de production — Modèle de données et rendu

> Pour l'interface utilisateur de l'éditeur, voir [guide-editeur-ligne.md](guide-editeur-ligne.md).

---

## Modèle de données

### `data.icons[]` — Bibliothèque d'icônes

Chaque icône est un SVG importé, stocké en texte brut dans l'état global.

```js
{
  id: "uid_123",             // identifiant unique (uid())
  name: "Extrudeuse",        // nom affiché sous l'icône (issu du nom de fichier .svg)
  description: "",           // champ libre (non affiché actuellement)
  svgData: "<svg>...</svg>"  // contenu SVG brut
}
```

Les icônes peuvent provenir :
- d'un **upload manuel** (bouton "+ Importer SVG", accepte plusieurs fichiers)
- du **dossier `library/`** (Electron), listés dans la section "SVG disponibles"

### `data.line[]` — Composition de la ligne

Liste des machines. L'ordre du tableau n'est plus l'ordre d'affichage — c'est le graphe `next[]`
qui détermine le layout.

```js
{
  id: "uid_456",           // identifiant unique
  iconId: "uid_123",       // référence vers data.icons[].id
  stepId: "uid_step_7",    // référence vers data.steps[].id (null = zone "sans affectation")
  size: 1,                 // multiplicateur de taille de l'icône (optionnel, défaut 1)
  next: ["uid_789"]        // IDs des machines suivantes (connexions DAG)
}
```

### Champs globaux liés à la ligne

| Champ | Type | Défaut | Rôle |
|---|---|---|---|
| `data.bgImageHeight` | `number` (%) | `25` | Hauteur de la bande ligne en % de la hauteur du poster |
| `data.lineEdgeGap` | `number` | `14` | Écart bord-à-bord entre icônes en "s units" |
| `data.lineZoneLabel` | `"number"` \| `"title"` | `"number"` | Numéro ou titre de zone au-dessus de chaque groupe |
| `data.showLineTags` | `boolean` | `true` | Afficher les badges de tags sous la lettre de chaque machine |

---

## Graphe DAG et layout (`computeLayout`)

La ligne est modélisée comme un **graphe orienté acyclique (DAG)**. Les connexions `next[]`
définissent quelles machines se suivent.

`computeLayout(nodes, steps)` — appelé dans `LineFlowBand` — calcule pour chaque nœud :
- `col` : colonne horizontale (0, 1, 2…)
- `track` : ligne verticale (0 = principale, 1+ = voie parallèle)
- `zoneSpans` : étendue de colonnes par zone pour le rendu des rectangles de zone
- `zoneKeys` : ordre des zones pour le rendu

Les machines sans connexion `next[]` définie sont placées en fin de leur zone.

---

## Labels machines (`getLineLabel`)

`getLineLabel(line, steps, id)` retourne le label humain d'une machine :
- Première machine d'une zone sans parallèle → `A`, `B`, `C`…
- Machines parallèles dans la même zone → `A1`, `A2`, `B1`, `B2`…

Ces labels sont identiques dans l'éditeur, la bande ligne, les opérations du process
et le plan technique.

---

## Rendu dans l'affiche visuelle (`LineFlowBand`)

### Hauteur de la bande

```js
const bh = Math.round(posterH * (data.bgImageHeight || 25) / 100);
```

### Largeurs de colonnes variables

Contrairement à un layout grille uniforme, chaque colonne a une largeur proportionnelle
à la vraie largeur de l'icône qu'elle contient :

```js
colMaxImgW[c] = max(largeurs réelles des icônes dans la colonne c)
minEdgeGap    = max(lineEdgeGap * s, arrowLen * 2)
colW[c]       = colMaxImgW[c] + minEdgeGap
```

**Propriété** : l'écart bord-à-bord entre deux icônes adjacentes est toujours égal à
`minEdgeGap`, quelle que soit la taille des icônes.

### Routing des flèches (H-V-H)

Les flèches entre machines suivent un trajet H-V-H (horizontal – vertical – horizontal) :
- `exitX` / `tipX` : ancrés sur la vraie demi-largeur de l'icône (`getIconHalfW`)
- `laneX` : voie verticale de changement de track
  - même zone : bord gauche de la colonne cible
  - cross-zone : centre du gap inter-zone (`colCx(gapCol)`)

---

## Plan technique (`TechnicalPlanPreview`)

Les machines de `data.line` sont également référencées dans le plan technique. Chaque
`machineLabel` placé sur une vue de plan technique pointe vers un index de `data.line` :

```js
{
  id: "uid_789",
  lineIndex: 2,            // index dans data.line[]
  x: 45.0,                 // position en % sur l'image
  y: 30.5,
  arrowTo: { x: 60, y: 50 } | null  // pointe de flèche optionnelle
}
```

La lettre et la couleur sont recalculées dynamiquement à partir du `lineIndex` et du `stepId`
via `getLineLabel` et `getZoneColor`, en cohérence avec l'affiche visuelle.

La **légende du plan technique est partagée** entre la Vue de dessus et la Vue de face :
elle affiche l'union des zones et machines présentes dans l'une ou l'autre vue,
sans doublons (déduplication par `lineIndex`).

---

## Auteur

**Arnaud Valente Jacot-Descombes**  
Stagiaire EPFL  
Quality Management — NEXANS Suisse SA  
✉ arnaud_jacot@hotmail.com · 🌐 [arnvalen.ch](https://arnvalen.ch)
