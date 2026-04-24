/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  constants.js                                              v2.0.0   ║
 * ║  Types de tags, palettes, formats papier, constantes globales       ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════ TYPES DE TAGS ═══════════════════ */

/**
 * Liste des types de tags sélectionnables par l'utilisateur dans l'éditeur.
 * Chaque type correspond à un document qualité Nexans :
 *   SWI  — Standard Work Instruction (instruction de travail)
 *   IC   — Instruction de contrôle
 *   LC   — Liste de contrôle (checklist)
 *   AQE  — Appareil qualité embarqué
 * Note : "PC" (Point de contrôle) existe dans TAG_COLORS mais n'est PAS dans TAG_TYPES
 * car il est modélisé comme une opération spéciale (isControlPoint), pas comme un tag.
 */
export const TAG_TYPES = ["SWI", "IC", "LC", "AQE"];

/**
 * Couleurs d'affichage associées à chaque type de tag.
 * Chaque entrée contient :
 *   bg     — couleur de fond du badge
 *   color  — couleur du texte
 *   border — couleur de la bordure
 * Utilisé par Tag.jsx, TagWithQR.jsx, et la bande SVG LineFlowBand.jsx.
 */
export const TAG_COLORS = {
  SWI: { bg: "#FFEBEE", color: "#C62828", border: "#EF9A9A" }, // rouge — SWI
  IC:  { bg: "#FFF3E0", color: "#E65100", border: "#FFCC80" }, // orange — IC
  PC:  { bg: "#E3F2FD", color: "#1565C0", border: "#90CAF9" }, // bleu — Point de contrôle
  LC:  { bg: "#E8F5E9", color: "#2E7D32", border: "#A5D6A7" }, // vert — LC
  AQE: { bg: "#F3E5F5", color: "#6A1B9A", border: "#CE93D8" }, // violet — AQE
};

/**
 * Libellés complets des types de tags, utilisés dans la légende du poster.
 * La légende affiche le badge TAG_TYPES[i] suivi de TAG_LABELS[type] en clair.
 */
export const TAG_LABELS = {
  SWI: "Standard Work Instruction",
  IC:  "Instruction de contrôle",
  PC:  "Point de contrôle",
  LC:  "Liste de contrôle",
  AQE: "Appareil qualité embarqué",
};

/* ═══════════════════ FORMATS PAPIER ═══════════════════ */

/**
 * Formats papier ISO disponibles pour le poster, en millimètres (largeur × hauteur).
 * Inclut paysage (w > h) et portrait (h > w) pour A0 à A4, plus un format personnalisé.
 * Le format "Personnalisé" sert de fallback — ses dimensions sont stockées dans
 * data.customW / data.customH et peuvent être définies librement.
 */
export const FORMATS = {
  "A0-paysage":   { w: 1189, h: 841  },
  "A1-paysage":   { w: 841,  h: 594  },
  "A2-paysage":   { w: 594,  h: 420  },
  "A3-paysage":   { w: 420,  h: 297  },
  "A4-paysage":   { w: 297,  h: 210  },
  "A0-portrait":  { w: 841,  h: 1189 },
  "A1-portrait":  { w: 594,  h: 841  },
  "A2-portrait":  { w: 420,  h: 594  },
  "A3-portrait":  { w: 297,  h: 420  },
  "A4-portrait":  { w: 210,  h: 297  },
  "Personnalisé": { w: 800,  h: 500  },
};

/* ═══════════════════ UNITÉS ═══════════════════ */

/**
 * Facteur de conversion millimètres → pixels pour le rendu écran.
 * Valeur arbitraire (pas un DPI standard) choisie pour que le poster
 * tienne à l'écran à échelle 1. La réduction visuelle est gérée par
 * transform: scale() dans App.jsx.
 * Utilisé aussi pour calculer le pixelRatio d'export PDF/PNG :
 *   pixelRatio = dpiCible / (MM_PX * 25.4)
 */
export const MM_PX = 1.4;

/* ═══════════════════ COULEURS DE ZONE (LEGACY) ═══════════════════ */

/**
 * Palette de couleurs indexée pour les zones (étapes) de la ligne de production.
 * Utilisée comme fallback dans LineEditor.jsx pour les badges de zone dans l'éditeur.
 * Dans le poster et le plan technique, la couleur de zone est calculée dynamiquement
 * via getZoneColor() (dégradé interpolé depuis la palette active).
 */
export const ZONE_COLORS = [
  "#1565C0", // bleu foncé
  "#00838F", // cyan
  "#E65100", // orange
  "#6A1B9A", // violet
  "#AD1457", // rose
  "#F57F17", // jaune
  "#4E342E", // brun
  "#37474F", // gris ardoise
];
