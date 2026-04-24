<!--
version: 1.1.2
date: 2026-04-24
modifications:
  - Aucune modification (document à jour pour v1.1.2, couvre le système DAG/graphe)
-->

# Guide — Éditeur de ligne de production

## Contexte de l'application

**Nexans Affiche** est un éditeur d'affiches de lignes de production destiné aux sites industriels Nexans. Il permet de créer deux types d'affiches complémentaires :

- **Affiche visuelle** : représentation abstraite de la ligne — étapes de process, icônes machines, tags qualité/sécurité, codes QR. C'est le document affiché en atelier pour guider les opérateurs.
- **Affiche technique** : plans d'implantation annotés (vue de dessus, vue de côté) avec zones colorées par étape et lettres machines positionnées à la souris.

L'application est autonome (Electron + React, aucun serveur), les données sont sauvegardées localement en JSON. Les affiches s'exportent en SVG ou PDF haute résolution.

---

## La ligne de production

La ligne de production est la **bande horizontale** affichée en bas de l'affiche visuelle. Elle représente les machines physiques de la ligne sous forme d'icônes SVG, organisées en un **graphe orienté** (DAG) : chaque machine peut avoir des successeurs et des prédécesseurs, ce qui permet de modéliser les chemins parallèles, les fusions et les séquences.

Les machines sont regroupées par **zone** (= étape de process). Chaque zone est colorée distinctement. À l'intérieur d'une zone, chaque machine reçoit un **label alphanumérique** (A, A1, A2, B…) calculé à partir de sa position dans le graphe :

- La **lettre** correspond à la colonne de profondeur dans la zone (A = 1ère colonne, B = 2ème…)
- Le **chiffre** apparaît uniquement si plusieurs machines occupent la même colonne en parallèle (A1, A2)

Ce label est cohérent dans toute l'application : bande ligne, étapes de process, et plan technique.

---

## Onglet Ligne 🏭

L'éditeur de ligne est accessible via l'onglet **Ligne** dans la barre latérale. Il est structuré en trois sections.

---

### 1. SVG disponibles (bibliothèque dossier)

Cette section liste les fichiers `.svg` présents dans le dossier `library/` situé à côté du lanceur `.bat`. Elle n'apparaît que si ce dossier contient des fichiers.

