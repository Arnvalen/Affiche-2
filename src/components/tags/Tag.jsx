/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/tags/Tag.jsx                                   v2.0.0   ║
 * ║  Badge de tag coloré (SWI, IC, LC, AQE) sans QR code               ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { TAG_COLORS } from '../../constants.js';

/** Pastille de tag simple (SWI, IC, LC, AQE) avec couleur associée. Utilisé dans la légende et les opérations. */
export const Tag = ({ type, small, scale = 1 }) => {
  const c = TAG_COLORS[type]; const sz = (small ? 8 : 10) * scale;
  return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,padding:`${(small?1:2)*scale}px ${(small?4:6)*scale}px`,borderRadius:3,background:c.bg,color:c.color,border:`1.5px solid ${c.border}`,letterSpacing:0.5 }}>{type}</span>;
};
