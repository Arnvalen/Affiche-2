/**
 * @file        TagEditor.jsx
 * @module      src/components/TagEditor
 * @description Composants de tags : rendu simple (Tag), avec QR code (TagWithQR),
 *              QR code SVG natif (QRCodeSVG), et éditeur de liste de tags (TagEditor).
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     2026-04-09
 * @modified    2026-04-09
 * @version     1.0.0
 *
 * @exports {Component} QRCodeSVG
 * @exports {Component} Tag
 * @exports {Component} TagWithQR
 * @exports {Component} TagEditor
 */
import { useState, useMemo } from "react";
import QRCode from "qrcode";
import { TAG_TYPES, TAG_COLORS, uid } from "../theme";
import { Input } from "./ui";

/* ═══════════════════ QR SVG COMPONENT ═══════════════════ */

/**
 * Rendu SVG natif d'un QR code à partir d'une URL.
 * Utilise la lib `qrcode` pour générer la matrice de modules,
 * puis dessine chaque module comme un <rect> SVG.
 * Avantage : vectoriel pur, pas de raster → qualité parfaite en export SVG/PDF.
 *
 * @param {string} url - L'URL encodée dans le QR
 * @param {number} size - Taille du QR en pixels (avant scaling)
 * @param {string} bgColor - Couleur de fond (correspond à la couleur du tag parent)
 */
export const QRCodeSVG = ({ url, size, bgColor }) => {
  const modules = useMemo(() => {
    try { return QRCode.create(url, { errorCorrectionLevel: "L" }).modules; }
    catch { return null; }
  }, [url]);
  if (!modules) return null;
  const n = modules.size, cell = size / (n + 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", borderRadius: 2 }}>
      <rect x="0" y="0" width={size} height={size} fill={bgColor} rx="2" />
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) =>
          modules.get(r, c) ? <rect key={`${r}_${c}`} x={(c+1)*cell} y={(r+1)*cell} width={cell+0.5} height={cell+0.5} fill="#000" /> : null
        )
      )}
    </svg>
  );
};

/* ═══════════════════ TAG COMPONENTS ═══════════════════ */

/** Pastille de tag simple (SWI, IC, LC, AQE) avec couleur associée. Utilisé dans la légende et les opérations. */
export const Tag = ({ type, small, scale = 1 }) => {
  const c = TAG_COLORS[type]; const sz = (small ? 8 : 10) * scale;
  return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,padding:`${(small?1:2)*scale}px ${(small?4:6)*scale}px`,borderRadius:3,background:c.bg,color:c.color,border:`1.5px solid ${c.border}`,letterSpacing:0.5 }}>{type}</span>;
};

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

/* ═══════════════════ TAG EDITOR ═══════════════════ */

/**
 * Éditeur de tags pour un élément (entrée, sortie ou opération).
 * Permet d'ajouter/supprimer des tags et d'associer une URL QR à chaque tag.
 * Cliquer sur un tag ouvre le champ URL ; un point vert indique qu'une URL est définie.
 */
export const TagEditor = ({ tags, onChange }) => {
  const [editId, setEditId] = useState(null);
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:4,marginTop:4 }}>
      <div style={{ display:"flex",flexWrap:"wrap",gap:3,alignItems:"center" }}>
        {tags.map(t => (
          <div key={t.id} style={{ display:"inline-flex",alignItems:"center",gap:2 }}>
            <span onClick={()=>setEditId(editId===t.id?null:t.id)} style={{ cursor:"pointer",position:"relative" }}>
              <Tag type={t.type} small />
              {t.url && <span style={{ position:"absolute",top:-3,right:-3,width:6,height:6,borderRadius:"50%",background:"#4CAF50" }} />}
            </span>
            <span onClick={()=>onChange(tags.filter(x=>x.id!==t.id))} style={{ cursor:"pointer",fontSize:10,color:"#999" }}>✕</span>
          </div>
        ))}
        <select onChange={e=>{if(e.target.value){onChange([...tags,{id:uid(),type:e.target.value,url:""}]);e.target.value="";}}} defaultValue="" style={{ fontSize:10,padding:"1px 2px",border:"1px dashed #bbb",borderRadius:3,background:"transparent",cursor:"pointer",color:"#888" }}>
          <option value="">+ tag</option>{TAG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {editId && tags.find(t=>t.id===editId) && (
        <div style={{ display:"flex",gap:4,alignItems:"center" }}>
          <span style={{ fontSize:10,color:"#888",whiteSpace:"nowrap" }}>URL QR :</span>
          <Input value={tags.find(t=>t.id===editId).url} onChange={v=>onChange(tags.map(t=>t.id===editId?{...t,url:v}:t))} placeholder="https://..." style={{ fontSize:10,padding:"2px 6px",flex:1 }} />
        </div>
      )}
    </div>
  );
};
