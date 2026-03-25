/**
 * Application complète de l'éditeur d'affiches Nexans.
 *
 * Ce fichier unique contient tous les composants :
 * - Constantes (types de tags, formats papier, couleurs)
 * - Composants de rendu (QR codes, tags, panneaux, poster)
 * - Composants d'édition (tags, entrée/sortie, étapes)
 * - Primitives UI (boutons, inputs, cartes dépliables)
 * - Fonctions d'export (JSON, SVG, PDF)
 * - Composant principal App (state, sidebar, layout)
 *
 * Tous les styles sont inline (objets React) pour simplifier les exports
 * SVG/PDF qui capturent le DOM directement.
 */
import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from "react";
import QRCode from "qrcode";            // Génération de la matrice QR
import { toPng } from "html-to-image";  // Capture DOM → PNG via rendu navigateur natif
import { jsPDF } from "jspdf";          // Création de fichiers PDF

/* ═══════════════════ CONSTANTS ═══════════════════ */

/** Types de tags disponibles dans l'éditeur */
const TAG_TYPES = ["SWI", "IC", "LC", "AQE"];

/** Couleurs associées à chaque type de tag (fond, texte, bordure) */
const TAG_COLORS = {
  SWI: { bg: "#FFEBEE", color: "#C62828", border: "#EF9A9A" },
  IC:  { bg: "#FFF3E0", color: "#E65100", border: "#FFCC80" },
  PC:  { bg: "#E3F2FD", color: "#1565C0", border: "#90CAF9" },
  LC:  { bg: "#E8F5E9", color: "#2E7D32", border: "#A5D6A7" },
  AQE: { bg: "#F3E5F5", color: "#6A1B9A", border: "#CE93D8" },
};

/** Libellés complets des types de tags (affichés dans la légende) */
const TAG_LABELS = { SWI: "Standard Work Instruction", IC: "Instruction de contrôle", PC: "Point de contrôle", LC: "Liste de contrôle", AQE: "Appareil qualité embarqué" };

/** Formats papier standards (dimensions en mm). Clé "Personnalisé" = valeurs par défaut modifiables. */
const FORMATS = { "A0-paysage":{w:1189,h:841},"A1-paysage":{w:841,h:594},"A2-paysage":{w:594,h:420},"A3-paysage":{w:420,h:297},"A4-paysage":{w:297,h:210},"A0-portrait":{w:841,h:1189},"A1-portrait":{w:594,h:841},"A2-portrait":{w:420,h:594},"A3-portrait":{w:297,h:420},"A4-portrait":{w:210,h:297},"Personnalisé":{w:800,h:500} };

/** Facteur de conversion millimètres → pixels pour le rendu écran (arbitraire, pas un DPI standard) */
const MM_PX = 1.4;

/** Palette de couleurs pour les zones de la ligne de production (indexée par position du step) */
const ZONE_COLORS = ["#1565C0","#00838F","#E65100","#6A1B9A","#AD1457","#F57F17","#4E342E","#37474F"];

/** Générateur d'IDs uniques pour les éléments du modèle de données */
let _id = 100; const uid = () => `_${_id++}`;

/** Supprime width/height fixes du SVG root et force width:100%;height:100% pour qu'il remplisse son conteneur sans déformation. */
/** Convertit un SVG texte en data URL pour utilisation dans <img>. Le navigateur gère le scaling nativement (height fixe + width:auto = ratio conservé). */
const svgUrl = (svgData) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

/** Composant image SVG scalée : height fixe en px, width auto, centrée. */
const SvgIcon = ({ svgData, height, style }) => (
  <img src={svgUrl(svgData)} alt="" style={{ height, width:'auto', maxWidth:'100%', display:'block', objectFit:'contain', ...style }} />
);

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
const QRCodeSVG = ({ url, size, bgColor }) => {
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
const Tag = ({ type, small, scale = 1 }) => {
  const c = TAG_COLORS[type]; const sz = (small ? 8 : 10) * scale;
  return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,padding:`${(small?1:2)*scale}px ${(small?4:6)*scale}px`,borderRadius:3,background:c.bg,color:c.color,border:`1.5px solid ${c.border}`,letterSpacing:0.5 }}>{type}</span>;
};

