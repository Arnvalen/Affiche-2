<!--
version: 1.1.2
date: 2026-04-24
modifications:
  - Correction nombre de lignes App.jsx (~1000 → ~2500)
  - Ajout onglet Plan (9 onglets au total)
  - Ajout composants TechnicalPlanEditor / TechnicalPlanPreview avec légende partagée
  - Remplacement JSON.parse/stringify par immer produce
  - Section Couleurs → Couleurs et palettes (système PALETTES, getZoneColor)
  - Data model : ajout palette, lineEdgeGap, line[].size, line[].next[], technicalPlan
  - Section Ligne : computeLayout DAG, largeurs de colonnes variables, getLineLabel
-->

# Architecture technique

## Vue d'ensemble

```
index.html
  └── src/main.jsx          Point d'entree React
        └── src/App.jsx      Application complete (~2500 lignes)
```

Application split-screen :
- **Gauche** : sidebar 360px avec 9 onglets (En-tete, Format, Entree, Process, Sortie, Ligne, Plan, Export, Biblio)
- **Droite** : apercu temps reel du poster, scalé pour tenir dans la fenetre (ResizeObserver + transform scale)

---

## Dependances

| Package | Role |
|---------|------|
| `react` / `react-dom` | Framework UI |
| `qrcode` | Generation matrice QR (donnees brutes, pas de rendu) |
| `html-to-image` | Capture DOM → PNG haute resolution (export PNG et PDF) |
| `jspdf` | Creation de fichiers PDF |
| `vite` + `@vitejs/plugin-react` | Build et dev server |
| `@vitejs/plugin-basic-ssl` | Certificat auto-signe HTTPS (fallback sans .cert/) |
| `mkcert` | Generation de CA et certificats locaux de confiance (npm package pur Node.js) |

---

## Composants

### Rendu (PosterPreview)

```
PosterPreview  [data-poster-root]
  ├── Header           Barre rouge : reference, process, logo, tags
  ├── Legend           Legende des types de tags
  ├── Main content     (flex row)
  │   ├── BookendPanel  Entree (vert)
  │   ├── Arrows        Connecteurs visuels entre zones
  │   ├── Step grid     Grille de colonnes (rows × maxCols)
  │   │   └── renderStep(step, si)
  │   │       ├── Header  Fond couleur ZONE_COLORS[si], cercle numero
  │   │       └── Operations
  │   │           ├── Ligne normale   [cercle-lettre?] [nom] [tags]
  │   │           └── Point controle  [cercle-lettre?] [barre bleue : nom + description + tags]
  │   ├── Arrows
  │   └── BookendPanel  Sortie (rouge)
  ├── Line strip        Bandeau ligne de production (zones colorees)
  │   └── Zone × N      [chiffre] [machine A → B → C]
  └── Footer            Barre noire : version, format, ligne
```

### Edition (sidebar)

```
App
  ├── TagEditor              Gestion tags + URLs QR (inline dans les editeurs)
  ├── BookendEditor          Entree/sortie (categories > elements > tags)
  ├── StepsEditor            Etapes (titre > operations > tags > lien machine)
  ├── LineEditor             Ligne de production
  │     ├── Sliders          Hauteur bandeau + ecart entre machines
  │     ├── Section SVG      Dossier lib ou upload
  │     ├── Bibliotheque     Grille d'icones draggables
  │     └── Zones            Groupees par stepId (machines, fleches, reorder)
  └── TechnicalPlanEditor    Plan technique (2 vues annotees)
        ├── Vue de dessus    Image + zones colorees + labels machines
        └── Vue de face      Image + zones colorees + labels machines
```

### Rendu plan technique (PosterPreview)

```
TechnicalPlanPreview
  ├── Vue de dessus          Image + stepZones + machineLabels (fleches)
  ├── Vue de face            Image + stepZones + machineLabels (fleches)
  └── Legende partagee       Union des zones et machines des 2 vues
```

