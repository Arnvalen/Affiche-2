<!--
version: 1.1.2
date: 2026-04-24
modifications:
  - Sidebar : 8 → 10 onglets
  - Onglet Format : ajout palette couleur (8 thèmes)
  - Onglet Ligne : ajout sliders Hauteur bandeau et Écart entre machines, mention DAG
  - Nouvel onglet Plan (§7) : plan technique, 2 vues, légende partagée
  - Numérotation des onglets Export (8→9) et Biblio (8→10) mise à jour
  - Data model : ajout palette, lineEdgeGap, line[].next[], technicalPlan
  - Stack : state immer produce
-->

# Nexans Poster Editor — Documentation

## Présentation

Le **Nexans Poster Editor** est un éditeur web d'affiches de lignes de production industrielles, conçu pour l'entreprise Nexans. Il permet de créer, personnaliser et exporter des affiches grand format décrivant visuellement l'ensemble d'un processus de fabrication : matières entrantes, étapes du process, opérations, points de contrôle, documents associés et produits sortants.

L'application est une **Single Page Application (SPA)** React servie par Vite, entièrement contenue dans un seul fichier source (`src/App.jsx`). Elle fonctionne intégralement dans le navigateur, sans serveur backend ni base de données.

---

## Objectif

Fournir aux équipes de production un outil simple et autonome pour :

- **Documenter** les lignes de production sous forme d'affiches normalisées
- **Associer** des documents qualité (SWI, IC, LC, AQE) à chaque étape et opération
- **Intégrer** des QR codes pointant vers la documentation en ligne
- **Représenter** visuellement le schéma de la ligne avec les machines et leur enchaînement
- **Exporter** l'affiche en PDF, SVG ou JSON pour impression, archivage ou partage

---

## Structure d'une affiche

Chaque affiche est composée des zones suivantes, de haut en bas :

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER  (référence, nom du process, sous-titre, logo)      │
├─────────────────────────────────────────────────────────────┤
│  LÉGENDE  (types de tags, générée automatiquement)          │
├──────────┬───┬────────────────────────────┬───┬─────────────┤
│          │   │  ÉTAPE 1  │  ÉTAPE 2       │   │             │
│  ENTRÉE  │ ▶ │  ÉTAPE 3  │  ÉTAPE 4       │ ▶ │   SORTIE    │
│          │   │  ÉTAPE 5  │                │   │             │
├──────────┴───┴────────────────────────────┴───┴─────────────┤
│  LIGNE DE PRODUCTION  (schéma machines, optionnel)          │
├─────────────────────────────────────────────────────────────┤
│  FOOTER  (version, format, dimensions, ligne)               │
└─────────────────────────────────────────────────────────────┘
```

### Header

Bandeau rouge Nexans (`#C8102E`) contenant :
- **Référence** de la ligne (ex: `37019`), en police monospace grande
- **Nom du process** (ex: `Extrusion mono-couche`)
- **Sous-titre** optionnel (ex: `Fil isolé coloré`)
- **Logo** personnalisable (image importée) ou texte "Nexans" par défaut

La hauteur du header est ajustable. Le texte et le logo scalent proportionnellement à l'espace disponible.

### Légende

Barre automatique listant les types de tags utilisés avec leur couleur et libellé complet.

### Panneau Entrée (gauche)

Fond vert (`#2E7D32` / `#E8F5E9`). Liste les matières, informations et ressources nécessaires en entrée du process, organisées par catégories (sections). Chaque élément peut porter des tags documentaires avec QR codes optionnels.

### Grille des étapes (centre)

Zone principale. Les étapes du process sont affichées dans une grille configurable (nombre de colonnes). Chaque étape comprend :

- **Header coloré** avec un numéro cerclé, le titre de l'étape, et des tags optionnels (avec QR codes)
- **Liste d'opérations** : chaque opération a un nom et des tags documentaires
- **Points de contrôle** : barres bleues intercalées entre les opérations, représentant des vérifications qualité

