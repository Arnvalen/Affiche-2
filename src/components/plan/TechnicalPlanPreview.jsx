/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/plan/TechnicalPlanPreview.jsx                  v2.0.0   ║
 * ║  Rendu du plan technique avec annotations interactives              ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { useState, useRef, useEffect } from 'react';
import { FORMATS, MM_PX } from '../../constants.js';
import { getPalette, getZoneColor } from '../../utils/colors.js';
import { getLineLabel } from '../../utils/lineLabel.js';

export const TechnicalPlanPreview = ({ data, appVersion, interactive, planTool, planSelStep, planSelMachine, planMachineMode, onAddZone, onAddLabel, onUpdateZone, onUpdateLabel }) => {
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

  const getMachinePlanInfo = (lineId) => {
    const item = line.find(m => m.id === lineId);
    if (!item) return { letter:'?', color:pal.primary };
    const { label } = getLineLabel(line, steps, lineId);
    const si = item.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
    return { letter: label, color: si >= 0 ? getZoneColor(pal, si, totalSteps) : pal.primary };
  };

  const rectToPoints = z => [{ x:z.x, y:z.y }, { x:z.x+z.w, y:z.y }, { x:z.x+z.w, y:z.y+z.h }, { x:z.x, y:z.y+z.h }];
  const getPoints = z => z.points || rectToPoints(z);
  const centroid = pts => ({ x: pts.reduce((a,p)=>a+p.x,0)/pts.length, y: pts.reduce((a,p)=>a+p.y,0)/pts.length });
  const snapToGrid = (pos, gs) => gs > 0 ? { x: Math.round(pos.x/gs)*gs, y: Math.round(pos.y/gs)*gs } : pos;

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
      {/* Header */}
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

      {/* Barre de légende */}
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

      {/* Corps */}
      <div style={{ flex:1,display:"flex",padding:`${10*s}px`,gap:10*s,minHeight:0 }}>
        {/* Colonne des vues */}
        <div style={{ flex:3,display:"flex",flexDirection:"column",gap:14*s,minWidth:0 }}>
        {tp.views.every(v=>!v.imageDataUrl) && (
          <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#bbb",fontSize:14*s,fontStyle:"italic" }}>
            Importer des images dans l'onglet 📐 Plan
          </div>
        )}
        {tp.views.map((view,vi) => {
          if (!view.imageDataUrl || view.enabled === false) return null;
          return (
            <div key={view.id} style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0 }}>
              <div style={{ flex:1,display:"flex",flexDirection:"column",minWidth:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6*s,marginBottom:4*s }}>
                  <span style={{ fontSize:11*s,fontWeight:700,color:pal.primary,textTransform:"uppercase",letterSpacing:1 }}>{view.label}</span>
                </div>
                <div style={{ flex:1,overflow:"hidden",minHeight:0 }}>
                <div ref={imgRefs[vi]}
                  style={{ position:"relative",cursor:interactive?(planTool==='zone'?'crosshair':'cell'):'default',borderRadius:4*s,border:`1.5px solid ${pal.primary}33`,overflow:"hidden" }}
                  onMouseDown={interactive ? (e=>handleMouseDown(e,vi)) : undefined}
                  onDoubleClick={interactive ? (e=>handleDoubleClick(e,vi)) : undefined}
                >
                  <img src={view.imageDataUrl} alt={view.label} style={{ width:"100%",display:"block" }} draggable={false} />

                  {/* Badges de zones */}
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

                  {/* Lettres machines */}
                  {view.machineLabels.map(m => {
                    const { letter, color:mColor } = getMachinePlanInfo(m.lineId);
                    return (
                      <div key={m.id} style={{ position:"absolute",left:m.x+'%',top:m.y+'%',transform:"translate(-50%,-50%)",width:22*s,height:22*s,borderRadius:"50%",background:mColor,color:"#fff",fontSize:Math.max(8,13*s),fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",pointerEvents:"none",boxShadow:`0 1px 4px rgba(0,0,0,0.3)`,zIndex:2 }}>{letter}</div>
                    );
                  })}

                  {/* Overlay SVG */}
                  <svg style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible" }}
                    viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <marker id={`arrowhead-${vi}`} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L0,5 L5,2.5 z" fill="context-stroke" />
                      </marker>
                    </defs>

                    {/* Grille snap */}
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
                      return (
                        <g key={z.id}>
                          <polygon points={ptStr} fill={color+'22'} stroke={color} strokeWidth={Math.max(0.3,0.5*s)} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </g>
                      );
                    })}

                    {/* Flèches machines */}
                    {view.machineLabels.map(m => {
                      const { color:mColor } = getMachinePlanInfo(m.lineId);
                      if (!m.arrowTo) return null;
                      return (
                        <g key={m.id+'arrow'}>
                          <line x1={m.x} y1={m.y} x2={m.arrowTo.x} y2={m.arrowTo.y} stroke={mColor} strokeWidth={Math.max(0.8,1.2*s)} markerEnd={`url(#arrowhead-${vi})`} vectorEffect="non-scaling-stroke" />
                          {interactive && <circle cx={m.arrowTo.x} cy={m.arrowTo.y} r={2.5} fill="transparent" style={{ cursor:'move',pointerEvents:'auto' }}
                            onMouseDown={e=>{e.stopPropagation();setInteraction({mode:'drag-arrow-tip',vi,labelId:m.id});}} />}
                        </g>
                      );
                    })}

                    {/* Arrow-drag en cours */}
                    {interaction?.mode==='arrow-drag' && interaction.vi===vi && (()=>{
                      const {color:mColor} = getMachinePlanInfo(interaction.lineId);
                      return <line x1={interaction.start.x} y1={interaction.start.y} x2={interaction.mouse.x} y2={interaction.mouse.y} stroke={mColor} strokeWidth={Math.max(0.8,1.2*s)} strokeDasharray="2,1" markerEnd={`url(#arrowhead-${vi})`} vectorEffect="non-scaling-stroke" />;
                    })()}

                    {/* Polygone en cours */}
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
                          {interaction.points.slice(1).map((p,i)=>(
                            <circle key={i} cx={p.x} cy={p.y} r={0.8} fill={color} vectorEffect="non-scaling-stroke" />
                          ))}
                          <circle cx={first.x} cy={first.y} r={canClose && dist < Math.max(3,(tp.gridSize||5)*0.8) ? 2 : 1.2} fill={color} opacity={0.9} vectorEffect="non-scaling-stroke" />
                        </g>
                      );
                    })()}
                  </svg>
                </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>

        {/* Légende commune */}
        {(()=>{
          const afs = tp.legendFontSize || 9;
          const activeViews = tp.views.filter(v => v.enabled !== false);
          const zoneIndicesSet = new Set();
          activeViews.forEach(v => v.stepZones.forEach(z => zoneIndicesSet.add(z.stepIndex)));
          const machinesByStep = {};
          const seenMachines = new Set();
          activeViews.forEach(v => v.machineLabels.forEach(m => {
            if (seenMachines.has(m.lineId)) return;
            seenMachines.add(m.lineId);
            const item = line.find(m2=>m2.id===m.lineId);
            const si = item?.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
            const key = si >= 0 ? si : '__none__';
            if (!machinesByStep[key]) machinesByStep[key] = [];
            machinesByStep[key].push(m);
          }));
          const allZoneKeys = [...new Set([...zoneIndicesSet, ...Object.keys(machinesByStep).filter(k=>k!=='__none__').map(Number)])].sort((a,b)=>a-b);
          return (
            <div style={{ flex:1,display:"flex",flexDirection:"column",gap:afs*0.6,minWidth:0,boxSizing:"border-box",borderLeft:`2px solid ${pal.primary}`,paddingLeft:afs,overflow:"hidden" }}>
              {allZoneKeys.length === 0 && !machinesByStep['__none__']
                ? <div style={{ fontSize:afs,color:"#bbb",fontStyle:"italic",marginTop:afs*0.4 }}>Aucune annotation</div>
                : allZoneKeys.map(si => {
                  const color = getZoneColor(pal, si, totalSteps);
                  const step = steps[si];
                  const machines = machinesByStep[si] || [];
                  const circleSize = afs * 1.7;
                  return (
                    <div key={si}>
                      <div style={{ display:"flex",alignItems:"center",gap:afs*0.45,marginBottom:afs*0.3 }}>
                        <div style={{ width:circleSize,height:circleSize,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.max(6,afs),fontWeight:700,flexShrink:0,fontFamily:"monospace" }}>{si+1}</div>
                        <span style={{ fontSize:afs,fontWeight:700,color:color,textTransform:"uppercase",letterSpacing:0.5,lineHeight:1.2 }}>{step?.title||"—"}</span>
                      </div>
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
                })
              }
            </div>
          );
        })()}
      </div>

      {/* Footer */}
      <div style={{ display:"flex",justifyContent:"space-between",padding:`${6*s}px ${24*s}px`,background:pal.primary,color:"rgba(255,255,255,0.6)",fontSize:9*s,flexShrink:0,flexWrap:"wrap",gap:8*s }}>
        <span><strong style={{ color:"#fff" }}>Version :</strong> {data.version || '—'}</span>
        <span><strong style={{ color:"#fff" }}>Format :</strong> {data.format} · {fmt.w}×{fmt.h}mm · Plan technique</span>
        <span><strong style={{ color:"#fff" }}>Ligne :</strong> {data.header.processName}</span>
      </div>
    </div>
  );
};
