/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  utils/lineLabel.js                                        v2.0.0   ║
 * ║  Calcul du label de machine (A, B, A1…) via computeLayout           ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { computeLayout } from './dagLayout.js';

/**
 * Calcule le label final d'une machine (ex: "A", "A1", "B2") en utilisant computeLayout,
 * identique au rendu de LineFlowBand. Utilisé dans l'éditeur, le plan technique, et les étapes.
 */
export function getLineLabel(line, steps, itemId) {
  if (!line?.length) return { label: '?', letter: '?', showRow: false, rowNum: 1 };
  const { col, track, zoneSpans } = computeLayout(line, steps);
  if (col[itemId] == null) return { label: '?', letter: '?', showRow: false, rowNum: 1 };
  const item = line.find(m => m.id === itemId);
  const k = item?.stepId || '__none__';
  const localColIdx = col[itemId] - (zoneSpans[k]?.startCol ?? 0);
  const letter = String.fromCharCode(65 + localColIdx);
  const nodesAtCol = {};
  line.forEach(n => { const c = col[n.id]; nodesAtCol[c] = (nodesAtCol[c]||0)+1; });
  const showRow = (nodesAtCol[col[itemId]]||1) > 1;
  const rowNum = (track[itemId]||0) + 1;
  const label = showRow ? `${letter}${rowNum}` : letter;
  return { label, letter, rowNum, showRow };
}
