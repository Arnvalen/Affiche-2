/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/ui/SvgIcon.jsx                                 v2.0.0   ║
 * ║  Rendu d'une icône SVG embarquée en data URL                        ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { svgUrl } from '../../utils/svgUtils.js';

/** Composant image SVG scalée : height fixe en px, width auto, centrée. */
export const SvgIcon = ({ svgData, height, style }) => (
  <img src={svgUrl(svgData)} alt="" style={{ height, width:'auto', maxWidth:'100%', display:'block', objectFit:'contain', ...style }} />
);
