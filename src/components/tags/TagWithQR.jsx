/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/tags/TagWithQR.jsx                             v2.0.0   ║
 * ║  Tag enrichi avec QR code si une URL est définie                    ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { TAG_COLORS } from '../../constants.js';
import { QRCodeSVG } from './QRCodeSVG.jsx';

/** Tag enrichi : affiche le QR code sous le libellé si une URL est définie. Utilisé dans le poster (entrée, sortie, étapes). */
export const TagWithQR = ({ tag, scale, qrSize }) => {
  const c = TAG_COLORS[tag.type]; const sz = 10 * scale; const qrPx = qrSize * scale;
  const hasUrl = tag.url && tag.url.trim().length > 0;
  if (!hasUrl) return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,padding:`${2*scale}px ${6*scale}px`,borderRadius:3,background:c.bg,color:c.color,border:`1.5px solid ${c.border}`,letterSpacing:0.5 }}>{tag.type}</span>;
  return (
    <div style={{ display:"inline-flex",flexDirection:"column",alignItems:"center",gap:2*scale,border:`2px solid ${c.border}`,borderRadius:4,padding:3*scale,background:c.bg }}>
      <span style={{ fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,color:c.color,letterSpacing:0.5,lineHeight:1,padding:`0 ${2*scale}px` }}>{tag.type}</span>
      <QRCodeSVG url={tag.url} size={qrPx} bgColor={c.bg} />
    </div>
  );
};