### Primitives UI

- `Btn` : bouton avec couleur, taille, mode outline
- `Input` : champ texte stylise
- `SectionCard` : carte depliable avec titre et actions
- `Tag` : badge inline (SWI / IC / PC / LC / AQE)
- `TagWithQR` : badge + QR code inline en SVG natif
- `SvgIcon` : `<img src="data:image/svg+xml,...">` pour icones machine (scaling natif navigateur)
- `QRCodeSVG` : QR code SVG pur (matrice de `<rect>`)

---

## Modele de donnees (defaultData)

```js
{
  header: { reference, processName, subtitle, logoDataUrl },
  format,            // cle FORMATS ou "Personnalise"
  customW, customH,  // dimensions mm si Personnalise
  maxCols,           // 0 = auto
  fontScale,         // entier 1-20 (defaut 7). s = fontScale * 0.15
  qrSize,            // taille QR en px (avant scale)
  forceFormat,       // force height = posterH
  bookendWidth,      // largeur panneaux entree/sortie en px
  headerHeight,      // hauteur header en px
  bgImageHeight,     // % de hauteur pour le bandeau image/ligne
  showLineTags,      // afficher les tags sur la ligne de prod
  lineZoneLabel,     // "number" | "title"
  pdfResolution,     // 1-4 (pixelRatio pour html-to-image)
  entree: { tags, sections: [{ id, title, items: [{ id, name, tags }] }] },
  sortie: { ... },
  steps: [{
    id, title, tags,
    operations: [{
      id, name, tags,
      isControlPoint?,    // true = point de controle bleu
      description?,       // texte sous le nom (PC uniquement)
      lineItemId?         // ID d'un item dans data.line
    }]
  }],
  palette,           // cle PALETTES (ex: "nexans") — theme couleur du poster
  lineEdgeGap,       // ecart bord-a-bord entre icones en "s units" (defaut 14)
  icons: [{ id, name, description, svgData }],  // bibliotheque SVG
  line: [{
    id, iconId,
    stepId,          // null = zone "sans affectation"
    size,            // multiplicateur de taille de l'icone (defaut 1)
    next: ["uid_x"]  // IDs des machines suivantes (connexions DAG)
  }],
  technicalPlan: {   // plan technique
    views: [
      { id: 'top', label: 'Vue de dessus',
        imageDataUrl: null,
        stepZones:    [{ id, stepIndex, x, y, w, h }],   // coordonnees en % image
        machineLabels:[{ id, lineIndex, x, y, arrowTo }]  // position en % image
      },
      { id: 'side', label: 'Vue de face', ... }
    ]
  },
  backgroundImage,   // base64 data URL (fallback si line vide)
  header.logoDataUrl // base64 data URL
}
```

Template de depart : toutes les sections vides (reference, steps, entree, sortie = tableaux vides).

---

## Gestion du state

Un seul `useState` avec `defaultData()`. Toute mise a jour utilise **immer** `produce` :

```js
import { produce } from 'immer';

const up = useCallback((fn) => setData(prev => produce(prev, fn)), []);

// Usage :
up(d => { d.steps.push({ id: uid(), title: '' }); });
```

`produce` gere le clone profond et la copie-sur-ecriture automatiquement.

---

## Systeme de scaling

`fontScale` est un entier 1–20 (defaut 7). Le multiplicateur reel :
```js
s = (data.fontScale || 7) * 0.15
// fontScale=7  → s=1.05  (normal)
// fontScale=1  → s=0.15  (tres petit)
// fontScale=20 → s=3.0   (tres grand)
```

Toutes les dimensions dans PosterPreview :
```js
fontSize: 12 * s,  padding: `${8*s}px`,  gap: 10 * s,  qrSize * s
```

Le poster est rendu a sa taille reelle (`width: fmt.w * MM_PX`), puis :
```js
const sc = Math.min((previewSize.w - pad) / posterW, (previewSize.h - pad) / posterH);
// transform: `scale(${sc})` sur le wrapper
```

