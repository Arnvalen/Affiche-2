# CLAUDE.md — Contexte projet pour assistants IA

## Description

Editeur web d'affiches de lignes de production Nexans. Application React monopage (SPA) avec Vite. Tout le code applicatif est dans `src/App.jsx` (~500 lignes).

## Commandes

```bash
npm install          # Installer les dependances
npm run dev          # Dev server sur localhost:3000
npm run build        # Build production dans dist/
```

## Conventions

- **Un seul fichier source** : `src/App.jsx` contient tout (composants, editeurs, preview, exports, state). C'est volontaire, ne pas splitter sans raison.
- **100% inline styles** : pas de CSS externe, pas de classes. Tous les styles sont des objets React `style={{...}}`. Cela simplifie les exports SVG/PDF.
- **Pas de state management externe** : un seul `useState(defaultData)` dans App, mis a jour via `up(fn)` (clone profond + mutation).
- **Pas de TypeScript** : JSX pur.
- **Pas de tests** : projet interne simple.

## Architecture de App.jsx

Le fichier est organise en sections separees par des commentaires `/* ═══ ... ═══ */` :

1. **Constantes** (lignes 6-18) : TAG_TYPES, TAG_COLORS, FORMATS, MM_PX
2. **QRCodeSVG** (lignes 20-38) : QR codes en SVG natif via `qrcode` lib
3. **Tag / TagWithQR** (lignes 40-56) : badges de tags avec QR optionnel
4. **UI Primitives** (lignes 58-61) : Btn, Input, SectionCard
5. **Editeurs** (lignes 63-155) : TagEditor, BookendEditor, StepsEditor
6. **Preview** (lignes 157-299) : BookendPanel, PosterPreview (element `data-poster-root`)
7. **Default data** (lignes 301-350) : donnees par defaut avec exemple
8. **App principal** (lignes 352-500) : state, exports, sidebar tabs, layout

## Modele de donnees

Voir `defaultData()` ligne 302 pour la structure complete. Points cles :

- `header.logoDataUrl` et `backgroundImage` : images en base64 data URL
- `format` : cle dans FORMATS (ex: "A1-paysage") ou "Personnalise"
- `fontScale` : multiplicateur applique a toutes les tailles de police et espacements
- Chaque tag a `{ id, type, url }` — l'URL genere un QR code si non-vide
- `isControlPoint: true` sur une operation la rend comme un point de controle bleu

## Exports — points techniques critiques

### SVG (exportSVG, ligne 362)
- Utilise `XMLSerializer.serializeToString()` et **non** `outerHTML`
- Raison : `outerHTML` produit du HTML5, pas du XHTML valide. Les `<img>` ne sont pas auto-fermees, ce qui corrompt le XML dans le foreignObject.
- Les namespaces SVG (pour les QR codes inline) sont geres automatiquement par XMLSerializer.

### PDF (exportPDF, ligne 378)
- Utilise `html-to-image` (capture DOM via SVG foreignObject natif du navigateur) + `jsPDF`
- **Ne pas utiliser `html2canvas`** : il re-implemente le rendu CSS en JavaScript et produit des resultats deformes avec les layouts flexbox complexes de ce projet.
- Resolution configurable via `data.pdfResolution` (1-4, defaut 3)
- Attention memoire pour grands formats (A0) + haute resolution

## Couleurs du design

- Rouge principal : `#C8102E` (Nexans)
- Orange : `#E87722` (numeros d'etapes)
- Noir header etapes : `#212121`
- Footer : `#212121`
- Entree : vert `#2E7D32` / `#E8F5E9`
- Sortie : rouge fonce `#9B0D23` / `#FFEBEE`

## Pieges connus

- Le poster est affiche dans un `transform: scale()` dans le preview — les exports doivent capturer l'element `[data-poster-root]` directement, pas le wrapper scale.
- `MM_PX = 1.4` : facteur de conversion mm vers pixels pour le rendu ecran. Ce n'est pas un DPI standard, c'est un choix de rendu.
- Les IDs sont generes par `uid()` (compteur incremental). Ils ne sont pas persistants entre sessions — le JSON sauvegarde les IDs tels quels.
