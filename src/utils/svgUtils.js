/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  utils/svgUtils.js                                         v2.0.0   ║
 * ║  svgUrl (data URL) et getSVGRatio (ratio naturel d'un SVG)          ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/** Convertit un SVG texte en data URL pour utilisation dans <img> ou <image>. */
export const svgUrl = (svgData) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

/** Extrait le ratio naturel (largeur/hauteur) d'un SVG à partir de viewBox ou width/height.
 *  Retourne 1 si indéterminé. Utilisé pour afficher les icônes sans déformation dans la bande. */
export const getSVGRatio = (svgData) => {
  if (!svgData) return 1;
  const vb = svgData.match(/viewBox=["']([^"']+)["']/);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length >= 4 && p[3]) return p[2] / p[3];
  }
  const wm = svgData.match(/\bwidth=["']([0-9.]+)["']/);
  const hm = svgData.match(/\bheight=["']([0-9.]+)["']/);
  if (wm && hm) { const w = parseFloat(wm[1]), h = parseFloat(hm[1]); if (w && h) return w / h; }
  return 1;
};