/** Tag enrichi : affiche le QR code sous le libellé si une URL est définie. Utilisé dans le poster (entrée, sortie, étapes). */
const TagWithQR = ({ tag, scale, qrSize }) => {
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

/* ═══════════════════ UI PRIMITIVES ═══════════════════ */

/** Bouton stylisé avec variantes : couleur, petite taille, outline. Couleur par défaut = rouge Nexans. */
const Btn = ({ children, onClick, color="#C8102E", small, outline, style:st, ...r }) => <button onClick={onClick} style={{ display:"inline-flex",alignItems:"center",gap:4,padding:small?"3px 8px":"6px 12px",borderRadius:5,border:outline?`1.5px solid ${color}`:"none",background:outline?"transparent":color,color:outline?color:"#fff",fontSize:small?11:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",...st }} {...r}>{children}</button>;
/** Champ texte stylisé avec gestion simplifiée du onChange (reçoit directement la valeur, pas l'event). */
const Input = ({ value, onChange, placeholder, style:st, ...r }) => <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:"100%",padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit",outline:"none",...st }} {...r} />;
/** Carte dépliable avec titre, contenu et actions optionnelles dans la barre de titre. */
const SectionCard = ({ title, children, actions, defaultOpen=true }) => { const [open,setOpen]=useState(defaultOpen); return <div style={{background:"#fff",borderRadius:8,border:"1px solid #e0e0e0",overflow:"hidden",marginBottom:10}}><div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#f5f5f5",cursor:"pointer",userSelect:"none"}}><span style={{fontSize:12,fontWeight:700,color:"#424242"}}>{open?"▾":"▸"} {title}</span>{actions&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}>{actions}</div>}</div>{open&&<div style={{padding:10}}>{children}</div>}</div>; };

/* ═══════════════════ TAG EDITOR ═══════════════════ */

/**
 * Éditeur de tags pour un élément (entrée, sortie ou opération).
 * Permet d'ajouter/supprimer des tags et d'associer une URL QR à chaque tag.
 * Cliquer sur un tag ouvre le champ URL ; un point vert indique qu'une URL est définie.
 */
const TagEditor = ({ tags, onChange }) => {
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

/* ═══════════════════ BOOKEND EDITOR ═══════════════════ */

/**
 * Éditeur pour les panneaux Entrée ou Sortie.
 * Structure : tags du panneau + catégories (sections) > éléments > tags par élément.
 * Utilise un clone profond (JSON parse/stringify) pour chaque mutation → immutabilité.
 */
const BookendEditor = ({ data, onChange }) => {
  const up = (fn) => { const d = JSON.parse(JSON.stringify(data)); fn(d); onChange(d); };
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
      <div style={{ marginBottom:6 }}>
        <label style={{ fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:4 }}>Tags du panneau</label>
        <TagEditor tags={data.tags || []} onChange={tags=>up(d=>{d.tags=tags;})} />
      </div>
      {data.sections.map(sec => (
        <SectionCard key={sec.id} title={sec.title} actions={<Btn small outline color="#999" onClick={()=>up(d=>{d.sections=d.sections.filter(x=>x.id!==sec.id);})}>✕</Btn>}>
          <Input value={sec.title} onChange={v=>up(d=>{d.sections.find(x=>x.id===sec.id).title=v;})} style={{ marginBottom:6,fontWeight:600 }} />
          {sec.items.map(item => (
            <div key={item.id} style={{ background:"#fafafa",borderRadius:5,padding:"6px 8px",marginBottom:4,border:"1px solid #eee" }}>
              <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                <Input value={item.name} onChange={v=>up(d=>{d.sections.find(x=>x.id===sec.id).items.find(i=>i.id===item.id).name=v;})} style={{ flex:1 }} />
                <span onClick={()=>up(d=>{const s=d.sections.find(x=>x.id===sec.id);s.items=s.items.filter(i=>i.id!==item.id);})} style={{ cursor:"pointer",fontSize:12,color:"#ccc" }}>✕</span>
              </div>
              <TagEditor tags={item.tags} onChange={tags=>up(d=>{d.sections.find(x=>x.id===sec.id).items.find(i=>i.id===item.id).tags=tags;})} />
            </div>
          ))}
          <Btn small outline color="#888" onClick={()=>up(d=>{d.sections.find(x=>x.id===sec.id).items.push({id:uid(),name:"Nouveau",tags:[]});})}>+ Élément</Btn>
        </SectionCard>
      ))}
      <Btn small outline color="#555" onClick={()=>up(d=>d.sections.push({id:uid(),title:"Nouvelle catégorie",items:[]}))}>+ Catégorie</Btn>
    </div>
  );
};

/* ═══════════════════ STEPS EDITOR ═══════════════════ */

/**
 * Éditeur des étapes du process (zone centrale du poster).
 * Chaque étape contient un titre, des tags de process, et des opérations.
 * Les opérations peuvent être normales (lettre cerclée + tags) ou des points de contrôle (barre bleue).
 * Supporte le réordonnement (↑↓) des étapes et des opérations.
 */
const StepsEditor = ({ steps, onChange, line, icons }) => {
  const up = (fn) => { const d = JSON.parse(JSON.stringify(steps)); fn(d); onChange(d); };
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
      {steps.map((step, si) => (
        <SectionCard key={step.id} title={`Étape ${si+1} — ${step.title}`} actions={<>
          <Btn small outline color="#888" onClick={()=>up(d=>{const i=d.findIndex(x=>x.id===step.id);if(i>0)[d[i-1],d[i]]=[d[i],d[i-1]];})}>↑</Btn>
          <Btn small outline color="#888" onClick={()=>up(d=>{const i=d.findIndex(x=>x.id===step.id);if(i<d.length-1)[d[i],d[i+1]]=[d[i+1],d[i]];})}>↓</Btn>
          <Btn small outline color="#d32f2f" onClick={()=>up(d=>{const i=d.findIndex(x=>x.id===step.id);d.splice(i,1);})}>✕</Btn>
        </>}>
          <Input value={step.title} onChange={v=>up(d=>{d.find(x=>x.id===step.id).title=v;})} style={{ marginBottom:6,fontWeight:600 }} />
          <div style={{ marginBottom:6 }}>
            <label style={{ fontSize:11,fontWeight:600,color:"#666",display:"block",marginBottom:4 }}>Tags du process</label>
            <TagEditor tags={step.tags || []} onChange={tags=>up(d=>{d.find(x=>x.id===step.id).tags=tags;})} />
          </div>
          {step.operations.map((op, opi) => (
            <div key={op.id} style={{ background: op.isControlPoint ? "#E3F2FD" : "#fafafa", borderRadius: 5, padding: "6px 8px", marginBottom: 4, border: op.isControlPoint ? "1.5px solid #90CAF9" : "1px solid #eee" }}>
              <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                <Input value={op.name} onChange={v=>up(d=>{d.find(x=>x.id===step.id).operations.find(o=>o.id===op.id).name=v;})} style={{ flex:1,fontSize:12 }} />
                <Btn small outline color="#888" onClick={()=>up(d=>{const s=d.find(x=>x.id===step.id);if(opi>0)[s.operations[opi-1],s.operations[opi]]=[s.operations[opi],s.operations[opi-1]];})}>↑</Btn>
                <Btn small outline color="#888" onClick={()=>up(d=>{const s=d.find(x=>x.id===step.id);if(opi<s.operations.length-1)[s.operations[opi],s.operations[opi+1]]=[s.operations[opi+1],s.operations[opi]];})}>↓</Btn>
                <span onClick={()=>up(d=>{const s=d.find(x=>x.id===step.id);s.operations=s.operations.filter(o=>o.id!==op.id);})} style={{ cursor:"pointer",fontSize:12,color:"#ccc" }}>✕</span>
              </div>
              {op.isControlPoint && <Input value={op.description || ""} onChange={v=>up(d=>{d.find(x=>x.id===step.id).operations.find(o=>o.id===op.id).description=v;})} style={{ fontSize:11,marginTop:4,color:"#555",fontStyle:"italic" }} placeholder="Description (optionnel)" />}
              <TagEditor tags={op.tags||[]} onChange={tags=>up(d=>{d.find(x=>x.id===step.id).operations.find(o=>o.id===op.id).tags=tags;})} />
              {(line||[]).length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                  <span style={{fontSize:10,color:"#888",flexShrink:0}}>Machine :</span>
                  <select value={op.lineItemId||''} onChange={e=>up(d=>{d.find(x=>x.id===step.id).operations.find(o=>o.id===op.id).lineItemId=e.target.value||null;})}
                    style={{fontSize:10,padding:"2px 4px",border:"1px solid #ddd",borderRadius:3,flex:1}}>
                    <option value="">— Aucune —</option>
                    {(line||[]).map(m=>{const ic=(icons||[]).find(i=>i.id===m.iconId);return <option key={m.id} value={m.id}>{ic?.name||m.id}</option>;})}
                  </select>
                </div>
              )}
            </div>
          ))}
          <Btn small outline color="#888" onClick={()=>up(d=>{d.find(x=>x.id===step.id).operations.push({id:uid(),name:"Opération",tags:[]});})}>+ Opération</Btn>
          <Btn small outline color="#1565C0" onClick={()=>up(d=>{d.find(x=>x.id===step.id).operations.push({id:uid(),isControlPoint:true,name:"Point de contrôle",description:"",tags:[]});})}>+ PC</Btn>
        </SectionCard>
      ))}
      <Btn onClick={()=>up(d=>d.push({id:uid(),title:"Nouvelle étape",tags:[],operations:[]}))} style={{ alignSelf:"flex-start" }}>+ Étape process</Btn>
    </div>
  );
};

/* ═══════════════════ BOOKEND PANEL (Preview) ═══════════════════ */

/**
 * Panneau latéral du poster (entrée à gauche, sortie à droite).
 * Header coloré (vert entrée / rouge sortie) + catégories avec éléments et tags QR.
 * Toutes les dimensions sont multipliées par `s` (fontScale) pour le scaling.
 */
const BookendPanel = ({ bookendData, type, s, qrSize, width }) => {
  const isE = type === "entree";
  const renderTags = (tags) => <div style={{ display:"flex",gap:3*s,flexWrap:"wrap",alignItems:"center" }}>{tags.map(t=><TagWithQR key={t.id} tag={t} scale={s} qrSize={qrSize} />)}</div>;
  return (
    <div style={{ width:width||"fit-content",borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column",flexShrink:0 }}>
      <div style={{ padding:`${8*s}px ${12*s}px`,color:"#fff",fontSize:12*s,fontWeight:700,textTransform:"uppercase",letterSpacing:1,background:isE?"#2E7D32":"#9B0D23",display:"flex",flexDirection:"column",gap:4*s,lineHeight:1.2 }}>
        <div>{isE?"▶ Entrée":"Sortie ▶"}</div>
        {(bookendData.tags || []).length > 0 && renderTags(bookendData.tags || [])}
      </div>
      <div style={{ flex:1,padding:8*s,display:"flex",flexDirection:"column",gap:6*s,background:isE?"#E8F5E9":"#FFEBEE",border:`1.5px solid ${isE?"#A5D6A7":"#EF9A9A"}`,borderTop:"none",borderRadius:"0 0 8px 8px" }}>
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

/* ═══════════════════ POSTER PREVIEW ═══════════════════ */

/**
 * Composant principal de rendu du poster.
 * Rendu à taille réelle (mm → px via MM_PX), puis réduit par transform: scale() dans App.
 * Structure verticale : Header → Légende → Contenu principal → Image bandeau → Footer.
 * Le contenu principal est horizontal : Entrée | › | Grille d'étapes | › | Sortie.
 * L'attribut data-poster-root permet aux exports (SVG, PDF) de cibler cet élément.
 */
const PosterPreview = ({ data }) => {
  const fmt = data.format === "Personnalisé" ? { w: data.customW || 800, h: data.customH || 500 } : (FORMATS[data.format] || { w: 800, h: 500 });
  const posterW = Math.round(fmt.w * MM_PX), posterH = Math.round(fmt.h * MM_PX);
  const s = (data.fontScale || 7) * 0.15, qrSize = data.qrSize || 32;
  const isPortrait = fmt.h > fmt.w;
  const totalSteps = data.steps.length;
  const maxCols = data.maxCols > 0 ? data.maxCols : Math.min(totalSteps, isPortrait ? 3 : 4);
  const rows = []; for (let i = 0; i < totalSteps; i += maxCols) rows.push(data.steps.slice(i, i + maxCols));

  const bookendW = data.bookendWidth || 220;

  const renderTags = (tags) => <div style={{ display:"flex",gap:3*s,flexWrap:"nowrap",alignItems:"center",flexShrink:0 }}>{tags.map(t=><TagWithQR key={t.id} tag={t} scale={s} qrSize={qrSize} />)}</div>;
  const renderTagsPlain = (tags) => <div style={{ display:"flex",gap:3*s,flexWrap:"nowrap",alignItems:"center",flexShrink:0 }}>{tags.map(t=><Tag key={t.id} type={t.type} scale={s} />)}</div>;

  const getMachineInfo = (lineItemId) => {
    const item = (data.line||[]).find(m => m.id === lineItemId);
    if (!item) return null;
    const zoneItems = (data.line||[]).filter(m => m.stepId === item.stepId);
    const idx = zoneItems.findIndex(m => m.id === lineItemId);
    const si2 = item.stepId ? data.steps.findIndex(s => s.id === item.stepId) : -1;
    return { letter: idx >= 0 ? String.fromCharCode(65 + idx) : '?', color: si2 >= 0 ? ZONE_COLORS[si2 % ZONE_COLORS.length] : '#9E9E9E' };
  };

  const renderStep = (step, si) => {
    const zc = ZONE_COLORS[si%ZONE_COLORS.length];
    return (
    <div key={step.id} style={{ flex:"1 1 0%",minWidth:0,borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column",border:`1.5px solid ${zc}` }}>
      <div style={{ display:"flex",alignItems:"center",gap:8*s,padding:`${7*s}px ${12*s}px`,background:zc,color:"#fff" }}>
        <div style={{ fontFamily:"monospace",fontSize:14*s,fontWeight:700,background:"rgba(255,255,255,0.25)",color:"#fff",width:22*s,height:22*s,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{si+1}</div>
        <div style={{ flex:1,display:"flex",alignItems:"center",gap:4*s,minWidth:0 }}>
          <div style={{ fontSize:11*s,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{step.title}</div>
          {(step.tags || []).length > 0 && renderTags(step.tags || [])}
        </div>
      </div>
      <div style={{ flex:1,padding:8*s,display:"flex",flexDirection:"column",gap:5*s,background:zc+"18" }}>
        {step.operations.map((item) => {
          if (item.isControlPoint) {
            const pcMachineInfo = item.lineItemId ? getMachineInfo(item.lineItemId) : null;
            return (
              <div key={item.id} style={{ display:"flex",flexDirection:"row",alignItems:"center",padding:`${6*s}px ${8*s}px`,gap:6*s }}>
                {pcMachineInfo && <span style={{ display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontSize:14*s,fontWeight:700,borderRadius:"50%",background:pcMachineInfo.color,color:"#fff",width:22*s,height:22*s,flexShrink:0 }}>{pcMachineInfo.letter}</span>}
                <div style={{ flex:1,display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",borderRadius:4,padding:`${4*s}px ${8*s}px`,background:"#E3F2FD",border:"2px solid #90CAF9",gap:6*s }}>
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2*s,flex:1 }}>
                    <span style={{ fontSize:10*s,fontWeight:700,color:"#1565C0",textTransform:"uppercase",letterSpacing:1 }}>{item.name}</span>
                    {item.description && <span style={{ fontSize:9*s,fontWeight:400,color:"#1565C0",textTransform:"none",letterSpacing:0 }}>{item.description}</span>}
                  </div>
                  {(item.tags||[]).length > 0 && renderTagsPlain(item.tags)}
                </div>
              </div>
            );
          } else {
            const machineInfo = item.lineItemId ? getMachineInfo(item.lineItemId) : null;
            const cc = machineInfo ? machineInfo.color : null;
            return (
              <div key={item.id} style={{ background:"#fafafa",border:"1px solid #eee",borderRadius:4,padding:`${6*s}px ${8*s}px`,display:"flex",flexDirection:"row",alignItems:"center",gap:6*s }}>
                {machineInfo && <span style={{ display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontSize:14*s,fontWeight:700,borderRadius:"50%",background:cc,color:"#fff",width:22*s,height:22*s,flexShrink:0 }}>{machineInfo.letter}</span>}
                <div style={{ flex:1,fontSize:10*s,fontWeight:600,color:"#424242" }}>{item.name}</div>
                {item.tags.length > 0 && renderTagsPlain(item.tags)}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
  };

  const stepConnector = (key) => (
    <div key={key} style={{ display:"flex",alignItems:"center",justifyContent:"center",width:12*s,flexShrink:0,color:"#E87722" }}>
      <svg width={10*s} height={10*s} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    </div>
  );

  const renderRow = (rowSteps, ri) => {
    const cells = [];
    for (let ci = 0; ci < maxCols; ci++) {
      if (ci > 0) cells.push(stepConnector(`arr-${ri}-${ci}`));
      if (ci < rowSteps.length) {
        cells.push(renderStep(rowSteps[ci], ri * maxCols + ci));
      } else {
        cells.push(<div key={`e${ci}`} style={{ flex:"1 1 0%",minWidth:0 }} />);
      }
    }
    return <div key={ri} style={{ display:"flex",gap:0,width:"100%",flex:1 }}>{cells}</div>;
  };

  const rowConn = <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",padding:`${3*s}px 0`,color:"#E87722",paddingRight:8*s }}><svg width={16*s} height={16*s} viewBox="0 0 24 24" fill="currentColor"><path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/></svg></div>;
  const arrowSt = { display:"flex",alignItems:"center",justifyContent:"center",width:28*s,minWidth:28*s,flexShrink:0,color:"#E87722" };

  const forceH = data.forceFormat;

  return (
    <div data-poster-root="1" style={{ width:posterW, ...(forceH ? {height:posterH} : {minHeight:posterH}), fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:"#fff",borderRadius:6,overflow:forceH?"hidden":"visible",boxShadow:"0 2px 16px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column", position:"relative", ...(forceH ? {outline:"2px dashed #C8102E",outlineOffset:-2} : {}) }}>
      {/* Format lock indicator */}
      {forceH && <div style={{ position:"absolute",top:4,right:4,background:"#C8102E",color:"#fff",fontSize:8*s,padding:`${1*s}px ${4*s}px`,borderRadius:3,fontWeight:700,opacity:0.7,zIndex:10 }}>FORMAT FIXE</div>}

      {/* Header */}
      {(()=>{ const hh=(data.headerHeight||56), hr=hh/56, hs=s*hr; return (
      <div style={{ background:"#C8102E",color:"#fff",display:"flex",alignItems:"flex-start",padding:`0 ${24*hs}px`,height:hh*s,gap:20*hs,flexShrink:0,paddingTop:4*hs }}>
        <div style={{ borderRight:"2px solid rgba(255,255,255,0.3)",paddingRight:20*hs,display:"flex",flexDirection:"column",gap:2*hs }}>
          <span style={{ fontSize:8*hs,textTransform:"uppercase",letterSpacing:1.5,opacity:0.8 }}>Référence</span>
          <strong style={{ fontFamily:"monospace",fontSize:24*hs,fontWeight:700 }}>{data.header.reference}</strong>
        </div>
        <div style={{ flex:1,display:"flex",flexDirection:"column",gap:2*hs }}>
          <span style={{ fontSize:8*hs,textTransform:"uppercase",letterSpacing:1.5,opacity:0.8 }}>Process</span>
          <div style={{ fontSize:16*hs,fontWeight:700 }}>{data.header.processName}</div>
          <div style={{ fontSize:10*hs,opacity:0.85 }}>{data.header.subtitle}</div>
        </div>
        {data.header.logoDataUrl ? <img src={data.header.logoDataUrl} alt="" style={{ height:40*hs,objectFit:"contain" }} /> : (
          <div style={{ textAlign:"right" }}><div style={{ fontSize:22*hs,fontWeight:700,letterSpacing:2 }}>Nexans</div><div style={{ fontSize:7*hs,textTransform:"uppercase",letterSpacing:2,opacity:0.7 }}>Electrify the future</div></div>
        )}
      </div>
      );})()}

      {/* Legend */}
      <div style={{ display:"flex",alignItems:"center",gap:14*s,padding:`${6*s}px ${24*s}px`,background:"#fafafa",borderBottom:"1px solid #e0e0e0",fontSize:10*s,flexWrap:"wrap",flexShrink:0 }}>
        <span style={{ fontWeight:600,color:"#757575" }}>Légende :</span>
        {TAG_TYPES.map(t=><span key={t} style={{ display:"inline-flex",alignItems:"center",gap:4*s }}><Tag type={t} small scale={s} /> <span style={{ color:"#666" }}>{TAG_LABELS[t]}</span></span>)}
      </div>

      {/* Main */}
      <div style={{ display:"flex",padding:`${14*s}px ${16*s}px`,gap:10*s,alignItems:"stretch",flex:1 }}>
        <BookendPanel bookendData={data.entree} type="entree" s={s} qrSize={qrSize} width={bookendW} />
        <div style={arrowSt}><svg width={20*s} height={20*s} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
        <div style={{ flex:1,display:"flex",flexDirection:"column",gap:0,minWidth:0 }}>
          {rows.map((rowSteps, ri) => <div key={ri} style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>{ri > 0 && rowConn}{renderRow(rowSteps, ri)}</div>)}
        </div>
        <div style={arrowSt}><svg width={20*s} height={20*s} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
        <BookendPanel bookendData={data.sortie} type="sortie" s={s} qrSize={qrSize} width={bookendW} />
      </div>

      {/* Ligne de production ou image bandeau */}
      {(()=>{
        const bh=posterH*((data.bgImageHeight||25)/100);
        const hasLine=(data.line||[]).length>0;
        const hasImg=!!data.backgroundImage;
        if(!hasLine&&!hasImg) return null;
        if(!hasLine) return(
          <div style={{flexShrink:0,width:"100%",display:"flex",justifyContent:"center",alignItems:"center",background:"#f0f0f0",height:bh,overflow:"hidden"}}>
            <img src={data.backgroundImage} alt="" style={{maxWidth:"100%",maxHeight:bh,objectFit:"contain",display:"block"}} />
          </div>
        );

        // Groupement par zone (ordre data.steps) + non-liés en dernier
        const unlinked=(data.line||[]).filter(m=>!m.stepId);
        const byStep=data.steps.map((st,si)=>({
          step:st,color:ZONE_COLORS[si%ZONE_COLORS.length],stepIndex:si,
          machines:(data.line||[]).filter(m=>m.stepId===st.id)
        })).filter(z=>z.machines.length>0);
        const zones=[...byStep,...(unlinked.length?[{step:null,color:"#9E9E9E",stepIndex:-1,machines:unlinked}]:[])];
        if(!zones.length) return null;

        const getLinkedOp=(lineItemId)=>{for(const st of data.steps)for(const op of(st.operations||[]))if(op.lineItemId===lineItemId)return op;return null;};
        const iconH=bh*0.52;

        return(
          <div style={{flexShrink:0,width:"100%",height:bh,background:"#fafafa",borderTop:"1px solid #eee",display:"flex",alignItems:"center",justifyContent:"center",gap:6*s,padding:`0 ${10*s}px`,overflow:"hidden"}}>
            {zones.map((zone,zi)=>(
              <Fragment key={zone.step?.id||"unlinked"}>
                {/* Séparateur entre zones */}
                {zi>0&&(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,gap:2*s}}>
                    <div style={{width:0,height:bh*0.4,borderLeft:"1.5px dashed #ccc"}} />
                    <span style={{color:"#E87722",fontSize:9*s,fontWeight:700,lineHeight:1}}>→</span>
                    <div style={{width:0,height:bh*0.4,borderLeft:"1.5px dashed #ccc"}} />
                  </div>
                )}
                {/* Zone — numéro au-dessus du rectangle arrondi */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,gap:2*s}}>
                  {/* Label de zone : numéro ou titre */}
                  {(data.lineZoneLabel||"number")==="title"
                    ? <div style={{fontSize:10*s,fontWeight:700,color:zone.color,textTransform:"uppercase",letterSpacing:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:zone.machines.length*80*s}}>{zone.step?.title||"?"}</div>
                    : <div style={{width:22*s,height:22*s,borderRadius:"50%",background:zone.color,color:"#fff",fontSize:14*s,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"monospace"}}>{zone.stepIndex>=0?zone.stepIndex+1:"?"}</div>
                  }
                  {/* Rectangle arrondi */}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,border:`2px solid ${zone.color}`,borderRadius:6*s,background:zone.color+"18",padding:`${3*s}px ${6*s}px`}}>
                  {/* Machines */}
                  <div style={{display:"flex",alignItems:"flex-end",gap:4*s}}>
                    {zone.machines.map((item,mi)=>{
                      const icon=(data.icons||[]).find(ic=>ic.id===item.iconId);
                      if(!icon) return null;
                      const letter=String.fromCharCode(65+mi);
                      const linkedOp=getLinkedOp(item.id);
                      return(
                        <Fragment key={item.id}>
                          {mi>0&&<div style={{alignSelf:"stretch",display:"flex",alignItems:"center",flexShrink:0}}><svg width={16*s} height={16*s} viewBox="0 0 24 24" fill={zone.color} style={{display:"block"}}><path d="M8 5v14l11-7z"/></svg></div>}
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1*s,flexShrink:0}}>
                            {/* Lettre + tags en dessous, centrés */}
                            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1*s}}>
                              <div style={{width:22*s,height:22*s,borderRadius:"50%",background:zone.color,color:"#fff",fontSize:14*s,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"monospace"}}>{letter}</div>
                              {data.showLineTags!==false&&linkedOp&&(linkedOp.tags||[]).length>0&&<div style={{display:"flex",gap:1*s,flexWrap:"wrap",justifyContent:"center"}}>{linkedOp.tags.map(t=><Tag key={t.id} type={t.type} scale={s*0.65} small />)}</div>}
                            </div>
                            <SvgIcon svgData={icon.svgData} height={iconH*(item.size||1)} />
                            <span style={{fontSize:5.5*s,color:"#555",fontWeight:600,textAlign:"center",maxWidth:iconH*(item.size||1)*1.4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{icon.name}</span>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                  </div>{/* /rectangle arrondi */}
                </div>{/* /outer column */}
              </Fragment>
            ))}
          </div>
        );
      })()}

      {/* Footer */}
      <div style={{ display:"flex",justifyContent:"space-between",padding:`${6*s}px ${24*s}px`,background:"#212121",color:"rgba(255,255,255,0.6)",fontSize:9*s,flexShrink:0,flexWrap:"wrap",gap:8*s }}>
        <span><strong style={{ color:"#fff" }}>Version :</strong> 1.0</span>
        <span><strong style={{ color:"#fff" }}>Format :</strong> {data.format} · {fmt.w}×{fmt.h}mm · {maxCols} col · Police {s.toFixed(1)}×</span>
        <span><strong style={{ color:"#fff" }}>Ligne :</strong> {data.header.processName}</span>
      </div>
    </div>
  );
};

/* ═══════════════════ DEFAULT DATA ═══════════════════ */

/**
 * Données initiales de démonstration (ligne d'extrusion mono-couche Nexans).
 * Retourne un nouvel objet à chaque appel (IDs uniques via uid()).
 * Sert aussi de référence pour la structure attendue du modèle de données.
 */
const defaultData = () => ({
  header: { reference: "", processName: "", subtitle: "", logoDataUrl: null },
  format: "A1-paysage", customW: 800, customH: 500, maxCols: 0, fontScale: 7, qrSize: 32, forceFormat: false, bookendWidth: 220, headerHeight: 56, bgImageHeight: 25, showLineTags: true, lineZoneLabel: "number", pdfResolution: 3,
  entree: { tags: [], sections: [] },
  steps: [],
  sortie: { tags: [], sections: [] },
  backgroundImage: null,
  icons: [],
  line: [],
});

/* ═══════════════════ LINE EDITOR ═══════════════════ */

const LineEditor = ({ icons, line, steps, onChange, libDirHandle, libSvgFiles, onLoadSvg }) => {
  const iconFileRef = useRef();

  const upIcons = (newIcons) => onChange({ icons: newIcons, line });
  const upLine  = (newLine)  => onChange({ icons, line: newLine });

  const importSVGs = (files) => {
    const toRead = Array.from(files);
    let done = 0;
    const newIcons = [];
    toRead.forEach(file => {
      const r = new FileReader();
      r.onload = (ev) => {
        newIcons.push({ id: uid(), name: file.name.replace(/\.svg$/i,''), description:'', svgData: ev.target.result });
        done++;
        if (done === toRead.length) onChange({ icons:[...icons,...newIcons], line });
      };
      r.readAsText(file);
    });
  };

  const addToLine = (iconId) => upLine([...line, { id:uid(), iconId, stepId:null }]);
  const removeFromLine = (id) => upLine(line.filter(m => m.id !== id));
  const removeIcon = (iconId) => {
    upIcons(icons.filter(ic => ic.id !== iconId));
    upLine(line.filter(m => m.iconId !== iconId));
  };
  const updateLineItem = (id, patch) => upLine(line.map(m => m.id===id ? {...m,...patch} : m));
  const moveInZone = (itemId, dir) => {
    const item = line.find(m => m.id === itemId);
    if (!item) return;
    const zoneItems = line.filter(m => m.stepId === item.stepId);
    const zi = zoneItems.findIndex(m => m.id === itemId);
    const target = zoneItems[zi + dir];
    if (!target) return;
    const newLine = [...line];
    const i1 = newLine.findIndex(m => m.id === itemId);
    const i2 = newLine.findIndex(m => m.id === target.id);
    [newLine[i1], newLine[i2]] = [newLine[i2], newLine[i1]];
    upLine(newLine);
  };

  // Drag from library to line-drop zone
  const onDragStart = (e, iconId) => e.dataTransfer.setData('iconId', iconId);
  const onDropZone  = (e) => { e.preventDefault(); const id=e.dataTransfer.getData('iconId'); if(id) addToLine(id); };

  const card = { borderRadius:6, padding:'6px 8px', border:'1px solid #eee', background:'#fafafa', display:'flex', alignItems:'center', gap:6, cursor:'grab' };

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      {/* ── SVG depuis la bibliothèque dossier ── */}
      {libDirHandle && libSvgFiles.length > 0 && (
        <div>
          <label style={{ fontSize:11,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:0.5,display:'block',marginBottom:6 }}>📂 {libDirHandle.name}/ — SVG disponibles</label>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {libSvgFiles.map(name => {
              const already = icons.some(ic => ic.name === name.replace(/\.svg$/i,''));
              return (
                <div key={name} style={{display:'flex',alignItems:'center',gap:6,background:'#f5f5f5',border:'1px solid #eee',borderRadius:5,padding:'4px 8px'}}>
                  <span style={{flex:1,fontSize:11,color:'#444',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                  {already
                    ? <span style={{fontSize:10,color:'#aaa'}}>déjà chargé</span>
                    : <Btn small onClick={()=>onLoadSvg(name)}>+ Charger</Btn>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bibliothèque locale (upload) ── */}
      <div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
          <label style={{ fontSize:11,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:0.5 }}>Bibliothèque d'icônes</label>
          <Btn small onClick={()=>iconFileRef.current?.click()}>+ Importer SVG</Btn>
          <input ref={iconFileRef} type="file" accept=".svg" multiple style={{display:'none'}} onChange={e=>{ importSVGs(e.target.files); e.target.value=''; }} />
        </div>
        {icons.length===0
          ? <div style={{fontSize:11,color:'#bbb',textAlign:'center',padding:16}}>Aucune icône — importer des .svg</div>
          : <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {icons.map(ic=>(
                <div key={ic.id} style={{...card,flexDirection:'column',alignItems:'stretch',cursor:'grab',position:'relative'}}
                  draggable onDragStart={e=>onDragStart(e,ic.id)}
                  title={ic.name}>
                  <div style={{width:'100%',height:48,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                    <SvgIcon svgData={ic.svgData} height={48} />
                  </div>
                  <div style={{fontSize:9,color:'#555',textAlign:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ic.name}</div>
                  <span onClick={()=>removeIcon(ic.id)} style={{position:'absolute',top:2,right:4,fontSize:10,color:'#ccc',cursor:'pointer'}}>✕</span>
                  <button onClick={()=>addToLine(ic.id)} style={{marginTop:2,fontSize:9,padding:'1px 4px',border:'1px solid #ddd',borderRadius:3,background:'#fff',cursor:'pointer',color:'#555'}}>+ Ligne</button>
                </div>
              ))}
            </div>
        }
      </div>

      {/* ── Composition de la ligne — vue par zones ── */}
      <div>
        <label style={{ fontSize:11,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:0.5,display:'block',marginBottom:6 }}>Ligne de production</label>
        {(()=>{
          const unlinked = line.filter(m=>!m.stepId);
          const byStep = steps.map((st,si)=>({
            step:st, color:ZONE_COLORS[si%ZONE_COLORS.length], stepIndex:si,
            machines:line.filter(m=>m.stepId===st.id)
          })).filter(z=>z.machines.length>0);
          const zones=[...byStep,...(unlinked.length?[{step:null,color:'#9E9E9E',stepIndex:-1,machines:unlinked}]:[])];

          if(line.length===0) return (
            <div onDragOver={e=>e.preventDefault()} onDrop={onDropZone}
              style={{minHeight:60,border:'2px dashed #ddd',borderRadius:8,padding:8,background:'#fafafa',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{fontSize:11,color:'#bbb'}}>Glisser des icônes ici depuis la bibliothèque</span>
            </div>
          );

          return (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {zones.map(zone=>(
                <div key={zone.step?.id||'unlinked'} style={{borderRadius:8,border:`2px solid ${zone.color}`,background:zone.color+'12',padding:'8px'}}>
                  {/* Numéro centré en haut */}
                  <div style={{display:'flex',justifyContent:'center',marginBottom:6}}>
                    <div style={{width:18,height:18,borderRadius:'50%',background:zone.color,color:'#fff',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {zone.stepIndex>=0?zone.stepIndex+1:'?'}
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'flex-start',gap:4,flexWrap:'wrap'}}>
                    {zone.machines.map((item,mi)=>{
                      const icon=icons.find(ic=>ic.id===item.iconId);
                      if(!icon) return null;
                      const letter=String.fromCharCode(65+mi);
                      return (
                        <Fragment key={item.id}>
                          {mi>0&&<span style={{color:zone.color,fontSize:20,fontWeight:900,alignSelf:'center'}}>→</span>}
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'#fafafa',border:'1px solid #eee',borderRadius:6,padding:'6px 8px',minWidth:60}}>
                            <div style={{width:16,height:16,borderRadius:'50%',background:zone.color,color:'#fff',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{letter}</div>
                            <SvgIcon svgData={icon.svgData} height={32} />
                            <span style={{fontSize:8,color:'#555',textAlign:'center',maxWidth:56,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{icon.name}</span>
                            <select value={item.stepId||''} onChange={e=>updateLineItem(item.id,{stepId:e.target.value||null})}
                              style={{fontSize:8,padding:'1px 2px',border:'1px solid #ddd',borderRadius:3,maxWidth:64}}>
                              <option value="">— —</option>
                              {steps.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
                            </select>

                            <div style={{display:'flex',gap:2}}>
                              <span onClick={()=>moveInZone(item.id,-1)} style={{cursor:'pointer',fontSize:10,color:'#aaa',padding:'0 2px'}}>←</span>
                              <span onClick={()=>moveInZone(item.id,1)}  style={{cursor:'pointer',fontSize:10,color:'#aaa',padding:'0 2px'}}>→</span>
                              <span onClick={()=>removeFromLine(item.id)} style={{cursor:'pointer',fontSize:9,color:'#ccc',padding:'0 2px'}}>✕</span>
                            </div>
                          </div>
                        </Fragment>
                      );
                    })}
                    {/* Drop target pour ajouter une machine dans cette zone */}
                    <div onDragOver={e=>e.preventDefault()}
                      onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('iconId');if(id){const stepId=zone.step?.id||null;upLine([...line,{id:uid(),iconId:id,stepId}]);}}}
                      style={{width:40,height:56,border:'2px dashed #ddd',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'#ccc',fontSize:20,cursor:'copy',alignSelf:'center'}}>+</div>
                  </div>
                </div>
              ))}
              {/* Zone de drop globale pour les nouvelles icônes sans step */}
              <div onDragOver={e=>e.preventDefault()} onDrop={onDropZone}
                style={{border:'2px dashed #e0e0e0',borderRadius:6,padding:'6px 10px',display:'flex',alignItems:'center',justifyContent:'center',color:'#bbb',fontSize:10,cursor:'copy'}}>
                ＋ Glisser une icône ici pour l'ajouter sans zone
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

/* ═══════════════════ MAIN APP ═══════════════════ */

/**
 * Composant racine de l'application.
 * Layout split-screen : sidebar d'édition (360px) | aperçu temps réel.
 * State unique `data` contenant tout le modèle ; mis à jour via `up()` (clone + mutation).
 */
export default function App() {
  const [data, setData] = useState(defaultData);       // Modèle de données complet
  const [tab, setTab] = useState("header");             // Onglet actif dans la sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true); // Visibilité de la sidebar
  const fileRef = useRef(), logoRef = useRef(), bgRef = useRef(); // Refs pour les inputs file
  const previewContainerRef = useRef();
  const [previewSize, setPreviewSize] = useState({ w: 700, h: 500 });
  const [libDirHandle, setLibDirHandle] = useState(null);
  const [libFiles, setLibFiles] = useState([]);
  const [libSvgFiles, setLibSvgFiles] = useState([]);
  const [libExpanded, setLibExpanded] = useState({});

  /** Mise à jour immutable du state : clone profond → mutation sur le clone → remplacement */
  const up = useCallback((fn) => setData(prev => { const d = JSON.parse(JSON.stringify(prev)); fn(d); return d; }), []);

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setPreviewSize({ w: width, h: height });
    });
    obs.observe(previewContainerRef.current);
    return () => obs.disconnect();
  }, []);

  /** Export JSON : sérialise le state complet dans un fichier téléchargeable, ré-importable via importJSON. */
  const exportJSON = () => {
    const defaultName = data.header.reference ? `affiche_${data.header.reference}` : "affiche";
    const name = prompt("Nom du fichier (sans extension) :", defaultName);
    if (!name) return;
    const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${name}.json`; a.click(); URL.revokeObjectURL(u);
  };

  /**
   * Export SVG : sérialise le DOM du poster via XMLSerializer (produit du XHTML valide),
   * puis l'enveloppe dans un <svg><foreignObject>. Les styles inline sont ainsi embarqués.
   */
  const exportSVG = () => {
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
    const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `affiche_${data.header.reference}.svg`; a.click(); URL.revokeObjectURL(u);
  };
  /**
   * Export PDF : capture le poster en PNG haute résolution via html-to-image (rendu navigateur natif),
   * puis insère l'image dans un PDF aux dimensions exactes du format papier via jsPDF.
   * La résolution (pixelRatio) est configurable dans l'onglet Export.
   */
  const exportPDF = async () => {
    const el = document.querySelector("[data-poster-root]");
    if (!el) return;
    const fmt = data.format === "Personnalisé" ? { w: data.customW || 800, h: data.customH || 500 } : (FORMATS[data.format] || { w: 800, h: 500 });
    const dataUrl = await toPng(el, { pixelRatio: data.pdfResolution || 3 });
    const orientation = fmt.w > fmt.h ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
    doc.addImage(dataUrl, "PNG", 0, 0, fmt.w, fmt.h);
    doc.save(`affiche_${data.header.reference}.pdf`);
  };
  const exportPNG = async () => {
    const el = document.querySelector("[data-poster-root]");
    if (!el) return;
    const dataUrl = await toPng(el, { pixelRatio: data.pdfResolution || 3 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `affiche_${data.header.reference}.png`;
    a.click();
  };
  /** Import JSON : lit un fichier .json et remplace le state complet. */
  const importJSON = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { setData(JSON.parse(ev.target.result)); } catch { alert("JSON invalide"); } }; r.readAsText(f); };

  /** Charge une image (logo ou bandeau) depuis un input file et la stocke en base64 dans le state. */
  const handleImg = (ref, key) => () => { const f = ref.current?.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up(d => { if (key === "logo") d.header.logoDataUrl = ev.target.result; else d.backgroundImage = ev.target.result; }); r.readAsDataURL(f); };

  const refreshLibrary = async (handle = libDirHandle) => {
    if (!handle) return;
    const jsons = [], svgs = [];
    for await (const [name] of handle.entries()) {
      if (name.endsWith('.json')) jsons.push(name);
      else if (name.endsWith('.svg')) svgs.push(name);
    }
    setLibFiles(jsons.sort());
    setLibSvgFiles(svgs.sort());
  };

  const loadSvgFromLib = async (name) => {
    if (!libDirHandle) return;
    const fh = await libDirHandle.getFileHandle(name);
    const file = await fh.getFile();
    const svgData = await file.text();
    up(d => {
      if (!d.icons) d.icons = [];
      if (!d.icons.find(ic => ic.name === name.replace(/\.svg$/i, '')))
        d.icons.push({ id: uid(), name: name.replace(/\.svg$/i, ''), description: '', svgData });
    });
  };
  const openLibraryDir = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setLibDirHandle(handle);
      const files = [];
      for await (const [name] of handle.entries()) { if (name.endsWith('.json')) files.push(name); }
      setLibFiles(files.sort());
    } catch {}
  };
  const saveToLibrary = async () => {
    if (!libDirHandle) return;
    const base = data.header.reference ? `affiche_${data.header.reference}` : "affiche";
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const maxV = libFiles.reduce((max, f) => {
      const m = f.match(new RegExp(`^${escaped}_(V(\\d+))\\.json$`, 'i'));
      return m ? Math.max(max, parseInt(m[2])) : max;
    }, 0);
    const suggested = `${base}_V${maxV + 1}`;
    const nameInput = prompt("Nom du fichier (sans extension) :", suggested);
    if (!nameInput) return;
    const fh = await libDirHandle.getFileHandle(`${nameInput}.json`, { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(data, null, 2));
    await w.close();
    await refreshLibrary();
  };
  const loadFromLibrary = async (name) => {
    if (!libDirHandle) return;
    const fh = await libDirHandle.getFileHandle(name);
    const file = await fh.getFile();
    try { setData(JSON.parse(await file.text())); } catch { alert('JSON invalide'); }
  };
  const deleteFromLibrary = async (name) => {
    if (!libDirHandle || !confirm(`Supprimer ${name} ?`)) return;
    await libDirHandle.removeEntry(name);
    await refreshLibrary();
  };

  /** Définition des 7 onglets de la sidebar */
  const tabs = [{ key:"header",label:"En-tête",icon:"◆" },{ key:"format",label:"Format",icon:"⊞" },{ key:"entree",label:"Entrée",icon:"▶" },{ key:"steps",label:"Process",icon:"⚙" },{ key:"sortie",label:"Sortie",icon:"◀" },{ key:"line",label:"Ligne",icon:"🏭" },{ key:"export",label:"Export",icon:"↗" },{ key:"library",label:"Biblio",icon:"📚" }];

  return (
    <div style={{ display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#212121",overflow:"hidden" }}>
      {/* ── Sidebar d'édition (360px, rétractable) ── */}
      <div style={{ width:sidebarOpen?360:0,minWidth:sidebarOpen?360:0,transition:"width 0.2s,min-width 0.2s",borderRight:"1px solid #e0e0e0",display:"flex",flexDirection:"column",background:"#fff",overflow:"hidden" }}>
        {sidebarOpen && <>
          <div style={{ padding:"12px 14px",borderBottom:"1px solid #e0e0e0",background:"#C8102E",color:"#fff" }}>
            <div style={{ fontSize:14,fontWeight:700 }}>Éditeur d'affiche</div><div style={{ fontSize:10,opacity:0.8 }}>Ligne de production</div>
          </div>
          <div style={{ display:"flex",flexWrap:"wrap",borderBottom:"1px solid #e0e0e0" }}>
            {tabs.map(t=><button key={t.key} onClick={()=>setTab(t.key)} style={{ flex:1,minWidth:56,padding:"8px 4px",border:"none",borderBottom:tab===t.key?"2.5px solid #C8102E":"2.5px solid transparent",background:tab===t.key?"#FFF5F5":"transparent",color:tab===t.key?"#C8102E":"#888",fontSize:10,fontWeight:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1 }}><span style={{ fontSize:14 }}>{t.icon}</span>{t.label}</button>)}
          </div>
          <div style={{ flex:1,overflowY:"auto",padding:12 }}>
            {tab === "header" && (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Référence</label><Input value={data.header.reference} onChange={v=>up(d=>{d.header.reference=v;})} />
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Nom du process</label><Input value={data.header.processName} onChange={v=>up(d=>{d.header.processName=v;})} />
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Sous-titre</label><Input value={data.header.subtitle} onChange={v=>up(d=>{d.header.subtitle=v;})} />
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Logo</label>
                <input ref={logoRef} type="file" accept="image/*" onChange={handleImg(logoRef,"logo")} style={{ fontSize:11 }} />
                {data.header.logoDataUrl && <Btn small outline color="#d32f2f" onClick={()=>up(d=>{d.header.logoDataUrl=null;})}>Supprimer</Btn>}
                <label style={{ fontSize:11,fontWeight:600,color:"#666",marginTop:6 }}>Image bandeau</label>
                <div style={{ fontSize:10,color:"#999" }}>S'affiche entre le contenu et le footer, sans déformation.</div>
                <input ref={bgRef} type="file" accept="image/*" onChange={handleImg(bgRef,"bg")} style={{ fontSize:11 }} />
                {data.backgroundImage && <Btn small outline color="#d32f2f" onClick={()=>up(d=>{d.backgroundImage=null;})}>Supprimer</Btn>}
                {data.backgroundImage && (
                  <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
                    <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Hauteur image bandeau</label>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:6 }}><span style={{ fontSize:10,color:"#888" }}>5%</span><input type="range" min="5" max="60" step="1" value={data.bgImageHeight||25} onChange={e=>up(d=>{d.bgImageHeight=parseInt(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>60%</span></div>
                    <div style={{ fontSize:12,fontWeight:700,color:"#C8102E",marginTop:4 }}>{data.bgImageHeight||25}%</div>
                  </div>
                )}
              </div>
            )}
            {tab === "format" && (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {(()=>{const sel=FORMATS[data.format]||{w:data.customW,h:data.customH};const ratio=sel.h/sel.w;const pw=120,ph=pw*ratio;const isISO=data.format.startsWith("A");const ok=Math.abs(ratio-1/Math.sqrt(2))<0.002||Math.abs(ratio-Math.sqrt(2))<0.002;return <div style={{ display:"flex",alignItems:"center",gap:12,padding:10,background:"#f5f5f5",borderRadius:8 }}><div style={{ width:pw,height:ph,border:"2px solid #C8102E",borderRadius:4,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#999",flexShrink:0 }}>{sel.w}×{sel.h}</div><div style={{ fontSize:11,color:"#555",lineHeight:1.5 }}><div style={{ fontWeight:700,color:"#C8102E" }}>{data.format}</div><div>Ratio : <strong>1:{ratio.toFixed(3)}</strong></div>{isISO&&<div style={{ fontSize:10,color:ok?"#2E7D32":"#d32f2f" }}>{ok?"✓ ISO 1:√2":"⚠ Non-ISO"}</div>}</div></div>;})()}
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Format</label>
                {Object.keys(FORMATS).map(f=><label key={f} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,border:data.format===f?"2px solid #C8102E":"1.5px solid #e0e0e0",background:data.format===f?"#FFF5F5":"#fff",cursor:"pointer",fontSize:12 }}><input type="radio" name="fmt" checked={data.format===f} onChange={()=>up(d=>{d.format=f;})} style={{ accentColor:"#C8102E" }} /><span style={{ fontWeight:500 }}>{f}</span><span style={{ marginLeft:"auto",fontSize:10,color:"#999" }}>{FORMATS[f].w}×{FORMATS[f].h}</span></label>)}
                {data.format==="Personnalisé"&&<div style={{ display:"flex",gap:8 }}><div style={{ flex:1 }}><label style={{ fontSize:10,color:"#888" }}>L (mm)</label><Input value={data.customW} onChange={v=>up(d=>{d.customW=parseInt(v)||800;})} type="number" /></div><div style={{ flex:1 }}><label style={{ fontSize:10,color:"#888" }}>H (mm)</label><Input value={data.customH} onChange={v=>up(d=>{d.customH=parseInt(v)||500;})} type="number" /></div></div>}

                {/* Forcer le format */}
                <div style={{ padding:12,background:data.forceFormat?"#FFF5F5":"#f5f5f5",borderRadius:8,border:data.forceFormat?"2px solid #C8102E":"1px solid transparent" }}>
                  <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}>
                    <input type="checkbox" checked={data.forceFormat} onChange={e=>up(d=>{d.forceFormat=e.target.checked;})} style={{ accentColor:"#C8102E",width:16,height:16 }} />
                    <span style={{ fontSize:11,fontWeight:600,color:data.forceFormat?"#C8102E":"#666" }}>Forcer les dimensions exactes</span>
                  </label>
                  <div style={{ fontSize:10,color:"#999",marginTop:4,marginLeft:24 }}>
                    {data.forceFormat
                      ? "Activé : l'affiche fait exactement la taille du format. Le contenu qui dépasse est masqué. Réduisez la police ou augmentez les colonnes si le contenu est coupé."
                      : "Désactivé : l'affiche s'étend verticalement pour montrer tout le contenu (hauteur minimale = format)."
                    }
                  </div>
                </div>

                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Colonnes max</label>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:6 }}>{[0,2,3,4,5,6].map(n=><button key={n} onClick={()=>up(d=>{d.maxCols=n;})} style={{ padding:"5px 12px",borderRadius:5,fontSize:12,fontWeight:600,cursor:"pointer",border:data.maxCols===n?"2px solid #C8102E":"1.5px solid #ddd",background:data.maxCols===n?"#FFF5F5":"#fff",color:data.maxCols===n?"#C8102E":"#666" }}>{n===0?"Auto":n}</button>)}</div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Taille polices</label>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:6 }}><span style={{ fontSize:10,color:"#888" }}>1</span><input type="range" min="1" max="20" step="1" value={data.fontScale} onChange={e=>up(d=>{d.fontScale=parseInt(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>20</span></div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}><span style={{ fontSize:12,fontWeight:700,color:"#C8102E" }}>{data.fontScale}/20</span><div style={{ display:"flex",gap:4 }}>{[{l:"XS",v:3},{l:"S",v:5},{l:"M",v:7},{l:"L",v:10},{l:"XL",v:14},{l:"2XL",v:20}].map(({l,v})=><button key={v} onClick={()=>up(d=>{d.fontScale=v;})} style={{ padding:"3px 7px",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",border:data.fontScale===v?"2px solid #C8102E":"1px solid #ddd",background:data.fontScale===v?"#FFF5F5":"#fff",color:data.fontScale===v?"#C8102E":"#888" }}>{l}</button>)}</div></div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Taille QR codes</label>
                  <div style={{ fontSize:10,color:"#999",marginBottom:4 }}>Visible sur les tags ayant une URL. Cliquer un tag dans l'éditeur pour ajouter l'URL.</div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}><span style={{ fontSize:10,color:"#888" }}>16</span><input type="range" min="16" max="80" step="4" value={data.qrSize} onChange={e=>up(d=>{d.qrSize=parseInt(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>80</span></div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}><span style={{ fontSize:12,fontWeight:700,color:"#C8102E" }}>{data.qrSize}px</span><span style={{ fontSize:10,color:"#999" }}>Rendu : {Math.round(data.qrSize*(data.fontScale||7)*0.15)}px</span></div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Hauteur zone de titre</label>
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:6 }}><span style={{ fontSize:10,color:"#888" }}>30</span><input type="range" min="30" max="120" step="2" value={data.headerHeight || 56} onChange={e=>up(d=>{d.headerHeight=parseInt(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>120</span></div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}><span style={{ fontSize:12,fontWeight:700,color:"#C8102E" }}>{data.headerHeight || 56}px</span><span style={{ fontSize:10,color:"#999" }}>Rendu : {Math.round((data.headerHeight||56)*(data.fontScale||7)*0.15)}px</span></div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Largeur entrée / sortie</label>
                  <div style={{ fontSize:10,color:"#999",marginBottom:4 }}>Contrôle la largeur fixe des panneaux entrée et sortie.</div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}><span style={{ fontSize:10,color:"#888" }}>10</span><input type="range" min="10" max="420" step="10" value={data.bookendWidth || 220} onChange={e=>up(d=>{d.bookendWidth=parseInt(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>420</span></div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}><span style={{ fontSize:12,fontWeight:700,color:"#C8102E" }}>{data.bookendWidth || 220}px</span></div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}>
                    <input type="checkbox" checked={data.showLineTags!==false} onChange={e=>up(d=>{d.showLineTags=e.target.checked;})} style={{ accentColor:"#C8102E",width:16,height:16 }} />
                    <span style={{ fontSize:11,fontWeight:600,color:"#666" }}>Afficher les tags sur la ligne de production</span>
                  </label>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Label des zones (ligne de prod.)</label>
                  <div style={{ display:"flex",gap:6,marginTop:6 }}>
                    {[["number","Numéros"],["title","Titres"]].map(([v,l])=><button key={v} onClick={()=>up(d=>{d.lineZoneLabel=v;})} style={{ padding:"5px 12px",borderRadius:5,fontSize:12,fontWeight:600,cursor:"pointer",border:(data.lineZoneLabel||"number")===v?"2px solid #C8102E":"1.5px solid #ddd",background:(data.lineZoneLabel||"number")===v?"#FFF5F5":"#fff",color:(data.lineZoneLabel||"number")===v?"#C8102E":"#666" }}>{l}</button>)}
                  </div>
                </div>
              </div>
            )}
            {tab === "entree" && <BookendEditor data={data.entree} onChange={entree=>up(d=>{d.entree=entree;})} />}
            {tab === "steps" && <StepsEditor steps={data.steps} line={data.line||[]} icons={data.icons||[]} onChange={steps=>up(d=>{d.steps=steps;})} />}
            {tab === "sortie" && <BookendEditor data={data.sortie} onChange={sortie=>up(d=>{d.sortie=sortie;})} />}
            {tab === "line" && <LineEditor icons={data.icons||[]} line={data.line||[]} steps={data.steps} onChange={({icons,line})=>up(d=>{d.icons=icons;d.line=line;})} libDirHandle={libDirHandle} libSvgFiles={libSvgFiles} onLoadSvg={loadSvgFromLib} />}
            {tab === "export" && (
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8,fontSize:11,color:"#666",lineHeight:1.6 }}><strong style={{ color:"#424242" }}>Exports :</strong><br/>• <strong>JSON</strong> — Sauvegarde ré-importable<br/>• <strong>SVG</strong> — Vectoriel (Illustrator / Inkscape)<br/>• <strong>PNG</strong> — Image haute résolution<br/>• <strong>PDF</strong> — Document imprimable</div>
                <Btn onClick={exportJSON}>↓ Exporter JSON</Btn>
                <Btn onClick={exportSVG} color="#E87722">↓ Exporter SVG</Btn>
                <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Résolution export (PNG / PDF)</label>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:6 }}>
                    {[{v:1,l:"1× (96 DPI)"},{v:2,l:"2× (200 DPI)"},{v:3,l:"3× (300 DPI)"},{v:4,l:"4× (400 DPI)"}].map(r=><button key={r.v} onClick={()=>up(d=>{d.pdfResolution=r.v;})} style={{ padding:"5px 10px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:(data.pdfResolution||3)===r.v?"2px solid #1565C0":"1.5px solid #ddd",background:(data.pdfResolution||3)===r.v?"#E3F2FD":"#fff",color:(data.pdfResolution||3)===r.v?"#1565C0":"#666" }}>{r.l}</button>)}
                  </div>
                  <div style={{ fontSize:10,color:"#999",marginTop:4 }}>Plus élevé = meilleure qualité, mais plus lent (attention aux grands formats A0/A1).</div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <Btn onClick={exportPNG} color="#2E7D32" style={{ flex:1 }}>↓ Exporter PNG</Btn>
                  <Btn onClick={exportPDF} color="#1565C0" style={{ flex:1 }}>↓ Exporter PDF</Btn>
                </div>
                <div style={{ borderTop:"1px solid #e0e0e0",paddingTop:12 }}><label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Importer JSON</label><input ref={fileRef} type="file" accept=".json" onChange={importJSON} style={{ fontSize:11,marginTop:4 }} /></div>
                <Btn outline color="#d32f2f" onClick={()=>{if(confirm("Réinitialiser ?"))setData(defaultData());}}>↺ Réinitialiser</Btn>
              </div>
            )}
            {tab === "library" && (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {!libDirHandle ? (
                  <>
                    <div style={{ padding:12,background:"#f5f5f5",borderRadius:8,fontSize:11,color:"#666",lineHeight:1.6 }}>Choisis le dossier <strong>library/</strong> du projet pour sauvegarder et charger des affiches JSON.</div>
                    <Btn onClick={openLibraryDir} color="#555">📁 Choisir le dossier library/</Btn>
                  </>
                ) : (
                  <>
                    <div style={{ display:"flex",gap:6 }}>
                      <Btn onClick={saveToLibrary} style={{ flex:1 }}>💾 Sauvegarder</Btn>
                      <Btn outline color="#888" onClick={()=>refreshLibrary()}>↺</Btn>
                      <Btn outline color="#555" onClick={openLibraryDir}>📁</Btn>
                    </div>
                    <div style={{ fontSize:10,color:"#999",padding:"0 2px" }}>📂 {libDirHandle.name}/</div>
                    {libFiles.length === 0
                      ? <div style={{ fontSize:11,color:"#bbb",textAlign:"center",padding:20 }}>Aucun fichier JSON</div>
                      : (() => {
                          const groups = {};
                          libFiles.forEach(name => {
                            const m = name.match(/^(.+)_(V\d+)\.json$/i);
                            const base = m ? m[1] : name.replace(/\.json$/, '');
                            if (!groups[base]) groups[base] = [];
                            groups[base].push(name);
                          });
                          return Object.entries(groups).map(([base, files]) => {
                            const isGroup = files.length > 1;
                            const expanded = libExpanded[base] !== false;
                            if (!isGroup) {
                              const name = files[0];
                              return (
                                <div key={name} style={{ display:"flex",alignItems:"center",gap:6,background:"#fafafa",border:"1px solid #eee",borderRadius:5,padding:"6px 8px" }}>
                                  <span style={{ flex:1,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>📄 {name.replace(/\.json$/,'')}</span>
                                  <Btn small onClick={()=>loadFromLibrary(name)}>Charger</Btn>
                                  <span onClick={()=>deleteFromLibrary(name)} style={{ cursor:"pointer",color:"#ccc",fontSize:13 }}>✕</span>
                                </div>
                              );
                            }
                            return (
                              <div key={base} style={{ border:"1px solid #ddd",borderRadius:6,overflow:"hidden" }}>
                                <div onClick={()=>setLibExpanded(e=>({...e,[base]:!expanded}))} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 10px",background:"#efefef",cursor:"pointer",userSelect:"none" }}>
                                  <span style={{ fontSize:10,color:"#666" }}>{expanded?"▾":"▸"}</span>
                                  <span style={{ flex:1,fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>📁 {base}</span>
                                  <span style={{ fontSize:10,color:"#999",flexShrink:0 }}>{files.length} versions</span>
                                </div>
                                {expanded && files.map((name, i) => {
                                  const vm = name.match(/_(V\d+)\.json$/i);
                                  const label = vm ? vm[1] : name.replace(/\.json$/,'');
                                  return (
                                    <div key={name} style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 8px 5px 18px",borderTop:"1px solid #eee",background:"#fafafa" }}>
                                      <span style={{ fontSize:10,color:"#777",marginRight:2 }}>{i === files.length-1 ? "└" : "├"}</span>
                                      <span style={{ flex:1,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{label}</span>
                                      <Btn small onClick={()=>loadFromLibrary(name)}>Charger</Btn>
                                      <span onClick={()=>deleteFromLibrary(name)} style={{ cursor:"pointer",color:"#ccc",fontSize:13 }}>✕</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          });
                        })()
                    }
                  </>
                )}
              </div>
            )}
          </div>
        </>}
      </div>
      {/* ── Zone d'aperçu (droite) ── */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ display:"flex",alignItems:"center",padding:"8px 16px",borderBottom:"1px solid #e0e0e0",background:"#fafafa",gap:12 }}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ border:"1px solid #ddd",borderRadius:5,background:"#fff",padding:"4px 10px",cursor:"pointer",fontSize:14 }}>{sidebarOpen?"◁":"▷"}</button>
          <span style={{ fontSize:13,fontWeight:600,color:"#555" }}>Aperçu</span>
          <span style={{ fontSize:10,color:"#aaa",marginLeft:"auto" }}>{data.header.reference} — {data.format}</span>
        </div>
        {/* Poster rendu à taille réelle puis réduit par transform: scale() pour tenir dans la fenêtre */}
        {(()=>{const sel=FORMATS[data.format]||{w:data.customW,h:data.customH};const pad=48;const posterW=Math.round(sel.w*MM_PX);const posterH=Math.round(sel.h*MM_PX);const sc=Math.min((previewSize.w-pad)/posterW,(previewSize.h-pad)/posterH);return <div ref={previewContainerRef} style={{ flex:1,overflow:"hidden",background:"#e8e8e8",display:"flex",justifyContent:"center",alignItems:"center" }}><div style={{ transform:`scale(${sc.toFixed(3)})`,transformOrigin:"center center" }}><PosterPreview data={data} /></div></div>;})()}
      </div>
      {/* Styles d'impression : masque la sidebar et supprime le scaling pour imprimer le poster en taille réelle */}
      <style>{`@media print{body>div>div:first-child,[style*="borderBottom"]{display:none!important}[style*="overflow: auto"]{overflow:visible!important;padding:0!important;background:white!important}[style*="transform"]{transform:none!important}}`}</style>
    </div>
  );
}
