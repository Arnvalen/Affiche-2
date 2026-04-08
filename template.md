# Templates de fichiers — Éditeur d'affiche Nexans

> Standards d'en-tête à respecter pour chaque fichier du projet.
> Basé sur les conventions JSDoc + commentaires de bloc structurés.
> Ces templates s'appliquent dès le découpage de `App.jsx` (voir `roadmap.md`).

---

## 1. Composant React (`.jsx`)

```jsx
/**
 * @file        NomComposant.jsx
 * @module      src/components/NomComposant
 * @description Brève description du rôle du composant (1–2 phrases).
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     YYYY-MM-DD
 * @modified    YYYY-MM-DD
 * @version     1.0.0
 *
 * @requires    react
 * @requires    ../theme          — constantes de couleur et de mise en page
 *
 * ---------------------------------------------------------------------------
 * Props
 * ---------------------------------------------------------------------------
 * @param {Object}   props
 * @param {AfficheData} props.data        — état courant de l'affiche
 * @param {function} props.onChange       — callback (newData) => void
 * @param {boolean}  [props.readOnly]     — désactive les interactions (défaut : false)
 *
 * ---------------------------------------------------------------------------
 * Emits / Callbacks
 * ---------------------------------------------------------------------------
 * onChange(newData)   Déclenché à chaque modification. newData est une copie
 *                     structurale produite par Immer (produce).
 *
 * ---------------------------------------------------------------------------
 * Usage
 * ---------------------------------------------------------------------------
 * @example
 * <NomComposant
 *   data={data}
 *   onChange={(d) => setData(d)}
 * />
 */

import React from 'react'
// ...
```

---

## 2. Module utilitaire / données (`.js`)

```js
/**
 * @file        nom-module.js
 * @module      src/nom-module
 * @description Brève description du rôle du module (1–2 phrases).
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     YYYY-MM-DD
 * @modified    YYYY-MM-DD
 * @version     1.0.0
 *
 * ---------------------------------------------------------------------------
 * Exports
 * ---------------------------------------------------------------------------
 * @exports {function} defaultData    — données initiales d'une affiche vide
 * @exports {function} emptyData      — données minimales sans contenu
 * @exports {function} applyLoaded    — fusionne un JSON importé avec emptyData
 *
 * ---------------------------------------------------------------------------
 * Dépendances
 * ---------------------------------------------------------------------------
 * Aucune dépendance externe. Fonctions pures (pas d'effets de bord).
 */

// ...
```

---

## 3. Module d'export (`exports.js`)

```js
/**
 * @file        exports.js
 * @module      src/exports
 * @description Fonctions d'export de l'affiche : SVG natif, PNG (html-to-image),
 *              PDF (jsPDF). Charge les bibliothèques lourdes en import dynamique
 *              pour ne pas alourdir le bundle initial.
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     YYYY-MM-DD
 * @modified    YYYY-MM-DD
 * @version     1.0.0
 *
 * ---------------------------------------------------------------------------
 * Exports
 * ---------------------------------------------------------------------------
 * @exports {AsyncFunction} exportSVG
 * @exports {AsyncFunction} exportPNG
 * @exports {AsyncFunction} exportPDF
 *
 * ---------------------------------------------------------------------------
 * Contraintes techniques
 * ---------------------------------------------------------------------------
 * - Cible : élément DOM portant l'attribut [data-poster-root].
 *   Ne jamais capturer le wrapper scale() — les exports doivent mesurer
 *   l'élément racine directement.
 * - SVG : utiliser XMLSerializer.serializeToString(), pas outerHTML.
 *   Raison : outerHTML produit du HTML5 (balises <img> non fermées) qui
 *   corrompt le XML dans les foreignObject.
 * - PDF/PNG : ne pas utiliser html2canvas (rendu CSS JS incompatible avec
 *   les layouts flexbox de ce projet). Utiliser html-to-image.
 * - Résolution : pixelRatio = data.pdfResolution / (MM_PX * 25.4)
 *   où MM_PX = 1.4 et pdfResolution est en DPI réels (72 / 150 / 300 / 400).
 *
 * @requires    html-to-image  (import dynamique)
 * @requires    jspdf          (import dynamique)
 * @requires    ../theme       — MM_PX
 */

// ...
```

