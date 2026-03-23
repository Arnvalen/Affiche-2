import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

/* ═══════════════════ CONSTANTS ═══════════════════ */
const TAG_TYPES = ["SWI", "IC", "LC", "AQE"];
const TAG_COLORS = {
  SWI: { bg: "#FFEBEE", color: "#C62828", border: "#EF9A9A" },
  IC:  { bg: "#FFF3E0", color: "#E65100", border: "#FFCC80" },
  PC:  { bg: "#E3F2FD", color: "#1565C0", border: "#90CAF9" },
  LC:  { bg: "#E8F5E9", color: "#2E7D32", border: "#A5D6A7" },
  AQE: { bg: "#F3E5F5", color: "#6A1B9A", border: "#CE93D8" },
};
const TAG_LABELS = { SWI: "Standard Work Instruction", IC: "Instruction de contrôle", PC: "Point de contrôle", LC: "Liste de contrôle", AQE: "Appareil qualité embarqué" };
const FORMATS = { "A0-paysage":{w:1189,h:841},"A1-paysage":{w:841,h:594},"A2-paysage":{w:594,h:420},"A3-paysage":{w:420,h:297},"A4-paysage":{w:297,h:210},"A0-portrait":{w:841,h:1189},"A1-portrait":{w:594,h:841},"A2-portrait":{w:420,h:594},"A3-portrait":{w:297,h:420},"A4-portrait":{w:210,h:297},"Personnalisé":{w:800,h:500} };
const MM_PX = 1.4;
let _id = 100; const uid = () => `_${_id++}`;

/* ═══════════════════ QR SVG COMPONENT ═══════════════════ */
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
const Tag = ({ type, small, scale = 1 }) => {
  const c = TAG_COLORS[type]; const sz = (small ? 8 : 10) * scale;
  return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,padding:`${(small?1:2)*scale}px ${(small?4:6)*scale}px`,borderRadius:3,background:c.bg,color:c.color,border:`1.5px solid ${c.border}`,letterSpacing:0.5 }}>{type}</span>;
};

const TagWithQR = ({ tag, scale, qrSize }) => {
  const c = TAG_COLORS[tag.type]; const sz = 8 * scale; const qrPx = qrSize * scale;
  const hasUrl = tag.url && tag.url.trim().length > 0;
  if (!hasUrl) return <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,padding:`${1*scale}px ${4*scale}px`,borderRadius:3,background:c.bg,color:c.color,border:`1.5px solid ${c.border}`,letterSpacing:0.5 }}>{tag.type}</span>;
  return (
    <div style={{ display:"inline-flex",flexDirection:"column",alignItems:"center",gap:2*scale,border:`2px solid ${c.border}`,borderRadius:4,padding:3*scale,background:c.bg }}>
      <span style={{ fontFamily:"'Courier New',monospace",fontSize:sz,fontWeight:700,color:c.color,letterSpacing:0.5,lineHeight:1 }}>{tag.type}</span>
      <QRCodeSVG url={tag.url} size={qrPx} bgColor={c.bg} />
    </div>
  );
};

/* ═══════════════════ UI PRIMITIVES ═══════════════════ */
const Btn = ({ children, onClick, color="#C8102E", small, outline, style:st, ...r }) => <button onClick={onClick} style={{ display:"inline-flex",alignItems:"center",gap:4,padding:small?"3px 8px":"6px 12px",borderRadius:5,border:outline?`1.5px solid ${color}`:"none",background:outline?"transparent":color,color:outline?color:"#fff",fontSize:small?11:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",...st }} {...r}>{children}</button>;
const Input = ({ value, onChange, placeholder, style:st, ...r }) => <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:"100%",padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit",outline:"none",...st }} {...r} />;
const SectionCard = ({ title, children, actions, defaultOpen=true }) => { const [open,setOpen]=useState(defaultOpen); return <div style={{background:"#fff",borderRadius:8,border:"1px solid #e0e0e0",overflow:"hidden",marginBottom:10}}><div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#f5f5f5",cursor:"pointer",userSelect:"none"}}><span style={{fontSize:12,fontWeight:700,color:"#424242"}}>{open?"▾":"▸"} {title}</span>{actions&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}>{actions}</div>}</div>{open&&<div style={{padding:10}}>{children}</div>}</div>; };

/* ═══════════════════ TAG EDITOR ═══════════════════ */
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
const StepsEditor = ({ steps, onChange }) => {
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
              {!op.isControlPoint && <TagEditor tags={op.tags} onChange={tags=>up(d=>{d.find(x=>x.id===step.id).operations.find(o=>o.id===op.id).tags=tags;})} />}
            </div>
          ))}
          <Btn small outline color="#888" onClick={()=>up(d=>{d.find(x=>x.id===step.id).operations.push({id:uid(),name:"Opération",tags:[]});})}>+ Opération</Btn>
          <Btn small outline color="#1565C0" onClick={()=>up(d=>{d.find(x=>x.id===step.id).operations.push({id:uid(),isControlPoint:true,name:"Point de contrôle"});})}>+ PC</Btn>
        </SectionCard>
      ))}
      <Btn onClick={()=>up(d=>d.push({id:uid(),title:"Nouvelle étape",tags:[],operations:[]}))} style={{ alignSelf:"flex-start" }}>+ Étape process</Btn>
    </div>
  );
};