Les étapes sont reliées par des flèches orange indiquant le flux du process. Si le process comporte plus d'étapes que de colonnes, les lignes se poursuivent en dessous avec une flèche de retour.

Chaque étape a une couleur unique tirée d'une palette de 8 couleurs.

### Panneau Sortie (droite)

Fond rouge (`#9B0D23` / `#FFEBEE`). Même structure que l'entrée, pour les produits, documents et informations en sortie du process.

### Ligne de production (optionnel)

Schéma visuel des machines de la ligne, regroupées par zone (étape). Chaque machine est représentée par :
- Une **icône SVG** importée
- Une **lettre** (A, B, C...) dans un cercle de la couleur de la zone
- Des **tags** optionnels (affichage configurable)
- Le **nom** de la machine

Les zones sont identifiées par un numéro ou un titre (au choix), et séparées par des flèches.

Les machines peuvent être liées à des opérations dans les étapes, ce qui affiche leur lettre à côté de l'opération correspondante.

### Footer

Barre sombre (`#212121`) affichant la version, le format papier, les dimensions, le nombre de colonnes, le facteur de police, et le nom de la ligne.

---

## Interface utilisateur

L'interface est composée de deux zones :

- **Sidebar gauche** (360px, rétractable) : éditeur avec 10 onglets
- **Zone droite** : aperçu temps réel du poster, mis à l'échelle pour tenir dans la fenêtre

### Onglets de la sidebar

#### 1. En-tête (`◆`)

Édition des champs du header :
- Référence, nom du process, sous-titre
- Import de logo (image)
- Import d'image bandeau (affichée entre le contenu et le footer)
- Contrôle de la hauteur de l'image bandeau (5% à 60%)

#### 2. Format (`⊞`)

Paramètres de mise en page :

| Paramètre | Description | Plage |
|-----------|-------------|-------|
| Format papier | A0 à A4, paysage ou portrait, ou personnalisé | Liste prédéfinie |
| Dimensions personnalisées | Largeur × Hauteur en mm | Libre |
| Forcer les dimensions | Si activé, le contenu débordant est masqué | On/Off |
| Colonnes max | Nombre de colonnes dans la grille d'étapes | Auto, 2-6 |
| Palette couleur | Thème de couleur pour les zones et flèches | 8 thèmes (Nexans, Océan, Forêt…) |
| Taille polices | Multiplicateur global | 0.5× à 3× |
| Taille QR codes | Taille de base des QR codes | 16px à 80px |
| Hauteur zone de titre | Épaisseur verticale du header | 30px à 120px |
| Largeur entrée/sortie | Largeur fixe des panneaux latéraux | 10px à 420px |
| Tags sur la ligne | Afficher/masquer les tags sous les machines | On/Off |
| Label des zones | Numéros (1, 2, 3) ou titres des étapes | Choix |

#### 3. Entrée (`▶`)

Éditeur du panneau d'entrée :
- Ajout/suppression de sections (catégories)
- Ajout/suppression d'éléments dans chaque section
- Ajout/suppression de tags sur chaque élément
- Tags au niveau du panneau (affichés dans le header vert)

#### 4. Process (`⚙`)

Éditeur des étapes :
- Ajout/suppression/réorganisation des étapes
- Édition du titre de chaque étape
- Ajout de tags au niveau de l'étape (affichés dans le header coloré)
- Ajout/suppression d'opérations normales et de points de contrôle
- Ajout de tags sur chaque opération
- Liaison d'opérations à des machines de la ligne

#### 5. Sortie (`◀`)

Même éditeur que l'entrée, pour le panneau de sortie.

#### 6. Ligne (`🏭`)

Gestion du schéma de la ligne de production.

