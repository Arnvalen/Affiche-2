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
import { useState, useRef, useCallback, useEffect, useMemo, Fragment, Component } from "react";
import { produce } from "immer";        // Copie structurale pour up() — remplace JSON.parse/stringify
import QRCode from "qrcode";            // Génération de la matrice QR
// html-to-image et jsPDF : chargés dynamiquement à l'export (voir exportPNG/exportPDF)

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

/** Interpolation linéaire entre deux couleurs hex */
const lerpColor = (a, b, t) => {
  const h = s => parseInt(s, 16);
  const [ar,ag,ab] = [h(a.slice(1,3)),h(a.slice(3,5)),h(a.slice(5,7))];
  const [br,bg,bb] = [h(b.slice(1,3)),h(b.slice(3,5)),h(b.slice(5,7))];
  const mix = (x,y) => Math.round(x*(1-t)+y*t).toString(16).padStart(2,'0');
  return `#${mix(ar,br)}${mix(ag,bg)}${mix(ab,bb)}`;
};
/** Couleur de zone calculée par dégradé entre pal.zoneFrom et pal.zoneTo */
const getZoneColor = (pal, index, total) =>
  lerpColor(pal.zoneFrom, pal.zoneTo, total <= 1 ? 0 : index / (total - 1));

/** Thèmes de couleurs disponibles pour le poster */
const PALETTES = [
  { id:"nexans",     name:"Nexans Classic", primary:"#C8102E", accent:"#E87722", footer:"#212121",
    entreeH:"#2E7D32", entreeB:"#E8F5E9", entreeBr:"#A5D6A7",
    sortieH:"#9B0D23", sortieB:"#FFEBEE", sortieBr:"#EF9A9A",
    cp:{bg:"#E3F2FD",br:"#90CAF9",tx:"#1565C0"},
    zoneFrom:"#C8102E", zoneTo:"#1565C0" },
  { id:"cobalt",     name:"Cobalt Pro",     primary:"#1565C0", accent:"#0288D1", footer:"#0A1929",
    entreeH:"#00695C", entreeB:"#E0F2F1", entreeBr:"#80CBC4",
    sortieH:"#AD1457", sortieB:"#FCE4EC", sortieBr:"#F48FB1",
    cp:{bg:"#E8EAF6",br:"#7986CB",tx:"#283593"},
    zoneFrom:"#0D47A1", zoneTo:"#0097A7" },
  { id:"graphite",   name:"Graphite",       primary:"#37474F", accent:"#607D8B", footer:"#102027",
    entreeH:"#2E7D32", entreeB:"#E8F5E9", entreeBr:"#A5D6A7",
    sortieH:"#B71C1C", sortieB:"#FFEBEE", sortieBr:"#EF9A9A",
    cp:{bg:"#ECEFF1",br:"#78909C",tx:"#37474F"},
    zoneFrom:"#263238", zoneTo:"#90A4AE" },
  { id:"foret",      name:"Forêt",          primary:"#2E7D32", accent:"#558B2F", footer:"#1A2E1B",
    entreeH:"#1565C0", entreeB:"#E3F2FD", entreeBr:"#90CAF9",
    sortieH:"#BF360C", sortieB:"#FBE9E7", sortieBr:"#FFAB91",
    cp:{bg:"#F1F8E9",br:"#AED581",tx:"#33691E"},
    zoneFrom:"#1B5E20", zoneTo:"#00897B" },
  { id:"ocean",      name:"Océan",          primary:"#006064", accent:"#00ACC1", footer:"#002F35",
    entreeH:"#1565C0", entreeB:"#E3F2FD", entreeBr:"#90CAF9",
    sortieH:"#AD1457", sortieB:"#FCE4EC", sortieBr:"#F48FB1",
    cp:{bg:"#E0F7FA",br:"#80DEEA",tx:"#00838F"},
    zoneFrom:"#004D40", zoneTo:"#0277BD" },
  { id:"soleil",     name:"Soleil",         primary:"#F57F17", accent:"#FDD835", footer:"#3E2723",
    entreeH:"#2E7D32", entreeB:"#E8F5E9", entreeBr:"#A5D6A7",
    sortieH:"#BF360C", sortieB:"#FBE9E7", sortieBr:"#FFAB91",
    cp:{bg:"#FFFDE7",br:"#FDD835",tx:"#F57F17"},
    zoneFrom:"#BF360C", zoneTo:"#F9A825" },
  { id:"aubergine",  name:"Aubergine",      primary:"#4A148C", accent:"#AB47BC", footer:"#1A0030",
    entreeH:"#00695C", entreeB:"#E0F2F1", entreeBr:"#80CBC4",
    sortieH:"#AD1457", sortieB:"#FCE4EC", sortieBr:"#F48FB1",
    cp:{bg:"#F3E5F5",br:"#CE93D8",tx:"#6A1B9A"},
    zoneFrom:"#4A148C", zoneTo:"#C62828" },
  { id:"sakura",     name:"Sakura",         primary:"#AD1457", accent:"#F06292", footer:"#4A0D2D",
    entreeH:"#2E7D32", entreeB:"#E8F5E9", entreeBr:"#A5D6A7",
    sortieH:"#880E4F", sortieB:"#FCE4EC", sortieBr:"#F48FB1",
    cp:{bg:"#FCE4EC",br:"#F48FB1",tx:"#AD1457"},
    zoneFrom:"#880E4F", zoneTo:"#4527A0" },
  { id:"terracotta", name:"Terracotta",     primary:"#6D4C41", accent:"#FF7043", footer:"#3E2723",
    entreeH:"#4E342E", entreeB:"#EFEBE9", entreeBr:"#BCAAA4",
    sortieH:"#BF360C", sortieB:"#FBE9E7", sortieBr:"#FFAB91",
    cp:{bg:"#FBE9E7",br:"#FFAB91",tx:"#BF360C"},
    zoneFrom:"#4E342E", zoneTo:"#FF7043" },
  { id:"minuit",     name:"Minuit",         primary:"#0D1B4B", accent:"#C9A84C", footer:"#060D26",
    entreeH:"#0D4B2C", entreeB:"#E8F5E9", entreeBr:"#A5D6A7",
    sortieH:"#4B0D0D", sortieB:"#FFEBEE", sortieBr:"#EF9A9A",
    cp:{bg:"#E8EEFF",br:"#9BB0FF",tx:"#0D1B4B"},
    zoneFrom:"#0D1B4B", zoneTo:"#C9A84C" },
];
const getPalette = id => PALETTES.find(p => p.id === id) || PALETTES[0];

/** Générateur d'IDs uniques pour les éléments du modèle de données */
let _id = 120; const uid = () => `_${_id++}`;

/** Convertit un SVG texte en data URL pour utilisation dans <img> ou <image>. */
const svgUrl = (svgData) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

/** Extrait le ratio naturel (largeur/hauteur) d'un SVG à partir de viewBox ou width/height.
 *  Retourne 1 si indéterminé. Utilisé pour afficher les icônes sans déformation dans la bande. */
