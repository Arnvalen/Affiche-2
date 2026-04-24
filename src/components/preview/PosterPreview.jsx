/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/preview/PosterPreview.jsx                      v2.0.0   ║
 * ║  Rendu complet du poster (header, légende, étapes, ligne, footer)   ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { TAG_TYPES, TAG_LABELS, FORMATS, MM_PX } from '../../constants.js';
import { getPalette, getZoneColor } from '../../utils/colors.js';
import { getLineLabel } from '../../utils/lineLabel.js';
import { BookendPanel } from './BookendPanel.jsx';
import { LineFlowBand, LineFlowErrorBoundary } from './LineFlowBand.jsx';
import { TagWithQR } from '../tags/TagWithQR.jsx';
import { Tag } from '../tags/Tag.jsx';

export const PosterPreview = ({ data, appVersion }) => {
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
        return <div style={{marginBottom:4*s,flexShrink:0}}><LineFlowErrorBoundary bh={bh}><LineFlowBand data={data} bh={bh} s={s} pal={pal} posterW={posterW} /></LineFlowErrorBoundary></div>;
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