`MM_PX = 1.4` : conversion mm → px pour l'ecran (arbitraire, pas un DPI standard).

**Migration** : les anciens JSON avec `fontScale: 1` (l'ancien defaut "×1") s'afficheront tres petits avec le nouveau systeme. Corriger manuellement a 7.

---

## Couleurs et palettes

| Usage | Valeur |
|-------|--------|
| Nexans rouge (header) | `#C8102E` |
| Nexans orange (connecteurs, fleches) | `#E87722` |
| Entree (fond header) | `#2E7D32` |
| Sortie (fond header) | `#9B0D23` |
| Control point (fond) | `#E3F2FD` / bordure `#90CAF9` |
| Zones process/ligne | calculees via `getZoneColor(index, palette)` |

### Systeme de palettes

`PALETTES` est un objet constant qui definit 8 themes. Chaque palette contient :
- `accent` : couleur des fleches entre zones (orange par defaut)
- `zone` : tableau de couleurs pour les zones du process et la ligne

```js
const PALETTES = {
  nexans:  { accent: '#E87722', zone: [...] },  // defaut
  ocean:   { accent: '#0288D1', zone: [...] },
  forest:  { ... },
  // ...8 themes au total
};
```

`data.palette` (string, defaut `"nexans"`) selectionne le theme actif. La fonction `getZoneColor(index, pal)` retourne la couleur d'une zone en interpolant les couleurs de la palette.

---

## Ligne de production

Chaque item de `data.line` : `{ id, iconId, stepId, size, next[] }`.

### Layout DAG (computeLayout)

La ligne est un **graphe orienté acyclique** (DAG). `next[]` definit les connexions entre machines.
`computeLayout(nodes, steps)` calcule pour chaque nœud :
- `col` : colonne horizontale (0, 1, 2…)
- `track` : ligne verticale (0 = principale, 1+ = parallele)
- `zoneSpans`, `zoneKeys` : regroupements par zone pour le rendu des rectangles

### Largeurs de colonnes variables (LineFlowBand)

Contrairement a un layout a grille uniforme, chaque colonne a une largeur proportionnelle
a la vraie largeur de l'icone qu'elle contient :

```js
colW[c] = colMaxImgW[c] + minEdgeGap
// minEdgeGap = max(lineEdgeGap * s, arrowLen * 2)
// Garantit un ecart bord-a-bord fixe entre icones adjacentes
```

`data.lineEdgeGap` (entier, defaut 14) est regle via le slider "Ecart entre machines".

### Labels machines

`getLineLabel(line, steps, id)` retourne la lettre d'une machine (A, B, C... ou A1, A2... pour
les machines paralleles dans la meme zone). Ces labels sont coherents dans l'editeur, la bande
ligne, les operations du process et le plan technique.

---

## Pipeline d'export

### JSON
```
prompt(nom) → data → JSON.stringify → Blob → download
```
Le nom suggere automatiquement la prochaine version (`affiche_37019_V2` si V1 existe).

### SVG
```
DOM [data-poster-root]
  → XMLSerializer.serializeToString()   (XHTML valide, pas outerHTML)
  → wrap dans <svg><foreignObject>
  → Blob → download
```

### PNG
```
DOM [data-poster-root]
  → html-to-image toPng(el, { pixelRatio })
  → dataUrl → <a download> → click
```

### PDF
```
DOM [data-poster-root]
  → html-to-image toPng(el, { pixelRatio })
  → jsPDF.addImage(png, "mm", fmt.w, fmt.h)
  → pdf.save()
```

> PNG et PDF partagent le meme `pdfResolution` (1–4×).

---

## Bibliotheque et versionnage

L'onglet Biblio utilise la File System Access API (`showDirectoryPicker`, necessite HTTPS).

