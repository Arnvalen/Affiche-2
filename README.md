# Nexans — Éditeur d'affiche ligne de production

Outil interne pour créer, éditer et exporter des affiches de lignes de production.
Interface React avec aperçu temps réel, QR codes intégrés, ligne de production visuelle, et export JSON / SVG / PNG / PDF.

---

## Prérequis

| Outil | Version minimale | Vérifier |
|-------|-----------------|----------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ (inclus avec Node) | `npm --version` |

**Windows** — Télécharger l'installeur LTS sur https://nodejs.org

---

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. (Optionnel) Générer les certificats HTTPS pour l'accès réseau
npm run setup:https
```

---

## Lancement

```bash
npm run dev
```

L'application s'ouvre automatiquement sur `https://localhost:3000`.

| Script | Description |
|--------|-------------|
| `npm run dev` | Serveur de développement avec hot-reload |
| `npm run build` | Build production dans `dist/` |
| `npm run preview` | Servir le build localement |
| `npm run setup:https` | Générer les certificats HTTPS (accès réseau sans warning) |

---

## Structure du projet

```
nexans-poster-editor/
├── index.html
├── package.json
├── vite.config.js
├── scripts/
│   └── setup-cert.mjs      # Génération des certificats HTTPS
├── .cert/                   # Certificats générés (ignoré par git)
│   ├── cert.pem
│   ├── key.pem
│   ├── ca.crt               # CA à distribuer aux clients
│   └── installer-ca.bat     # Script d'installation CA (Windows)
├── library/                 # Bibliothèque de configs JSON et icônes SVG
└── src/
    ├── main.jsx
    └── App.jsx              # Application complète (~1000 lignes)
```

---

## Utilisation

### Onglets de l'éditeur

| Onglet | Contenu |
|--------|---------|
| **En-tête** | Référence, process, sous-titre, logo, image bandeau |
| **Format** | Format papier (A0–A4, personnalisé), colonnes, taille police (1–20), QR, forçage |
| **Entrée** | Catégories et éléments d'entrée avec tags/QR |
| **Process** | Étapes, opérations, points de contrôle, associations machines |
| **Sortie** | Catégories et éléments de sortie avec tags/QR |
| **Ligne** | Constructeur de ligne de production (icônes SVG, zones, associations) |
| **Export** | JSON, SVG, PNG, PDF, import, réinitialisation |
| **Biblio** | Bibliothèque avec versionnage (JSON configs + icônes SVG) |

### Taille de police

Le curseur **Taille polices** va de 1 à 20. Des raccourcis nommés sont disponibles :

| Bouton | Valeur | Multiplicateur |
|--------|--------|----------------|
| XS | 3 | ×0.45 |
| S | 5 | ×0.75 |
| **M** | **7** | **×1.05** (défaut) |
| L | 10 | ×1.5 |
| XL | 14 | ×2.1 |
| 2XL | 20 | ×3.0 |

### Tags et QR codes

Chaque élément peut recevoir des tags : **SWI**, **IC**, **PC**, **LC**, **AQE**.
Pour associer un QR code à un tag, cliquer dessus et saisir l'URL.

### Ligne de production

L'onglet **Ligne** permet de composer visuellement la ligne de production :
1. Importer des icônes SVG (upload ou depuis la bibliothèque)
2. Ajouter des machines dans la zone de composition
3. Associer chaque machine à une étape du process
4. Les machines se regroupent en zones colorées (une par étape)
5. La ligne s'affiche en bandeau sur le poster

Chaque opération du process peut être liée à une machine — elle affiche alors la lettre de cette machine.

### Exports

| Format | Usage |
|--------|-------|
| **JSON** | Sauvegarde complète, ré-importable (nom libre au moment de l'export) |
| **SVG** | Vectoriel, éditable dans Illustrator / Inkscape |
| **PNG** | Image haute résolution (résolution configurable 1×–4×) |
| **PDF** | Document imprimable (résolution configurable 1×–4×) |

La résolution PNG/PDF est partagée : 3× (300 DPI) recommandé, 4× pour l'impression A0.

### Bibliothèque et versionnage

L'onglet **Biblio** permet d'ouvrir un dossier local (`library/` recommandé) pour :
- Sauvegarder/charger des configurations JSON avec versionnage automatique
- Charger des icônes SVG pour la ligne de production

**Versionnage** : le bouton "💾 Sauvegarder" propose automatiquement le nom suivant selon les fichiers existants (ex. `affiche_37019_V3` si V1 et V2 existent). Le nom reste modifiable.

**Vue arbre** : les fichiers partageant le même préfixe avant `_V{n}` sont groupés :
```
📁 affiche_37019   3 versions
  ├ V1   [Charger] [✕]
  ├ V2   [Charger] [✕]
  └ V3   [Charger] [✕]
📄 autre_affiche   [Charger] [✕]
```

> Nécessite HTTPS (voir section ci-dessous).

---

## Accès réseau (partage sur LAN)

Pour partager l'application sur le réseau local avec accès complet (incluant la bibliothèque) :

### 1. Générer les certificats (une seule fois)

```bash
npm run setup:https
```

Cette commande :
- Détecte votre IP locale automatiquement
- Génère un CA et un certificat serveur valides 1 an
- Installe la CA sur votre machine
- Génère `.cert/installer-ca.bat` pour les clients

### 2. Lancer le serveur

```bash
npm run dev
```

URL : `https://[votre-IP]:3000`

### 3. Clients (une seule fois par machine)

Distribuer **les deux fichiers ensemble** : `.cert/installer-ca.bat` et `.cert/ca.crt`.
Les deux doivent être dans le même dossier. Double-clic sur `installer-ca.bat` puis relancer le navigateur.

> **Renouvellement** : les certificats expirent après 1 an. Relancer `npm run setup:https` et redistribuer le nouveau `installer-ca.bat` + `ca.crt`.

> **Fallback sans certificat** : si `.cert/` est absent, Vite utilise un certificat auto-signé (avertissement navigateur, mais fonctionnel).

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `node: command not found` | Node.js non installé → voir Prérequis |
| Port 3000 occupé | Modifier `server.port` dans `vite.config.js` |
| Avertissement certificat | Lancer `npm run setup:https` et installer la CA |
| "Certificat introuvable" dans le .bat | Distribuer `installer-ca.bat` ET `ca.crt` dans le même dossier |
| La bibliothèque ne fonctionne pas | L'accès réseau nécessite HTTPS → voir section Accès réseau |
| QR code absent | URL trop longue (> 130 car.) ou invalide |
| Contenu coupé | Réduire police, augmenter colonnes, ou désactiver "Format fixe" |
| Export SVG vide | Vérifier que l'aperçu affiche l'affiche avant d'exporter |
| Lent en export 4× A0 | Normal (image ~100 MP) — utiliser 3× pour les grands formats |
| JSON importé avec petite police | Ancien format : `fontScale` était 1 (= ×1), nouveau : mettre 7 (= M) |

---

## Licence

Usage interne Nexans.
