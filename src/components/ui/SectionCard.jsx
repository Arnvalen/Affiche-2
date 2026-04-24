/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/ui/SectionCard.jsx                             v2.0.0   ║
 * ║  Carte dépliable avec titre et actions optionnelles                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { useState } from "react";

/** Carte dépliable avec titre, contenu et actions optionnelles dans la barre de titre. */
export const SectionCard = ({ title, children, actions, defaultOpen=true }) => {
  const [open,setOpen]=useState(defaultOpen);
  return (
    <div style={{background:"#fff",borderRadius:8,border:"1px solid #e0e0e0",overflow:"hidden",marginBottom:10}}>
      <div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#f5f5f5",cursor:"pointer",userSelect:"none"}}>
        <span style={{fontSize:12,fontWeight:700,color:"#424242"}}>{open?"▾":"▸"} {title}</span>
        {actions&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}>{actions}</div>}
      </div>
      {open&&<div style={{padding:10}}>{children}</div>}
    </div>
  );
};