**Sauvegarde avec versionnage automatique** :
```js
// Detecte le max existant parmi affiche_37019_V1.json, V2.json...
const maxV = libFiles.reduce((max, f) => { /* regex */ }, 0);
const suggested = `${base}_V${maxV + 1}`;
const nameInput = prompt("Nom du fichier :", suggested);
```

**Vue arbre** : les fichiers sont groupes par prefixe avant `_V{n}`. Les groupes avec 2+ versions sont depliables/repliables via `libExpanded` state (`{}` par defaut = tout deplie).

```
📁 affiche_37019   3 versions   [▾]
  ├ V1  [Charger] [✕]
  ├ V2  [Charger] [✕]
  └ V3  [Charger] [✕]
📄 test  [Charger] [✕]
```

---

## HTTPS et acces reseau

Vite est configure pour servir en HTTPS :

```js
// vite.config.js
https: hasCert
  ? { cert: fs.readFileSync('.cert/cert.pem'), key: fs.readFileSync('.cert/key.pem') }
  : true  // fallback basic-ssl (avec warning navigateur)
```

Les certificats sont generes par `scripts/setup-cert.mjs` via le package npm `mkcert` (pure Node.js, pas de binaire systeme). La CA est installee dans le store utilisateur Windows via `certutil -addstore -user Root` (sans droits admin).

L'HTTPS est requis pour `window.showDirectoryPicker()` (File System Access API) utilise par la bibliotheque.

**Distribution aux clients** : envoyer `installer-ca.bat` ET `ca.crt` ensemble dans le meme dossier. Le .bat utilise `%~dp0ca.crt` (chemin relatif au .bat).

---

## Decisions techniques

### Pourquoi un seul fichier ?
Le projet est auto-contenu (~2500 lignes). Splitter ajouterait du prop-drilling sans benefice. Les sections sont separees par des commentaires `/* ═══ ... ═══ */`.

### Pourquoi inline styles ?
Les exports SVG/PDF capturent le DOM. Avec des classes CSS, il faudrait extraire et injecter les stylesheets dans le foreignObject SVG. Les inline styles sont deja embarques dans le DOM capture.

### Pourquoi XMLSerializer et pas outerHTML ?
`outerHTML` produit du HTML5 (balises `<img>` non fermees). Dans un `<foreignObject>` SVG, le contenu doit etre du XHTML valide. `XMLSerializer` produit automatiquement du XML bien forme.

### Pourquoi html-to-image et pas html2canvas ?
`html2canvas` re-implemente le rendu CSS en JS — gere mal les flexbox complexes. `html-to-image` utilise le moteur natif via SVG foreignObject.

### Pourquoi SvgIcon utilise <img> et pas dangerouslySetInnerHTML ?
Les SVGs importes ont des `width`/`height` fixes (souvent 10cm). `dangerouslySetInnerHTML` les injecte tels quels, debordant leur conteneur. Avec `<img src="data:image/svg+xml,...">` et `height` CSS fixe, le navigateur scale le SVG nativement.

### Pourquoi display:"flex" et pas "inline-flex" sur les cercles-lettres ?
Dans le contexte SVG `foreignObject` de html-to-image, `inline-flex` sur un `<span>` peut etre degrade en `inline`, cassant le layout flex du conteneur parent. `display:"flex"` (block-level) est universellement supporte.

### Pourquoi flexWrap:"nowrap" sur les conteneurs de tags ?
`html-to-image` calcule la largeur disponible des conteneurs flex dans le `foreignObject` SVG differemment du DOM reel — souvent plus etroite. Avec `flexWrap:"wrap"`, les tags se repliaient sur une nouvelle ligne meme quand ils tenaient visuellement. `flexWrap:"nowrap"` les empeche de wrapper quelle que soit la largeur calculee.

---

## Auteur

**Arnaud Valente Jacot-Descombes**  
Stagiaire EPFL  
Quality Management — NEXANS Suisse SA  
✉ arnaud_jacot@hotmail.com · 🌐 [arnvalen.ch](https://arnvalen.ch)
