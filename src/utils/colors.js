/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  utils/colors.js                                           v2.0.0   ║
 * ║  Interpolation de couleurs, palettes et getZoneColor                ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════ INTERPOLATION ═══════════════════ */

/**
 * Interpolation linéaire (lerp) entre deux couleurs hexadécimales.
 * @param {string} a  Couleur de départ  ex: "#C8102E"
 * @param {string} b  Couleur d'arrivée  ex: "#1565C0"
 * @param {number} t  Paramètre [0..1]   0 = a, 1 = b
 * @returns {string}  Couleur hex résultante
 */
export const lerpColor = (a, b, t) => {
  // Convertit chaque composante hex en entier
  const h = s => parseInt(s, 16);
  const [ar, ag, ab] = [h(a.slice(1,3)), h(a.slice(3,5)), h(a.slice(5,7))];
  const [br, bg, bb] = [h(b.slice(1,3)), h(b.slice(3,5)), h(b.slice(5,7))];
  // Mélange linéaire par composante, pad pour garantir 2 chiffres hex
  const mix = (x, y) => Math.round(x*(1-t) + y*t).toString(16).padStart(2,'0');
  return `#${mix(ar,br)}${mix(ag,bg)}${mix(ab,bb)}`;
};

/**
 * Calcule la couleur d'une zone d'étape par interpolation entre pal.zoneFrom et pal.zoneTo.
 * Permet un dégradé uniforme quelle que soit le nombre d'étapes.
 * @param {object} pal    Palette active (voir PALETTES)
 * @param {number} index  Index de l'étape (0-based)
 * @param {number} total  Nombre total d'étapes
 * @returns {string}      Couleur hex de la zone
 */
export const getZoneColor = (pal, index, total) =>
  lerpColor(pal.zoneFrom, pal.zoneTo, total <= 1 ? 0 : index / (total - 1));

/* ═══════════════════ PALETTES ═══════════════════ */

/**
 * Thèmes de couleurs disponibles pour le poster.
 *
 * Structure d'une palette :
 *   id        — identifiant technique (stocké dans data.palette)
 *   name      — libellé affiché dans le sélecteur de palette
 *   primary   — couleur principale (header, footer, barre de titre)
 *   accent    — couleur des flèches et connecteurs
 *   footer    — couleur du footer (souvent plus sombre que primary)
 *   entreeH   — fond de l'en-tête du panneau Entrée
 *   entreeB   — fond du corps du panneau Entrée
 *   entreeBr  — bordure du panneau Entrée
 *   sortieH   — fond de l'en-tête du panneau Sortie
 *   sortieB   — fond du corps du panneau Sortie
 *   sortieBr  — bordure du panneau Sortie
 *   cp        — couleurs du badge Point de contrôle { bg, br, tx }
 *   zoneFrom  — couleur de départ du dégradé des zones d'étapes
 *   zoneTo    — couleur d'arrivée du dégradé des zones d'étapes
 */
