/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/preview/BookendPanel.jsx                       v2.0.0   ║
 * ║  Rendu du panneau Entrée ou Sortie dans l'aperçu poster             ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { TAG_LABELS } from '../../constants.js';
import { getPalette } from '../../utils/colors.js';
import { TagWithQR } from '../tags/TagWithQR.jsx';

export const BookendPanel = ({ bookendData, type, s, qrSize, width, palette }) => {
  const isE = type === "entree";
  const pal = palette || getPalette("nexans");
  const renderTags = (tags) => <div style={{ display:"flex",gap:3*s,flexWrap:"wrap",alignItems:"center" }}>{tags.map(t=><TagWithQR key={t.id} tag={t} scale={s} qrSize={qrSize} />)}</div>;
  return (
    <div style={{ width:width||"fit-content",borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column",flexShrink:0 }}>
      <div style={{ padding:`${8*s}px ${12*s}px`,color:"#fff",fontSize:12*s,fontWeight:700,textTransform:"uppercase",letterSpacing:1,background:isE?pal.entreeH:pal.sortieH,display:"flex",flexDirection:"column",gap:4*s,lineHeight:1.2 }}>
        <div>{isE?"▶ Entrée":"Sortie ▶"}</div>
        {(bookendData.tags || []).length > 0 && renderTags(bookendData.tags || [])}
      </div>
      <div style={{ flex:1,padding:8*s,display:"flex",flexDirection:"column",gap:6*s,background:isE?pal.entreeB:pal.sortieB,border:`1.5px solid ${isE?pal.entreeBr:pal.sortieBr}`,borderTop:"none",borderRadius:"0 0 8px 8px" }}>
        {bookendData.sections.map(sec => (
          <div key={sec.id}>
            <div style={{ fontSize:8*s,fontWeight:700,textTransform:"uppercase",letterSpacing:1,color:"#757575",borderBottom:"1px solid rgba(0,0,0,0.08)",paddingBottom:2*s,marginBottom:4*s,lineHeight:1.2 }}>{sec.title}</div>
            {sec.items.map(item => (
              <div key={item.id} style={{ background:"rgba(255,255,255,0.7)",borderRadius:4,padding:`${5*s}px ${7*s}px`,marginBottom:3*s,display:"flex",flexDirection:"row",alignItems:"center",gap:6*s }}>
                <div style={{ flex:1,fontSize:10*s,fontWeight:500,color:"#424242",lineHeight:1.2 }}>{item.name}</div>
                {(item.tags||[]).length > 0 && renderTags(item.tags)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