---

## 4. Thème / constantes (`theme.js`)

```js
/**
 * @file        theme.js
 * @module      src/theme
 * @description Constantes de design system : couleurs Nexans, facteur de
 *              conversion mm/px, formats papier, types de tags, palettes
 *              de couleurs du plan technique.
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     YYYY-MM-DD
 * @modified    YYYY-MM-DD
 * @version     1.0.0
 *
 * ---------------------------------------------------------------------------
 * Conventions
 * ---------------------------------------------------------------------------
 * - Toutes les couleurs sont des chaînes hex (#RRGGBB).
 * - MM_PX n'est PAS un DPI standard : c'est un facteur de rendu écran
 *   choisi pour l'affichage (1.4 px/mm). Ne pas confondre avec la résolution
 *   d'export (voir exports.js).
 * - FORMATS est un dictionnaire indexé par clé (ex. "A1-paysage").
 *   La clé est stockée dans data.format.
 *
 * ---------------------------------------------------------------------------
 * Exports
 * ---------------------------------------------------------------------------
 * @exports {number}  MM_PX
 * @exports {Object}  FORMATS
 * @exports {Object}  TAG_TYPES
 * @exports {Object}  TAG_COLORS
 * @exports {string}  COLOR_RED
 * @exports {string}  COLOR_ORANGE
 * @exports {Array}   PALETTES
 * @exports {Array}   ZONE_COLORS
 * @exports {function} lerpColor
 * @exports {function} getZoneColor
 */

// ...
```

---

## 5. Processus principal Electron (`main.cjs`)

```js
/**
 * @file        main.cjs
 * @module      electron/main
 * @description Processus principal Electron : démarrage du serveur HTTP local,
 *              création de la fenêtre BrowserWindow, gestion du cycle de vie
 *              de l'application, API library (lecture / écriture de fichiers JSON
 *              et SVG sur le réseau), logs locaux et partagés.
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     YYYY-MM-DD
 * @modified    YYYY-MM-DD
 * @version     voir package.json → version
 *
 * ---------------------------------------------------------------------------
 * Architecture
 * ---------------------------------------------------------------------------
 * ┌─────────────────────────────────────────────────────────────┐
 * │  BrowserWindow  →  http://127.0.0.1:{port}/                │
 * │                                                             │
 * │  Serveur HTTP local (Node http)                             │
 * │  ├─ GET  /__api/version        → { version }               │
 * │  ├─ GET  /__api/library        → { path, jsons, svgs }     │
 * │  ├─ GET  /__api/library/:file  → contenu fichier           │
 * │  ├─ PUT  /__api/library/:file  → écriture fichier          │
 * │  ├─ DEL  /__api/library/:file  → suppression fichier       │
 * │  └─ GET  /*                    → fichiers statiques (ASAR) │
 * └─────────────────────────────────────────────────────────────┘
 *
 * ---------------------------------------------------------------------------
 * Variables d'environnement / arguments
 * ---------------------------------------------------------------------------
 * --library=PATH   Chemin absolu vers le dossier library (passé par launcher.bat)
 * LOCALAPPDATA     Utilisé pour résoudre userData / logs Electron
 *
 * ---------------------------------------------------------------------------
 * Fichiers produits
 * ---------------------------------------------------------------------------
 * affiche-debug.log          Côté exe (local, sync)
 * logs/affiche_{user}_{date}.log  Côté réseau / OneDrive (async, non-bloquant)
 *
 * ---------------------------------------------------------------------------
 * Pièges connus
 * ---------------------------------------------------------------------------
 * - Ne PAS utiliser appendFileSync sur un lecteur réseau (bloque le thread).
 *   Utiliser appendFile (async) pour les logs partagés.
 * - Les fichiers statiques sont servis à la demande depuis l'ASAR (memory-mapped
 *   par l'OS) — ne pas reconstituer un FILE_CACHE : cela annule l'intérêt des
 *   chunks lazy (jsPDF, html-to-image).
 *
 * @requires    electron  — app, BrowserWindow
 * @requires    http      — serveur local
 * @requires    fs        — lecture ASAR, logs
 * @requires    path
 */

// ...
```

