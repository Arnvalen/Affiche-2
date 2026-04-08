# Roadmap — Maintenabilité de l'éditeur d'affiche Nexans

> Ce document recense les améliorations structurelles identifiées pour faciliter la maintenance et l'évolution du projet par un développeur externe. Aucune fonctionnalité n'est modifiée — il s'agit uniquement de refactorings internes.

---

## Contexte

L'application est actuellement un SPA React Vite dont la totalité du code métier réside dans `src/App.jsx` (~1 500 lignes). Cette organisation fonctionne bien pour un développeur unique connaissant le fichier, mais devient un obstacle dès qu'un nouvel entrant doit modifier ou déboguer une fonctionnalité précise.

---

## Axe 1 — Centraliser le thème

**Fichier cible :** `src/theme.js`

**Problème :** Les couleurs, constantes de mise en page et listes de valeurs sont dispersées sur les ~1 500 lignes de `App.jsx`. Changer la couleur principale ou ajouter un format nécessite de parcourir tout le fichier.

**Contenu à extraire :**

| Constante | Description |
|-----------|-------------|
| `COLOR_RED = '#C8102E'` | Rouge principal Nexans |
| `COLOR_ORANGE = '#E87722'` | Numéros d'étapes |
| `COLOR_ENTRY_*`, `COLOR_EXIT_*` | Couleurs entrée/sortie |
| `MM_PX = 1.4` | Facteur de conversion mm → pixels écran |
| `FORMATS` | Dictionnaire des formats papier (A0…A4, paysage/portrait) |
| `TAG_TYPES`, `TAG_COLORS` | Types et couleurs de tags |
| `PALETTES` | Palettes de couleurs du plan technique |
| `ZONE_COLORS` | Couleurs des zones de plan |

**Bénéfice :** Rebrancher la charte graphique ou ajouter un format en quelques minutes sans risquer de casser du code JSX.

---

## Axe 2 — Découper App.jsx en modules

**Problème :** ~1 500 lignes dans un seul fichier. Le fichier a déjà des séparateurs `/* ═══ ... ═══ */` clairs — il suffit de les transformer en frontières de modules.

**Découpage proposé :**

| Fichier | Contenu actuel dans App.jsx |
|---------|-----------------------------|
| `src/theme.js` | Constantes (voir Axe 1) |
| `src/data.js` | `emptyData()`, `defaultData()`, `applyLoaded()` |
| `src/exports.js` | `exportSVG()`, `exportPDF()`, `exportPNG()` |
| `src/components/TagEditor.jsx` | `Tag`, `TagWithQR`, `TagEditor` |
| `src/components/BookendEditor.jsx` | `BookendEditor` |
| `src/components/StepsEditor.jsx` | `StepsEditor`, `LineEditor` |
| `src/components/PosterPreview.jsx` | `BookendPanel`, `PosterPreview` |
| `src/components/TechnicalPlan.jsx` | `TechnicalPlanEditor`, `TechnicalPlanPreview` |
| `src/App.jsx` | Layout principal + `useState` + sidebar — ≤ 300 lignes |

**Règles à respecter lors du découpage :**
- Conserver les 100 % de styles inline (aucun fichier CSS externe)
- `up(fn)` reste dans App et est passé en prop aux éditeurs
- Les exports dynamiques (`import('html-to-image')`, `import('jspdf')`) restent dans `src/exports.js`
- L'élément `[data-poster-root]` reste dans `PosterPreview` — les fonctions d'export en dépendent

**Bénéfice :** Un entrant trouve immédiatement le bon fichier. App.jsx devient lisible d'un coup d'œil.

---

## Axe 3 — Documenter le modèle de données (JSDoc)

**Fichier cible :** `src/data.js` (après découpage) ou directement dans `App.jsx` avant `defaultData()`

**Problème :** La structure de `data` (tags, étapes, plan technique, zones…) n'est documentée que dans `CLAUDE.md`. Un développeur VS Code n'a pas d'autocomplétion ni de survol de type.

**Typedefs à ajouter :**

```js
/**
 * @typedef {Object} Tag
 * @property {string} id
 * @property {'danger'|'info'|'quality'|'env'|'hse'} type
 * @property {string} url — génère un QR code si non vide
 */

/**
 * @typedef {Object} Operation
 * @property {string} id
 * @property {string} label
 * @property {Tag[]} tags
 * @property {boolean} [isControlPoint] — affichage bleu si vrai
 */

/**
 * @typedef {Object} StepZone
 * @property {string} id
 * @property {number} stepIndex — index dans data.steps
 * @property {number} x — position en % de l'image
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * @typedef {Object} TechnicalView
 * @property {string} id
 * @property {string} label
 * @property {string|null} imageDataUrl — image base64 importée
 * @property {StepZone[]} stepZones
 * @property {MachineLabel[]} machineLabels
 */
```

**Bénéfice :** Autocomplétion VS Code, erreurs détectées à l'écriture, documentation toujours à jour avec le code.

---

## Ordre d'exécution recommandé

1. **Axe 1** (theme.js) — le plus court, débloque les axes suivants
2. **Axe 3** (JSDoc) — peut se faire en parallèle ou juste avant le découpage
3. **Axe 2** (découpage App.jsx) — le plus structurant, à faire en dernier pour que les imports soient stables

---

## Ce qui ne change PAS

- Aucun TypeScript
- Aucun state management externe
- Aucun fichier CSS
- Aucune modification de la logique métier ou des exports
- `CLAUDE.md` reste la référence pour les pièges et conventions