| Action | Résultat |
|---|---|
| **+ Charger** (à côté d'un fichier) | Importe ce SVG dans la bibliothèque de la session |
| **Tout importer** | Importe tous les SVG non encore chargés |

> Les fichiers déjà chargés sont signalés "déjà chargé" et ne peuvent pas être importés en double.

---

### 2. Bibliothèque d'icônes

Grille de toutes les icônes importées dans la session (upload manuel ou depuis le dossier library).

| Action | Résultat |
|---|---|
| **+ Importer SVG** | Ouvre un sélecteur de fichiers, accepte plusieurs `.svg` simultanément |
| **✕** (coin de l'icône) | Supprime l'icône de la bibliothèque ET retire toutes les machines qui l'utilisent de la ligne |
| **Glisser** une icône | Permet de la déposer directement dans une zone de la ligne |
| **+ Ligne** | Ouvre le **panel d'ajout rapide** |

#### Panel d'ajout rapide

Cliquer **+ Ligne** ouvre un panel contextuel directement sous la grille :

```
┌─────────────────────────────────────────┐
│ Ajouter : Extrudeuse                    │
│                                         │
│ Zone :                                  │
│ [Sans zone]  [● PRE-EXTRUSION]  [● EXTRUSION]  … │
│                                         │
│ Après (qui pointe vers la nouvelle) :   │
│ [Aucune]  [A Dévidoir]  [B Redresseur]  │
│                                         │
│ Avant (vers qui pointe la nouvelle) :   │
│ [Aucune]  [A Extrudeuse]  [B Refroidisseur] │
│                                         │
│ [Ajouter]  [Annuler]                    │
└─────────────────────────────────────────┘
```

**Zone** : cliquer sur un chip coloré assigne la machine à cette étape. "Sans zone" laisse la machine non liée (zone grise).

**Après** : machine existante qui sera connectée **vers** la nouvelle (connexion entrante). Sélectionner "Aucune" si la nouvelle machine est une source sans prédécesseur dans la zone.

**Avant** : machine existante vers laquelle la nouvelle sera connectée (connexion sortante). Sélectionner "Aucune" si la nouvelle machine est un terminal sans successeur dans la zone.

> Les deux champs sont indépendants et tous deux optionnels. Il est possible de définir uniquement "Après", uniquement "Avant", les deux, ou aucun.

Cliquer **Ajouter** crée la machine et les connexions. Le panel se ferme.

---

### 3. Ligne de production

Vue en zones miroir du rendu final. Chaque zone affiche ses machines avec leur label réel (A, A1, B…).

#### Par machine

Chaque carte machine contient :

| Élément | Description |
|---|---|
| **Cercle coloré + label** | Label alphanumérique (A, A1, B…) cohérent avec le preview |
| **Icône SVG** | Aperçu de la machine |
| **Nom** | Nom issu du fichier SVG, tronqué si trop long |
| **Sélecteur de zone** | Dropdown pour changer la zone sans recréer la machine |
| **← →** | Réordonne la machine au sein de sa zone |
| **✕** | Retire la machine de la ligne (sans supprimer l'icône) |
| **Badges → X ✕** | Connexions sortantes existantes — cliquer pour supprimer |
| **Dropdown +→** | Ajoute une connexion sortante vers une autre machine |

#### Zones

- Chaque zone est encadrée dans la couleur de l'étape correspondante
- Un **drop target `+`** à droite de chaque zone accepte le glisser-déposer d'une icône depuis la bibliothèque
- Une **zone de dépôt globale** en bas accepte les icônes à ajouter sans zone

---

## Modèle graphe — logique des connexions

La ligne est un **DAG** (graphe acyclique dirigé). Chaque machine a un champ `next: []` listant les IDs des machines vers lesquelles elle pointe.

```
Machine A ──→ Machine B ──→ Machine C
              ↑
Machine D ───┘
```

Ce modèle permet :
- **Séquences** simples (A → B → C)
- **Bifurcations** (A → B et A → C en parallèle)
- **Fusions** (A et B → C)
- **Chemins indépendants** dans la même zone ou dans des zones différentes

Le moteur de layout `computeLayout` calcule automatiquement les colonnes et lignes de chaque machine pour le rendu SVG.

---

## Cohérence des labels dans l'application

Le label d'une machine (ex. `A2`) est calculé une seule fois via `getLineLabel()` et utilisé partout :

| Emplacement | Usage |
|---|---|
| **Bande ligne** (affiche visuelle) | Cercle badge au-dessus de l'icône |
| **Étapes de process** | Badge coloré à gauche de chaque opération liée |
| **Plan technique** | Cercle positionné sur l'image de plan |
| **Éditeur de ligne** | Affichage dans les zones + dropdowns de connexion |

---

## Conseils

- **Construire la ligne de gauche à droite** : ajouter les machines dans l'ordre du flux, en utilisant le champ "Après" pour chaîner automatiquement.
- **Parallèles** : pour deux machines en parallèle après A, ajouter B1 avec "Après A", puis B2 avec "Après A" également. Les deux recevront A1/A2 ou B1/B2 selon leur colonne.
- **Réorganiser** : les boutons ← → dans l'éditeur changent l'ordre dans `data.line`, ce qui modifie l'ordre d'affichage à l'intérieur d'une colonne (donc les numéros de track).
- **Changer de zone** : utiliser le sélecteur dropdown directement sur la carte machine, sans avoir à supprimer et recréer.

---

## Auteur

**Arnaud Valente Jacot-Descombes**  
Stagiaire EPFL  
Quality Management — NEXANS Suisse SA  
✉ arnaud_jacot@hotmail.com · 🌐 [arnvalen.ch](https://arnvalen.ch)