---

## 6. Typedefs partagées (modèle de données)

À placer en tête de `src/data.js` ou dans un fichier `src/types.js` dédié.

```js
/**
 * @file        types.js
 * @module      src/types
 * @description Typedefs JSDoc du modèle de données de l'affiche.
 *              Ce fichier ne contient aucun code exécutable — uniquement des
 *              définitions de types pour l'autocomplétion VS Code et la
 *              documentation en ligne.
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     YYYY-MM-DD
 * @modified    YYYY-MM-DD
 * @version     1.0.0
 */

/**
 * @typedef {Object} Tag
 * @property {string} id
 * @property {'danger'|'info'|'quality'|'env'|'hse'} type
 * @property {string} url — génère un QR code SVG natif si non vide
 */

/**
 * @typedef {Object} Operation
 * @property {string}  id
 * @property {string}  label
 * @property {Tag[]}   tags
 * @property {boolean} [isControlPoint] — rendu bleu si vrai (point de contrôle)
 */

/**
 * @typedef {Object} Step
 * @property {string}      id
 * @property {string}      label         — intitulé de l'étape
 * @property {string}      machine        — lettre de la machine (A, B, …)
 * @property {Operation[]} operations
 */

/**
 * @typedef {Object} StepZone
 * @property {string} id
 * @property {number} stepIndex — index dans data.steps (0-based)
 * @property {number} x  — position gauche en % de l'image (0–100)
 * @property {number} y  — position haute en % de l'image (0–100)
 * @property {number} w  — largeur en % de l'image
 * @property {number} h  — hauteur en % de l'image
 */

/**
 * @typedef {Object} MachineLabel
 * @property {string} id
 * @property {number} lineIndex — index dans data.header.machines (0-based)
 * @property {number} x         — position en % de l'image
 * @property {number} y
 */

/**
 * @typedef {Object} TechnicalView
 * @property {string}         id           — 'top' | 'side' | identifiant libre
 * @property {string}         label        — libellé affiché dans l'interface
 * @property {string|null}    imageDataUrl — image importée en base64 data URL
 * @property {StepZone[]}     stepZones
 * @property {MachineLabel[]} machineLabels
 */

/**
 * @typedef {Object} AfficheData
 * @property {Object}  header
 * @property {string}  header.line          — nom de la ligne de production
 * @property {string}  header.logoDataUrl   — logo base64 (peut être vide)
 * @property {string[]} header.machines     — liste des lettres/noms de machines
 * @property {string}  format              — clé dans FORMATS ou "Personnalise"
 * @property {number}  fontScale           — multiplicateur global des tailles de police
 * @property {number}  pdfResolution       — DPI cible pour l'export (72/150/300/400)
 * @property {string|null} backgroundImage — image de fond base64
 * @property {Step[]}  steps
 * @property {{ jsons: string[], svgs: string[] }} library — fichiers disponibles
 * @property {Object}  technicalPlan
 * @property {TechnicalView[]} technicalPlan.views
 */
```

---

## Règles générales

| Règle | Détail |
|-------|--------|
| `@created` | Date de création initiale du fichier (ne change plus) |
| `@modified` | Mise à jour à chaque modification significative |
| `@version` | Suit la version de `package.json` pour les fichiers Electron ; `1.x.y` en semver interne pour les modules React |
| Langue | Descriptions en français ; noms de variables/fonctions en anglais |
| Longueur | En-tête ≤ 50 lignes ; préférer concision à exhaustivité |
| Pièges | Toujours documenter les contraintes non-évidentes (ex. XMLSerializer vs outerHTML, appendFile vs appendFileSync réseau) |
