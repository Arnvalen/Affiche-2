/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  utils/exportUtils.js                                      v2.0.0   ║
 * ║  Export SVG, PDF et PNG du poster (fonctions pures)                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { FORMATS, MM_PX } from '../constants.js';

// Note : exportJSON n'est PAS ici car il dépend des hooks React setSaveModal /
// setSaveModalInput définis dans App.jsx. Les trois fonctions ci-dessous sont
// des fonctions pures qui ne nécessitent que `data` et `previewMode`.

/* ═══════════════════ EXPORT SVG ═══════════════════ */

/**
 * Exporte le poster courant au format SVG vectoriel.
 *
 * Stratégie : sérialiser le DOM React via XMLSerializer (produit du XHTML valide),
 * puis l'envelopper dans un <svg><foreignObject>. Les styles inline de React sont
 * ainsi embarqués directement dans le SVG — pas besoin de feuille CSS externe.
 *
 * Limitation : le rendu final dépend du moteur SVG du visualiseur (Inkscape, Chrome…)
 * qui doit supporter foreignObject + XHTML. Pour Illustrator, préférer le PDF.
 *
 * @param {object} data         Modèle de données complet
 * @param {string} previewMode  'poster' ou 'plan' — détermine le préfixe du nom de fichier
 */
export const exportSVG = (data, previewMode) => {
  // Cibler l'élément racine du poster (attribut data-poster-root="1")
  const el = document.querySelector("[data-poster-root]");
  if (!el) return;

  const w = el.offsetWidth, h = el.offsetHeight;

  // Sérialiser le DOM en XHTML — nécessaire pour que le SVG soit valide
  const xhtml = new XMLSerializer().serializeToString(el);

  // Envelopper dans un <svg><foreignObject> pour préserver le rendu HTML/CSS
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<foreignObject width="${w}" height="${h}">
<div xmlns="http://www.w3.org/1999/xhtml">
<style>*{margin:0;padding:0;box-sizing:border-box}</style>
${xhtml}
</div>
</foreignObject>
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const prefix = previewMode === 'plan' ? 'plan' : 'affiche';
  // Déclenchement téléchargement via <a> temporaire
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u;
  a.download = `${prefix}_${data.header.reference}.svg`;
  a.click();
  URL.revokeObjectURL(u);
};

/* ═══════════════════ EXPORT PDF ═══════════════════ */

/**
 * Exporte le poster au format PDF imprimable.
 *
 * Stratégie : capturer le poster en PNG haute résolution via html-to-image
 * (rendu navigateur natif, fidèle à l'écran), puis insérer cette image dans
 * un PDF aux dimensions exactes du format papier via jsPDF.
 *
 * html-to-image et jsPDF sont chargés dynamiquement (dynamic import) pour
 * éviter de les inclure dans le bundle principal — ils sont lourds (~400 kB).
 *
 * Le pixelRatio est calculé pour obtenir la résolution cible (DPI) :
 *   pixelRatio = dpiCible / (MM_PX * 25.4)
 * Par exemple à 150 DPI : 150 / (1.4 * 25.4) ≈ 4.22 pixels par pixel CSS.
 *
 * @param {object} data         Modèle de données complet
 * @param {string} previewMode  'poster' ou 'plan'
 */
export const exportPDF = async (data, previewMode) => {
  const el = document.querySelector("[data-poster-root]");
  if (!el) return;

  // Récupérer les dimensions du format papier en mm
  const fmt = data.format === "Personnalisé"
    ? { w: data.customW || 800, h: data.customH || 500 }
    : (FORMATS[data.format] || { w: 800, h: 500 });

  // Chargement dynamique des libs lourdes (ne bloquent pas le bundle initial)
  const [{ toPng }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);

  // Capture PNG à la résolution cible
  const dataUrl = await toPng(el, {
    pixelRatio: (data.pdfResolution || 150) / (MM_PX * 25.4),
  });

  // Orientation auto : paysage si largeur > hauteur
  const orientation = fmt.w > fmt.h ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });

  // Insérer l'image PNG en pleine page (0,0 → largeur×hauteur)
  doc.addImage(dataUrl, "PNG", 0, 0, fmt.w, fmt.h);

  const prefix = previewMode === 'plan' ? 'plan' : 'affiche';
  doc.save(`${prefix}_${data.header.reference}.pdf`);
};

/* ═══════════════════ EXPORT PNG ═══════════════════ */

/**
 * Exporte le poster au format PNG haute résolution.
 *
 * Utilise le même moteur que exportPDF (html-to-image) mais sans l'étape jsPDF.
 * Le fichier PNG a les dimensions CSS du poster multipliées par pixelRatio.
 * Utile pour les usages numériques (présentation, partage) où le PDF n'est pas requis.
 *
 * @param {object} data         Modèle de données complet
 * @param {string} previewMode  'poster' ou 'plan'
 */
export const exportPNG = async (data, previewMode) => {
  const el = document.querySelector("[data-poster-root]");
  if (!el) return;

  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(el, {
    pixelRatio: (data.pdfResolution || 150) / (MM_PX * 25.4),
  });

  const prefix = previewMode === 'plan' ? 'plan' : 'affiche';
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${prefix}_${data.header.reference}.png`;
  a.click();
};