export const PALETTES = [
  {
    id: "nexans", name: "Nexans Classic",
    primary: "#C8102E", accent: "#E87722", footer: "#212121",
    entreeH: "#2E7D32", entreeB: "#E8F5E9", entreeBr: "#A5D6A7",
    sortieH: "#9B0D23", sortieB: "#FFEBEE", sortieBr: "#EF9A9A",
    cp: { bg: "#E3F2FD", br: "#90CAF9", tx: "#1565C0" },
    zoneFrom: "#C8102E", zoneTo: "#1565C0",
  },
  {
    id: "cobalt", name: "Cobalt Pro",
    primary: "#1565C0", accent: "#0288D1", footer: "#0A1929",
    entreeH: "#00695C", entreeB: "#E0F2F1", entreeBr: "#80CBC4",
    sortieH: "#AD1457", sortieB: "#FCE4EC", sortieBr: "#F48FB1",
    cp: { bg: "#E8EAF6", br: "#7986CB", tx: "#283593" },
    zoneFrom: "#0D47A1", zoneTo: "#0097A7",
  },
  {
    id: "graphite", name: "Graphite",
    primary: "#37474F", accent: "#607D8B", footer: "#102027",
    entreeH: "#2E7D32", entreeB: "#E8F5E9", entreeBr: "#A5D6A7",
    sortieH: "#B71C1C", sortieB: "#FFEBEE", sortieBr: "#EF9A9A",
    cp: { bg: "#ECEFF1", br: "#78909C", tx: "#37474F" },
    zoneFrom: "#263238", zoneTo: "#90A4AE",
  },
  {
    id: "foret", name: "Forêt",
    primary: "#2E7D32", accent: "#558B2F", footer: "#1A2E1B",
    entreeH: "#1565C0", entreeB: "#E3F2FD", entreeBr: "#90CAF9",
    sortieH: "#BF360C", sortieB: "#FBE9E7", sortieBr: "#FFAB91",
    cp: { bg: "#F1F8E9", br: "#AED581", tx: "#33691E" },
    zoneFrom: "#1B5E20", zoneTo: "#00897B",
  },
  {
    id: "ocean", name: "Océan",
    primary: "#006064", accent: "#00ACC1", footer: "#002F35",
    entreeH: "#1565C0", entreeB: "#E3F2FD", entreeBr: "#90CAF9",
    sortieH: "#AD1457", sortieB: "#FCE4EC", sortieBr: "#F48FB1",
    cp: { bg: "#E0F7FA", br: "#80DEEA", tx: "#00838F" },
    zoneFrom: "#004D40", zoneTo: "#0277BD",
  },
  {
    id: "soleil", name: "Soleil",
    primary: "#F57F17", accent: "#FDD835", footer: "#3E2723",
    entreeH: "#2E7D32", entreeB: "#E8F5E9", entreeBr: "#A5D6A7",
    sortieH: "#BF360C", sortieB: "#FBE9E7", sortieBr: "#FFAB91",
    cp: { bg: "#FFFDE7", br: "#FDD835", tx: "#F57F17" },
    zoneFrom: "#BF360C", zoneTo: "#F9A825",
  },
  {
    id: "aubergine", name: "Aubergine",
    primary: "#4A148C", accent: "#AB47BC", footer: "#1A0030",
    entreeH: "#00695C", entreeB: "#E0F2F1", entreeBr: "#80CBC4",
    sortieH: "#AD1457", sortieB: "#FCE4EC", sortieBr: "#F48FB1",
    cp: { bg: "#F3E5F5", br: "#CE93D8", tx: "#6A1B9A" },
    zoneFrom: "#4A148C", zoneTo: "#C62828",
  },
  {
    id: "sakura", name: "Sakura",
    primary: "#AD1457", accent: "#F06292", footer: "#4A0D2D",
    entreeH: "#2E7D32", entreeB: "#E8F5E9", entreeBr: "#A5D6A7",
    sortieH: "#880E4F", sortieB: "#FCE4EC", sortieBr: "#F48FB1",
    cp: { bg: "#FCE4EC", br: "#F48FB1", tx: "#AD1457" },
    zoneFrom: "#880E4F", zoneTo: "#4527A0",
  },
  {
    id: "terracotta", name: "Terracotta",
    primary: "#6D4C41", accent: "#FF7043", footer: "#3E2723",
    entreeH: "#4E342E", entreeB: "#EFEBE9", entreeBr: "#BCAAA4",
    sortieH: "#BF360C", sortieB: "#FBE9E7", sortieBr: "#FFAB91",
    cp: { bg: "#FBE9E7", br: "#FFAB91", tx: "#BF360C" },
    zoneFrom: "#4E342E", zoneTo: "#FF7043",
  },
  {
    id: "minuit", name: "Minuit",
    primary: "#0D1B4B", accent: "#C9A84C", footer: "#060D26",
    entreeH: "#0D4B2C", entreeB: "#E8F5E9", entreeBr: "#A5D6A7",
    sortieH: "#4B0D0D", sortieB: "#FFEBEE", sortieBr: "#EF9A9A",
    cp: { bg: "#E8EEFF", br: "#9BB0FF", tx: "#0D1B4B" },
    zoneFrom: "#0D1B4B", zoneTo: "#C9A84C",
  },
];

/**
 * Retourne la palette correspondant à l'identifiant donné.
 * Retourne la palette "nexans" (index 0) si l'id est inconnu.
 * @param {string} id  Identifiant de palette (ex: "cobalt", "graphite")
 * @returns {object}   Objet palette complet
 */
export const getPalette = id => PALETTES.find(p => p.id === id) || PALETTES[0];
