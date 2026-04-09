/**
 * @file        exports.js
 * @module      src/exports
 * @description Fonctions d'export de l'affiche : SVG natif, PNG (html-to-image),
 *              PDF (jsPDF). Les bibliothèques lourdes sont chargées en import
 *              dynamique pour ne pas alourdir le bundle initial.
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     2026-04-09
 * @modified    2026-04-09
 * @version     1.0.0
 *
 * @exports {AsyncFunction} exportSVG
 * @exports {AsyncFunction} exportPNG
 * @exports {AsyncFunction} exportPDF
 *
 * Contraintes :
 * - Cible : élément DOM [data-poster-root] (pas le wrapper scale)
 * - SVG : XMLSerializer.serializeToString() obligatoire (pas outerHTML)
 * - pixelRatio = pdfResolution / (MM_PX * 25.4), pdfResolution en DPI réels
 */
import { MM_PX, FORMATS } from "./theme";

/**
 * Export SVG : sérialise le DOM du poster via XMLSerializer (produit du XHTML valide),
 * puis l'enveloppe dans un <svg><foreignObject>. Les styles inline sont ainsi embarqués.
 *
 * @param {object} data        - Modèle de données complet de l'affiche
 * @param {string} previewMode - Mode courant : 'poster' | 'plan'
 */
export const exportSVG = (data, previewMode) => {
  const el = document.querySelector("[data-poster-root]");
  if (!el) return;
  const w = el.offsetWidth, h = el.offsetHeight;
  const xhtml = new XMLSerializer().serializeToString(el);
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
  const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `${prefix}_${data.header.reference}.svg`; a.click(); URL.revokeObjectURL(u);
};

/**
 * Export PDF : capture le poster en PNG haute résolution via html-to-image (rendu navigateur natif),
 * puis insère l'image dans un PDF aux dimensions exactes du format papier via jsPDF.
 * La résolution (pixelRatio) est configurable dans l'onglet Export.
 *
 * @param {object} data        - Modèle de données complet de l'affiche
 * @param {string} previewMode - Mode courant : 'poster' | 'plan'
 */
export const exportPDF = async (data, previewMode) => {
  const el = document.querySelector("[data-poster-root]");
  if (!el) return;
  const fmt = data.format === "Personnalisé" ? { w: data.customW || 800, h: data.customH || 500 } : (FORMATS[data.format] || { w: 800, h: 500 });
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const dataUrl = await toPng(el, { pixelRatio: (data.pdfResolution || 150) / (MM_PX * 25.4) });
  const orientation = fmt.w > fmt.h ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
  doc.addImage(dataUrl, "PNG", 0, 0, fmt.w, fmt.h);
  const prefix = previewMode === 'plan' ? 'plan' : 'affiche';
  doc.save(`${prefix}_${data.header.reference}.pdf`);
};

/**
 * Export PNG : capture le poster en PNG haute résolution via html-to-image.
 * La résolution est configurable via data.pdfResolution (72/150/300/400 DPI).
 *
 * @param {object} data        - Modèle de données complet de l'affiche
 * @param {string} previewMode - Mode courant : 'poster' | 'plan'
 */
export const exportPNG = async (data, previewMode) => {
  const el = document.querySelector("[data-poster-root]");
  if (!el) return;
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(el, { pixelRatio: (data.pdfResolution || 150) / (MM_PX * 25.4) });
  const a = document.createElement("a");
  const prefix = previewMode === 'plan' ? 'plan' : 'affiche';
  a.href = dataUrl;
  a.download = `${prefix}_${data.header.reference}.png`;
  a.click();
};
