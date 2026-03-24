# Installation rapide

## Prérequis

- **Node.js** v18 ou supérieur — https://nodejs.org (bouton LTS)
- **npm** v9 ou supérieur (inclus avec Node.js)
- Un navigateur moderne (Chrome, Edge, Firefox)

## Étape 1 — Vérifier Node.js

Ouvrir un terminal (PowerShell, cmd, Terminal) et taper :

```
node --version
npm --version
```

Si la commande échoue, installer Node.js depuis https://nodejs.org (bouton LTS).

## Étape 2 — Récupérer le projet

Cloner le dépôt ou extraire l'archive ZIP dans un dossier, puis se placer dedans :

```bash
cd nexans-poster-editor
```

## Étape 3 — Installer les dépendances

```
npm install
```

Cela installe automatiquement toutes les librairies nécessaires :
- **react / react-dom** — interface utilisateur
- **vite** — serveur de développement et build
- **qrcode** — génération des QR codes
- **html-to-image** — export PNG
- **jspdf** — export PDF

## Étape 4 — Lancer en développement

```
npm run dev
```

L'application s'ouvre à http://localhost:5173

> Le port peut varier si 5173 est déjà occupé — Vite l'indique dans le terminal.

## Commandes disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Lance le serveur de développement avec rechargement automatique |
| `npm run build` | Génère les fichiers de production dans `dist/` |
| `npm run preview` | Prévisualise le build de production localement |

## Résumé en 3 commandes

```bash
cd nexans-poster-editor
npm install
npm run dev
```

C'est tout.