En haut de l'onglet, deux sliders globaux :
- **Hauteur du bandeau** : hauteur de la bande ligne en % du poster (5 % à 60 %, défaut 25 %)
- **Écart entre machines** : espacement bord-à-bord entre icônes adjacentes (14 à 60 unités)

Ensuite :
- **Bibliothèque d'icônes SVG** : import de fichiers SVG (drag & drop ou sélection), chaque icône peut être ajoutée à la ligne
- **Chargement depuis un dossier** : si un dossier bibliothèque est ouvert (onglet Biblio), les SVG disponibles sont listés et importables en un clic
- **Composition de la ligne** : les machines sont organisées en graphe orienté (DAG), avec possibilité de :
  - Glisser-déposer des icônes depuis la bibliothèque
  - Assigner chaque machine à une étape (zone)
  - Définir les connexions entre machines (machine suivante)
  - Réordonner les machines au sein d'une zone
  - Supprimer une machine

#### 7. Plan (`📐`)

Éditeur du plan technique d'implantation :
- **2 vues** : Vue de dessus et Vue de face (images importées)
- **Zones d'étapes** : rectangles colorés dessinés à la souris sur l'image, liés à une étape
- **Labels machines** : lettres (A, B, A1…) placées sur l'image, liés à une machine de la ligne
- **Flèches** : optionnelles sur chaque label, pointant vers la machine sur le plan
- **Légende partagée** : affichée à droite des deux vues, elle liste toutes les zones et machines présentes dans l'une ou l'autre vue

#### 9. Export (`↗`)

Fonctions d'import/export :

| Action | Description |
|--------|-------------|
| **Exporter JSON** | Sauvegarde complète ré-importable (toutes les données, images en base64) |
| **Exporter SVG** | Image vectorielle avec QR codes natifs, ouvrable dans Illustrator/Inkscape |
| **Exporter PDF** | Document PDF aux dimensions exactes du format papier |
| **Importer JSON** | Charge un fichier JSON précédemment exporté |
| **Réinitialiser** | Remet les données par défaut (avec confirmation) |

La résolution PDF est configurable : 1× (96 DPI), 2× (200 DPI), 3× (300 DPI, défaut), 4× (400 DPI).

#### 10. Biblio (`📚`)

Système de bibliothèque locale basé sur l'API File System Access :
- Sélection d'un dossier local (`library/`)
- Sauvegarde de l'affiche courante dans le dossier
- Chargement d'affiches depuis le dossier
- Suppression de fichiers
- Rafraîchissement de la liste

---

## Tags documentaires

Les tags représentent des documents ou contrôles qualité associés aux éléments de l'affiche. Chaque tag a un type, et optionnellement une URL qui génère un QR code.

| Type | Nom complet | Couleur |
|------|-------------|---------|
| **SWI** | Standard Work Instruction | Rouge (`#C62828`) |
| **IC** | Instruction de contrôle | Orange (`#E65100`) |
| **LC** | Liste de contrôle | Vert (`#2E7D32`) |
| **AQE** | Appareil qualité embarqué | Violet (`#6A1B9A`) |
| **PC** | Point de contrôle | Bleu (`#1565C0`) — legacy, non listé dans l'éditeur mais fonctionnel |