/* ═══════════════════ BOOKEND PANEL (Preview) ═══════════════════ */
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
              <div key={item.id} style={{ background:"rgba(255,255,255,0.7)",borderRadius:4,padding:`${5*s}px ${7*s}px`,marginBottom:3*s }}>
                <div style={{ fontSize:10*s,fontWeight:500,color:"#424242",marginBottom:2*s,lineHeight:1.2 }}>{item.name}</div>
                {renderTags(item.tags)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════ POSTER PREVIEW ═══════════════════ */
const PosterPreview = ({ data }) => {
  const fmt = FORMATS[data.format] || { w: data.customW, h: data.customH };
  const posterW = Math.round(fmt.w * MM_PX), posterH = Math.round(fmt.h * MM_PX);
  const s = data.fontScale || 1, qrSize = data.qrSize || 32;
  const isPortrait = fmt.h > fmt.w;
  const totalSteps = data.steps.length;
  const maxCols = data.maxCols > 0 ? data.maxCols : Math.min(totalSteps, isPortrait ? 3 : 4);
  const rows = []; for (let i = 0; i < totalSteps; i += maxCols) rows.push(data.steps.slice(i, i + maxCols));

  const bookendW = data.bookendWidth || 220;

  const renderTags = (tags) => <div style={{ display:"flex",gap:3*s,flexWrap:"wrap",alignItems:"center" }}>{tags.map(t=><TagWithQR key={t.id} tag={t} scale={s} qrSize={qrSize} />)}</div>;
  const renderTagsPlain = (tags) => <div style={{ display:"flex",gap:3*s,flexWrap:"wrap",alignItems:"center" }}>{tags.map(t=><Tag key={t.id} type={t.type} small scale={s} />)}</div>;

  const renderStep = (step, si) => (
    <div key={step.id} style={{ flex:"1 1 0%",minWidth:0,borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column",border:"1.5px solid #e0e0e0" }}>
      <div style={{ display:"flex",alignItems:"center",gap:8*s,padding:`${7*s}px ${12*s}px`,background:"#212121",color:"#fff" }}>
        <div style={{ fontFamily:"monospace",fontSize:14*s,fontWeight:700,background:"#E87722",color:"#fff",width:22*s,height:22*s,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{si+1}</div>
        <div style={{ flex:1,display:"flex",alignItems:"center",gap:4*s,minWidth:0 }}>
          <div style={{ fontSize:11*s,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{step.title}</div>
          {(step.tags || []).length > 0 && renderTags(step.tags || [])}
        </div>
      </div>
      <div style={{ flex:1,padding:8*s,display:"flex",flexDirection:"column",gap:5*s,background:"#fff" }}>
        {step.operations.map((item, idx) => {
          if (item.isControlPoint) {
            return (
              <div key={item.id} style={{ display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,padding:`${6*s}px ${12*s}px`,fontSize:12*s,fontWeight:700,color:"#1565C0",background:"#E3F2FD",border:"2px solid #90CAF9",textTransform:"uppercase",letterSpacing:1 }}>
                {item.name}
              </div>
            );
          } else {
            const operLetterIndex = step.operations.slice(0, idx).filter(o => !o.isControlPoint).length;
            const operationLetter = String.fromCharCode(65 + operLetterIndex);
            return (
              <div key={item.id} style={{ background:"#fafafa",border:"1px solid #eee",borderRadius:4,padding:`${6*s}px ${8*s}px`,display:"flex",flexDirection:"column",gap:3*s }}>
                <div style={{ display:"flex",alignItems:"center",gap:6*s }}>
                  <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontSize:9*s,fontWeight:900,padding:`${2*s}px ${4*s}px`,borderRadius:"50%",border:"2.5px solid #000",background:"#fafafa",color:"#000",minWidth:24*s,height:24*s,flexShrink:0 }}>{operationLetter}</span>
                  <div style={{ fontSize:10*s,fontWeight:600,color:"#424242" }}>{item.name}</div>
                </div>
                {renderTagsPlain(item.tags)}
              </div>
            );
          }
        })}
      </div>
    </div>
  );

  const renderRow = (rowSteps, ri) => (
    <div key={ri} style={{ display:"flex",gap:10*s,width:"100%" }}>
      {rowSteps.map((step, ci) => renderStep(step, ri * maxCols + ci))}
      {rowSteps.length < maxCols && Array.from({ length: maxCols - rowSteps.length }).map((_, k) => <div key={`e${k}`} style={{ flex:"1 1 0%",minWidth:0 }} />)}
    </div>
  );

  const rowConn = <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:`${2*s}px 0`,color:"#ccc" }}><svg width={18*s} height={18*s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 16.59L6.41 11 5 12.41 12 19.41 19 12.41 17.59 11z"/></svg></div>;
  const arrowSt = { display:"flex",alignItems:"center",justifyContent:"center",width:20*s,minWidth:20*s,color:"#bbb",fontSize:18*s,flexShrink:0 };

  const forceH = data.forceFormat;

  return (
    <div data-poster-root="1" style={{ width:posterW, ...(forceH ? {height:posterH} : {minHeight:posterH}), fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",background:"#fff",borderRadius:6,overflow:forceH?"hidden":"visible",boxShadow:"0 2px 16px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column", position:"relative", ...(forceH ? {outline:"2px dashed #C8102E",outlineOffset:-2} : {}) }}>
      {/* Format lock indicator */}
      {forceH && <div style={{ position:"absolute",top:4,right:4,background:"#C8102E",color:"#fff",fontSize:8*s,padding:`${1*s}px ${4*s}px`,borderRadius:3,fontWeight:700,opacity:0.7,zIndex:10 }}>FORMAT FIXE</div>}

      {/* Header */}
      <div style={{ background:"#C8102E",color:"#fff",display:"flex",alignItems:"flex-start",padding:`0 ${24*s}px`,height:56*s,gap:20*s,flexShrink:0,paddingTop:4*s }}>
        <div style={{ borderRight:"2px solid rgba(255,255,255,0.3)",paddingRight:20*s,display:"flex",flexDirection:"column",gap:2*s }}>
          <span style={{ fontSize:8*s,textTransform:"uppercase",letterSpacing:1.5,opacity:0.8 }}>Référence</span>
          <strong style={{ fontFamily:"monospace",fontSize:24*s,fontWeight:700 }}>{data.header.reference}</strong>
        </div>
        <div style={{ flex:1,display:"flex",flexDirection:"column",gap:2*s }}>
          <span style={{ fontSize:8*s,textTransform:"uppercase",letterSpacing:1.5,opacity:0.8 }}>Process</span>
          <div style={{ fontSize:16*s,fontWeight:700 }}>{data.header.processName}</div>
          <div style={{ fontSize:10*s,opacity:0.85 }}>{data.header.subtitle}</div>
        </div>
        {data.header.logoDataUrl ? <img src={data.header.logoDataUrl} alt="" style={{ height:40*s,objectFit:"contain" }} /> : (
          <div style={{ textAlign:"right" }}><div style={{ fontSize:22*s,fontWeight:700,letterSpacing:2 }}>Nexans</div><div style={{ fontSize:7*s,textTransform:"uppercase",letterSpacing:2,opacity:0.7 }}>Electrify the future</div></div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display:"flex",alignItems:"center",gap:14*s,padding:`${6*s}px ${24*s}px`,background:"#fafafa",borderBottom:"1px solid #e0e0e0",fontSize:10*s,flexWrap:"wrap",flexShrink:0 }}>
        <span style={{ fontWeight:600,color:"#757575" }}>Légende :</span>
        {TAG_TYPES.map(t=><span key={t} style={{ display:"inline-flex",alignItems:"center",gap:4*s }}><Tag type={t} small scale={s} /> <span style={{ color:"#666" }}>{TAG_LABELS[t]}</span></span>)}
      </div>

      {/* Main */}
      <div style={{ display:"flex",padding:`${14*s}px ${16*s}px`,gap:10*s,alignItems:"stretch",flex:1 }}>
        <BookendPanel bookendData={data.entree} type="entree" s={s} qrSize={qrSize} width={bookendW} />
        <div style={arrowSt}>›</div>
        <div style={{ flex:1,display:"flex",flexDirection:"column",gap:0,minWidth:0 }}>
          {rows.map((rowSteps, ri) => <div key={ri}>{ri > 0 && rowConn}{renderRow(rowSteps, ri)}</div>)}
        </div>
        <div style={arrowSt}>›</div>
        <BookendPanel bookendData={data.sortie} type="sortie" s={s} qrSize={qrSize} width={bookendW} />
      </div>

      {/* Background image — propre bloc, sans déformation */}
      {data.backgroundImage && (()=>{const bh=posterH*((data.bgImageHeight||25)/100);return(
        <div style={{ flexShrink:0,width:"100%",display:"flex",justifyContent:"center",alignItems:"center",background:"#f0f0f0",height:bh,overflow:"hidden" }}>
          <img src={data.backgroundImage} alt="" style={{ maxWidth:"100%",maxHeight:bh,objectFit:"contain",display:"block" }} />
        </div>
      );})()}

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
const defaultData = () => ({
  header: { reference: "37019", processName: "Extrusion mono-couche", subtitle: "Fil isolé coloré", logoDataUrl: null },
  format: "A1-paysage", customW: 800, customH: 500, maxCols: 0, fontScale: 1, qrSize: 32, forceFormat: false, bookendWidth: 220, bgImageHeight: 25, pdfResolution: 3,
  entree: { tags: [], sections: [
    { id: uid(), title: "Matière", items: [
      { id: uid(), name: "Fil de cuivre", tags: [{ id: uid(), type: "IC", url: "https://nexans.com/ic-cuivre" }, { id: uid(), type: "PC", url: "" }] },
      { id: uid(), name: "HDPE", tags: [{ id: uid(), type: "IC", url: "" }] },
      { id: uid(), name: "Colorants", tags: [{ id: uid(), type: "IC", url: "" }] },
    ]},
    { id: uid(), title: "Informations", items: [
      { id: uid(), name: "OF / Planning", tags: [{ id: uid(), type: "SWI", url: "" }] },
      { id: uid(), name: "Recette", tags: [{ id: uid(), type: "SWI", url: "https://nexans.com/swi-recette" }, { id: uid(), type: "IC", url: "" }] },
    ]},
  ]},
  steps: [
    { id: uid(), title: "Fil de cuivre nu", tags: [], operations: [
      { id: uid(), name: "Dévidoir", tags: [{ id: uid(), type: "SWI", url: "" }, { id: uid(), type: "IC", url: "" }] },
      { id: uid(), name: "Soudure", tags: [{ id: uid(), type: "SWI", url: "" }, { id: uid(), type: "IC", url: "" }] },
      { id: uid(), name: "Redressage", tags: [{ id: uid(), type: "SWI", url: "" }] },
      { id: uid(), name: "Préchauffeur", tags: [{ id: uid(), type: "SWI", url: "" }, { id: uid(), type: "IC", url: "" }, { id: uid(), type: "PC", url: "" }] },
    ]},
    { id: uid(), title: "Extrusion", tags: [{ id: uid(), type: "SWI", url: "https://nexans.com/swi-extrusion" }, { id: uid(), type: "IC", url: "" }], operations: [
      { id: uid(), name: "Alim. HDPE", tags: [{ id: uid(), type: "SWI", url: "" }, { id: uid(), type: "IC", url: "" }] },
      { id: uid(), name: "Alim. colorant", tags: [{ id: uid(), type: "SWI", url: "" }, { id: uid(), type: "IC", url: "" }] },
      { id: uid(), isControlPoint: true, name: "Point de contrôle" },
      { id: uid(), name: "Dosage", tags: [{ id: uid(), type: "IC", url: "" }] },
    ]},
    { id: uid(), title: "Refroidissement", tags: [], operations: [
      { id: uid(), name: "Contrôle qualité", tags: [{ id: uid(), type: "AQE", url: "" }] },
      { id: uid(), isControlPoint: true, name: "Vérification" },
      { id: uid(), name: "Liste de contrôle", tags: [{ id: uid(), type: "LC", url: "" }] },
    ]},
  ],
  sortie: { tags: [], sections: [
    { id: uid(), title: "Matière", items: [
      { id: uid(), name: "Fil isolé", tags: [{ id: uid(), type: "IC", url: "" }] },
      { id: uid(), name: "Fil coloré", tags: [{ id: uid(), type: "IC", url: "" }] },
    ]},
    { id: uid(), title: "Informations", items: [
      { id: uid(), name: "SAP / MES", tags: [{ id: uid(), type: "LC", url: "" }] },
      { id: uid(), name: "Checklist", tags: [{ id: uid(), type: "LC", url: "" }] },
      { id: uid(), name: "Carte bobine", tags: [{ id: uid(), type: "IC", url: "" }] },
    ]},
    { id: uid(), title: "Protocoles", items: [
      { id: uid(), name: "Qualité", tags: [{ id: uid(), type: "LC", url: "" }, { id: uid(), type: "AQE", url: "" }] },
    ]},
  ]},
  backgroundImage: null,
});

/* ═══════════════════ MAIN APP ═══════════════════ */
export default function App() {
  const [data, setData] = useState(defaultData);
  const [tab, setTab] = useState("header");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileRef = useRef(), logoRef = useRef(), bgRef = useRef();
  const up = useCallback((fn) => setData(prev => { const d = JSON.parse(JSON.stringify(prev)); fn(d); return d; }), []);

  const exportJSON = () => { const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `affiche_${data.header.reference}.json`; a.click(); URL.revokeObjectURL(u); };

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
  const exportPDF = async () => {
    const el = document.querySelector("[data-poster-root]");
    if (!el) return;
    const fmt = FORMATS[data.format] || { w: data.customW, h: data.customH };
    const dataUrl = await toPng(el, { pixelRatio: data.pdfResolution || 3 });
    const orientation = fmt.w > fmt.h ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation, unit: "mm", format: [fmt.w, fmt.h] });
    doc.addImage(dataUrl, "PNG", 0, 0, fmt.w, fmt.h);
    doc.save(`affiche_${data.header.reference}.pdf`);
  };
  const importJSON = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { setData(JSON.parse(ev.target.result)); } catch { alert("JSON invalide"); } }; r.readAsText(f); };
  const handleImg = (ref, key) => () => { const f = ref.current?.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up(d => { if (key === "logo") d.header.logoDataUrl = ev.target.result; else d.backgroundImage = ev.target.result; }); r.readAsDataURL(f); };

  const tabs = [{ key:"header",label:"En-tête",icon:"◆" },{ key:"format",label:"Format",icon:"⊞" },{ key:"entree",label:"Entrée",icon:"▶" },{ key:"steps",label:"Process",icon:"⚙" },{ key:"sortie",label:"Sortie",icon:"◀" },{ key:"export",label:"Export",icon:"↗" }];

  return (
    <div style={{ display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#212121",overflow:"hidden" }}>
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
                  <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:6 }}><span style={{ fontSize:10,color:"#888" }}>0.5</span><input type="range" min="0.5" max="3" step="0.1" value={data.fontScale} onChange={e=>up(d=>{d.fontScale=parseFloat(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>3</span></div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}><span style={{ fontSize:12,fontWeight:700,color:"#C8102E" }}>{data.fontScale.toFixed(1)}×</span><div style={{ display:"flex",gap:4 }}>{[0.7,1,1.3,1.5,2,2.5].map(v=><button key={v} onClick={()=>up(d=>{d.fontScale=v;})} style={{ padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",border:Math.abs(data.fontScale-v)<0.05?"2px solid #C8102E":"1px solid #ddd",background:Math.abs(data.fontScale-v)<0.05?"#FFF5F5":"#fff",color:Math.abs(data.fontScale-v)<0.05?"#C8102E":"#888" }}>{v}×</button>)}</div></div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Taille QR codes</label>
                  <div style={{ fontSize:10,color:"#999",marginBottom:4 }}>Visible sur les tags ayant une URL. Cliquer un tag dans l'éditeur pour ajouter l'URL.</div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}><span style={{ fontSize:10,color:"#888" }}>16</span><input type="range" min="16" max="80" step="4" value={data.qrSize} onChange={e=>up(d=>{d.qrSize=parseInt(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>80</span></div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}><span style={{ fontSize:12,fontWeight:700,color:"#C8102E" }}>{data.qrSize}px</span><span style={{ fontSize:10,color:"#999" }}>Rendu : {Math.round(data.qrSize*data.fontScale)}px</span></div>
                </div>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Largeur entrée / sortie</label>
                  <div style={{ fontSize:10,color:"#999",marginBottom:4 }}>Contrôle la largeur fixe des panneaux entrée et sortie.</div>
                  <div style={{ display:"flex",alignItems:"center",gap:10 }}><span style={{ fontSize:10,color:"#888" }}>10</span><input type="range" min="10" max="420" step="10" value={data.bookendWidth || 220} onChange={e=>up(d=>{d.bookendWidth=parseInt(e.target.value);})} style={{ flex:1,accentColor:"#C8102E" }} /><span style={{ fontSize:10,color:"#888" }}>420</span></div>
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}><span style={{ fontSize:12,fontWeight:700,color:"#C8102E" }}>{data.bookendWidth || 220}px</span></div>
                </div>
              </div>
            )}
            {tab === "entree" && <BookendEditor data={data.entree} onChange={entree=>up(d=>{d.entree=entree;})} />}
            {tab === "steps" && <StepsEditor steps={data.steps} onChange={steps=>up(d=>{d.steps=steps;})} />}
            {tab === "sortie" && <BookendEditor data={data.sortie} onChange={sortie=>up(d=>{d.sortie=sortie;})} />}
            {tab === "export" && (
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ padding:12,background:"#f5f5f5",borderRadius:8,fontSize:11,color:"#666",lineHeight:1.6 }}><strong style={{ color:"#424242" }}>Exports :</strong><br/>• <strong>JSON</strong> — Sauvegarde ré-importable<br/>• <strong>SVG</strong> — Vectoriel, ouvrable dans Illustrator / Inkscape (QR codes inclus en natif)<br/>• <strong>PDF</strong> — Téléchargement direct</div>
                <Btn onClick={exportJSON}>↓ Exporter JSON</Btn>
                <Btn onClick={exportSVG} color="#E87722">↓ Exporter SVG</Btn>
                <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Résolution PDF</label>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:6 }}>
                    {[{v:1,l:"1× (96 DPI)"},{v:2,l:"2× (200 DPI)"},{v:3,l:"3× (300 DPI)"},{v:4,l:"4× (400 DPI)"}].map(r=><button key={r.v} onClick={()=>up(d=>{d.pdfResolution=r.v;})} style={{ padding:"5px 10px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:(data.pdfResolution||3)===r.v?"2px solid #1565C0":"1.5px solid #ddd",background:(data.pdfResolution||3)===r.v?"#E3F2FD":"#fff",color:(data.pdfResolution||3)===r.v?"#1565C0":"#666" }}>{r.l}</button>)}
                  </div>
                  <div style={{ fontSize:10,color:"#999",marginTop:4 }}>Plus élevé = meilleure qualité, mais plus lent et plus lourd (attention aux grands formats).</div>
                </div>
                <Btn onClick={exportPDF} color="#1565C0">↓ Exporter PDF</Btn>
                <div style={{ borderTop:"1px solid #e0e0e0",paddingTop:12 }}><label style={{ fontSize:11,fontWeight:600,color:"#666" }}>Importer JSON</label><input ref={fileRef} type="file" accept=".json" onChange={importJSON} style={{ fontSize:11,marginTop:4 }} /></div>
                <Btn outline color="#d32f2f" onClick={()=>{if(confirm("Réinitialiser ?"))setData(defaultData());}}>↺ Réinitialiser</Btn>
              </div>
            )}
          </div>
        </>}
      </div>
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ display:"flex",alignItems:"center",padding:"8px 16px",borderBottom:"1px solid #e0e0e0",background:"#fafafa",gap:12 }}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{ border:"1px solid #ddd",borderRadius:5,background:"#fff",padding:"4px 10px",cursor:"pointer",fontSize:14 }}>{sidebarOpen?"◁":"▷"}</button>
          <span style={{ fontSize:13,fontWeight:600,color:"#555" }}>Aperçu</span>
          <span style={{ fontSize:10,color:"#aaa",marginLeft:"auto" }}>{data.header.reference} — {data.format}</span>
        </div>
        {(()=>{const sel=FORMATS[data.format]||{w:data.customW,h:data.customH};const sc=Math.min(1,700/Math.round(sel.w*MM_PX));return <div style={{ flex:1,overflow:"auto",padding:24,background:"#e8e8e8",display:"flex",justifyContent:"center",alignItems:"flex-start" }}><div style={{ transform:`scale(${sc.toFixed(3)})`,transformOrigin:"top center" }}><PosterPreview data={data} /></div></div>;})()}
      </div>
      <style>{`@media print{body>div>div:first-child,[style*="borderBottom"]{display:none!important}[style*="overflow: auto"]{overflow:visible!important;padding:0!important;background:white!important}[style*="transform"]{transform:none!important}}`}</style>
    </div>
  );
}
