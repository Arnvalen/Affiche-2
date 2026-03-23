# Nexans — Éditeur d'affiche ligne de production

Outil interne pour créer, éditer et exporter des affiches de lignes de production.
Interface React avec aperçu temps réel, QR codes intégrés, et export JSON / SVG / PDF.

---

## Prérequis

| Outil | Version minimale | Vérifier l'installation |
|-------|-----------------|------------------------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ (inclus avec Node) | `npm --version` |

### Installer Node.js si absent

**Windows** — Télécharger l'installeur sur https://nodejs.org (version LTS recommandée).

**macOS** — Via Homebrew :
```bash
brew install node
```

**Linux (Ubuntu/Debian)** :
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## Installation

### 1. Décompresser le projet

Extraire `nexans-poster-editor.zip` dans le dossier de votre choix.

### 2. Ouvrir un terminal dans le dossier

```bash
cd chemin/vers/nexans-poster-editor
```

### 3. Installer les dépendances

```bash
npm install
```

Cette commande installe React, Vite et les plugins nécessaires (~30 secondes).

---

## Lancement

### Mode développement (avec hot-reload)

```bash
npm run dev
```

L'application s'ouvre automatiquement dans le navigateur à l'adresse :

```
http://localhost:3000
```

Toute modification du code source est reflétée instantanément.

### Mode production (build optimisé)

```bash
npm run build
npm run preview
```

Le build génère un dossier `dist/` avec les fichiers statiques optimisés.
`npm run preview` sert ces fichiers localement pour vérification.

---

## Structure du projet

```
nexans-poster-editor/
├── index.html              # Point d'entrée HTML
├── package.json            # Dépendances et scripts
├── vite.config.js          # Configuration Vite
├── .gitignore
├── README.md               # Ce fichier
└── src/
    ├── main.jsx            # Bootstrap React
    └── App.jsx             # Application complète (éditeur + preview + QR)
```

---

## Utilisation

### Interface

L'éditeur se compose de deux zones :

- **Panneau gauche** — 6 onglets d'édition :
  - **En-tête** : référence, nom du process, sous-titre, logo, image bandeau
  - **Format** : format papier (A0→A4, portrait/paysage, personnalisé), colonnes, taille police, taille QR, forçage du format
  - **Entrée** : catégories et éléments d'entrée avec tags
  - **Process** : étapes avec opérations et tags (ajout, suppression, réordonnement)
  - **Sortie** : catégories et éléments de sortie avec tags
  - **Export** : JSON, SVG, PDF, import, réinitialisation

- **Zone droite** — Aperçu temps réel de l'affiche

### Tags et QR codes

Chaque élément peut recevoir des tags parmi : **SWI**, **IC**, **PC**, **LC**, **AQE**.

Pour associer un QR code à un tag :
1. Cliquer sur le tag dans l'éditeur (panneau gauche)
2. Saisir l'URL dans le champ "URL QR" qui apparaît
3. Le QR code apparaît automatiquement dans l'aperçu, encadré dans la couleur du tag

La taille des QR est réglable globalement dans l'onglet **Format**.

### Forcer le format

Par défaut, l'affiche s'étend verticalement si le contenu dépasse.
Cocher **"Forcer les dimensions exactes"** dans l'onglet Format pour :
- Fixer la hauteur au format choisi
- Masquer le contenu excédentaire
- Afficher un indicateur visuel "FORMAT FIXE"

Si le contenu est coupé : réduire la police, augmenter les colonnes, ou passer à un format plus grand.

### Exports

| Format | Usage |
|--------|-------|
| **JSON** | Sauvegarde complète, ré-importable dans l'outil |
| **SVG** | Vectoriel, éditable dans Illustrator / Inkscape |
| **PDF** | Via Ctrl+P / Cmd+P (impression navigateur) |

---

## Déploiement réseau interne

Pour rendre l'outil accessible à d'autres postes sur le réseau local :

```bash
npm run dev -- --host 0.0.0.0
```

L'adresse réseau s'affiche dans le terminal (ex: `http://192.168.1.42:3000`).
Les autres postes y accèdent via cette adresse.

Pour un déploiement permanent, servir le dossier `dist/` (après `npm run build`) avec n'importe quel serveur HTTP (nginx, Apache, IIS, Python http.server, etc.) :

```bash
# Exemple rapide avec Python
npm run build
cd dist
python3 -m http.server 8080
```

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `node: command not found` | Node.js n'est pas installé → voir section Prérequis |
| `npm ERR! EACCES` | Droits insuffisants → relancer le terminal en admin ou utiliser `sudo` |
| Port 3000 occupé | Modifier le port dans `vite.config.js` (champ `server.port`) |
| QR code ne s'affiche pas | Vérifier que l'URL est valide et fait moins de ~130 caractères |
| Contenu coupé en mode "Format fixe" | Réduire police (onglet Format), augmenter colonnes, ou désactiver le forçage |
| Export SVG vide | Vérifier que l'aperçu affiche bien l'affiche avant d'exporter |

---

## Licence

Usage interne Nexans.