const getSVGRatio = (svgData) => {
  if (!svgData) return 1;
  const vb = svgData.match(/viewBox=["']([^"']+)["']/);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length >= 4 && p[3]) return p[2] / p[3];
  }
  const wm = svgData.match(/\bwidth=["']([0-9.]+)["']/);
  const hm = svgData.match(/\bheight=["']([0-9.]+)["']/);
  if (wm && hm) { const w = parseFloat(wm[1]), h = parseFloat(hm[1]); if (w && h) return w / h; }
  return 1;
};

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
const Input = ({ value, onChange, placeholder, style:st, ...r }) => <input value={value} onChange={e=>onChange(e.target.value)} onFocus={e=>e.target.select()} placeholder={placeholder} style={{ width:"100%",padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit",outline:"none",...st }} {...r} />;
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
  const up = (fn) => { onChange(produce(data, fn)); };
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
  const up = (fn) => { onChange(produce(steps, fn)); };
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
const BookendPanel = ({ bookendData, type, s, qrSize, width, palette }) => {
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

/* ═══════════════════ POSTER PREVIEW ═══════════════════ */

/**
 * Calcule le label final d'une machine (ex: "A", "A1", "B2") en utilisant computeLayout,
 * identique au rendu de LineFlowBand. Utilisé dans l'éditeur, le plan technique, et les étapes.
 */
function getLineLabel(line, steps, itemId) {
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

/**
 * Composant principal de rendu du poster.
 * Rendu à taille réelle (mm → px via MM_PX), puis réduit par transform: scale() dans App.
 * Structure verticale : Header → Légende → Contenu principal → Image bandeau → Footer.
 * Le contenu principal est horizontal : Entrée | › | Grille d'étapes | › | Sortie.
 * L'attribut data-poster-root permet aux exports (SVG, PDF) de cibler cet élément.
 */
const PosterPreview = ({ data, appVersion }) => {
  const pal = getPalette(data.palette);
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
    const { label } = getLineLabel(data.line||[], data.steps||[], lineItemId);
    const si2 = item.stepId ? data.steps.findIndex(s => s.id === item.stepId) : -1;
    return { letter: label, color: si2 >= 0 ? getZoneColor(pal, si2, totalSteps) : '#9E9E9E' };
  };

  const renderStep = (step, si) => {
    const zc = getZoneColor(pal, si, totalSteps);
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
                <div style={{ flex:1,display:"flex",flexDirection:"row",alignItems:"center",justifyContent:"center",borderRadius:4,padding:`${4*s}px ${8*s}px`,background:pal.cp.bg,border:`2px solid ${pal.cp.br}`,gap:6*s }}>
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2*s,flex:1 }}>
                    <span style={{ fontSize:10*s,fontWeight:700,color:pal.cp.tx,textTransform:"uppercase",letterSpacing:1 }}>{item.name}</span>
                    {item.description && <span style={{ fontSize:9*s,fontWeight:400,color:pal.cp.tx,textTransform:"none",letterSpacing:0 }}>{item.description}</span>}
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
    <div key={key} style={{ display:"flex",alignItems:"center",justifyContent:"center",width:12*s,flexShrink:0,color:pal.accent }}>
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

  const rowConn = <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",padding:`${3*s}px 0`,color:pal.accent,paddingRight:8*s }}><svg width={16*s} height={16*s} viewBox="0 0 24 24" fill="currentColor"><path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/></svg></div>;
  const arrowSt = { display:"flex",alignItems:"center",justifyContent:"center",width:28*s,minWidth:28*s,flexShrink:0,color:pal.accent };

  const forceH = data.forceFormat;

  return (
    <div data-poster-root="1" style={{ width:posterW, ...(forceH ? {height:posterH} : {minHeight:posterH}), fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:"#fff",borderRadius:6,overflow:forceH?"hidden":"visible",boxShadow:"0 2px 16px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column", position:"relative", ...(forceH ? {outline:`2px dashed ${pal.primary}`,outlineOffset:-2} : {}) }}>
      {/* Format lock indicator */}
      {forceH && <div style={{ position:"absolute",top:4,right:4,background:pal.primary,color:"#fff",fontSize:8*s,padding:`${1*s}px ${4*s}px`,borderRadius:3,fontWeight:700,opacity:0.7,zIndex:10 }}>FORMAT FIXE</div>}

      {/* Header */}
      {(()=>{ const hh=(data.headerHeight||56), hr=hh/56, hs=s*hr; return (
      <div style={{ background:pal.primary,color:"#fff",display:"flex",alignItems:"flex-start",padding:`0 ${24*hs}px`,height:hh*s,gap:20*hs,flexShrink:0,paddingTop:4*hs }}>
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
        <BookendPanel bookendData={data.entree} type="entree" s={s} qrSize={qrSize} width={bookendW} palette={pal} />
        <div style={arrowSt}><svg width={20*s} height={20*s} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
        <div style={{ flex:1,display:"flex",flexDirection:"column",gap:0,minWidth:0 }}>
          {rows.map((rowSteps, ri) => <div key={ri} style={{ display:"flex",flexDirection:"column",flex:1,minHeight:0 }}>{ri > 0 && rowConn}{renderRow(rowSteps, ri)}</div>)}
        </div>
        <div style={arrowSt}><svg width={20*s} height={20*s} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
        <BookendPanel bookendData={data.sortie} type="sortie" s={s} qrSize={qrSize} width={bookendW} palette={pal} />
      </div>

      {/* Ligne de production ou image bandeau */}
      {(()=>{
        const bh=posterH*((data.bgImageHeight||25)/100);
        const hasLine=(data.line||[]).length>0;
        const hasImg=!!data.backgroundImage;
        if(!hasLine&&!hasImg) return null;
        if(!hasLine) return(
          <div style={{flexShrink:0,width:"100%",display:"flex",justifyContent:"center",alignItems:"flex-end",background:"#f0f0f0",height:bh,overflow:"hidden"}}>
            <img src={data.backgroundImage} alt="" style={{maxWidth:"100%",maxHeight:bh,objectFit:"contain",display:"block"}} />
          </div>
        );
        return <LineFlowErrorBoundary bh={bh}><LineFlowBand data={data} bh={bh} s={s} pal={pal} posterW={posterW} /></LineFlowErrorBoundary>;
      })()}

      {/* Footer */}
      <div style={{ display:"flex",justifyContent:"space-between",padding:`${6*s}px ${24*s}px`,background:pal.primary,color:"rgba(255,255,255,0.6)",fontSize:9*s,flexShrink:0,flexWrap:"wrap",gap:8*s }}>
        <span><strong style={{ color:"#fff" }}>Version :</strong> {data.version || '—'}</span>
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
const emptyData = () => ({
  header: { reference: "", processName: "", subtitle: "", logoDataUrl: "" },
  format: "A1-paysage", customW: 800, customH: 500, maxCols: 0, fontScale: 7, qrSize: 32, forceFormat: false,
  bookendWidth: 220, headerHeight: 56, bgImageHeight: 25, showLineTags: true, lineZoneLabel: "number", pdfResolution: 150,
  entree: { tags: [], sections: [] },
  sortie: { tags: [], sections: [] },
  steps: [], backgroundImage: "", icons: [], line: [], version: "",
  technicalPlan: { zoneLabel:"number", gridSize:5, legendFontSize:9, views: [
    { id:"top",  label:"Vue de dessus", imageDataUrl:null, stepZones:[], machineLabels:[], enabled:true },
    { id:"side", label:"Vue de côté",   imageDataUrl:null, stepZones:[], machineLabels:[], enabled:true },
  ]},
});

const defaultData = () => ({
  header: { reference: "", processName: "", subtitle: "", logoDataUrl: "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iQ2FscXVlXzEiIGRhdGEtbmFtZT0iQ2FscXVlIDEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDY4OC40MyAyODMuNDQiPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuY2xzLTEgewogICAgICAgIGZpbGw6ICMwMTAxMDE7CiAgICAgIH0KCiAgICAgIC5jbHMtMiB7CiAgICAgICAgZmlsbDogI0ZGMTkxMDsKICAgICAgfQogICAgPC9zdHlsZT4KICA8L2RlZnM+CiAgPHBhdGggY2xhc3M9ImNscy0yIiBkPSJNMjk5LjM5LDQuMTdzLTEwLjktNC4xNy0yNS42NS00LjE3Yy0yNi43MywwLTQwLjc5LDE0LjU5LTQ3LjYyLDIzLjk4LTYuNDYsOC44OC0xMC41MywxOC4xMy0xMy41OSwzMC45Mi0yLjkzLDEyLjIzLTMuNDEsMjcuNTItMy45MiwzOS43Mi0xLjI3LDMwLjYzLDEuNiw4NC41My0xMS42MSw4NC41My02Ljc4LDAtMTEuNDItMTAuNDMtMTIuOTktMTQuNDQtLjY0LTEuNjMtNS44LTE2LjYzLTEyLjE5LTQ0Ljk4LTMuOTctMTcuNjYtMTMuNDItNjAuMjEtMTYuMTYtNjkuNzgtMS4yNi00LjQxLTQuNDctMTYuMS0xMC42OS0yNi4yNC04LjE2LTEzLjI5LTIyLjA2LTE5Ljk5LTM0LjEzLTE5Ljk5cy0yMi41NSw4LjA4LTI2LjUyLDExLjk5Yy0xMi4xMSwxMS45My0xNi4wNywyOS4zNC0xNy4zNCwzNi4yNi0xLjM4LDcuNDctMy4wNywyMy4wNy0zLjA3LDIzLjA3LTIuNDMsMTguNi02LjQ5LDUwLjgzLTcuNDEsNTcuNTktNC43NCwzNC43Ni0xNC42NCw0MC4zNy0yNC4xNyw0My40Ny0yLjI0LC43My02LjUzLDEuMDYtOC4wMSwxLjA2LTYuMjEsMC0xMS4xMi0xLjgtMTEuMTItMS44LS42Ny0uMjctMS45Mi0uNzYtMy4zOC0uNzYtLjg1LDAtMS42NiwuMTYtMi40MSwuNDktMi4wMSwuODgtMi45MiwyLjA4LTMuMjMsMi42NC0zLjg4LDUuOTctNC4xOCwxMi4zNy00LjE4LDE0LjE5LDAsNC4zOSwyLjY4LDUuODYsMy40OCw2LjIsLjI0LC4xLDUuNzQsMi40NSwxMy44NiwzLjcsMjQuMzcsMy43OCwzOS42Mi0xMC41Nyw0My43NS0xNC41OSwzLjg4LTMuNzksMTAuNTktMTEuNTksMTUtMjYuODMsMi44Mi05LjcyLDQuNDYtMTkuMjYsNS43MS0yOS44NSwuOTQtNy45OSw3LjA3LTYwLjkxLDguMzItNjguMzIsMS4zMi03LjgsMy4zMi0xNS44OSw3LjE4LTIzLjMsMi43Mi01LjIzLDcuMzgtMTAuODMsMTQuMjctMTAuODMsMi42NSwwLDUuMDgsLjgsNy4yMiwyLjQsNi42LDQuODksMTAuNTUsMTYuNDQsMTEuODUsMjEuNDMsMS43Niw2LjcxLDE0LjM2LDU5LjcsMTYuMzYsNjguOTMsMTMuNDIsNjIuMTMsMjIuNDYsNzIuOSwzNC45Nyw3OS4xMyw3LjE2LDMuNTYsMjEuMjIsNy41MywzMy45OC0yLjU0LDE0LjMxLTExLjI4LDE0LjY5LTMzLjMyLDE1LjY2LTQ2LjY5LDEtMTMuNzgsMS4wNC0yNC44MSwxLjExLTI5Ljc2LC42OC00OS4yLDEuMDktNjQuMzUsMTQuMjItODMuMzMsNy4wNy0xMC4yMSwyMS41Ny0xNy40Myw0NS42LTkuOTksLjU5LC4xOSwxLjg4LC41LDIuOTUsLjUsNC42NiwwLDYuNi00LjczLDcuODEtOS40NCwuODItMy4xOCwzLjA4LTEyLjMzLTMuOTItMTQuNiIvPgogIDxnPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMjc3LjM4LDE2My4xM2MwLDcuNzcsMS4zMywxMi44OCwzLjc5LDE2LjI5LDMuMjIsNC4xNyw4LjE1LDYuNDQsMTQuNTgsNi40NCw3LjIsMCwxNC4wMi0yLjA4LDIwLjQ3LTQuOTIsMS4zMi0uNTcsMi42NS0uOTUsMy45Ny0uOTUsNC43NCwwLDkuMjgsMy45OCw5LjI4LDguOSwwLDMuNjEtMS41MSw2LjgyLTQuOTIsOC41My05LjEsNC4zNS0xOC43NSw2LjQ0LTI4LjgsNi40NC0xMC45OCwwLTIwLjQ1LTMuNi0yNy40Ni0xMC42MS02LjgyLTYuODItMTAuNDItMTYuMjktMTAuNDItMjcuNDZ2LTIzLjg3YzAtMTAuOTksMy42LTIwLjQ2LDEwLjQyLTI3LjI4LDcuMDEtNy4wMSwxNi40OC0xMC42MSwyNy40Ni0xMC42MXMyMC42NSwzLjYsMjcuNDcsMTAuNjFjNi44Miw2LjgyLDEwLjYsMTYuMjksMTAuNiwyNy4yOHY4LjljMCw2LjgyLTUuNDksMTIuMzItMTIuMzEsMTIuMzJoLTQ0LjEzWm0zNi45NC0xOGMwLTE1LjcyLTYuNDQtMjMuMTEtMTguNTctMjMuMTFzLTE4LjM3LDcuMTktMTguMzcsMjMuMTFoMzYuOTRaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0zODMuMjIsMTcwLjE0bC0yMC4wOCwyOS41NWMtMS45LDIuNjYtNC45Miw0LjE3LTcuOTYsNC4xNy01LjExLDAtOS44NS00LjM1LTkuODUtOS44NSwwLTEuODksLjU4LTMuNzgsMS43MS01LjQ5bDI0LjgyLTM1LjA1LTI0LjI1LTM0LjA5Yy0xLjE0LTEuNzEtMS43LTMuNi0xLjctNS41LDAtNS4xMSw0LjM1LTkuODQsOS44NS05Ljg0LDMuMDMsMCw2LjA2LDEuNTEsNy45NSw0LjE2bDE5LjUxLDI4LjYsMTkuNTEtMjguNmMxLjg5LTIuODQsNS4xMS00LjE2LDguMTUtNC4xNiw1LjMsMCw5LjY2LDQuMzUsOS42Niw5Ljg0LDAsMS45LS41OCwzLjc5LTEuNzEsNS41bC0yNC4yNCwzNC4wOSwyNC44MSwzNS4wNWMxLjMzLDEuNzEsMS45LDMuNiwxLjksNS40OSwwLDUuMy00LjU1LDkuODUtMTAuMDQsOS44NS0zLjAzLDAtNi4wNi0xLjMyLTcuOTUtNC4xN2wtMjAuMDktMjkuNTVaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik01MDcuMDUsMTg3LjM4YzAsNS4zLTMuNDEsOS44NS04LjMzLDExLjU2LTkuMjksMy4yMi0yMC4wOSw0LjkyLTMwLjY5LDQuOTItMTEuNTYsMC0yMC42NS0yLjg0LTI3LjA5LTguMzMtNi40NC01LjUtOS44NS0xMy4yNi05Ljg1LTIyLjU0czMuNDEtMTYuNDgsOS44NS0yMS43OGM2LjQ0LTUuNDksMTUuNTMtOC4zNCwyNy4wOS04LjM0aDE5LjUxdi02LjYzYzAtNy45NS01Ljg3LTE0LjIxLTE1LjcyLTE0LjIxLTguOSwwLTEzLjgyLDEuMTQtMjAuNDYsNS4xMS0xLjUyLC45NS0zLjYsMS43LTUuMywxLjctNS4xMSwwLTkuMjgtMy43OS05LjI4LTguNTMsMC0zLjQxLDEuNTEtNi44MSw0LjczLTguNzEsMTAuMjMtNS44OCwxOS4xMy03LjU4LDMyLjc3LTcuNTgsMjEuMjIsMCwzMi43NywxNS4zNSwzMi43NywzMi4yMXY1MS4xNFptLTE5LjUxLTI2LjUyaC0xOS41MWMtMTYuNDgsMC0xNy40Myw4LjkxLTE3LjQzLDEyLjEzLDAsMy40MSwuOTUsMTIuODgsMTcuNDMsMTIuODgsNi40NCwwLDEzLjQ1LS45NSwxOS41MS0yLjQ2di0yMi41NVoiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTU4NS4yNCwxNDAuNGMwLTExLjU1LTYuODItMTguMzctMTguNTYtMTguMzctNi4yNSwwLTEyLjUsLjk0LTE4LjM3LDIuNDZ2NjkuNTJjMCw1LjUtNC4zNiw5Ljg1LTkuNjYsOS44NXMtOS44NS00LjM1LTkuODUtOS44NVYxMjAuNTJjMC01LjMxLDMuMjItOS44NSw4LjMzLTExLjU2LDkuMjktMy4yMSwxOS4zMi00LjkyLDI5LjU1LTQuOTIsMTEuMTgsMCwyMC42NSwzLjYsMjcuNDcsMTAuNjEsNi44Miw2LjgyLDEwLjYsMTYuMjksMTAuNiwyNy4yOHY1Mi4wOWMwLDUuNS00LjM2LDkuODUtOS44NSw5Ljg1cy05LjY2LTQuMzUtOS42Ni05Ljg1di01My42MVoiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTY0MC42OSwxNTguNTljLTEwLjIzLTMuNzktMTguMTktMTEuNzUtMTguMTktMjUuOTUsMC0xNi42NywxMy44My0yOC42MSwzMi43Ny0yOC42MSwxMi44OCwwLDE5LjUxLDEuOSwyNS43Niw0Ljc0LDMuNzksMS41Miw2LjI1LDQuOTIsNi4yNSw4LjkxLDAsNC45Mi0zLjk4LDkuMDktOS4wOSw5LjA5LTEuMzMsMC0zLjIyLS4zOC00LjU1LS45NS00LjczLTIuMjctMTIuNS0zLjc5LTE4Ljc1LTMuNzktNy43NywwLTEyLjg4LDMuNzktMTIuODgsMTAuMjMsMCw0LjkyLDMuNzgsNy45NSw3Ljc2LDkuMjhsMTguNTcsNi4wN2MxMi41LDQuMTYsMjAuMDgsMTIuNjksMjAuMDgsMjYuNTEsMCwxNi42Ny0xMy40NSwyOS43NC0zMy43MiwyOS43NC0xMS4xOCwwLTIwLjI3LTIuMDgtMjcuMjgtNS4zLTMuNTktMS43MS01Ljg3LTQuOTMtNS44Ny04LjcyLDAtNC45Miw0LjE3LTkuNDcsOS40Ny05LjQ3LDEuMzMsMCwzLjAzLC41Nyw0LjM2LDEuMTQsNS4xMiwyLjY1LDExLjM3LDQuMzUsMTkuNyw0LjM1LDkuMSwwLDEzLjgzLTMuNDEsMTMuODMtOS44NSwwLTcuMDEtNS42OC05LjI4LTEyLjY5LTExLjc0bC0xNS41My01LjY4WiIvPgogIDwvZz4KICA8Zz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTExNi4xOCwyODIuODdjLS45OSwwLTEuODYtLjM1LTIuNTktMS4wNS0uNzQtLjcxLTEuMTEtMS41Ny0xLjExLTIuNnYtMzIuNjZjMC0uOTksLjM2LTEuODQsMS4wOC0yLjU3LC43Mi0uNzIsMS42LTEuMDgsMi42Mi0xLjA4aDE2LjU0Yy44MywwLDEuNTMsLjI4LDIuMTEsLjg1LC41NywuNTcsLjg1LDEuMjgsLjg1LDIuMTFzLS4yOCwxLjQ3LS44NSwyYy0uNTgsLjUzLTEuMjgsLjgtMi4xMSwuOGgtMTQuMnYxMC42MWgxMy40NmMuODQsMCwxLjU0LC4yNywyLjExLC44MywuNTcsLjU1LC44NiwxLjI0LC44NiwyLjA4LDAsLjgtLjI5LDEuNDctLjg2LDIuMDItLjU3LC41NS0xLjI3LC44My0yLjExLC44M2gtMTMuNDZ2MTIuMDloMTQuNmMuOCwwLDEuNDksLjI3LDIuMDgsLjgyLC41OSwuNTUsLjg4LDEuMjMsLjg4LDIuMDIsMCwuODQtLjI5LDEuNTMtLjg4LDIuMDgtLjU5LC41NS0xLjI5LC44My0yLjA4LC44M2gtMTYuOTNaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0xNDYuNjgsMjgyLjg3Yy0xLjAzLDAtMS45LS4zNy0yLjYyLTEuMTEtLjcyLS43NC0xLjA4LTEuNi0xLjA4LTIuNTl2LTMzLjgxYzAtLjg0LC4zLTEuNTQsLjkxLTIuMTQsLjYxLS41OSwxLjMxLS44OSwyLjExLS44OXMxLjU0LC4zMSwyLjE0LC45MmMuNTgsLjYxLC44OCwxLjMzLC44OCwyLjE2djMxLjdoMTQuNmMuODQsMCwxLjU0LC4yNywyLjExLC44MiwuNTcsLjU1LC44NiwxLjIzLC44NiwyLjAyLDAsLjg0LS4yOCwxLjUzLS44MywyLjA4LS41NSwuNTUtMS4yNSwuODMtMi4wOSwuODNoLTE2Ljk4WiIvPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMTc2LjE1LDI4Mi44N2MtLjk5LDAtMS44Ni0uMzUtMi41OS0xLjA1LS43NC0uNzEtMS4xMS0xLjU3LTEuMTEtMi42di0zMi42NmMwLS45OSwuMzYtMS44NCwxLjA4LTIuNTcsLjcyLS43MiwxLjYtMS4wOCwyLjYyLTEuMDhoMTYuNTRjLjgzLDAsMS41MywuMjgsMi4xMSwuODUsLjU3LC41NywuODUsMS4yOCwuODUsMi4xMXMtLjI4LDEuNDctLjg1LDJjLS41OCwuNTMtMS4yOCwuOC0yLjExLC44aC0xNC4ydjEwLjYxaDEzLjQ2Yy44MywwLDEuNTQsLjI3LDIuMTEsLjgzLC41NywuNTUsLjg2LDEuMjQsLjg2LDIuMDgsMCwuOC0uMjksMS40Ny0uODYsMi4wMi0uNTcsLjU1LTEuMjgsLjgzLTIuMTEsLjgzaC0xMy40NnYxMi4wOWgxNC42Yy44LDAsMS40OSwuMjcsMi4wOCwuODIsLjU5LC41NSwuODgsMS4yMywuODgsMi4wMiwwLC44NC0uMjksMS41My0uODgsMi4wOC0uNTksLjU1LTEuMjksLjgzLTIuMDgsLjgzaC0xNi45M1oiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTIwMS45MiwyNTcuMWMwLTIuMjEsLjM1LTQuMjIsMS4wNS02LjA1LC43MS0xLjgyLDEuNy0zLjM4LDIuOTktNC42NywxLjI5LTEuMjksMi44NC0yLjI5LDQuNjUtMi45OSwxLjgtLjcsMy44LTEuMDYsNi4wMS0xLjA2LDMuMDksMCw2LjAxLC45LDguNzksMi42OCwuOTEsLjYyLDEuMzcsMS40MywxLjM3LDIuNDYsMCwuNzYtLjI5LDEuNDItLjg1LDEuOTYtLjU4LC41Ni0xLjI4LC44My0yLjExLC44My0uNDksMC0xLS4xNi0xLjU0LS40Ni0uOTEtLjU3LTEuODQtMS4wMi0yLjc2LTEuMzctLjkzLS4zNC0xLjg5LS41MS0yLjg4LS41MS0yLjc3LDAtNC45MSwuODMtNi40MSwyLjUtMS41LDEuNjctMi4yNSwzLjktMi4yNSw2LjY3djExLjU3YzAsMi43OCwuNzUsNSwyLjI1LDYuNjcsMS41LDEuNjgsMy42NCwyLjUxLDYuNDEsMi41MSwuOTksMCwxLjk0LS4xOCwyLjg2LS41NCwuOTEtLjM2LDEuODItLjgzLDIuNzQtMS40LC40OS0uMzQsMS4wNS0uNTEsMS42NS0uNTEsLjc2LDAsMS40MywuMjcsMi4wMywuOCwuNTksLjUzLC44OCwxLjIyLC44OCwyLjA2LDAsMS4wNi0uNDYsMS45LTEuMzcsMi41LTIuNzcsMS43OS01LjcsMi42OC04Ljc5LDIuNjgtMi4yMSwwLTQuMjEtLjM1LTYuMDEtMS4wNS0xLjgxLS43LTMuMzYtMS43LTQuNjUtMi45OS0xLjMtMS4zLTIuMjktMi44NS0yLjk5LTQuNjctLjctMS44My0xLjA1LTMuODQtMS4wNS02LjA1di0xMS41N1oiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI0MS4xNSwyNDguNjZoLTguNDRjLS44MywwLTEuNTItLjI4LTIuMDctLjgzLS41Ni0uNTUtLjgzLTEuMjItLjgzLTIuMDNzLjI4LTEuNTIsLjgzLTIuMDhjLjU1LS41NSwxLjI0LS44MiwyLjA3LS44MmgyMi44NmMuODQsMCwxLjU0LC4yNywyLjExLC44MiwuNTcsLjU1LC44NSwxLjI1LC44NSwyLjA4cy0uMjksMS40OC0uODUsMi4wM2MtLjU3LC41NS0xLjI4LC44My0yLjExLC44M2gtOC4zOHYzMS43NmMwLC44My0uMywxLjU1LS44OSwyLjE0LS41OSwuNTktMS4zLC44OC0yLjE0LC44OHMtMS41NS0uMy0yLjE0LS44OC0uODgtMS4zLS44OC0yLjE0di0zMS43NloiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI3NS4wNywyNjYuMTFoLTUuMTN2MTQuMzdjMCwuODQtLjMsMS41NC0uOTEsMi4xMS0uNjIsLjU3LTEuMzIsLjg2LTIuMTEsLjg2LS44NCwwLTEuNTUtLjI5LTIuMTQtLjg2LS41OS0uNTctLjg4LTEuMjctLjg4LTIuMTF2LTMzLjkyYzAtLjk5LC4zNi0xLjg1LDEuMDgtMi41NywuNzMtLjczLDEuNi0xLjA5LDIuNjItMS4wOWgxMC42MWMzLjQ2LDAsNi4yNiwxLjA2LDguMzgsMy4xOSwyLjIxLDIuMjEsMy4zMSw1LjA2LDMuMzEsOC41NnMtMS4wOCw2LjI5LTMuMjUsOC4zOGMtMS4zMywxLjI2LTIuOTgsMi4xNS00Ljk2LDIuNjhsNy45MiwxMy4yOWMuMywuNDksLjQ1LDEsLjQ1LDEuNTMsMCwuNzYtLjI5LDEuNDMtLjg4LDIuMDMtLjYsLjU5LTEuMjksLjg4LTIuMDksLjg4LS41MywwLTEuMDEtLjEzLTEuNDUtLjM3LS40NC0uMjUtLjc5LS42LTEuMDUtMS4wNmwtOS41My0xNS45MVptMy4xNC01Ljc1Yy42NSwwLDEuMy0uMDgsMS45Ny0uMjMsLjY2LS4xNSwxLjI3LS40NCwxLjgyLS44OCwuNTUtLjQ0LDEtMS4wMywxLjM0LTEuNzcsLjM0LS43NCwuNTEtMS42OCwuNTEtMi44MiwwLTEuNzItLjQ5LTMuMTQtMS40Ni00LjI4LS45Ny0xLjE0LTIuMzYtMS43MS00LjE5LTEuNzFoLTguMjZ2MTEuNjloOC4yNloiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI5Ni42NywyNDUuMzZjMC0uODMsLjI5LTEuNTUsLjg4LTIuMTQsLjU5LS41OSwxLjMtLjg4LDIuMTQtLjg4czEuNSwuMjksMi4xMSwuODhjLjYxLC41OSwuOTEsMS4zMSwuOTEsMi4xNHYzNS4wNmMwLC44My0uMywxLjU1LS45MSwyLjE0LS42MiwuNTktMS4zMiwuODgtMi4xMSwuODhzLTEuNTUtLjI5LTIuMTQtLjg4Yy0uNTktLjU5LS44OC0xLjMtLjg4LTIuMTR2LTM1LjA2WiIvPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMzE3LjcxLDI2NS4wM3YxNS40NWMwLC44My0uMjksMS41NC0uODgsMi4xMS0uNTksLjU3LTEuMjgsLjg2LTIuMDgsLjg2LS44MywwLTEuNTYtLjI4LTIuMTctLjg2LS42MS0uNTctLjkxLTEuMjgtLjkxLTIuMTF2LTMzLjkyYzAtLjk5LC4zNi0xLjg0LDEuMDktMi41NywuNzItLjcyLDEuNTktMS4wOCwyLjYyLTEuMDhoMTYuMzZjLjg0LDAsMS41NCwuMjgsMi4xMSwuODIsLjU3LC41NiwuODUsMS4yNSwuODUsMi4wOXMtLjI4LDEuNDctLjg1LDIuMDNjLS41NywuNTUtMS4yOCwuODMtMi4xMSwuODNoLTE0LjAydjEwLjZoMTMuMjhjLjgzLDAsMS41NCwuMjcsMi4xMSwuODMsLjU3LC41NSwuODUsMS4yNSwuODUsMi4wOHMtLjI4LDEuNDgtLjg1LDIuMDNjLS41OCwuNTUtMS4yOCwuODMtMi4xMSwuODNoLTEzLjI4WiIvPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNMzQ4LjYxLDI2NS4zN2wtMTEtMTguNThjLS4yNi0uNDItLjQtLjkxLS40LTEuNDksMC0uNzYsLjI4LTEuNDQsLjgyLTIuMDUsLjU2LS42MSwxLjI1LS45MSwyLjA5LS45MSwuNTMsMCwxLjAyLC4xMiwxLjQ5LC4zNywuNDUsLjI1LC44MiwuNTksMS4wOCwxLjA1bDguODksMTUuNjIsOC45LTE1LjYyYy4yNy0uNDYsLjYzLS44MSwxLjA4LTEuMDUsLjQ2LS4yNSwuOTUtLjM3LDEuNDgtLjM3LC43NiwwLDEuNDQsLjI4LDIuMDIsLjg1LC42LC41NywuODksMS4yNywuODksMi4xMSwwLC41Ny0uMTQsMS4wNi0uNCwxLjQ5bC0xMSwxOC41OHYxNS4xYzAsLjg0LS4yOSwxLjU0LS44NSwyLjExLS41NywuNTgtMS4yOCwuODUtMi4xMSwuODVzLTEuNTQtLjI4LTIuMS0uODVjLS41Ny0uNTctLjg2LTEuMjgtLjg2LTIuMTF2LTE1LjFaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik0zOTQuNzMsMjQ4LjY2aC04LjQ0Yy0uODMsMC0xLjUzLS4yOC0yLjA3LS44My0uNTYtLjU1LS44My0xLjIyLS44My0yLjAzcy4yOC0xLjUyLC44My0yLjA4Yy41NS0uNTUsMS4yNC0uODIsMi4wNy0uODJoMjIuODZjLjg0LDAsMS41NCwuMjcsMi4xMSwuODIsLjU3LC41NSwuODUsMS4yNSwuODUsMi4wOHMtLjI5LDEuNDgtLjg1LDIuMDNjLS41NywuNTUtMS4yOCwuODMtMi4xMSwuODNoLTguMzh2MzEuNzZjMCwuODMtLjMsMS41NS0uODksMi4xNC0uNTksLjU5LTEuMywuODgtMi4xNCwuODhzLTEuNTUtLjMtMi4xNC0uODhjLS41OS0uNTktLjg4LTEuMy0uODgtMi4xNHYtMzEuNzZaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik00MzguMzQsMjY1LjAzaC0xNC44MnYxNS40YzAsLjgzLS4zLDEuNTQtLjg4LDIuMTQtLjYsLjU5LTEuMjgsLjg4LTIuMDksLjg4cy0xLjU1LS4zLTIuMTYtLjg4Yy0uNjEtLjU5LS45MS0xLjMtLjkxLTIuMTR2LTM1LjA3YzAtLjgzLC4zLTEuNTQsLjg4LTIuMTQsLjU5LS41OSwxLjMxLS44OCwyLjE0LS44OHMxLjUsLjMsMi4xMSwuODhjLjYxLC42LC45MSwxLjMsLjkxLDIuMTR2MTMuOTJoMTQuODJ2LTEzLjkyYzAtLjgzLC4yOS0xLjU0LC44OC0yLjE0LC41OS0uNTksMS4zLS44OCwyLjE0LS44OHMxLjU1LC4zLDIuMTQsLjg4Yy41OSwuNiwuODksMS4zLC44OSwyLjE0djM1LjA3YzAsLjgzLS4yOSwxLjU0LS44NiwyLjE0LS41NywuNTktMS4yNywuODgtMi4xMSwuODhzLTEuNTYtLjMtMi4xNy0uODhjLS42MS0uNTktLjkxLTEuMy0uOTEtMi4xNHYtMTUuNFoiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTQ1Ny4wNCwyODIuODdjLS45OSwwLTEuODYtLjM1LTIuNTktMS4wNS0uNzQtLjcxLTEuMTEtMS41Ny0xLjExLTIuNnYtMzIuNjZjMC0uOTksLjM2LTEuODQsMS4wOC0yLjU3LC43Mi0uNzIsMS42LTEuMDgsMi42Mi0xLjA4aDE2LjU0Yy44MywwLDEuNTMsLjI4LDIuMTEsLjg1LC41NywuNTcsLjg1LDEuMjgsLjg1LDIuMTFzLS4yOCwxLjQ3LS44NSwyYy0uNTgsLjUzLTEuMjgsLjgtMi4xMSwuOGgtMTQuMTl2MTAuNjFoMTMuNDVjLjgzLDAsMS41NCwuMjcsMi4xMSwuODMsLjU3LC41NSwuODYsMS4yNCwuODYsMi4wOCwwLC44LS4yOSwxLjQ3LS44NiwyLjAyLS41NywuNTUtMS4yOCwuODMtMi4xMSwuODNoLTEzLjQ1djEyLjA5aDE0LjU5Yy44LDAsMS40OSwuMjcsMi4wOCwuODIsLjU5LC41NSwuODksMS4yMywuODksMi4wMiwwLC44NC0uMywxLjUzLS44OSwyLjA4LS41OSwuNTUtMS4yOCwuODMtMi4wOCwuODNoLTE2LjkzWiIvPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNTA1LjMzLDI2NS4wM3YxNS40NWMwLC44My0uMjksMS41NC0uODgsMi4xMS0uNTksLjU3LTEuMjgsLjg2LTIuMDgsLjg2LS44NCwwLTEuNTctLjI4LTIuMTctLjg2LS42MS0uNTctLjkxLTEuMjgtLjkxLTIuMTF2LTMzLjkyYzAtLjk5LC4zNi0xLjg0LDEuMDktMi41NywuNzItLjcyLDEuNTktMS4wOCwyLjYxLTEuMDhoMTYuMzdjLjg0LDAsMS41NCwuMjgsMi4xMSwuODIsLjU3LC41NiwuODUsMS4yNSwuODUsMi4wOXMtLjI4LDEuNDctLjg1LDIuMDNjLS41NywuNTUtMS4yNywuODMtMi4xMSwuODNoLTE0LjAydjEwLjZoMTMuMjhjLjgzLDAsMS41MywuMjcsMi4xMSwuODMsLjU3LC41NSwuODUsMS4yNSwuODUsMi4wOHMtLjI5LDEuNDgtLjg1LDIuMDNjLS41OCwuNTUtMS4yOCwuODMtMi4xMSwuODNoLTEzLjI4WiIvPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNTUwLjAzLDI0NS4zNmMwLS44MywuMjktMS41NSwuODgtMi4xNCwuNTktLjU5LDEuMy0uODgsMi4xNC0uODhzMS41MSwuMjksMi4xMSwuODhjLjYxLC41OSwuOTEsMS4zMSwuOTEsMi4xNHYyMy44OWMwLDIuMTMtLjM1LDQuMDctMS4wMyw1LjgxLS42OSwxLjc1LTEuNjUsMy4yNC0yLjg4LDQuNDgtMS4yNCwxLjI0LTIuNzMsMi4yLTQuNDgsMi44OC0xLjc1LC42OS0zLjY5LDEuMDMtNS44MSwxLjAzcy00LjA3LS4zNC01LjgyLTEuMDNjLTEuNzUtLjY4LTMuMjUtMS42NC00LjQ4LTIuODgtMS4yNC0xLjI0LTIuMTktMi43My0yLjg4LTQuNDgtLjY4LTEuNzUtMS4wMi0zLjY4LTEuMDItNS44MXYtMjMuODljMC0uODMsLjMtMS41NSwuOTEtMi4xNCwuNjEtLjU5LDEuMzMtLjg4LDIuMTYtLjg4czEuNSwuMjksMi4wOSwuODhjLjU5LC41OSwuODgsMS4zMSwuODgsMi4xNHYyNC4yM2MwLDIuNjEsLjcsNC42NSwyLjExLDYuMSwxLjQsMS40NCwzLjQyLDIuMTcsNi4wNSwyLjE3czQuNjMtLjcyLDYuMDQtMi4xN2MxLjQxLTEuNDQsMi4xMS0zLjQ4LDIuMTEtNi4xdi0yNC4yM1oiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTU3Mi4yNiwyNDguNjZoLTguNDRjLS44MywwLTEuNTItLjI4LTIuMDctLjgzLS41Ni0uNTUtLjgzLTEuMjItLjgzLTIuMDNzLjI4LTEuNTIsLjgzLTIuMDhjLjU1LS41NSwxLjI0LS44MiwyLjA3LS44MmgyMi44NmMuODQsMCwxLjU0LC4yNywyLjExLC44MiwuNTcsLjU1LC44NSwxLjI1LC44NSwyLjA4cy0uMjksMS40OC0uODUsMi4wM2MtLjU3LC41NS0xLjI4LC44My0yLjExLC44M2gtOC4zOHYzMS43NmMwLC44My0uMywxLjU1LS44OSwyLjE0LS41OSwuNTktMS4zLC44OC0yLjE0LC44OHMtMS41NS0uMy0yLjE0LS44OGMtLjU5LS41OS0uODgtMS4zLS44OC0yLjE0di0zMS43NloiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTYxNi44NSwyNDUuMzZjMC0uODMsLjI5LTEuNTUsLjg4LTIuMTQsLjU5LS41OSwxLjMtLjg4LDIuMTQtLjg4czEuNTEsLjI5LDIuMTEsLjg4Yy42MSwuNTksLjkxLDEuMzEsLjkxLDIuMTR2MjMuODljMCwyLjEzLS4zNSw0LjA3LTEuMDMsNS44MS0uNjksMS43NS0xLjY1LDMuMjQtMi44OCw0LjQ4LTEuMjQsMS4yNC0yLjczLDIuMi00LjQ4LDIuODgtMS43NSwuNjktMy42OSwxLjAzLTUuODEsMS4wM3MtNC4wNy0uMzQtNS44Mi0xLjAzYy0xLjc1LS42OC0zLjI1LTEuNjQtNC40OC0yLjg4LTEuMjQtMS4yNC0yLjE5LTIuNzMtMi44OC00LjQ4LS42OC0xLjc1LTEuMDItMy42OC0xLjAyLTUuODF2LTIzLjg5YzAtLjgzLC4zLTEuNTUsLjkxLTIuMTQsLjYxLS41OSwxLjMzLS44OCwyLjE2LS44OHMxLjUsLjI5LDIuMDksLjg4Yy41OSwuNTksLjg4LDEuMzEsLjg4LDIuMTR2MjQuMjNjMCwyLjYxLC43LDQuNjUsMi4xMSw2LjEsMS40LDEuNDQsMy40MiwyLjE3LDYuMDUsMi4xN3M0LjYzLS43Miw2LjA0LTIuMTdjMS40MS0xLjQ0LDIuMTEtMy40OCwyLjExLTYuMXYtMjQuMjNaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik02NDIuNSwyNjYuMTFoLTUuMTN2MTQuMzdjMCwuODQtLjMxLDEuNTQtLjkyLDIuMTEtLjYxLC41Ny0xLjMxLC44Ni0yLjEsLjg2LS44NCwwLTEuNTUtLjI5LTIuMTQtLjg2LS41OS0uNTctLjg4LTEuMjctLjg4LTIuMTF2LTMzLjkyYzAtLjk5LC4zNi0xLjg1LDEuMDktMi41NywuNzItLjczLDEuNTktMS4wOSwyLjYxLTEuMDloMTAuNjFjMy40NiwwLDYuMjYsMS4wNiw4LjM4LDMuMTksMi4yMSwyLjIxLDMuMzEsNS4wNiwzLjMxLDguNTZzLTEuMDgsNi4yOS0zLjI1LDguMzhjLTEuMzQsMS4yNi0yLjk5LDIuMTUtNC45NywyLjY4bDcuOTMsMTMuMjljLjMsLjQ5LC40NSwxLC40NSwxLjUzLDAsLjc2LS4yOSwxLjQzLS44OCwyLjAzLS42LC41OS0xLjI4LC44OC0yLjA5LC44OC0uNTMsMC0xLjAxLS4xMy0xLjQ1LS4zNy0uNDQtLjI1LS43OS0uNi0xLjA2LTEuMDZsLTkuNTItMTUuOTFabTMuMTQtNS43NWMuNjUsMCwxLjMtLjA4LDEuOTYtLjIzLC42Ny0uMTUsMS4yOC0uNDQsMS44My0uODhzMS0xLjAzLDEuMzQtMS43N2MuMzQtLjc0LC41MS0xLjY4LC41MS0yLjgyLDAtMS43Mi0uNDktMy4xNC0xLjQ2LTQuMjgtLjk3LTEuMTQtMi4zNy0xLjcxLTQuMTktMS43MWgtOC4yNnYxMS42OWg4LjI2WiIvPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNjY3LjgxLDI4Mi44N2MtLjk5LDAtMS44Ni0uMzUtMi41OS0xLjA1LS43NC0uNzEtMS4xMS0xLjU3LTEuMTEtMi42di0zMi42NmMwLS45OSwuMzYtMS44NCwxLjA4LTIuNTcsLjcyLS43MiwxLjYtMS4wOCwyLjYyLTEuMDhoMTYuNTRjLjgzLDAsMS41MywuMjgsMi4xLC44NSwuNTgsLjU3LC44NiwxLjI4LC44NiwyLjExcy0uMjgsMS40Ny0uODYsMmMtLjU3LC41My0xLjI3LC44LTIuMSwuOGgtMTQuMTl2MTAuNjFoMTMuNDVjLjgzLDAsMS41NCwuMjcsMi4xMSwuODMsLjU3LC41NSwuODYsMS4yNCwuODYsMi4wOCwwLC44LS4yOSwxLjQ3LS44NiwyLjAyLS41NywuNTUtMS4yOCwuODMtMi4xMSwuODNoLTEzLjQ1djEyLjA5aDE0LjU5Yy44LDAsMS40OSwuMjcsMi4wOCwuODIsLjYsLjU1LC44OSwxLjIzLC44OSwyLjAyLDAsLjg0LS4zLDEuNTMtLjg5LDIuMDgtLjU5LC41NS0xLjI4LC44My0yLjA4LC44M2gtMTYuOTNaIi8+CiAgPC9nPgo8L3N2Zz4=" },
  format: "A1-paysage", customW: 800, customH: 500, maxCols: 0, fontScale: 7, qrSize: 32, forceFormat: false, bookendWidth: 220, headerHeight: 56, bgImageHeight: 25, showLineTags: true, lineZoneLabel: "number", pdfResolution: 150, palette: "nexans",
  entree: { tags: [], sections: [] },
  steps: [],
  sortie: { tags: [], sections: [] },
  backgroundImage: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTA0NTMiIGhlaWdodD0iNDMzMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgb3ZlcmZsb3c9ImhpZGRlbiI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTI3MzEgLTM4MTEpIj48cGF0aCBkPSJNMjc0NSA0NTQyLjUyQzI3NDUgNDE0Ni4yNCAzMDY2LjI0IDM4MjUgMzQ2Mi41MiAzODI1TDEyNDUyLjUgMzgyNUMxMjg0OC44IDM4MjUgMTMxNzAgNDE0Ni4yNCAxMzE3MCA0NTQyLjUyTDEzMTcwIDc0MTIuNDhDMTMxNzAgNzgwOC43NiAxMjg0OC44IDgxMzAgMTI0NTIuNSA4MTMwTDM0NjIuNTIgODEzMEMzMDY2LjI0IDgxMzAgMjc0NSA3ODA4Ljc2IDI3NDUgNzQxMi40OFoiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSIyNy41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1taXRlcmxpbWl0PSI4IiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48L2c+PC9zdmc+",
  icons: [
    {
      "id": "_101",
      "name": "Bain",
      "description": "",
      "svgData": "<svg width=\"1035\" height=\"1321\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1133 -578)\"><path d=\"M1143.5 634.168C1143.5 608.946 1163.95 588.5 1189.17 588.5L2111.83 588.5C2137.05 588.5 2157.5 608.946 2157.5 634.168L2157.5 816.832C2157.5 842.054 2137.05 862.5 2111.83 862.5L1189.17 862.5C1163.95 862.5 1143.5 842.054 1143.5 816.832Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><g><g><g><path d=\"M1598.96 751.542C1598.96 779.731 1621.81 802.583 1650 802.583 1678.19 802.583 1701.04 779.731 1701.04 751.542 1701.04 719.079 1650 647.417 1650 647.417 1650 647.417 1598.96 719.283 1598.96 751.542ZM1696.96 751.542C1696.96 777.476 1675.93 798.5 1650 798.5 1624.07 798.5 1603.04 777.476 1603.04 751.542 1603.04 725.624 1638.78 671.08 1650 654.594 1661.23 671.043 1696.96 725.449 1696.96 751.542Z\" stroke=\"#000000\" stroke-width=\"25.0212\" fill=\"none\"/></g></g></g><path d=\"M1143.5 725.5 1143.5 1726.52\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M2157.5 725.5 2157.5 1725.79\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 686.184 0.0046916\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 0 0 -1 1308.5 1887.5)\"/><path d=\"M1306.22 1887.5C1217.03 1888.17 1144.18 1816.19 1143.5 1726.72 1143.5 1726.56 1143.5 1726.4 1143.5 1726.24\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M160.281 0.0046063C249.472-0.670683 322.322 71.3097 322.995 160.777 322.996 160.939 322.997 161.101 322.998 161.263\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 -1.22465e-16 -1.22465e-16 -1 1834.5 1887.5)\"/></g></svg>"
    },
    {
      "id": "_103",
      "name": "Bobinoir",
      "description": "",
      "svgData": "<svg width=\"840\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1231 -576)\"><path d=\"M0 0 293.229 226.201\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 1547.73 623.5)\"/><path d=\"M1602.5 841.667C1602.5 836.052 1607.05 831.5 1612.67 831.5L1653.33 831.5C1658.95 831.5 1663.5 836.052 1663.5 841.667L1663.5 1183.33C1663.5 1188.95 1658.95 1193.5 1653.33 1193.5L1612.67 1193.5C1607.05 1193.5 1602.5 1188.95 1602.5 1183.33Z\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><rect x=\"1375.5\" y=\"1350.5\" width=\"516\" height=\"459\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\"/><path d=\"M1301.5 1822.5C1301.5 1815.32 1307.32 1809.5 1314.5 1809.5L1952.5 1809.5C1959.68 1809.5 1965.5 1815.32 1965.5 1822.5L1965.5 1874.5C1965.5 1881.68 1959.68 1887.5 1952.5 1887.5L1314.5 1887.5C1307.32 1887.5 1301.5 1881.68 1301.5 1874.5Z\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1374.5 1891.5 1374.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1399.5 1891.5 1399.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1421.5 1891.5 1421.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1446.5 1891.5 1446.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1468.5 1891.5 1468.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1493.5 1891.5 1493.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1518.5 1891.5 1518.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1543.5 1891.5 1543.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1565.5 1891.5 1565.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1590.5 1891.5 1590.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1612.5 1891.5 1612.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1637.5 1891.5 1637.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1662.5 1891.5 1662.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1686.5 1891.5 1686.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1709.5 1891.5 1709.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1733.5 1891.5 1733.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1756.5 1891.5 1756.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1375.5 1780.5 1891.5 1780.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 168.232 320.859\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 0 0 -1 1893.5 1507.36)\"/><path d=\"M2062.17 1185.15 1719.5 623.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1511 709.5C1511 642.398 1565.4 588 1632.5 588 1699.6 588 1754 642.398 1754 709.5 1754 776.603 1699.6 831 1632.5 831 1565.4 831 1511 776.603 1511 709.5Z\" stroke=\"#000000\" stroke-width=\"24.0625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1609.5 711C1609.5 698.021 1620.02 687.5 1633 687.5 1645.98 687.5 1656.5 698.021 1656.5 711 1656.5 723.979 1645.98 734.5 1633 734.5 1620.02 734.5 1609.5 723.979 1609.5 711Z\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1239.5 1193.5 2027.64 1193.5\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1239.5 1193.5 1375.57 1349.88\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 133.756 156.384\" stroke=\"#000000\" stroke-width=\"17.1875\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 2027.26 1193.5)\"/></g></svg>"
    },
    {
      "id": "_105",
      "name": "Cabestan",
      "description": "",
      "svgData": "<svg width=\"1036\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1133 -578)\"><path d=\"M1143.5 757.504C1143.5 664.165 1219.17 588.5 1312.5 588.5L1988.5 588.5C2081.83 588.5 2157.5 664.165 2157.5 757.504L2157.5 1718.5C2157.5 1811.83 2081.83 1887.5 1988.5 1887.5L1312.5 1887.5C1219.17 1887.5 1143.5 1811.83 1143.5 1718.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1218.5 977.5C1218.5 869.804 1305.8 782.5 1413.5 782.5 1521.2 782.5 1608.5 869.804 1608.5 977.5 1608.5 1085.2 1521.2 1172.5 1413.5 1172.5 1305.8 1172.5 1218.5 1085.2 1218.5 977.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1701.5 977C1701.5 869.581 1788.58 782.5 1896 782.5 2003.42 782.5 2090.5 869.581 2090.5 977 2090.5 1084.42 2003.42 1171.5 1896 1171.5 1788.58 1171.5 1701.5 1084.42 1701.5 977Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1143.5 782.5 2157.83 782.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 482.382 0.519685\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 1895.88 1171.5)\"/></g></svg>"
    },
    {
      "id": "_107",
      "name": "Devidoir",
      "description": "",
      "svgData": "<svg width=\"1245\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1028 -578)\"><path d=\"M1038.5 1760C1038.5 1745.92 1049.92 1734.5 1064 1734.5L2237 1734.5C2251.08 1734.5 2262.5 1745.92 2262.5 1760L2262.5 1862C2262.5 1876.08 2251.08 1887.5 2237 1887.5L1064 1887.5C1049.92 1887.5 1038.5 1876.08 1038.5 1862Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1038.5 1087C1038.5 1075.13 1048.13 1065.5 1060 1065.5L1146 1065.5C1157.87 1065.5 1167.5 1075.13 1167.5 1087L1167.5 1713C1167.5 1724.87 1157.87 1734.5 1146 1734.5L1060 1734.5C1048.13 1734.5 1038.5 1724.87 1038.5 1713Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1215.5 680.168C1215.5 629.541 1256.54 588.5 1307.17 588.5L1673.83 588.5C1724.46 588.5 1765.5 629.541 1765.5 680.168L1765.5 1553.83C1765.5 1604.46 1724.46 1645.5 1673.83 1645.5L1307.17 1645.5C1256.54 1645.5 1215.5 1604.46 1215.5 1553.83Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M2262.3 1054.17 1737.5 613.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 524.8 436.338\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 0 0 -1 1737.5 1620.84)\"/><path d=\"M2262.5 1054.5 2262.5 1184.57\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1167.5 1073.5C1167.5 1069.08 1171.08 1065.5 1175.5 1065.5L1207.5 1065.5C1211.92 1065.5 1215.5 1069.08 1215.5 1073.5L1215.5 1160.5C1215.5 1164.92 1211.92 1168.5 1207.5 1168.5L1175.5 1168.5C1171.08 1168.5 1167.5 1164.92 1167.5 1160.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/></g></svg>"
    },
    {
      "id": "_109",
      "name": "Extrudeuse",
      "description": "",
      "svgData": "<svg width=\"403\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1449 -578)\"><path d=\"M1617.5 1120.83C1617.5 1114.57 1622.57 1109.5 1628.83 1109.5L1674.17 1109.5C1680.43 1109.5 1685.5 1114.57 1685.5 1120.83L1685.5 1170.17C1685.5 1176.43 1680.43 1181.5 1674.17 1181.5L1628.83 1181.5C1622.57 1181.5 1617.5 1176.43 1617.5 1170.17Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1579.5 597.167C1579.5 592.38 1583.38 588.5 1588.17 588.5L1712.83 588.5C1717.62 588.5 1721.5 592.38 1721.5 597.167L1721.5 631.833C1721.5 636.62 1717.62 640.5 1712.83 640.5L1588.17 640.5C1583.38 640.5 1579.5 636.62 1579.5 631.833Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1688.87 1109.5 1613.13 1109.5 1513.5 1009.87 1513.5 640.5 1513.5 640.5 1788.5 640.5 1788.5 640.5 1788.5 1009.87Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1646.31 1031.46C1572.24 1030.15 1513.5 998.769 1513.5 960.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M145.194 0.0396425C216.676 1.24701 274.955 29.3978 280.567 65.4292\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 -1.22465e-16 -1.22465e-16 -1 1507.5 1031.5)\"/><path d=\"M1646.31 935.458C1572.24 934.152 1513.5 902.769 1513.5 864.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M145.194 0.0396425C216.676 1.24701 274.955 29.3978 280.567 65.4292\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 -1.22465e-16 -1.22465e-16 -1 1507.5 935.5)\"/><path d=\"M1646.31 842.459C1572.24 841.152 1513.5 809.769 1513.5 771.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M145.194 0.0396425C216.676 1.24701 274.955 29.3978 280.567 65.4292\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 -1.22465e-16 -1.22465e-16 -1 1507.5 842.5)\"/><path d=\"M1646.31 744.459C1572.24 743.152 1513.5 711.769 1513.5 673.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M145.194 0.0396425C216.676 1.24701 274.955 29.3978 280.567 65.4292\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 -1.22465e-16 -1.22465e-16 -1 1507.5 744.5)\"/><path d=\"M1460.5 1199.33C1460.5 1187.83 1469.83 1178.5 1481.33 1178.5L1818.67 1178.5C1830.17 1178.5 1839.5 1187.83 1839.5 1199.33L1839.5 1282.67C1839.5 1294.17 1830.17 1303.5 1818.67 1303.5L1481.33 1303.5C1469.83 1303.5 1460.5 1294.17 1460.5 1282.67Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1579.5 1201.67C1579.5 1190.53 1588.53 1181.5 1599.67 1181.5L1701.33 1181.5C1712.47 1181.5 1721.5 1190.53 1721.5 1201.67L1721.5 1282.33C1721.5 1293.47 1712.47 1302.5 1701.33 1302.5L1599.67 1302.5C1588.53 1302.5 1579.5 1293.47 1579.5 1282.33Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 119.46 0.000360892\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"#FFFFFF\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 1840.96 1241.5)\"/><path d=\"M0 0 119.46 0.000360892\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 1579.96 1241.5)\"/><path d=\"M1460.5 1031.5 1460.5 1828.49\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1460.5 1032C1460.5 1002.45 1484.45 978.5 1514 978.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1513.5 1887.5C1483.68 1887.5 1459.5 1863.32 1459.5 1833.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1513.5 1887.5 1787.85 1887.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 0.000360892 796.989\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 1839.5 1031.5)\"/><path d=\"M53.4999 0C83.0471-1.37498e-14 107 24.1766 107 54\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-6.12323e-17 -1 -1 6.12323e-17 1839.5 1085.5)\"/><path d=\"M54 0C83.8233-1.37498e-14 108 24.1766 108 54\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 -1.22465e-16 -1.22465e-16 -1 1731.5 1887.5)\"/></g></svg>"
    },
    {
      "id": "_111",
      "name": "Frein",
      "description": "",
      "svgData": "<svg width=\"859\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1221 -578)\"><path d=\"M1231.5 728.169C1231.5 651.032 1294.03 588.5 1371.17 588.5L1929.83 588.5C2006.97 588.5 2069.5 651.032 2069.5 728.169L2069.5 1747.83C2069.5 1824.97 2006.97 1887.5 1929.83 1887.5L1371.17 1887.5C1294.03 1887.5 1231.5 1824.97 1231.5 1747.83Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1486.5 974.5C1486.5 883.925 1559.93 810.5 1650.5 810.5 1741.07 810.5 1814.5 883.925 1814.5 974.5 1814.5 1065.07 1741.07 1138.5 1650.5 1138.5 1559.93 1138.5 1486.5 1065.07 1486.5 974.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1486.5 1513.5C1486.5 1422.93 1559.93 1349.5 1650.5 1349.5 1741.07 1349.5 1814.5 1422.93 1814.5 1513.5 1814.5 1604.07 1741.07 1677.5 1650.5 1677.5 1559.93 1677.5 1486.5 1604.07 1486.5 1513.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 408.451 0.000360892\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 2058.95 810.5)\"/><path d=\"M1534.5 1090.5 1766.34 1397.99\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1534.26 1630.15 1231.5 1238.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/></g></svg>"
    },
    {
      "id": "_113",
      "name": "Prechauffeur",
      "description": "",
      "svgData": "<svg width=\"860\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1221 -578)\"><path d=\"M1231.5 728.169C1231.5 651.032 1294.03 588.5 1371.17 588.5L1929.83 588.5C2006.97 588.5 2069.5 651.032 2069.5 728.169L2069.5 1747.83C2069.5 1824.97 2006.97 1887.5 1929.83 1887.5L1371.17 1887.5C1294.03 1887.5 1231.5 1824.97 1231.5 1747.83Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1486.5 974.5C1486.5 883.925 1559.93 810.5 1650.5 810.5 1741.07 810.5 1814.5 883.925 1814.5 974.5 1814.5 1065.07 1741.07 1138.5 1650.5 1138.5 1559.93 1138.5 1486.5 1065.07 1486.5 974.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1486.5 1513.5C1486.5 1422.93 1559.93 1349.5 1650.5 1349.5 1741.07 1349.5 1814.5 1422.93 1814.5 1513.5 1814.5 1604.07 1741.07 1677.5 1650.5 1677.5 1559.93 1677.5 1486.5 1604.07 1486.5 1513.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1770.5 1173.33C1770.5 1152.44 1787.44 1135.5 1808.33 1135.5L1964.67 1135.5C1985.56 1135.5 2002.5 1152.44 2002.5 1173.33L2002.5 1324.67C2002.5 1345.56 1985.56 1362.5 1964.67 1362.5L1808.33 1362.5C1787.44 1362.5 1770.5 1345.56 1770.5 1324.67Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1814.5 974.5 1814.5 1135.26\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 0.000360892 539.335\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 1486.5 974.5)\"/><path d=\"M0 0 418.678 0.000360892\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 1650.18 810.5)\"/><g><g><g><path d=\"M203.85 180 115.875 27C112.5 20.925 103.725 20.925 100.35 27L12.15 180C8.77499 186.075 13.05 193.5 20.025 193.5L108 193.5 195.975 193.5C202.95 193.5 207.225 186.075 203.85 180ZM93.1499 173.475 105.975 121.5 87.5249 121.5 96.5249 65.25 123.525 65.25 111.6 108 130.5 108 93.1499 173.475Z\" transform=\"matrix(1 0 0 1 1778 1134)\"/></g></g></g><path d=\"M0 0 419.174 0.000360892\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(-1 0 0 1 2069.67 810.5)\"/><path d=\"M0 0 0.000360892 151.212\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 0 0 -1 1814.5 1513.71)\"/></g></svg>"
    },
    {
      "id": "_115",
      "name": "Redresseur",
      "description": "",
      "svgData": "<svg width=\"761\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1270 -578)\"><path d=\"M1280.5 711.835C1280.5 643.719 1335.72 588.5 1403.84 588.5L1897.16 588.5C1965.28 588.5 2020.5 643.719 2020.5 711.835L2020.5 1764.16C2020.5 1832.28 1965.28 1887.5 1897.16 1887.5L1403.84 1887.5C1335.72 1887.5 1280.5 1832.28 1280.5 1764.16Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1316.5 893C1316.5 846.884 1353.88 809.5 1400 809.5 1446.12 809.5 1483.5 846.884 1483.5 893 1483.5 939.116 1446.12 976.5 1400 976.5 1353.88 976.5 1316.5 939.116 1316.5 893Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1280.5 1048.5 2020.09 1048.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1479.5 726C1479.5 679.884 1516.88 642.5 1563 642.5 1609.12 642.5 1646.5 679.884 1646.5 726 1646.5 772.116 1609.12 809.5 1563 809.5 1516.88 809.5 1479.5 772.116 1479.5 726Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1642.5 895.5C1642.5 849.108 1679.88 811.5 1726 811.5 1772.12 811.5 1809.5 849.108 1809.5 895.5 1809.5 941.892 1772.12 979.5 1726 979.5 1679.88 979.5 1642.5 941.892 1642.5 895.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1786.5 726C1786.5 679.884 1824.11 642.5 1870.5 642.5 1916.89 642.5 1954.5 679.884 1954.5 726 1954.5 772.116 1916.89 809.5 1870.5 809.5 1824.11 809.5 1786.5 772.116 1786.5 726Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1280.5 809.5 2020.09 809.5\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/></g></svg>"
    },
    {
      "id": "_117",
      "name": "Sikora",
      "description": "",
      "svgData": "<svg width=\"269\" height=\"1320\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><defs><image width=\"300\" height=\"265\" xlink:href=\"data:image/png;base64,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\" preserveAspectRatio=\"none\" id=\"img0\"></image><clipPath id=\"clip1\"><rect x=\"0\" y=\"0\" width=\"542681\" height=\"479368\"/></clipPath></defs><g transform=\"translate(-1516 -578)\"><path d=\"M1616.5 1065.5C1616.5 1058.87 1621.87 1053.5 1628.5 1053.5L1676.5 1053.5C1683.13 1053.5 1688.5 1058.87 1688.5 1065.5L1688.5 1799.5C1688.5 1806.13 1683.13 1811.5 1676.5 1811.5L1628.5 1811.5C1621.87 1811.5 1616.5 1806.13 1616.5 1799.5Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1526.5 629.834C1526.5 607.006 1545.01 588.5 1567.83 588.5L1733.17 588.5C1755.99 588.5 1774.5 607.006 1774.5 629.834L1774.5 1012.17C1774.5 1034.99 1755.99 1053.5 1733.17 1053.5L1567.83 1053.5C1545.01 1053.5 1526.5 1034.99 1526.5 1012.17Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1526.5 1824.17C1526.5 1817.17 1532.17 1811.5 1539.17 1811.5L1761.83 1811.5C1768.83 1811.5 1774.5 1817.17 1774.5 1824.17L1774.5 1874.83C1774.5 1881.83 1768.83 1887.5 1761.83 1887.5L1539.17 1887.5C1532.17 1887.5 1526.5 1881.83 1526.5 1874.83Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><g transform=\"matrix(0.000360892 0 0 0.000360892 1553 710)\"><g clip-path=\"url(#clip1)\" transform=\"matrix(1.00587 0 0 1 -0.08485 -0.16313)\"><use width=\"100%\" height=\"100%\" xlink:href=\"#img0\" transform=\"scale(1808.94 1808.94)\"></use></g></g></g></svg>"
    },
    {
      "id": "_119",
      "name": "Sikora_spark",
      "description": "",
      "svgData": "<svg width=\"797\" height=\"1310\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1252 -588)\"><path d=\"M1262.5 727.836C1262.5 656.405 1320.41 598.5 1391.84 598.5L1909.16 598.5C1980.59 598.5 2038.5 656.405 2038.5 727.836L2038.5 1758.16C2038.5 1829.59 1980.59 1887.5 1909.16 1887.5L1391.84 1887.5C1320.41 1887.5 1262.5 1829.59 1262.5 1758.16Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M1262.5 732.891C1262.5 658.669 1322.67 598.5 1396.89 598.5L1904.11 598.5C1978.33 598.5 2038.5 658.669 2038.5 732.891L2038.5 812.109C2038.5 886.331 1978.33 946.5 1904.11 946.5L1396.89 946.5C1322.67 946.5 1262.5 886.331 1262.5 812.109Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><g><g><g><path d=\"M320.875 283.333 182.396 42.5C177.083 32.9375 163.271 32.9375 157.958 42.5L19.125 283.333C13.8125 292.896 20.5417 304.583 31.5208 304.583L170 304.583 308.479 304.583C319.458 304.583 326.187 292.896 320.875 283.333ZM146.625 273.062 166.812 191.25 137.771 191.25 151.937 102.708 194.437 102.708 175.667 170 205.417 170 146.625 273.062Z\" transform=\"matrix(1 0 0 1 1480 588)\"/></g></g></g></g></svg>"
    }
  ],
  line: [], version: "",
  technicalPlan: { zoneLabel:"number", gridSize:5, legendFontSize:9, views: [
    { id:"top",  label:"Vue de dessus", imageDataUrl:null, stepZones:[], machineLabels:[], enabled:true },
    { id:"side", label:"Vue de côté",   imageDataUrl:null, stepZones:[], machineLabels:[], enabled:true },
  ]},
});

/* ═══════════════════ LINE EDITOR ═══════════════════ */

/* ═══════════════════ DAG LAYOUT ENGINE ═══════════════════ */

// Colonnes = profondeur DAG (flux horizontal gauche→droite), avec forçage de l'ordre inter-zones.
// Lignes  = branches parallèles : chaque split secondaire obtient une nouvelle ligne.
// Label   = lettre de colonne (dans la zone) + numéro de ligne si parallèles, ex : A1, B2, C.
function computeLayout(nodes, steps) {
  if (!nodes.length) return { col:{}, track:{}, numCols:1, maxTracks:1, zoneSpans:{}, zoneKeys:[] };

  const stepIds = (steps||[]).map(s=>s.id);
  const zk = n => n.stepId || '__none__';

  // Grouper par zone (préserve l'ordre de data.line dans chaque zone)
  const byZone = {};
  nodes.forEach(n => { const k=zk(n); if(!byZone[k])byZone[k]=[]; byZone[k].push(n); });
  const zoneKeys = [...stepIds.filter(k=>byZone[k]), ...(byZone['__none__']?['__none__']:[])];

  // Prédécesseurs + topologie
  const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const pred = Object.fromEntries(nodes.map(n=>[n.id, []]));
  nodes.forEach(n => (n.next||[]).forEach(nid => { if(pred[nid]) pred[nid].push(n.id); }));
  const inDeg = Object.fromEntries(nodes.map(n=>[n.id, pred[n.id].length]));
  const q = nodes.filter(n=>inDeg[n.id]===0).map(n=>n.id);
  const topo = [];
  while (q.length) {
    const id = q.shift(); topo.push(id);
    (byId[id]?.next||[]).forEach(nid => { if(byId[nid]) { inDeg[nid]--; if(!inDeg[nid]) q.push(nid); } });
  }
  nodes.forEach(n => { if(!topo.includes(n.id)) topo.push(n.id); });

  // Profondeur DAG brute (plus long chemin depuis une source)
  const rawD = {};
  topo.forEach(id => { rawD[id] = pred[id].length ? Math.max(...pred[id].map(p=>rawD[p]+1)) : 0; });

  // Colonnes absolues : profondeur brute + décalage de zone (respect de l'ordre des étapes)
  const col = {};
  const zoneSpans = {};
  let zoneStart = 0;
  zoneKeys.forEach(k => {
    const zn = byZone[k];
    const minR = Math.min(...zn.map(n=>rawD[n.id]||0));
    const off  = Math.max(0, zoneStart - minR);
    zn.forEach(n => { col[n.id] = (rawD[n.id]||0) + off; });
    const maxC = Math.max(...zn.map(n=>col[n.id]));
    const minC = Math.min(...zn.map(n=>col[n.id]));
    zoneSpans[k] = { startCol: minC, endCol: maxC };
    zoneStart = maxC + 2;  // col suivant + 1 col de gap entre zones
  });

  // Lignes (tracks) : locales par colonne — chaque colonne repart de 0
  // → les zones sur des colonnes distinctes réutilisent les mêmes indices de ligne
  const track = {};
  const colUsed = {};  // colUsed[col] = Set des lignes déjà prises dans cette colonne

  const allocTrack = (c) => {
    const used = colUsed[c] || new Set();
    let t = 0; while (used.has(t)) t++;
    return t;
  };
  const assignTrack = (id, t) => {
    track[id] = t;
    const c = col[id];
    if (!colUsed[c]) colUsed[c] = new Set();
    colUsed[c].add(t);
  };

  topo.forEach(id => {
    const ps = pred[id];
    const c = col[id];
    if (ps.length === 0) {
      assignTrack(id, allocTrack(c));
    } else if (ps.length === 1) {
      const pId = ps[0];
      const isPrimary = (byId[pId]?.next||[])[0] === id;
      const preferred = isPrimary ? (track[pId] ?? 0) : null;
      if (preferred !== null && !(colUsed[c]?.has(preferred))) {
        assignTrack(id, preferred);
      } else {
        assignTrack(id, allocTrack(c));
      }
    } else {
      // merge → minimum des tracks de prédécesseurs, si libre dans cette colonne
      const minP = Math.min(...ps.map(p => track[p] ?? 0));
      if (!(colUsed[c]?.has(minP))) {
        assignTrack(id, minP);
      } else {
        assignTrack(id, allocTrack(c));
      }
    }
  });

  const numCols  = nodes.length ? Math.max(...nodes.map(n=>col[n.id]))+1 : 1;
  const maxTracks= nodes.length ? Math.max(...nodes.map(n=>track[n.id]))+1 : 1;
  return { col, track, numCols, maxTracks, zoneSpans, zoneKeys };
}

/* ═══════════════════ LINE FLOW BAND (SVG) ═══════════════════ */

class LineFlowErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error('LineFlowBand:', e); }
  render() {
    if (this.state.err)
      return <div style={{height:this.props.bh,background:'#fafafa',borderTop:'1px solid #eee',
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#999'}}>
        Erreur de rendu (voir console)</div>;
    return this.props.children;
  }
}

const LineFlowBand = ({ data, bh, s, pal, posterW }) => {
  const nodes = data.line || [];
  const steps = data.steps || [];
  const layout = useMemo(() => computeLayout(nodes, steps), [nodes, steps]);
  const { col, track, numCols, maxTracks, zoneSpans, zoneKeys } = layout;
  if (!nodes.length) return null;

  // ── Dimensionnement ──────────────────────────────────────────
  const pad = 8 * s;
  const availW = posterW - pad * 2;
  const letterR = Math.max(6, 9 * s);
  const nameH = 9 * s;
  const topMargin = letterR * 2 + 4 * s;
  const arrowLen = 7 * s;  // longueur de la tête de flèche
  // Espace utile dans la zone (sous le label de zone, au-dessus du bord bas)
  const zoneH = bh - topMargin - 2 * s;
  // Hauteur par track — dans la zone uniquement
  const rowH  = zoneH / maxTracks;

  // ── Deux largeurs de colonnes : nœuds (larges) vs gaps inter-zone (étroits) ─
  // nodesAtCol : nb de nœuds par colonne absolue (pour labels et largeur)
  const nodesAtCol = {};
  nodes.forEach(n => { const c = col[n.id]; nodesAtCol[c] = (nodesAtCol[c]||0) + 1; });
  const occupiedCols = new Set(Object.keys(nodesAtCol).map(Number));
  const gapCount     = numCols - occupiedCols.size;
  const nodeColCount = occupiedCols.size;
  // Colonnes de gap : juste assez pour passer les flèches
  const gapW = Math.max(arrowLen * 3 + 4 * s, 20 * s);
  // iconSize = hauteur disponible dans la zone (indépendant de la largeur de colonne)
  const iconSize = Math.max(12, rowH - letterR * 2 - nameH - 10 * s);
  // nodeColW = icône + petite marge (colonne serrée), plafonné au rawNodeColW si espace insuffisant
  const rawNodeColW = nodeColCount > 0 ? (availW - gapCount * gapW) / nodeColCount : availW;
  const nodeColW    = Math.min(rawNodeColW, Math.max(16 * s, iconSize + 8 * s));
  // Espace libéré → marges latérales (layout centré)
  const totalW  = nodeColCount * nodeColW + gapCount * gapW;
  const hPad    = pad + Math.max(0, availW - totalW) / 2;

  // Positions X pré-calculées (bords gauches + droit final de toutes les colonnes)
  const _colStarts = (() => {
    const a = []; let x = hPad;
    for (let i = 0; i < numCols; i++) { a.push(x); x += occupiedCols.has(i) ? nodeColW : gapW; }
    a.push(x);  // a[numCols] = bord droit de la dernière colonne
    return a;
  })();
  const colLeft = (ci) => _colStarts[Math.min(ci, numCols)] ?? (hPad + totalW);
  const colCx   = (ci) => _colStarts[ci] + (occupiedCols.has(ci) ? nodeColW : gapW) / 2;

  const cx = id => colCx(col[id] || 0);
  // cy = centre de l'icône, ancré en bas de sa sous-ligne (dans la zone)
  const cy = id => {
    const t = track[id] || 0;
    const rowBottomY = topMargin + (t + 1) * rowH - 2 * s;
    return rowBottomY - nameH - 6 * s - iconSize / 2;
  };

  const totalSteps = steps.length;
  const arrowId = 'lf-arr-' + (pal.primary||'').replace(/[^a-zA-Z0-9]/g,'');

  // ── Helpers flèches ───────────────────────────────────────────
  // Demi-largeur visuelle de l'icône d'un nœud (ancre les flèches au bord de l'icône)
  const getIconHalfW = (n) => {
    const icon = (data.icons||[]).find(ic => ic.id === n.iconId);
    if (!icon) return iconSize * 0.5;
    const r = getSVGRatio(icon.svgData);
    const iSz = iconSize * (n.size || 1);
    return Math.min(iSz * r, nodeColW * 0.88) / 2;
  };

  return (
    <svg width={posterW} height={bh} style={{flexShrink:0,display:'block',background:'#fafafa',borderTop:'1px solid #eee',overflow:'hidden'}}>
      <defs>
        {/* Triangle plein — refX=0 : la BASE est à la fin du chemin, la POINTE s'avance
            → le trait finit exactement sous la base, invisible sous le triangle rempli */}
        <marker id={arrowId}
          markerWidth={arrowLen} markerHeight={5*s}
          refX={0} refY={2.5*s}
          orient="auto" markerUnits="userSpaceOnUse">
          <path d={`M0,0 L0,${5*s} L${arrowLen},${2.5*s} z`} fill={pal.accent||pal.primary} />
        </marker>
      </defs>

      {/* ── 1. Zone backgrounds — rect couvrant startCol→endCol ── */}
      {zoneKeys.map((k) => {
        if (k === '__none__') return null;
        const si = steps.findIndex(st=>st.id===k);
        if (si < 0) return null;
        const color = getZoneColor(pal, si, totalSteps);
        const { startCol, endCol } = zoneSpans[k];
        const rx = colLeft(startCol);
        const rw = colLeft(endCol + 1) - colLeft(startCol);
        const ry = topMargin;
        const rh = bh - topMargin - 2 * s;
        const labelText = (data.lineZoneLabel||'number')==='title' ? (steps[si]?.title||'?') : String(si+1);
        const labelX = rx + rw / 2;
        return (
          <g key={k}>
            <rect x={rx} y={ry} width={rw} height={rh}
              rx={5*s} fill={color+'18'} stroke={color} strokeWidth={1.5*s} />
            {(data.lineZoneLabel||'number')==='title'
              ? <text x={labelX} y={ry-3*s} textAnchor="middle" fill={color}
                  fontSize={Math.max(7,9*s)} fontWeight={700} fontFamily="sans-serif">{labelText}</text>
              : <g transform={`translate(${labelX},${letterR + s})`}>
                  <circle r={letterR} fill={color}/>
                  <text textAnchor="middle" dy="0.35em" fill="#fff" fontSize={Math.max(8,12*s)} fontWeight={700} fontFamily="monospace">{labelText}</text>
                </g>
            }
          </g>
        );
      })}

      {/* ── 2. Arêtes — tracé orthogonal (suit la grille) ──────── */}
      {nodes.map(n => {
        const srcNexts = n.next || [];
        const fanCnt = srcNexts.length;
        return srcNexts.map((nid, fanOutIdx) => {
          const tgt = nodes.find(m => m.id === nid);
          if (!tgt) return null;
          const si = n.stepId ? steps.findIndex(st => st.id === n.stepId) : -1;
          const color = si >= 0 ? getZoneColor(pal, si, totalSteps) : (pal.accent || pal.primary);
          const sw = Math.max(1, 1.5 * s);
          // Sortie juste après le bord droit de l'icône source
          const exitX = cx(n.id) + getIconHalfW(n) + 2 * s;
          // La POINTE de la flèche s'arrête juste avant le bord gauche de l'icône cible.
          // Le CHEMIN s'arrête à (tipX - arrowLen) = BASE du triangle, qui cache la fin du trait.
          const tipX     = cx(tgt.id) - getIconHalfW(tgt) - 2 * s;
          const pathEndX = tipX - arrowLen;
          if (pathEndX <= exitX) return null;  // pas assez de place
          const srcY = cy(n.id);
          const tgtY = cy(tgt.id);
          let d;
          if (Math.abs(srcY - tgtY) < 1) {
            // Même ligne → trait horizontal
            d = `M${exitX},${srcY} H${pathEndX}`;
          } else {
            // Lignes différentes → orthogonal H-V-H
            // Chaque flèche reçoit un couloir X distinct pour éviter la superposition verticale
            const gapFrac = fanCnt > 1 ? (fanOutIdx + 1) / (fanCnt + 1) : 0.5;
            const laneX = exitX + (pathEndX - exitX) * gapFrac;
            d = `M${exitX},${srcY} H${laneX} V${tgtY} H${pathEndX}`;
          }
          return <path key={n.id + '-' + nid} d={d} fill="none"
            stroke={color} strokeWidth={sw} markerEnd={`url(#${arrowId})`} />;
        });
      })}

      {/* ── 3. Nœuds ─────────────────────────────────────────── */}
      {nodes.map(n => {
        const icon = (data.icons||[]).find(ic=>ic.id===n.iconId);
        if (!icon) return null;
        const si = n.stepId ? steps.findIndex(st=>st.id===n.stepId) : -1;
        const color = si>=0 ? getZoneColor(pal,si,totalSteps) : '#9E9E9E';
        // Lettre = colonne locale dans la zone (A=1ère col, B=2ème…)
        const k = n.stepId || '__none__';
        const localColIdx = col[n.id] - (zoneSpans[k]?.startCol ?? 0);
        const letter = String.fromCharCode(65 + localColIdx);
        // Numéro de ligne affiché seulement si plusieurs nœuds partagent la même colonne
        const rowNum = (track[n.id]||0) + 1;
        const showRow = (nodesAtCol[col[n.id]]||1) > 1;
        const label = showRow ? `${letter}${rowNum}` : letter;
        const iSz = iconSize * (n.size||1);
        const x = cx(n.id); const y = cy(n.id);
        const linkedOp = data.showLineTags!==false
          ? (()=>{ for(const st of steps) for(const op of (st.operations||[])) if(op.lineItemId===n.id) return op; return null; })()
          : null;
        // Dimensions naturelles de l'icône (ratio extrait du SVG)
        const ratio = getSVGRatio(icon.svgData);
        const rawW = iSz * ratio;
        const imgW = Math.min(rawW, nodeColW * 0.88);   // cap à la largeur de colonne
        const imgH = imgW / ratio;                    // hauteur ajustée si la largeur a été réduite
        return (
          <g key={n.id}>
            {/* Icône — ratio naturel préservé */}
            <image href={svgUrl(icon.svgData)}
              x={x-imgW/2} y={y-imgH/2} width={imgW} height={imgH}
              preserveAspectRatio="xMidYMid meet" />
            {/* Badge lettre (+ numéro de ligne si parallèles) */}
            <circle cx={x} cy={y-imgH/2-letterR-1*s} r={letterR} fill={color}/>
            <text x={x} y={y-imgH/2-letterR-1*s} textAnchor="middle" dy="0.35em" fill="#fff"
              fontSize={Math.max(5, Math.min(12*s, letterR*1.4))} fontWeight={700} fontFamily="monospace">{label}</text>
            {/* Nom */}
            <text x={x} y={y+imgH/2+8*s} textAnchor="middle" fill="#555"
              fontSize={Math.max(6,8*s)} fontWeight={600} fontFamily="sans-serif"
              style={{dominantBaseline:'hanging'}}>{icon.name}</text>
            {/* Tags */}
            {linkedOp && (linkedOp.tags||[]).length>0 && linkedOp.tags.map((t,ti)=>{
              const tc = TAG_COLORS[t.type]||{bg:'#eee',color:'#333',border:'#ccc'};
              const tw = Math.max(16, 20*s); const th = Math.max(8, 11*s);
              return <rect key={t.id}
                x={x+(ti-linkedOp.tags.length/2+0.5)*tw-tw/2} y={y-imgH/2-letterR*2-th-1*s}
                width={tw} height={th} rx={2} fill={tc.bg} stroke={tc.border} strokeWidth={0.5}/>;
            })}
          </g>
        );
      })}
    </svg>
  );
};

/* ═══════════════════ LINE FLOW EDITOR ═══════════════════ */

const LineEditor = ({ icons, line, steps, onChange, libSvgFiles, onLoadSvg }) => {
  const iconFileRef = useRef();
  const [addPanel, setAddPanel] = useState(null); // { iconId, stepId, afterId } | null

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

  const addToLine = (iconId) => upLine([...line, { id:uid(), iconId, stepId:null, next:[] }]);
  const removeFromLine = (id) => {
    upLine(line.filter(m => m.id !== id).map(m => ({...m, next:(m.next||[]).filter(nid=>nid!==id)})));
  };
  const removeIcon = (iconId) => {
    upIcons(icons.filter(ic => ic.id !== iconId));
    upLine(line.filter(m => m.iconId !== iconId));
  };
  const updateLineItem = (id, patch) => upLine(line.map(m => m.id===id ? {...m,...patch} : m));
  const addConnection = (fromId, toId) => upLine(line.map(m => m.id===fromId ? {...m, next:[...new Set([...(m.next||[]),toId])]} : m));
  const removeConnection = (fromId, toId) => upLine(line.map(m => m.id===fromId ? {...m, next:(m.next||[]).filter(id=>id!==toId)} : m));
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
      {libSvgFiles.length > 0 && (
        <div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
            <label style={{ fontSize:11,fontWeight:700,color:'#555',textTransform:'uppercase',letterSpacing:0.5 }}>📂 SVG disponibles</label>
            {libSvgFiles.some(n => !icons.some(ic => ic.name === n.replace(/\.svg$/i,''))) && (
              <Btn small onClick={()=>libSvgFiles.filter(n=>!icons.some(ic=>ic.name===n.replace(/\.svg$/i,''))).forEach(n=>onLoadSvg(n))}>Tout importer</Btn>
            )}
          </div>
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
                  <button onClick={()=>setAddPanel({iconId:ic.id,stepId:null,afterId:null,beforeId:null})} style={{marginTop:2,fontSize:9,padding:'1px 4px',border:'1px solid #ddd',borderRadius:3,background:'#fff',cursor:'pointer',color:'#555'}}>+ Ligne</button>
                </div>
              ))}
            </div>
        }
        {/* ── Panel d'ajout rapide ── */}
        {addPanel && (()=>{
          const ic = icons.find(i=>i.id===addPanel.iconId);
          const zoneOptions = steps.map((st,si)=>({
            id:st.id, title:st.title, color:ZONE_COLORS[si%ZONE_COLORS.length],
            machines:line.filter(m=>m.stepId===st.id)
          }));
          const machinesInZone = addPanel.stepId ? line.filter(m=>m.stepId===addPanel.stepId) : [];
          return (
            <div style={{background:'#f5f8ff',border:'2px solid #1565C0',borderRadius:8,padding:10,marginTop:4}}>
              <div style={{fontSize:10,fontWeight:700,color:'#1565C0',marginBottom:6}}>Ajouter : {ic?.name}</div>
              <div style={{fontSize:9,color:'#666',marginBottom:4}}>Zone :</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                <div onClick={()=>setAddPanel({...addPanel,stepId:null,afterId:null,beforeId:null})}
                  style={{padding:'3px 8px',borderRadius:10,fontSize:9,cursor:'pointer',
                    background:addPanel.stepId===null?'#555':'#e0e0e0',
                    color:addPanel.stepId===null?'#fff':'#555'}}>Sans zone</div>
                {zoneOptions.map(z=>(
                  <div key={z.id} onClick={()=>setAddPanel({...addPanel,stepId:z.id,afterId:null,beforeId:null})}
                    style={{padding:'3px 8px',borderRadius:10,fontSize:9,cursor:'pointer',fontWeight:600,
                      background:addPanel.stepId===z.id?z.color:z.color+'33',
                      color:addPanel.stepId===z.id?'#fff':z.color}}>{z.title}</div>
                ))}
              </div>
              {machinesInZone.length>0&&(()=>{
                const chipStyle = (active) => ({padding:'3px 8px',borderRadius:10,fontSize:9,cursor:'pointer',
                  background:active?'#333':'#e0e0e0',color:active?'#fff':'#555'});
                const machineChips = (selectedId, onSelect) => (
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                    <div onClick={()=>onSelect(null)} style={chipStyle(selectedId===null)}>Aucune</div>
                    {machinesInZone.map(m=>{
                      const {label:ml}=getLineLabel(line,steps,m.id);
                      const mic=icons.find(ic=>ic.id===m.iconId);
                      return <div key={m.id} onClick={()=>onSelect(m.id)} style={chipStyle(selectedId===m.id)}>{ml} {mic?.name}</div>;
                    })}
                  </div>
                );
                return (
                  <>
                    <div style={{fontSize:9,color:'#666',marginBottom:4}}>Après (qui pointe vers la nouvelle) :</div>
                    {machineChips(addPanel.afterId, id=>setAddPanel({...addPanel,afterId:id}))}
                    <div style={{fontSize:9,color:'#666',marginBottom:4}}>Avant (vers qui pointe la nouvelle) :</div>
                    {machineChips(addPanel.beforeId, id=>setAddPanel({...addPanel,beforeId:id}))}
                  </>
                );
              })()}
              <div style={{display:'flex',gap:6}}>
                <Btn small onClick={()=>{
                  const newId=uid();
                  const newItem={id:newId,iconId:addPanel.iconId,stepId:addPanel.stepId||null,
                    next:addPanel.beforeId?[addPanel.beforeId]:[]};
                  const updatedLine=addPanel.afterId
                    ?line.map(m=>m.id===addPanel.afterId?{...m,next:[...(m.next||[]),newId]}:m)
                    :[...line];
                  upLine([...updatedLine,newItem]);
                  setAddPanel(null);
                }}>Ajouter</Btn>
                <Btn small onClick={()=>setAddPanel(null)}>Annuler</Btn>
              </div>
            </div>
          );
        })()}
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
                      const {label:letter}=getLineLabel(line,steps,item.id);
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
                            {/* Connexions sortantes */}
                            {(item.next||[]).length>0 && (
                              <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center'}}>
                                {(item.next||[]).map(nid=>{
                                  const {label:nl}=getLineLabel(line,steps,nid);
                                  return <span key={nid} onClick={()=>removeConnection(item.id,nid)}
                                    title="Cliquer pour supprimer" style={{fontSize:7,background:zone.color+'33',color:zone.color,borderRadius:3,padding:'1px 3px',cursor:'pointer',border:`1px solid ${zone.color}66`}}>→{nl} ✕</span>;
                                })}
                              </div>
                            )}
                            <select value="" onChange={e=>{if(e.target.value)addConnection(item.id,e.target.value);}}
                              style={{fontSize:7,padding:'1px 2px',border:'1px dashed #ddd',borderRadius:3,maxWidth:64,color:'#888',cursor:'pointer'}}>
                              <option value="">+→</option>
                              {line.filter(m=>m.id!==item.id&&!(item.next||[]).includes(m.id)).map(m=>{
                                const {label:ml}=getLineLabel(line,steps,m.id);
                                const mic=icons.find(ic=>ic.id===m.iconId);
                                return <option key={m.id} value={m.id}>{ml} {mic?.name||'?'}</option>;
                              })}
                            </select>
                          </div>
                        </Fragment>
                      );
                    })}
                    {/* Drop target pour ajouter une machine dans cette zone */}
                    <div onDragOver={e=>e.preventDefault()}
                      onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('iconId');if(id){const stepId=zone.step?.id||null;upLine([...line,{id:uid(),iconId:id,stepId,next:[]}]);}}}
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

/* ═══════════════════ TECHNICAL PLAN COMPONENTS ═══════════════════ */

/**
 * Sidebar de l'onglet "Plan" : import images, sélection outil/étape/machine, liste annotations.
 * Le dessin se fait directement dans l'aperçu (TechnicalPlanPreview en mode interactif).
 * Permet d'importer des images de plan, de dessiner des zones d'étapes (rectangles)
 * et de placer des lettres de machines par clic.
 */
const TechnicalPlanEditor = ({ data, up, planTool, setPlanTool, planSelStep, setPlanSelStep, planSelMachine, setPlanSelMachine, planMachineMode, setPlanMachineMode }) => {
  const [activeView, setActiveView] = useState(0);
  const imgInputRefs = [useRef(), useRef()];

  const tp = data.technicalPlan || { zoneLabel:"number", gridSize:5, views:[
    { id:"top",label:"Vue de dessus",imageDataUrl:null,stepZones:[],machineLabels:[] },
    { id:"side",label:"Vue de côté",imageDataUrl:null,stepZones:[],machineLabels:[] },
  ]};
  const view = tp.views[activeView] || { stepZones:[], machineLabels:[] };
  const steps = data.steps || [];
  const line = data.line || [];
  const icons = data.icons || [];
  const pal = getPalette(data.palette);
  const totalSteps = steps.length;

  const handleImgFile = (vi) => (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => up(d => { d.technicalPlan.views[vi].imageDataUrl = ev.target.result; });
    r.readAsDataURL(f);
  };

  const handleRotate = (vi) => async () => {
    const dataUrl = tp.views[vi].imageDataUrl;
    if (!dataUrl) return;
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => { img.onload = r; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const newDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const remapPt = p => ({ x: 100 - p.y, y: p.x });
    const rectToPoints = z => [{ x:z.x, y:z.y }, { x:z.x+z.w, y:z.y }, { x:z.x+z.w, y:z.y+z.h }, { x:z.x, y:z.y+z.h }];
    up(d => {
      d.technicalPlan.views[vi].imageDataUrl = newDataUrl;
      d.technicalPlan.views[vi].stepZones = d.technicalPlan.views[vi].stepZones.map(z => ({
        ...z,
        points: (z.points || rectToPoints(z)).map(remapPt),
        labelX: z.labelX != null ? 100 - z.labelY : null,
        labelY: z.labelY != null ? z.labelX : null,
      }));
      d.technicalPlan.views[vi].machineLabels = d.technicalPlan.views[vi].machineLabels.map(m => ({
        ...m, x: 100 - m.y, y: m.x,
        arrowTo: m.arrowTo ? { x: 100 - m.arrowTo.y, y: m.arrowTo.x } : null,
      }));
    });
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
      {/* Sélecteur de vue */}
      <div style={{ display:"flex",gap:6 }}>
        {tp.views.map((v,i) => (
          <button key={v.id} onClick={()=>setActiveView(i)} style={{ flex:1,padding:"6px 8px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:activeView===i?"2px solid #C8102E":"1.5px solid #ddd",background:activeView===i?"#FFF5F5":"#fff",color:activeView===i?"#C8102E":"#666" }}>{v.label}</button>
        ))}
      </div>
      {/* Vue de côté optionnelle */}
      <label style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,color:"#555" }}>
        <input type="checkbox" checked={tp.views[1]?.enabled !== false}
          onChange={e=>up(d=>{d.technicalPlan.views[1].enabled=e.target.checked;})}
          style={{ accentColor:"#C8102E",width:14,height:14 }} />
        Afficher la vue de côté
      </label>

      {/* Import image */}
      <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
        <div style={{ fontSize:11,fontWeight:600,color:"#666",marginBottom:6 }}>Image — {tp.views[activeView]?.label}</div>
        <input ref={imgInputRefs[activeView]} type="file" accept="image/*" onChange={handleImgFile(activeView)} style={{ fontSize:11 }} />
        {view.imageDataUrl && (
          <div style={{ display:"flex",gap:6,marginTop:6 }}>
            <Btn small outline color="#d32f2f" onClick={()=>up(d=>{d.technicalPlan.views[activeView].imageDataUrl=null;})}>Supprimer</Btn>
            <Btn small outline color="#1565C0" onClick={handleRotate(activeView)}>↻ Rotation 90°</Btn>
          </div>
        )}
      </div>

      {/* Outil actif — le dessin se fait dans l'aperçu → */}
      <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
        <div style={{ fontSize:11,fontWeight:600,color:"#666",marginBottom:6 }}>Outil (dessiner dans l'aperçu →)</div>
        <div style={{ display:"flex",gap:6 }}>
          {[['zone','⬜ Zone étape'],['machine','⬤ Lettre machine']].map(([k,l])=>(
            <button key={k} onClick={()=>setPlanTool(k)} style={{ flex:1,padding:"5px 8px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:planTool===k?"2px solid #1565C0":"1.5px solid #ddd",background:planTool===k?"#E3F2FD":"#fff",color:planTool===k?"#1565C0":"#666" }}>{l}</button>
          ))}
        </div>
        {planTool === 'zone' && steps.length > 0 && (
          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,color:"#666" }}>Étape à annoter</label>
            <select value={planSelStep} onChange={e=>setPlanSelStep(parseInt(e.target.value))}
              style={{ width:"100%",marginTop:4,padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit" }}>
              {steps.map((s,i)=><option key={s.id} value={i}>{i+1}. {s.title||"(sans titre)"}</option>)}
            </select>
          </div>
        )}
        {planTool === 'machine' && line.length > 0 && (
          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,color:"#666" }}>Machine à placer</label>
            <select value={planSelMachine||''} onChange={e=>setPlanSelMachine(e.target.value||null)}
              style={{ width:"100%",marginTop:4,padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit" }}>
              <option value="">— choisir —</option>
              {(()=>{
                // Trier par stepIndex (ordre des étapes) puis par lettre dans la zone
                const sorted = line.map(item=>{
                  const step = steps.find(s => s.id === item.stepId);
                  const si = step ? steps.indexOf(step) : Infinity;
                  const zoneItems = line.filter(m => m.stepId === item.stepId);
                  const idx = zoneItems.findIndex(m => m.id === item.id);
                  const letter = idx >= 0 ? String.fromCharCode(65+idx) : '?';
                  return { item, si, idx, letter, step };
                }).sort((a,b) => a.si !== b.si ? a.si - b.si : a.idx - b.idx);
                return sorted.map(({ item, letter, step }) => {
                  const icon = (icons||[]).find(ic=>ic.id===item.iconId);
                  const zoneLabel = step ? step.title : 'sans zone';
                  return <option key={item.id} value={item.id}>{zoneLabel} — {letter} · {icon?.name||"Machine"}</option>;
                });
              })()}
            </select>
          </div>
        )}
        {planTool === 'zone' && steps.length === 0 && <div style={{ fontSize:10,color:"#bbb",marginTop:6 }}>Ajoute des étapes dans l'onglet Process.</div>}
        {planTool === 'machine' && line.length === 0 && <div style={{ fontSize:10,color:"#bbb",marginTop:6 }}>Ajoute des machines dans l'onglet Ligne.</div>}
        {planTool === 'zone' && steps.length > 0 && (
          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,color:"#666" }}>Badge de zone</label>
            <div style={{ display:"flex",gap:6,marginTop:4 }}>
              {[['number','⟨1⟩ Numéro'],['text','⟨texte⟩ Titre']].map(([k,l])=>(
                <button key={k} onClick={()=>up(d=>{d.technicalPlan.zoneLabel=k;})} style={{ flex:1,padding:"5px 8px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:tp.zoneLabel===k?"2px solid #E87722":"1.5px solid #ddd",background:tp.zoneLabel===k?"#FFF3E0":"#fff",color:tp.zoneLabel===k?"#E87722":"#666" }}>{l}</button>
              ))}
            </div>
          </div>
        )}
        {planTool === 'zone' && steps.length > 0 && (
          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,color:"#666" }}>Grille snap</label>
            <div style={{ display:"flex",gap:4,marginTop:4 }}>
              {[[0,'Aucune'],[2.5,'2.5%'],[5,'5%'],[10,'10%']].map(([v,l])=>(
                <button key={v} onClick={()=>up(d=>{d.technicalPlan.gridSize=v;})} style={{ flex:1,padding:"4px 4px",borderRadius:5,fontSize:10,fontWeight:600,cursor:"pointer",border:(tp.gridSize||0)===v?"2px solid #1565C0":"1.5px solid #ddd",background:(tp.gridSize||0)===v?"#E3F2FD":"#fff",color:(tp.gridSize||0)===v?"#1565C0":"#666" }}>{l}</button>
              ))}
            </div>
            <div style={{ fontSize:10,color:"#bbb",marginTop:4 }}>Clics pour placer les sommets. Double-clic ou clic sur le 1er point pour fermer.</div>
          </div>
        )}
        <div style={{ marginTop:8 }}>
          <label style={{ fontSize:11,color:"#666" }}>Police légende <strong style={{ color:"#333" }}>{tp.legendFontSize||9}px</strong></label>
          <input type="range" min={6} max={18} step={1} value={tp.legendFontSize||9}
            onChange={e=>up(d=>{d.technicalPlan.legendFontSize=Number(e.target.value);})}
            style={{ width:"100%",marginTop:4,accentColor:"#1565C0" }} />
        </div>
        {planTool === 'machine' && line.length > 0 && (
          <div style={{ marginTop:8 }}>
            <label style={{ fontSize:11,color:"#666" }}>Mode placement</label>
            <div style={{ display:"flex",gap:6,marginTop:4 }}>
              {[['point','⬤ Point seul'],['arrow','⬤→ Point + flèche']].map(([k,l])=>(
                <button key={k} onClick={()=>setPlanMachineMode(k)} style={{ flex:1,padding:"5px 8px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:planMachineMode===k?"2px solid #1565C0":"1.5px solid #ddd",background:planMachineMode===k?"#E3F2FD":"#fff",color:planMachineMode===k?"#1565C0":"#666" }}>{l}</button>
              ))}
            </div>
            <div style={{ fontSize:10,color:"#bbb",marginTop:4 }}>{planMachineMode==='arrow'?"Cliquer-glisser pour placer avec flèche.":"Cliquer pour placer."}</div>
          </div>
        )}
      </div>

      {/* Annotations existantes */}
      {tp.views.map((v, vi) => {
        if (v.stepZones.length === 0 && v.machineLabels.length === 0) return null;
        return (
          <SectionCard key={v.id} title={`Annotations — ${v.label}`} defaultOpen={vi===activeView}>
            {v.stepZones.map((z,i) => {
              const color = totalSteps>0 ? getZoneColor(pal, z.stepIndex, totalSteps) : "#999";
              const step = steps[z.stepIndex];
              return (
                <div key={z.id} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f0f0f0" }}>
                  <div style={{ width:14,height:14,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0 }}>{z.stepIndex+1}</div>
                  <span style={{ flex:1,fontSize:11,color:"#555" }}>{step?.title||"—"}</span>
                  <span onClick={()=>up(d=>{d.technicalPlan.views[vi].stepZones.splice(i,1);})} style={{ cursor:"pointer",fontSize:12,color:"#ccc",padding:"0 4px" }}>✕</span>
                </div>
              );
            })}
            {v.machineLabels.map((m,i) => {
              const item = line.find(m2=>m2.id===m.lineId);
              const icon = (icons||[]).find(ic => ic.id === (item||{}).iconId);
              const zoneItems = line.filter(li => li.stepId === item?.stepId);
              const idx = zoneItems.findIndex(li => li.id === item?.id);
              const letter = idx >= 0 ? String.fromCharCode(65+idx) : '?';
              const si = item?.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
              const mColor = si >= 0 ? getZoneColor(pal, si, totalSteps) : pal.primary;
              return (
                <div key={m.id} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f0f0f0" }}>
                  <div style={{ width:14,height:14,borderRadius:"50%",background:mColor,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0 }}>{letter}</div>
                  <span style={{ flex:1,fontSize:11,color:"#555" }}>{icon?.name||"Machine"}{m.arrowTo?' →':''}</span>
                  <span onClick={()=>up(d=>{d.technicalPlan.views[vi].machineLabels.splice(i,1);})} style={{ cursor:"pointer",fontSize:12,color:"#ccc",padding:"0 4px" }}>✕</span>
                </div>
              );
            })}
          </SectionCard>
        );
      })}
    </div>
  );
};

/**
 * Rendu de l'affiche technique (poster imprimable + mode interactif pour annoter).
 * Style unifié avec PosterPreview : même header, même footer, même palette.
 * En mode interactif (interactive=true), le dessin se fait directement sur les images.
 */
const TechnicalPlanPreview = ({ data, appVersion, interactive, planTool, planSelStep, planSelMachine, planMachineMode, onAddZone, onAddLabel, onUpdateZone, onUpdateLabel }) => {
  const pal = getPalette(data.palette);
  const fmt = data.format === "Personnalisé" ? { w:data.customW||800, h:data.customH||500 } : (FORMATS[data.format] || { w:841, h:594 });
  const posterW = Math.round(fmt.w * MM_PX);
  const posterH = Math.round(fmt.h * MM_PX);
  const forceH = data.forceFormat;
  const s = (data.fontScale || 7) * 0.15;
  const hh = data.headerHeight || 56;
  const hr = hh / 56, hs = s * hr;
  const tp = data.technicalPlan || { zoneLabel:"number", gridSize:5, views:[] };
  const steps = data.steps || [];
  const line = data.line || [];
  const icons = data.icons || [];
  const totalSteps = steps.length;

  // Lettre et couleur d'une machine — labels cohérents avec LineFlowBand via getLineLabel.
  const getMachinePlanInfo = (lineId) => {
    const item = line.find(m => m.id === lineId);
    if (!item) return { letter:'?', color:pal.primary };
    const { label } = getLineLabel(line, steps, lineId);
    const si = item.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
    return { letter: label, color: si >= 0 ? getZoneColor(pal, si, totalSteps) : pal.primary };
  };

  // Helpers geometry
  const rectToPoints = z => [{ x:z.x, y:z.y }, { x:z.x+z.w, y:z.y }, { x:z.x+z.w, y:z.y+z.h }, { x:z.x, y:z.y+z.h }];
  const getPoints = z => z.points || rectToPoints(z);
  const centroid = pts => ({ x: pts.reduce((a,p)=>a+p.x,0)/pts.length, y: pts.reduce((a,p)=>a+p.y,0)/pts.length });
  const snapToGrid = (pos, gs) => gs > 0 ? { x: Math.round(pos.x/gs)*gs, y: Math.round(pos.y/gs)*gs } : pos;

  // Unified interaction state machine
  // null | { mode:'polygon', vi, selStep, points, mouse }
  // | { mode:'arrow-drag', vi, lineId, start, mouse }
  // | { mode:'drag-label', vi, zoneId }
  // | { mode:'drag-arrow-tip', vi, labelId }
  const [interaction, setInteraction] = useState(null);
  const imgRefs = [useRef(), useRef()];

  const getRelPos = (e, vi) => {
    const el = imgRefs[vi].current; if (!el) return { x:0, y:0 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, (e.clientX-rect.left)/rect.width*100)),
      y: Math.max(0, Math.min(100, (e.clientY-rect.top)/rect.height*100)),
    };
  };

  useEffect(() => {
    if (!interaction || !interactive) return;
    const onMove = (e) => {
      if (interaction.mode === 'polygon') {
        const pos = getRelPos(e, interaction.vi);
        setInteraction(prev => prev ? { ...prev, mouse: pos } : null);
      } else if (interaction.mode === 'arrow-drag') {
        const pos = getRelPos(e, interaction.vi);
        setInteraction(prev => prev ? { ...prev, mouse: pos } : null);
      } else if (interaction.mode === 'drag-label') {
        const pos = getRelPos(e, interaction.vi);
        if (onUpdateZone) onUpdateZone(interaction.vi, interaction.zoneId, { labelX: pos.x, labelY: pos.y });
      } else if (interaction.mode === 'drag-arrow-tip') {
        const pos = getRelPos(e, interaction.vi);
        if (onUpdateLabel) onUpdateLabel(interaction.vi, interaction.labelId, { arrowTo: pos });
      }
    };
    const onUp = (e) => {
      if (interaction.mode === 'arrow-drag') {
        const pos = getRelPos(e, interaction.vi);
        const dx = pos.x - interaction.start.x, dy = pos.y - interaction.start.y;
        const arrowTo = Math.sqrt(dx*dx+dy*dy) > 3 ? pos : null;
        onAddLabel(interaction.vi, { lineId: interaction.lineId, x: interaction.start.x, y: interaction.start.y, arrowTo });
        setInteraction(null);
      } else if (interaction.mode === 'drag-label' || interaction.mode === 'drag-arrow-tip') {
        setInteraction(null);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [interaction, interactive]);

  const handleMouseDown = (e, vi) => {
    if (!interactive) return;
    const gs = tp.gridSize || 0;
    if (planTool === 'zone' && steps.length > 0) {
      e.preventDefault();
      const pos = snapToGrid(getRelPos(e, vi), gs);
      if (!interaction || interaction.mode !== 'polygon' || interaction.vi !== vi) {
        setInteraction({ mode:'polygon', vi, selStep: planSelStep, points:[pos], mouse:pos });
      } else {
        const first = interaction.points[0];
        const dist = Math.sqrt((pos.x-first.x)**2 + (pos.y-first.y)**2);
        const threshold = Math.max(3, (gs || 5) * 0.8);
        if (interaction.points.length >= 3 && dist < threshold) {
          onAddZone(vi, { stepIndex: interaction.selStep, points: interaction.points, labelX: null, labelY: null });
          setInteraction(null);
        } else {
          setInteraction(prev => prev ? { ...prev, points:[...prev.points, pos] } : null);
        }
      }
    } else if (planTool === 'machine' && line.length > 0 && planSelMachine) {
      const pos = getRelPos(e, vi);
      if (planMachineMode === 'arrow') {
        setInteraction({ mode:'arrow-drag', vi, lineId: planSelMachine, start: pos, mouse: pos });
      } else {
        onAddLabel(vi, { lineId: planSelMachine, x: pos.x, y: pos.y, arrowTo: null });
      }
    }
  };

  const handleDoubleClick = (e, vi) => {
    if (!interactive || !interaction || interaction.mode !== 'polygon' || interaction.vi !== vi) return;
    e.preventDefault();
    if (interaction.points.length >= 3) {
      onAddZone(vi, { stepIndex: interaction.selStep, points: interaction.points, labelX: null, labelY: null });
      setInteraction(null);
    }
  };

  return (
    <div data-poster-root="1" style={{ width:posterW, ...(forceH?{height:posterH}:{minHeight:posterH}), fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", borderRadius:6, overflow:forceH?"hidden":"visible", boxShadow:"0 2px 16px rgba(0,0,0,0.12)", display:"flex", flexDirection:"column" }}>
      {/* Header — identique à PosterPreview */}
      {(()=>{ return (
        <div style={{ background:pal.primary,color:"#fff",display:"flex",alignItems:"flex-start",padding:`0 ${24*hs}px`,height:hh*s,gap:20*hs,flexShrink:0,paddingTop:4*hs }}>
          <div style={{ borderRight:"2px solid rgba(255,255,255,0.3)",paddingRight:20*hs,display:"flex",flexDirection:"column",gap:2*hs }}>
            <span style={{ fontSize:8*hs,textTransform:"uppercase",letterSpacing:1.5,opacity:0.8 }}>Référence</span>
            <strong style={{ fontFamily:"monospace",fontSize:24*hs,fontWeight:700 }}>{data.header.reference}</strong>
          </div>
          <div style={{ flex:1,display:"flex",flexDirection:"column",gap:2*hs }}>
            <span style={{ fontSize:8*hs,textTransform:"uppercase",letterSpacing:1.5,opacity:0.8 }}>Process — Plan technique</span>
            <div style={{ fontSize:16*hs,fontWeight:700 }}>{data.header.processName}</div>
            <div style={{ fontSize:10*hs,opacity:0.85 }}>{data.header.subtitle}</div>
          </div>
          {data.header.logoDataUrl ? <img src={data.header.logoDataUrl} alt="" style={{ height:40*hs,objectFit:"contain" }} /> : (
            <div style={{ textAlign:"right" }}><div style={{ fontSize:22*hs,fontWeight:700,letterSpacing:2 }}>Nexans</div><div style={{ fontSize:7*hs,textTransform:"uppercase",letterSpacing:2,opacity:0.7 }}>Electrify the future</div></div>
          )}
        </div>
      );})()}

      {/* Barre de légende des étapes (style unifié avec la barre legend de PosterPreview) */}
      <div style={{ display:"flex",alignItems:"center",gap:10*s,padding:`${6*s}px ${24*s}px`,background:"#fafafa",borderBottom:"1px solid #e0e0e0",fontSize:10*s,flexWrap:"wrap",flexShrink:0 }}>
        <span style={{ fontWeight:600,color:"#757575" }}>Plan technique :</span>
        {steps.map((st,si)=>{
          const color=getZoneColor(pal,si,totalSteps);
          return <span key={st.id} style={{ display:"inline-flex",alignItems:"center",gap:3*s }}>
            <span style={{ width:14*s,height:14*s,borderRadius:"50%",background:color,color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:8*s,fontWeight:700 }}>{si+1}</span>
            <span style={{ color:"#666" }}>{st.title}</span>
          </span>;
        })}
      </div>

      {/* Corps : vues empilées */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",padding:`${10*s}px`,gap:14*s }}>
        {tp.views.every(v=>!v.imageDataUrl) && (
          <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#bbb",fontSize:14*s,fontStyle:"italic" }}>
            Importer des images dans l'onglet 📐 Plan
          </div>
        )}
        {tp.views.map((view,vi) => {
          if (!view.imageDataUrl || view.enabled === false) return null;
          return (
            <div key={view.id} style={{ flex:1,display:"flex",gap:10*s,minHeight:0 }}>
              {/* Image annotée */}
              <div style={{ flex:3,display:"flex",flexDirection:"column",minWidth:0 }}>
                {/* Label de vue */}
                <div style={{ display:"flex",alignItems:"center",gap:6*s,marginBottom:4*s }}>
                  <span style={{ fontSize:11*s,fontWeight:700,color:pal.primary,textTransform:"uppercase",letterSpacing:1 }}>{view.label}</span>
                </div>
                {/* Conteneur image + overlay annotations */}
                <div style={{ flex:1,overflow:"hidden",minHeight:0 }}>
                <div ref={imgRefs[vi]}
                  style={{ position:"relative",cursor:interactive?(planTool==='zone'?'crosshair':'cell'):'default',borderRadius:4*s,border:`1.5px solid ${pal.primary}33`,overflow:"hidden" }}
                  onMouseDown={interactive ? (e=>handleMouseDown(e,vi)) : undefined}
                  onDoubleClick={interactive ? (e=>handleDoubleClick(e,vi)) : undefined}
                >
                  <img src={view.imageDataUrl} alt={view.label} style={{ width:"100%",display:"block" }} draggable={false} />

                  {/* Badges de zones — DOM divs pour le texte, positionnés au centroïde ou labelX/Y */}
                  {view.stepZones.map(z => {
                    const color = getZoneColor(pal,z.stepIndex,totalSteps);
                    const step = steps[z.stepIndex];
                    const pts = getPoints(z);
                    const ctr = centroid(pts);
                    const bx = z.labelX != null ? z.labelX : ctr.x;
                    const by = z.labelY != null ? z.labelY : ctr.y;
                    const badgeContent = tp.zoneLabel === 'text'
                      ? <span style={{ fontSize:Math.max(6,9*s),fontWeight:700,whiteSpace:"nowrap" }}>{step?.title||String(z.stepIndex+1)}</span>
                      : <span style={{ fontSize:Math.max(8,13*s),fontWeight:700,fontFamily:"monospace" }}>{z.stepIndex+1}</span>;
                    const badgeW = tp.zoneLabel === 'text' ? 'auto' : 22*s;
                    const badgePad = tp.zoneLabel === 'text' ? `0 ${Math.max(4,6*s)}px` : 0;
                    return (
                      <div key={z.id+'b'} style={{ position:"absolute",left:bx+'%',top:by+'%',transform:"translate(-50%,-50%)",minWidth:22*s,width:badgeW,height:22*s,borderRadius:tp.zoneLabel==='text'?Math.max(3,11*s):"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:badgePad,boxSizing:"content-box",cursor:interactive?"grab":"default",zIndex:2,pointerEvents:interactive?"auto":"none",userSelect:"none" }}
                        onMouseDown={interactive ? (e=>{e.stopPropagation();setInteraction({mode:'drag-label',vi,zoneId:z.id});}) : undefined}
                      >{badgeContent}</div>
                    );
                  })}

                  {/* Lettres machines — lettre et couleur relatives à la zone (stepId) */}
                  {view.machineLabels.map(m => {
                    const { letter, color:mColor } = getMachinePlanInfo(m.lineId);
                    return (
                      <div key={m.id} style={{ position:"absolute",left:m.x+'%',top:m.y+'%',transform:"translate(-50%,-50%)",width:22*s,height:22*s,borderRadius:"50%",background:mColor,color:"#fff",fontSize:Math.max(8,13*s),fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",pointerEvents:"none",boxShadow:`0 1px 4px rgba(0,0,0,0.3)`,zIndex:2 }}>{letter}</div>
                    );
                  })}

                  {/* Overlay SVG : polygones, grille, flèches, in-progress */}
                  <svg style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible" }}
                    viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <marker id={`arrowhead-${vi}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,5 L5,2.5 z" fill="context-stroke" />
                      </marker>
                    </defs>

                    {/* Grille snap — visible uniquement en cours de dessin polygone */}
                    {interactive && interaction?.mode==='polygon' && interaction.vi===vi && (tp.gridSize||0)>0 && (()=>{
                      const gs = tp.gridSize;
                      const lines = [];
                      for (let v=0; v<=100; v+=gs) {
                        lines.push(<line key={'v'+v} x1={v} y1={0} x2={v} y2={100} stroke="#00000018" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />);
                        lines.push(<line key={'h'+v} x1={0} y1={v} x2={100} y2={v} stroke="#00000018" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />);
                      }
                      return lines;
                    })()}

                    {/* Polygones des zones */}
                    {view.stepZones.map(z => {
                      const color = getZoneColor(pal,z.stepIndex,totalSteps);
                      const pts = getPoints(z);
                      const ptStr = pts.map(p=>`${p.x},${p.y}`).join(' ');
                      const ctr = centroid(pts);
                      const bx = z.labelX != null ? z.labelX : ctr.x;
                      const by = z.labelY != null ? z.labelY : ctr.y;
                      return (
                        <g key={z.id}>
                          <polygon points={ptStr} fill={color+'22'} stroke={color} strokeWidth={Math.max(0.3,0.5*s)} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </g>
                      );
                    })}

                    {/* Flèches des lettres machines */}
                    {view.machineLabels.map(m => {
                      const { color:mColor } = getMachinePlanInfo(m.lineId);
                      if (!m.arrowTo) return null;
                      return (
                        <g key={m.id+'arrow'}>
                          <line x1={m.x} y1={m.y} x2={m.arrowTo.x} y2={m.arrowTo.y} stroke={mColor} strokeWidth={Math.max(0.8,1.2*s)} markerEnd={`url(#arrowhead-${vi})`} vectorEffect="non-scaling-stroke" />
                          {/* Handle invisible de déplacement de la pointe (zone cliquable) */}
                          {interactive && <circle cx={m.arrowTo.x} cy={m.arrowTo.y} r={2.5} fill="transparent" style={{ cursor:'move',pointerEvents:'auto' }}
                            onMouseDown={e=>{e.stopPropagation();setInteraction({mode:'drag-arrow-tip',vi,labelId:m.id});}} />}
                        </g>
                      );
                    })}

                    {/* Flèche arrow-drag en cours */}
                    {interaction?.mode==='arrow-drag' && interaction.vi===vi && (()=>{
                      const {color:mColor} = getMachinePlanInfo(interaction.lineId);
                      return <line x1={interaction.start.x} y1={interaction.start.y} x2={interaction.mouse.x} y2={interaction.mouse.y} stroke={mColor} strokeWidth={Math.max(0.8,1.2*s)} strokeDasharray="2,1" markerEnd={`url(#arrowhead-${vi})`} vectorEffect="non-scaling-stroke" />;
                    })()}

                    {/* Polygone en cours de dessin */}
                    {interaction?.mode==='polygon' && interaction.vi===vi && (()=>{
                      const color = totalSteps>0 ? getZoneColor(pal,interaction.selStep,totalSteps) : pal.primary;
                      const pts = [...interaction.points, interaction.mouse];
                      const ptStr = pts.map(p=>`${p.x},${p.y}`).join(' ');
                      const first = interaction.points[0];
                      const dist = Math.sqrt((interaction.mouse.x-first.x)**2+(interaction.mouse.y-first.y)**2);
                      const canClose = interaction.points.length >= 3;
                      return (
                        <g>
                          <polyline points={ptStr} fill="none" stroke={color} strokeWidth={Math.max(0.3,0.4*s)} strokeDasharray="2,1" vectorEffect="non-scaling-stroke" />
                          {/* Points déjà posés */}
                          {interaction.points.slice(1).map((p,i)=>(
                            <circle key={i} cx={p.x} cy={p.y} r={0.8} fill={color} vectorEffect="non-scaling-stroke" />
                          ))}
                          {/* 1er point — indicateur de fermeture */}
                          <circle cx={first.x} cy={first.y} r={canClose && dist < Math.max(3,(tp.gridSize||5)*0.8) ? 2 : 1.2} fill={color} opacity={0.9} vectorEffect="non-scaling-stroke" />
                        </g>
                      );
                    })()}
                  </svg>
                </div>
                </div>{/* /flex:1 wrapper */}
              </div>

              {/* Légende — organisée par zone */}
              {(()=>{
                const afs = tp.legendFontSize || 9;
                return (
                  <div style={{ flex:1,display:"flex",flexDirection:"column",gap:afs*0.6,minWidth:0,boxSizing:"border-box",borderLeft:`2px solid ${pal.primary}`,paddingLeft:afs,overflow:"hidden" }}>
                    {(()=>{
                      // Collecter les step indices présents dans cette vue (zones dessinées)
                      const zoneIndices = [...new Set(view.stepZones.map(z=>z.stepIndex))].sort((a,b)=>a-b);
                      // Machines placées dans cette vue, par stepId
                      const machinesByStep = {};
                      view.machineLabels.forEach(m => {
                        const item = line.find(m2=>m2.id===m.lineId);
                        const si = item?.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
                        const key = si >= 0 ? si : '__none__';
                        if (!machinesByStep[key]) machinesByStep[key] = [];
                        machinesByStep[key].push(m);
                      });
                      // Zones à afficher = union des zones dessinées + zones de machines placées
                      const allZoneKeys = [...new Set([...zoneIndices, ...Object.keys(machinesByStep).filter(k=>k!=='__none__').map(Number)])].sort((a,b)=>a-b);
                      if (allZoneKeys.length === 0 && !machinesByStep['__none__']) {
                        return <div style={{ fontSize:afs,color:"#bbb",fontStyle:"italic",marginTop:afs*0.4 }}>Aucune annotation</div>;
                      }
                      return allZoneKeys.map(si => {
                        const color = getZoneColor(pal, si, totalSteps);
                        const step = steps[si];
                        const machines = machinesByStep[si] || [];
                        const circleSize = afs * 1.7;
                        return (
                          <div key={si}>
                            {/* En-tête de zone */}
                            <div style={{ display:"flex",alignItems:"center",gap:afs*0.45,marginBottom:afs*0.3 }}>
                              <div style={{ width:circleSize,height:circleSize,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.max(6,afs),fontWeight:700,flexShrink:0,fontFamily:"monospace" }}>{si+1}</div>
                              <span style={{ fontSize:afs,fontWeight:700,color:color,textTransform:"uppercase",letterSpacing:0.5,lineHeight:1.2 }}>{step?.title||"—"}</span>
                            </div>
                            {/* Machines de cette zone */}
                            {machines.map(m => {
                              const item = line.find(m2=>m2.id===m.lineId);
                              const icon = (icons||[]).find(ic=>ic.id===(item||{}).iconId);
                              const { letter } = getMachinePlanInfo(m.lineId);
                              const mCircleSize = afs * 1.5;
                              return (
                                <div key={m.id} style={{ display:"flex",alignItems:"center",gap:afs*0.45,paddingLeft:afs*0.85,marginBottom:afs*0.2 }}>
                                  <div style={{ width:mCircleSize,height:mCircleSize,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.max(6,afs*0.9),fontWeight:700,flexShrink:0,fontFamily:"monospace" }}>{letter}</div>
                                  <span style={{ fontSize:afs,color:"#444",lineHeight:1.2 }}>{icon?.name||"—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Footer — même couleur que le header */}
      <div style={{ display:"flex",justifyContent:"space-between",padding:`${6*s}px ${24*s}px`,background:pal.primary,color:"rgba(255,255,255,0.6)",fontSize:9*s,flexShrink:0,flexWrap:"wrap",gap:8*s }}>
        <span><strong style={{ color:"#fff" }}>Version :</strong> {data.version || '—'}</span>
        <span><strong style={{ color:"#fff" }}>Format :</strong> {data.format} · {fmt.w}×{fmt.h}mm · Plan technique</span>
        <span><strong style={{ color:"#fff" }}>Ligne :</strong> {data.header.processName}</span>
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
  const [sidebarWidth, setSidebarWidth] = useState(360); // Largeur de la sidebar (redimensionnable)
  const sidebarDragRef = useRef(null); // état du drag de redimensionnement
  const fileRef = useRef(), logoRef = useRef(), bgRef = useRef(); // Refs pour les inputs file
  const previewContainerRef = useRef();
  const [previewSize, setPreviewSize] = useState({ w: 700, h: 500 });
  const [libDirHandle, setLibDirHandle] = useState(null);
  const [libFiles, setLibFiles] = useState([]);
  const [libSvgFiles, setLibSvgFiles] = useState([]);
  const [logoFiles, setLogoFiles] = useState([]);
  const [libExpanded, setLibExpanded] = useState({});
  const [electronLib, setElectronLib] = useState(null); // { path } si library Electron détectée
  const [appVersion, setAppVersion] = useState(null);  // version depuis l'API Electron
  const [previewMode, setPreviewMode] = useState('poster'); // 'poster' | 'plan'
  const [planTool, setPlanTool] = useState('zone');         // 'zone' | 'machine'
  const [planSelStep, setPlanSelStep] = useState(0);
  const [planSelMachine, setPlanSelMachine] = useState(null);
  const [planMachineMode, setPlanMachineMode] = useState('point'); // 'point' | 'arrow'
  const [saveModal, setSaveModal] = useState(null);     // { defaultName, onConfirm } ou null
  const [saveModalInput, setSaveModalInput] = useState('');
  const [versionNotice, setVersionNotice] = useState(null); // version du doc chargé si ≠ appVersion

  /** Mise à jour immutable du state : clone profond → mutation sur le clone → remplacement */
  const up = useCallback((fn) => setData(prev => produce(prev, fn)), []);

  useEffect(() => {
    if (window.__T_HTML) console.log('REACT_MOUNT +' + (Date.now() - window.__T_HTML) + 'ms depuis HTML parse');
    // Auto-détection Electron (API interne)
    fetch('/__api/version').then(r => r.ok ? r.json() : null).then(d => {
      if (d && d.version) { setAppVersion(d.version); up(doc => { if (!doc.version) doc.version = d.version; }); }
    }).catch(() => {});
    fetch('/__api/library').then(r => r.ok ? r.json() : null).then(d => {
      if (d && !d.error) {
        setElectronLib(d);
        setLibFiles(d.jsons || []);
        setLibSvgFiles(d.svgs || []);
      }
    }).catch(() => {});
    fetch('/__api/logos').then(r => r.ok ? r.json() : null).then(d => {
      if (d && d.logos) setLogoFiles(d.logos);
    }).catch(() => {});
  }, []);

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
    setSaveModalInput(defaultName);
    setSaveModal({ defaultName, onConfirm: (name) => {
      if (!name) return;
      const b = new Blob([JSON.stringify({...data, version: appVersion || data.version}, null, 2)], { type: "application/json" });
      const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${name}.json`; a.click(); URL.revokeObjectURL(u);
      setSaveModal(null);
    }});
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
    const prefix = previewMode === 'plan' ? 'plan' : 'affiche';
    const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = `${prefix}_${data.header.reference}.svg`; a.click(); URL.revokeObjectURL(u);
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
    const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
    const dataUrl = await toPng(el, { pixelRatio: (data.pdfResolution || 150) / (MM_PX * 25.4) });
    const orientation = fmt.w > fmt.h ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
    doc.addImage(dataUrl, "PNG", 0, 0, fmt.w, fmt.h);
    const prefix = previewMode === 'plan' ? 'plan' : 'affiche';
    doc.save(`${prefix}_${data.header.reference}.pdf`);
  };
  const exportPNG = async () => {
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
  /** Import JSON : lit un fichier .json et remplace le state complet. */
  const importJSON = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { applyLoaded(JSON.parse(ev.target.result)); } catch { alert("JSON invalide"); } }; r.readAsText(f); };

  /** Charge une image (logo ou bandeau) depuis un input file et la stocke en base64 dans le state. */
  const handleImg = (ref, key) => () => { const f = ref.current?.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up(d => { if (key === "logo") d.header.logoDataUrl = ev.target.result; else d.backgroundImage = ev.target.result; }); r.readAsDataURL(f); };

  const refreshLibrary = async (handle = libDirHandle) => {
    if (electronLib) {
      try {
        const r = await fetch('/__api/library');
        if (r.ok) { const d = await r.json(); setLibFiles(d.jsons || []); setLibSvgFiles(d.svgs || []); }
        const rl = await fetch('/__api/logos');
        if (rl.ok) { const dl = await rl.json(); setLogoFiles(dl.logos || []); }
      } catch {}
      return;
    }
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
    if (electronLib) {
      try {
        const r = await fetch('/__api/library/' + encodeURIComponent(name));
        if (!r.ok) return;
        const svgData = await r.text();
        up(d => {
          if (!d.icons) d.icons = [];
          if (!d.icons.find(ic => ic.name === name.replace(/\.svg$/i, '')))
            d.icons.push({ id: uid(), name: name.replace(/\.svg$/i, ''), description: '', svgData });
        });
      } catch {}
      return;
    }
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
  const libReady = electronLib || libDirHandle;
  const saveToLibrary = async () => {
    if (!libReady) return;
    const base = data.header.reference ? `affiche_${data.header.reference}` : "affiche";
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const maxV = libFiles.reduce((max, f) => {
      const m = f.match(new RegExp(`^${escaped}_(V(\\d+))\\.json$`, 'i'));
      return m ? Math.max(max, parseInt(m[2])) : max;
    }, 0);
    const suggested = `${base}_V${maxV + 1}`;
    setSaveModalInput(suggested);
    setSaveModal({ defaultName: suggested, onConfirm: async (nameInput) => {
      if (!nameInput) return;
      setSaveModal(null);
      if (electronLib) {
        await fetch('/__api/library/' + encodeURIComponent(nameInput + '.json'), {
          method: 'PUT', body: JSON.stringify({...data, version: appVersion || data.version}, null, 2)
        });
        await refreshLibrary();
        return;
      }
      const fh = await libDirHandle.getFileHandle(`${nameInput}.json`, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify({...data, version: appVersion || data.version}, null, 2));
      await w.close();
      await refreshLibrary();
    }});
  };
  const advanceId = (parsed) => {
    const nums = JSON.stringify(parsed).match(/"_(\d+)"/g) || [];
    const max = nums.reduce((m, s) => Math.max(m, parseInt(s.slice(2, -1))), _id - 1);
    if (max >= _id) _id = max + 1;
  };
  const applyLoaded = (parsed) => {
    advanceId(parsed);
    // Rétrocompatibilité : ajouter technicalPlan si absent
    if (!parsed.technicalPlan) parsed.technicalPlan = { zoneLabel:"number", views:[
      { id:"top", label:"Vue de dessus", imageDataUrl:null, stepZones:[], machineLabels:[] },
      { id:"side", label:"Vue de côté",  imageDataUrl:null, stepZones:[], machineLabels:[] },
    ]};
    if (!parsed.technicalPlan.zoneLabel) parsed.technicalPlan.zoneLabel = "number";
    if (parsed.technicalPlan.gridSize === undefined) parsed.technicalPlan.gridSize = 5;
    if (parsed.technicalPlan.legendFontSize === undefined) parsed.technicalPlan.legendFontSize = 9;
    parsed.technicalPlan.views.forEach(v => { if (v.enabled === undefined) v.enabled = true; });
    if (parsed.pdfResolution !== undefined && parsed.pdfResolution <= 10) parsed.pdfResolution = 150;
    // Migration ligne : ajouter next:[] (format DAG)
    if (parsed.line?.length && parsed.line.every(m => m.next === undefined)) {
      const byStep = {};
      parsed.line.forEach(m => { const k = m.stepId||'__none__'; if (!byStep[k]) byStep[k]=[]; byStep[k].push(m); });
      const orderedKeys = [...(parsed.steps||[]).map(s=>s.id).filter(k=>byStep[k]), ...(byStep['__none__']?['__none__']:[])];
      const byId = Object.fromEntries(parsed.line.map(m=>[m.id, {...m, next:[]}]));
      orderedKeys.forEach((key, ki) => {
        const zone = byStep[key];
        zone.forEach((m,mi) => { if (mi < zone.length-1) byId[m.id].next=[zone[mi+1].id]; });
        if (ki < orderedKeys.length-1) byId[zone[zone.length-1].id].next=[byStep[orderedKeys[ki+1]][0].id];
      });
      parsed.line = Object.values(byId);
    } else if (parsed.line) {
      parsed.line = parsed.line.map(m => ({...m, next: m.next||[]}));
    }
    // Migration machineLabels : lineIndex → lineId
    parsed.technicalPlan?.views?.forEach(v => {
      v.machineLabels = (v.machineLabels||[]).map(m => {
        if (m.lineId !== undefined) return m;
        const item = (parsed.line||[])[m.lineIndex];
        return {...m, lineId: item?.id||null, lineIndex: undefined};
      });
    });
    setData(parsed);
    if (parsed.version && appVersion && parsed.version !== appVersion)
      setVersionNotice(parsed.version);
    else setVersionNotice(null);
  };
  const loadFromLibrary = async (name) => {
    if (electronLib) {
      try {
        const r = await fetch('/__api/library/' + encodeURIComponent(name));
        if (r.ok) { applyLoaded(JSON.parse(await r.text())); } else { alert('Fichier introuvable'); }
      } catch { alert('Erreur de lecture'); }
      return;
    }
    if (!libDirHandle) return;
    const fh = await libDirHandle.getFileHandle(name);
    const file = await fh.getFile();
    try { applyLoaded(JSON.parse(await file.text())); } catch { alert('JSON invalide'); }
  };
  const deleteFromLibrary = async (name) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    if (electronLib) {
      await fetch('/__api/library/' + encodeURIComponent(name), { method: 'DELETE' });
      await refreshLibrary();
      return;
    }
    if (!libDirHandle) return;
    await libDirHandle.removeEntry(name);
    await refreshLibrary();
  };

  /** Définition des onglets de la sidebar */
  const tabs = [{ key:"header",label:"En-tête",icon:"◆" },{ key:"format",label:"Format",icon:"⊞" },{ key:"entree",label:"Entrée",icon:"▶" },{ key:"steps",label:"Process",icon:"⚙" },{ key:"sortie",label:"Sortie",icon:"◀" },{ key:"line",label:"Ligne",icon:"🏭" },{ key:"plan",label:"Plan",icon:"📐" },{ key:"export",label:"Export",icon:"↗" },{ key:"library",label:"Biblio",icon:"📚" }];

  return (
    <div style={{ display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#212121",overflow:"hidden" }}>
      {/* ── Sidebar d'édition (redimensionnable, rétractable) ── */}
      <div style={{ width:sidebarOpen?sidebarWidth:0,minWidth:sidebarOpen?sidebarWidth:0,transition:"width 0.2s,min-width 0.2s",display:"flex",flexDirection:"column",background:"#fff",overflow:"hidden" }}>
        {sidebarOpen && <>
          <div style={{ padding:"12px 14px",borderBottom:"1px solid #e0e0e0",background:"#C8102E",color:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div><div style={{ fontSize:14,fontWeight:700 }}>Éditeur d'affiche</div><div style={{ fontSize:10,opacity:0.8 }}>Ligne de production</div></div>
            <button onClick={()=>{if(confirm("Créer un nouveau document vide ?")){ _id=120; setVersionNotice(null); setData({...emptyData(), version: appVersion||""}); }}} style={{ background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.4)",color:"#fff",borderRadius:5,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600 }}>Nettoyer</button>
          </div>
          <div style={{ display:"flex",flexWrap:"wrap",borderBottom:"1px solid #e0e0e0" }}>
            {tabs.map(t=><button key={t.key} onClick={()=>setTab(t.key)} style={{ flex:1,minWidth:56,padding:"8px 4px",border:"none",borderBottom:tab===t.key?"2.5px solid #C8102E":"2.5px solid transparent",background:tab===t.key?"#FFF5F5":"transparent",color:tab===t.key?"#C8102E":"#888",fontSize:10,fontWeight:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1 }}><span style={{ fontSize:14 }}>{t.icon}</span>{t.label}</button>)}
          </div>
          <div style={{ flex:1,overflowY:"auto",padding:12,zoom:Math.min(1.8,Math.max(1,sidebarWidth/360)).toFixed(3) }}>
            {versionNotice && (
              <div style={{ marginBottom:8,padding:"8px 12px",background:"#FFF3E0",border:"1px solid #FF9800",borderRadius:6,fontSize:11,color:"#E65100",display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ flex:1 }}>⚠ Document créé avec v{versionNotice} — version actuelle : v{appVersion}</span>
                <span onClick={()=>setVersionNotice(null)} style={{ cursor:"pointer",opacity:0.5,fontSize:13 }}>✕</span>
              </div>
            )}
            {saveModal && (
              <div style={{ marginBottom:8,padding:"10px 12px",background:"#FFFDE7",border:"1px solid #F9A825",borderRadius:7,display:"flex",flexDirection:"column",gap:8 }}>
                <label style={{ fontSize:11,fontWeight:600,color:"#555" }}>Nom du fichier (sans extension)</label>
                <input autoFocus value={saveModalInput} onChange={e=>setSaveModalInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") saveModal.onConfirm(saveModalInput); if(e.key==="Escape") setSaveModal(null); }}
                  style={{ fontSize:12,padding:"5px 8px",border:"1px solid #ddd",borderRadius:5,outline:"none" }} />
                <div style={{ display:"flex",gap:6 }}>
                  <Btn onClick={()=>saveModal.onConfirm(saveModalInput)} style={{ flex:1 }}>✓ Confirmer</Btn>
                  <Btn outline color="#888" onClick={()=>setSaveModal(null)}>Annuler</Btn>
                </div>
              </div>
            )}
            {tab === "header" && (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Palette de couleurs</label>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5 }}>
                  {PALETTES.map(p=>{const sel=(data.palette||"nexans")===p.id;return(
                    <div key={p.id} onClick={()=>up(d=>{d.palette=p.id;})} title={p.name}
                      style={{ borderRadius:6,overflow:"hidden",cursor:"pointer",border:sel?"2px solid #212121":"2px solid transparent",boxShadow:sel?"0 0 0 1px #212121":"none" }}>
                      <div style={{ height:16,background:p.primary }} />
                      <div style={{ height:7,background:`linear-gradient(to right,${p.zoneFrom},${p.zoneTo})` }} />
                      <div style={{ fontSize:8,padding:"2px 3px",textAlign:"center",background:"#fafafa",color:"#444",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:sel?700:400 }}>{p.name}</div>
                    </div>
                  );})}
                </div>
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Référence</label><Input value={data.header.reference} onChange={v=>up(d=>{d.header.reference=v;})} />
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Nom du process</label><Input value={data.header.processName} onChange={v=>up(d=>{d.header.processName=v;})} />
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Sous-titre</label><Input value={data.header.subtitle} onChange={v=>up(d=>{d.header.subtitle=v;})} />
                <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Logo</label>
                {logoFiles.length > 0 && (
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,padding:6,background:"#f5f5f5",borderRadius:6 }}>
                    {logoFiles.map(name => (
                      <img key={name} src={'/__api/logos/' + encodeURIComponent(name)} title={name}
                        onClick={async () => { try { const r = await fetch('/__api/logos/' + encodeURIComponent(name)); const b = await r.blob(); const fr = new FileReader(); fr.onload = e => up(d => { d.header.logoDataUrl = e.target.result; }); fr.readAsDataURL(b); } catch {} }}
                        style={{ height:40,objectFit:"contain",cursor:"pointer",borderRadius:4,border:"2px solid transparent",background:"#fff",padding:2 }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#C8102E"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="transparent"}
                      />
                    ))}
                  </div>
                )}
                <input ref={logoRef} type="file" accept="image/*" onChange={handleImg(logoRef,"logo")} style={{ fontSize:11 }} />
                {data.header.logoDataUrl && <Btn small outline color="#d32f2f" onClick={()=>up(d=>{d.header.logoDataUrl=null;})}>Supprimer</Btn>}
                <label style={{ fontSize:11,fontWeight:600,color:"#666",marginTop:6 }}>Image bandeau</label>
                <div style={{ fontSize:10,color:"#999" }}>S'affiche entre le contenu et le footer, sans déformation.</div>
                <input ref={bgRef} type="file" accept="image/*" onChange={handleImg(bgRef,"bg")} style={{ fontSize:11 }} />
                {data.backgroundImage && <Btn small outline color="#d32f2f" onClick={()=>up(d=>{d.backgroundImage=null;})}>Supprimer</Btn>}
                {(data.backgroundImage || (data.line||[]).length > 0) && (
                  <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
                    <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Hauteur de la zone bandeau</label>
                    <div style={{ fontSize:10,color:"#999",marginBottom:4 }}>Bord inférieur fixe — le bord supérieur monte avec le réglage</div>
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
            {tab === "line" && <LineEditor icons={data.icons||[]} line={data.line||[]} steps={data.steps} onChange={({icons,line})=>up(d=>{d.icons=icons;d.line=line;})} libSvgFiles={libSvgFiles} onLoadSvg={loadSvgFromLib} />}
            {tab === "plan" && <TechnicalPlanEditor data={data} up={up} planTool={planTool} setPlanTool={setPlanTool} planSelStep={planSelStep} setPlanSelStep={setPlanSelStep} planSelMachine={planSelMachine} setPlanSelMachine={setPlanSelMachine} planMachineMode={planMachineMode} setPlanMachineMode={setPlanMachineMode} />}
            {tab === "export" && (
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {/* Choix de ce qui est exporté */}
                <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
                  <div style={{ fontSize:11,fontWeight:600,color:"#666",marginBottom:6 }}>Exporter :</div>
                  <div style={{ display:"flex",gap:6 }}>
                    {[['poster','🗂 Affiche visuelle'],['plan','📐 Plan technique']].map(([k,l])=>(
                      <button key={k} onClick={()=>setPreviewMode(k)} style={{ flex:1,padding:"6px 8px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:previewMode===k?"2px solid #C8102E":"1.5px solid #ddd",background:previewMode===k?"#FFF5F5":"#fff",color:previewMode===k?"#C8102E":"#666" }}>{l}</button>
                    ))}
                  </div>
                  <div style={{ fontSize:10,color:"#999",marginTop:4 }}>L'export capture ce qui est affiché dans l'aperçu.</div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8,fontSize:11,color:"#666",lineHeight:1.6 }}><strong style={{ color:"#424242" }}>Formats :</strong><br/>• <strong>JSON</strong> — Sauvegarde ré-importable<br/>• <strong>SVG</strong> — Vectoriel (Illustrator / Inkscape)<br/>• <strong>PNG</strong> — Image haute résolution<br/>• <strong>PDF</strong> — Document imprimable</div>
                <Btn onClick={exportJSON}>↓ Exporter JSON</Btn>
                <Btn onClick={exportSVG} color="#E87722">↓ Exporter SVG</Btn>
                <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Résolution export (PNG / PDF)</label>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:6 }}>
                    {[{v:72,l:"72 DPI"},{v:150,l:"150 DPI"},{v:300,l:"300 DPI (impression)"},{v:400,l:"400 DPI"}].map(r=><button key={r.v} onClick={()=>up(d=>{d.pdfResolution=r.v;})} style={{ padding:"5px 10px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:(data.pdfResolution||150)===r.v?"2px solid #1565C0":"1.5px solid #ddd",background:(data.pdfResolution||150)===r.v?"#E3F2FD":"#fff",color:(data.pdfResolution||150)===r.v?"#1565C0":"#666" }}>{r.l}</button>)}
                  </div>
                  <div style={{ fontSize:10,color:"#999",marginTop:4 }}>Sur A1 : 72 DPI → ~2385×1685 px · 150 DPI → ~4965×3508 px · 300 DPI → ~9930×7016 px (lourd sur A0/A1).</div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <Btn onClick={exportPNG} color="#2E7D32" style={{ flex:1 }}>↓ Exporter PNG</Btn>
                  <Btn onClick={exportPDF} color="#1565C0" style={{ flex:1 }}>↓ Exporter PDF</Btn>
                </div>
                <div style={{ borderTop:"1px solid #e0e0e0",paddingTop:12 }}><label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Importer JSON</label><input ref={fileRef} type="file" accept=".json" onChange={importJSON} style={{ fontSize:11,marginTop:4 }} /></div>
                <Btn outline color="#d32f2f" onClick={()=>{if(confirm("Réinitialiser ?")){ setVersionNotice(null); setData({...defaultData(), version: appVersion||""}); }}}>↺ Réinitialiser</Btn>
              </div>
            )}
            {tab === "library" && (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {!libReady ? (
                  <>
                    <div style={{ padding:12,background:"#f5f5f5",borderRadius:8,fontSize:11,color:"#666",lineHeight:1.6 }}>Choisis le dossier <strong>library/</strong> du projet pour sauvegarder et charger des affiches JSON.</div>
                    <Btn onClick={openLibraryDir} color="#555">📁 Choisir le dossier library/</Btn>
                  </>
                ) : (
                  <>
                    <div style={{ display:"flex",gap:6 }}>
                      <Btn onClick={saveToLibrary} style={{ flex:1 }}>💾 Sauvegarder</Btn>
                      <Btn outline color="#888" onClick={()=>refreshLibrary()}>↺</Btn>
                      {!electronLib && <Btn outline color="#555" onClick={openLibraryDir}>📁</Btn>}
                    </div>
                    <div style={{ fontSize:10,color:"#999",padding:"0 2px" }}>📂 {electronLib ? electronLib.path : libDirHandle.name}/</div>
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
        {appVersion && <div style={{ padding:"8px 16px",borderTop:"1px solid #eee",fontSize:10,color:"#bbb",textAlign:"center" }}>Nexans Affiche v{appVersion}</div>}
      </div>
      {/* ── Poignée de redimensionnement de la sidebar ── */}
      {sidebarOpen && <div
        onMouseDown={e=>{e.preventDefault();const startX=e.clientX,startW=sidebarWidth;const onMove=ev=>{setSidebarWidth(Math.max(260,Math.min(700,startW+(ev.clientX-startX))));};const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);}}
        style={{ width:6,flexShrink:0,cursor:"ew-resize",background:"transparent",borderRight:"1px solid #e0e0e0" }}
      />}
      {/* ── Zone d'aperçu (droite) ── */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ display:"flex",alignItems:"center",padding:"8px 16px",borderBottom:"1px solid #e0e0e0",background:"#fafafa",gap:12 }}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ border:"1px solid #ddd",borderRadius:5,background:"#fff",padding:"4px 10px",cursor:"pointer",fontSize:14 }}>{sidebarOpen?"◁":"▷"}</button>
          <span style={{ fontSize:13,fontWeight:600,color:"#555" }}>Aperçu</span>
          <div style={{ display:"flex",gap:4,marginLeft:12 }}>
            {[['poster','Affiche'],['plan','Plan technique']].map(([k,l])=>(
              <button key={k} onClick={()=>setPreviewMode(k)} style={{ padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:previewMode===k?"2px solid #C8102E":"1.5px solid #ddd",background:previewMode===k?"#FFF5F5":"#fff",color:previewMode===k?"#C8102E":"#888" }}>{l}</button>
            ))}
          </div>
          <span style={{ fontSize:10,color:"#aaa",marginLeft:"auto" }}>{data.header.reference} — {data.format}{appVersion ? ` — v${appVersion}` : ''}</span>
        </div>
        {/* Poster / Plan technique rendu à taille réelle puis réduit par transform: scale() */}
        {(()=>{const sel=FORMATS[data.format]||{w:data.customW,h:data.customH};const pad=48;const posterW=Math.round(sel.w*MM_PX);const posterH=Math.round(sel.h*MM_PX);const sc=Math.min((previewSize.w-pad)/posterW,(previewSize.h-pad)/posterH);return <div ref={previewContainerRef} style={{ flex:1,overflow:"hidden",background:"#e8e8e8",display:"flex",justifyContent:"center",alignItems:"center" }}><div style={{ transform:`scale(${sc.toFixed(3)})`,transformOrigin:"center center" }}>{previewMode==='plan'
  ? <TechnicalPlanPreview data={data} appVersion={appVersion} interactive={true} planTool={planTool} planSelStep={planSelStep} planSelMachine={planSelMachine} planMachineMode={planMachineMode}
      onAddZone={(vi,zone)=>up(d=>{d.technicalPlan.views[vi].stepZones.push({id:uid(),...zone});})}
      onAddLabel={(vi,label)=>up(d=>{d.technicalPlan.views[vi].machineLabels.push({id:uid(),...label});})}
      onUpdateZone={(vi,zoneId,patch)=>up(d=>{const z=d.technicalPlan.views[vi].stepZones.find(z=>z.id===zoneId);if(z)Object.assign(z,patch);})}
      onUpdateLabel={(vi,labelId,patch)=>up(d=>{const m=d.technicalPlan.views[vi].machineLabels.find(m=>m.id===labelId);if(m)Object.assign(m,patch);})} />
  : <PosterPreview data={data} appVersion={appVersion} />}</div></div>;})()}
      </div>
      {/* Styles d'impression : masque la sidebar et supprime le scaling pour imprimer le poster en taille réelle */}
      <style>{`@media print{body>div>div:first-child,[style*="borderBottom"]{display:none!important}[style*="overflow: auto"]{overflow:visible!important;padding:0!important;background:white!important}[style*="transform"]{transform:none!important}}`}</style>
    </div>
  );
}