Les tags peuvent être placés :
- Sur les panneaux entrée/sortie (header)
- Sur chaque élément des sections entrée/sortie
- Sur chaque étape (header de l'étape)
- Sur chaque opération d'une étape

Quand un tag a une URL non vide, un QR code SVG vectoriel est affiché à côté du libellé du tag.

---

## Exports — détails techniques

### JSON

Sérialisation complète du state (`JSON.stringify`). Le fichier contient toutes les données y compris les images (logo, bandeau, icônes SVG) encodées en base64 ou en texte SVG. Ce format permet la sauvegarde et le rechargement exact de l'affiche.

### SVG

Le DOM du poster est sérialisé via `XMLSerializer.serializeToString()` (et non `outerHTML`, qui produit du HTML5 invalide en XML). Le résultat est enveloppé dans un `<svg><foreignObject>`. Les styles inline sont embarqués, ce qui garantit un rendu fidèle dans tout logiciel supportant SVG avec foreignObject (navigateurs, Inkscape, Illustrator).

### PDF

Utilise `html-to-image` pour capturer le poster en PNG haute résolution (rendu navigateur natif via SVG foreignObject), puis `jsPDF` pour insérer l'image dans un PDF aux dimensions exactes du format papier. La bibliothèque `html2canvas` n'est **pas** utilisée car elle ré-implémente le rendu CSS en JavaScript et produit des résultats déformés avec les layouts flexbox complexes.

---

## Formats papier supportés

| Format | Dimensions (mm) |
|--------|-----------------|
| A0 paysage | 1189 × 841 |
| A1 paysage | 841 × 594 |
| A2 paysage | 594 × 420 |
| A3 paysage | 420 × 297 |
| A4 paysage | 297 × 210 |
| A0 portrait | 841 × 1189 |
| A1 portrait | 594 × 841 |
| A2 portrait | 420 × 594 |
| A3 portrait | 297 × 420 |
| A4 portrait | 210 × 297 |
| Personnalisé | Libre |

Le format recommandé pour la plupart des lignes de production est **A1 paysage**.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | React 18 |
| Bundler | Vite 6 |
| QR codes | `qrcode` (matrice) → rendu SVG natif |
| Capture DOM | `html-to-image` (PNG via rendu navigateur) |
| Génération PDF | `jsPDF` |
| Styles | 100% inline (objets React `style={{}}`) |
| State | Un seul `useState` dans App, mis à jour via `up(fn)` avec immer `produce` |
| Persistance | Export/import JSON + API File System Access (bibliothèque locale) |

### Pourquoi un seul fichier ?

Le choix de concentrer tout le code dans `src/App.jsx` est volontaire :
- L'application est un outil interne simple
- Les styles inline facilitent les exports SVG/PDF (pas de CSS externe à résoudre)
- Un seul fichier simplifie la maintenance et la compréhension globale

### Pourquoi des styles inline ?

Les exports SVG et PDF capturent le DOM directement. Avec des styles inline, le rendu exporté est identique au rendu à l'écran, sans dépendance à des feuilles de style externes.

---

## Lancer le projet

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev

# Build de production
npm run build
```

Le serveur de développement démarre sur `localhost:5173` (port par défaut Vite).

---

## Modèle de données

L'état complet de l'affiche est un objet JSON unique. Voici sa structure :

```
{
  header: { reference, processName, subtitle, logoDataUrl }
  format, customW, customH, maxCols, fontScale, qrSize
  forceFormat, bookendWidth, headerHeight, bgImageHeight
  showLineTags, lineZoneLabel, pdfResolution
  entree: { tags, sections: [{ id, title, items: [{ id, name, tags }] }] }
  steps: [{ id, title, tags, operations: [{ id, name, tags, isControlPoint?, lineItemId? }] }]
  sortie: { tags, sections: [...] }
  backgroundImage
  icons: [{ id, name, description, svgData }]
  palette                             // theme couleur (defaut "nexans")
  lineEdgeGap                         // ecart bord-a-bord machines (defaut 14)
  line: [{ id, iconId, stepId, size?, next?: string[] }]
  technicalPlan: { views: [...] }     // plan technique (2 vues annotees)
}
```

Les images (logo, bandeau) sont stockées en data URL base64. Les icônes SVG sont stockées en texte brut. Les IDs sont générés par un compteur incrémental (`_100`, `_101`, ...).

---

## Auteur

**Arnaud Valente Jacot-Descombes**  
Stagiaire EPFL  
Quality Management — NEXANS Suisse SA  
✉ arnaud_jacot@hotmail.com · 🌐 [arnvalen.ch](https://arnvalen.ch)
