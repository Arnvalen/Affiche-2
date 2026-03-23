# Architecture technique

## Vue d'ensemble

```
index.html
  └── src/main.jsx          Point d'entree React
        └── src/App.jsx      Application complete
```

L'application est un editeur split-screen :
- **Gauche** : sidebar avec 6 onglets d'edition (En-tete, Format, Entree, Process, Sortie, Export)
- **Droite** : apercu temps reel du poster, scale pour tenir dans la fenetre

## Dependances

| Package | Role |
|---------|------|
| `react` / `react-dom` | Framework UI |
| `qrcode` | Generation de la matrice QR (pas de rendu, juste les donnees) |
| `html-to-image` | Capture du DOM en image PNG (pour export PDF) |
| `jspdf` | Creation de fichiers PDF |
| `vite` + `@vitejs/plugin-react` | Build et dev server |

## Composants

### Rendu (preview)

```
PosterPreview (data-poster-root)
  ├── Header (barre rouge : reference, process, logo)
  ├── Legend (barre des types de tags)
  ├── Main content
  │   ├── BookendPanel (entree, vert)
  │   ├── Arrow (›)
  │   ├── Step grid
  │   │   └── Step cards (header noir + operations)
  │   │       └── Operations (lettre cerclee + nom + tags)
  │   │       └── Control points (barre bleue)
  │   ├── Arrow (›)
  │   └── BookendPanel (sortie, rouge)
  ├── Background image (optionnel, hauteur configurable)
  └── Footer (barre noire : version, format, ligne)
```

### Edition (sidebar)

```
App
  ├── TagEditor        Gestion des tags + URLs QR
  ├── BookendEditor    Edition entree/sortie (categories > elements > tags)
  └── StepsEditor      Edition etapes (titre > operations > tags)
```

### Primitives UI

- `Btn` : bouton avec couleur, taille, mode outline
- `Input` : champ texte stylise
- `SectionCard` : carte depliable avec titre et actions

### QR codes

`QRCodeSVG` utilise `QRCode.create(url, { errorCorrectionLevel: "L" })` de la lib `qrcode` pour obtenir la matrice de modules, puis rend chaque module comme un `<rect>` SVG. Le QR est natif SVG (pas une image raster).

## Gestion du state

Un seul `useState` avec la structure `defaultData()`. Toute mise a jour passe par :

```js
const up = useCallback((fn) => setData(prev => {
  const d = JSON.parse(JSON.stringify(prev));  // clone profond
  fn(d);                                        // mutation sur le clone
  return d;
}), []);
```

Les editeurs appellent `up(d => { d.quelqueChose = valeur; })`.

## Systeme de scaling

Toutes les dimensions dans `PosterPreview` sont multipliees par `s` (fontScale) :
- Tailles de police : `fontSize: 12 * s`
- Paddings : `padding: ${8*s}px`
- QR codes : `qrSize * s`
- Gaps : `gap: 10 * s`

Le poster est rendu a sa taille reelle en pixels (`width: fmt.w * MM_PX`), puis le wrapper dans App applique `transform: scale(sc)` ou `sc = Math.min(1, 700 / posterWidth)` pour l'apercu.

## Formats papier

Definis dans `FORMATS` avec dimensions en mm :

| Format | Largeur | Hauteur |
|--------|---------|---------|
| A0-paysage | 1189 | 841 |
| A1-paysage | 841 | 594 |
| A2-paysage | 594 | 420 |
| A3-paysage | 420 | 297 |
| A4-paysage | 297 | 210 |
| (idem en portrait, w/h inverses) | | |

Conversion mm → px : `MM_PX = 1.4` (arbitraire, pour le rendu ecran).

## Pipeline d'export

### JSON
```
data → JSON.stringify → Blob → download
```
Re-importable via `importJSON` (FileReader → JSON.parse → setData).

### SVG
```
DOM [data-poster-root]
  → XMLSerializer.serializeToString()    (XHTML valide)
  → wrap dans <svg><foreignObject>...</foreignObject></svg>
  → Blob → download
```

### PDF
```
DOM [data-poster-root]
  → html-to-image toPng(el, { pixelRatio })   (capture haute res)
  → jsPDF.addImage(png, format mm)
  → pdf.save()
```

## Decisions techniques et justifications

### Pourquoi un seul fichier ?
Le projet est petit (~500 lignes) et auto-contenu. Splitter ajouterait de la complexite (imports, props drilling) sans benefice reel. Les sections sont clairement separees par des commentaires.

### Pourquoi inline styles ?
Les exports SVG et PDF capturent le DOM. Avec des classes CSS, il faudrait extraire et injecter les stylesheets dans le SVG foreignObject. Avec des inline styles, tout est deja embarque.

### Pourquoi XMLSerializer et pas outerHTML ?
`outerHTML` produit du HTML5 (balises `<img>` non fermees). Dans un `<foreignObject>` SVG, le contenu doit etre du XHTML valide. `XMLSerializer` produit automatiquement du XML bien forme.

### Pourquoi html-to-image et pas html2canvas ?
`html2canvas` re-implemente le rendu CSS en JavaScript. Il gere mal les layouts flexbox complexes et les contextes de `transform`. `html-to-image` utilise le moteur de rendu natif du navigateur via SVG foreignObject, produisant un rendu fidele.

### Pourquoi pas de PDF vectoriel ?
Il n'existe pas de bibliotheque client-side capable de convertir du HTML/CSS arbitraire en PDF vectoriel. Les options :
- `@react-pdf/renderer` : necessite de recoder tout le layout avec ses propres primitives (resultat different du preview)
- `html2canvas` + `jsPDF` : raster, rendu deforme
- `html-to-image` + `jsPDF` : raster, mais fidele au preview (solution retenue)
- `window.print()` : vectoriel natif, mais necessite interaction utilisateur (dialogue d'impression)
