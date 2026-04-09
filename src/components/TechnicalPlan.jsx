/**
 * @file        TechnicalPlan.jsx
 * @module      src/components/TechnicalPlan
 * @description Éditeur (TechnicalPlanEditor) et rendu (TechnicalPlanPreview) du plan
 *              technique : import d'image, zones annotées (stepZones), labels machines.
 *              Les coordonnées des zones sont en % de l'image (0-100).
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     2026-04-09
 * @modified    2026-04-09
 * @version     1.0.0
 *
 * @exports {Component} TechnicalPlanEditor
 * @exports {Component} TechnicalPlanPreview
 */
import { useState, useRef, useEffect } from "react";
import { getZoneColor, getPalette, MM_PX, FORMATS } from "../theme";
import { Btn, SectionCard } from "./ui";

/* ═══════════════════ TECHNICAL PLAN COMPONENTS ═══════════════════ */

/**
 * Sidebar de l'onglet "Plan" : import images, sélection outil/étape/machine, liste annotations.
 * Le dessin se fait directement dans l'aperçu (TechnicalPlanPreview en mode interactif).
 * Permet d'importer des images de plan, de dessiner des zones d'étapes (rectangles)
 * et de placer des lettres de machines par clic.
 */
export const TechnicalPlanEditor = ({ data, up, planTool, setPlanTool, planSelStep, setPlanSelStep, planSelMachine, setPlanSelMachine }) => {
  const [activeView, setActiveView] = useState(0);
  const imgInputRefs = [useRef(), useRef()];

  const tp = data.technicalPlan || { zoneLabel:"number", views:[
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

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
      {/* Sélecteur de vue */}
      <div style={{ display:"flex",gap:6 }}>
        {tp.views.map((v,i) => (
          <button key={v.id} onClick={()=>setActiveView(i)} style={{ flex:1,padding:"6px 8px",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",border:activeView===i?"2px solid #C8102E":"1.5px solid #ddd",background:activeView===i?"#FFF5F5":"#fff",color:activeView===i?"#C8102E":"#666" }}>{v.label}</button>
        ))}
      </div>

      {/* Import image */}
      <div style={{ padding:10,background:"#f5f5f5",borderRadius:8 }}>
        <div style={{ fontSize:11,fontWeight:600,color:"#666",marginBottom:6 }}>Image — {tp.views[activeView]?.label}</div>
        <input ref={imgInputRefs[activeView]} type="file" accept="image/*" onChange={handleImgFile(activeView)} style={{ fontSize:11 }} />
        {view.imageDataUrl && <Btn small outline color="#d32f2f" onClick={()=>up(d=>{d.technicalPlan.views[activeView].imageDataUrl=null;})} style={{ marginTop:6 }}>Supprimer l'image</Btn>}
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
            <select value={planSelMachine} onChange={e=>setPlanSelMachine(parseInt(e.target.value))}
              style={{ width:"100%",marginTop:4,padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit" }}>
              {(()=>{
                // Trier par stepIndex (ordre des étapes) puis par lettre dans la zone
                const sorted = line.map((item,i)=>{
                  const step = steps.find(s => s.id === item.stepId);
                  const si = step ? steps.indexOf(step) : Infinity;
                  const zoneItems = line.filter(m => m.stepId === item.stepId);
                  const idx = zoneItems.findIndex(m => m.id === item.id);
                  const letter = idx >= 0 ? String.fromCharCode(65+idx) : '?';
                  return { item, i, si, idx, letter, step };
                }).sort((a,b) => a.si !== b.si ? a.si - b.si : a.idx - b.idx);
                return sorted.map(({ item, i, letter, step }) => {
                  const icon = (icons||[]).find(ic=>ic.id===item.iconId);
                  const zoneLabel = step ? step.title : 'sans zone';
                  return <option key={item.id} value={i}>{zoneLabel} — {letter} · {icon?.name||"Machine"}</option>;
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
      </div>

      {/* Annotations existantes */}
      {(view.stepZones.length > 0 || view.machineLabels.length > 0) && (
        <SectionCard title={`Annotations — ${tp.views[activeView]?.label}`} defaultOpen={true}>
          {view.stepZones.map((z,i) => {
            const color = totalSteps>0 ? getZoneColor(pal, z.stepIndex, totalSteps) : "#999";
            const step = steps[z.stepIndex];
            return (
              <div key={z.id} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f0f0f0" }}>
                <div style={{ width:14,height:14,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0 }}>{z.stepIndex+1}</div>
                <span style={{ flex:1,fontSize:11,color:"#555" }}>{step?.title||"—"}</span>
                <span onClick={()=>up(d=>{d.technicalPlan.views[activeView].stepZones.splice(i,1);})} style={{ cursor:"pointer",fontSize:12,color:"#ccc",padding:"0 4px" }}>✕</span>
              </div>
            );
          })}
          {view.machineLabels.map((m,i) => {
            const item = line[m.lineIndex];
            const icon = (icons||[]).find(ic => ic.id === (item||{}).iconId);
            // Lettre et couleur par zone (même logique que getMachinePlanInfo dans TechnicalPlanPreview)
            const zoneItems = line.filter(li => li.stepId === item?.stepId);
            const idx = zoneItems.findIndex(li => li.id === item?.id);
            const letter = idx >= 0 ? String.fromCharCode(65+idx) : '?';
            const si = item?.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
            const mColor = si >= 0 ? getZoneColor(pal, si, totalSteps) : pal.primary;
            return (
              <div key={m.id} style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:"1px solid #f0f0f0" }}>
                <div style={{ width:14,height:14,borderRadius:"50%",background:mColor,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0 }}>{letter}</div>
                <span style={{ flex:1,fontSize:11,color:"#555" }}>{icon?.name||"Machine"}</span>
                <span onClick={()=>up(d=>{d.technicalPlan.views[activeView].machineLabels.splice(i,1);})} style={{ cursor:"pointer",fontSize:12,color:"#ccc",padding:"0 4px" }}>✕</span>
              </div>
            );
          })}
        </SectionCard>
      )}
    </div>
  );
};

/**
 * Rendu de l'affiche technique (poster imprimable + mode interactif pour annoter).
 * Style unifié avec PosterPreview : même header, même footer, même palette.
 * En mode interactif (interactive=true), le dessin se fait directement sur les images.
 */
export const TechnicalPlanPreview = ({ data, appVersion, interactive, planTool, planSelStep, planSelMachine, onAddZone, onAddLabel }) => {
  const pal = getPalette(data.palette);
  const fmt = data.format === "Personnalisé" ? { w:data.customW||800, h:data.customH||500 } : (FORMATS[data.format] || { w:841, h:594 });
  const posterW = Math.round(fmt.w * MM_PX);
  const posterH = Math.round(fmt.h * MM_PX);
  const forceH = data.forceFormat;
  const s = (data.fontScale || 7) * 0.15;
  const hh = data.headerHeight || 56;
  const hr = hh / 56, hs = s * hr;
  const tp = data.technicalPlan || { zoneLabel:"number", views:[] };
  const steps = data.steps || [];
  const line = data.line || [];
  const icons = data.icons || [];
  const totalSteps = steps.length;

  // Lettre et couleur d'une machine = relatives à sa zone (stepId), comme getMachineInfo dans PosterPreview.
  // Deux machines dans deux zones différentes peuvent avoir la même lettre.
  const getMachinePlanInfo = (lineIndex) => {
    const item = line[lineIndex];
    if (!item) return { letter:'?', color:pal.primary };
    const zoneItems = line.filter(m => m.stepId === item.stepId);
    const idx = zoneItems.findIndex(m => m.id === item.id);
    const si = item.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
    return {
      letter: idx >= 0 ? String.fromCharCode(65 + idx) : '?',
      color: si >= 0 ? getZoneColor(pal, si, totalSteps) : pal.primary,
    };
  };

  const [drawing, setDrawing] = useState(null);     // { x, y, vi, selStep } en cours de drag
  const [currentRect, setCurrentRect] = useState(null);
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
    if (!drawing || !interactive) return;
    const addZoneFn = onAddZone;
    const onMove = (e) => {
      const pos = getRelPos(e, drawing.vi);
      setCurrentRect({ x:Math.min(drawing.x,pos.x), y:Math.min(drawing.y,pos.y), w:Math.abs(pos.x-drawing.x), h:Math.abs(pos.y-drawing.y) });
    };
    const onUp = (e) => {
      const pos = getRelPos(e, drawing.vi);
      const x=Math.min(drawing.x,pos.x), y=Math.min(drawing.y,pos.y), w=Math.abs(pos.x-drawing.x), h=Math.abs(pos.y-drawing.y);
      setDrawing(null); setCurrentRect(null);
      if (w>=1 && h>=1) addZoneFn(drawing.vi, { stepIndex:drawing.selStep, x, y, w, h });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drawing, interactive]);

  const handleMouseDown = (e, vi) => {
    if (!interactive) return;
    if (planTool==='zone' && steps.length>0) {
      e.preventDefault();
      const pos = getRelPos(e, vi);
      setDrawing({ ...pos, vi, selStep:planSelStep });
    } else if (planTool==='machine' && line.length>0) {
      const pos = getRelPos(e, vi);
      onAddLabel(vi, { lineIndex:planSelMachine, x:pos.x, y:pos.y });
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
          if (!view.imageDataUrl) return null;
          return (
            <div key={view.id} style={{ flex:1,display:"flex",gap:10*s,minHeight:0 }}>
              {/* Image annotée */}
              <div style={{ flex:3,display:"flex",flexDirection:"column",minWidth:0 }}>
                {/* Label de vue */}
                <div style={{ display:"flex",alignItems:"center",gap:6*s,marginBottom:4*s }}>
                  <span style={{ fontSize:11*s,fontWeight:700,color:pal.primary,textTransform:"uppercase",letterSpacing:1 }}>{view.label}</span>
                </div>
                {/* Conteneur image + overlay annotations */}
                <div ref={imgRefs[vi]}
                  style={{ position:"relative",flex:1,cursor:interactive?(planTool==='zone'?'crosshair':'cell'):'default',borderRadius:4*s,border:`1.5px solid ${pal.primary}33`,overflow:"hidden" }}
                  onMouseDown={interactive ? (e=>handleMouseDown(e,vi)) : undefined}
                >
                  <img src={view.imageDataUrl} alt={view.label} style={{ width:"100%",display:"block" }} draggable={false} />
                  {/* Zones d'étapes — style ligne de production (rounded rect + badge rond) */}
                  {view.stepZones.map(z => {
                    const color = getZoneColor(pal,z.stepIndex,totalSteps);
                    const step = steps[z.stepIndex];
                    const badgeContent = tp.zoneLabel === 'text'
                      ? <span style={{ fontSize:Math.max(6,9*s),fontWeight:700,whiteSpace:"nowrap" }}>{step?.title||String(z.stepIndex+1)}</span>
                      : <span style={{ fontSize:Math.max(8,13*s),fontWeight:700,fontFamily:"monospace" }}>{z.stepIndex+1}</span>;
                    const badgeW = tp.zoneLabel === 'text' ? 'auto' : 22*s;
                    const badgePad = tp.zoneLabel === 'text' ? `0 ${Math.max(4,6*s)}px` : 0;
                    return (
                      <div key={z.id} style={{ position:"absolute",left:z.x+'%',top:z.y+'%',width:z.w+'%',height:z.h+'%',border:`${Math.max(1.5,2*s)}px solid ${color}`,borderRadius:Math.max(3,6*s),background:color+'22',boxSizing:"border-box",pointerEvents:"none" }}>
                        <div style={{ position:"absolute",top:-(11*s),left:-(11*s),minWidth:22*s,width:badgeW,height:22*s,borderRadius:tp.zoneLabel==='text'?Math.max(3,11*s):"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:badgePad,flexShrink:0,boxSizing:"content-box" }}>{badgeContent}</div>
                      </div>
                    );
                  })}
                  {/* Lettres machines — lettre et couleur relatives à la zone (stepId) */}
                  {view.machineLabels.map(m => {
                    const { letter, color:mColor } = getMachinePlanInfo(m.lineIndex);
                    return (
                      <div key={m.id} style={{ position:"absolute",left:m.x+'%',top:m.y+'%',transform:"translate(-50%,-50%)",width:22*s,height:22*s,borderRadius:"50%",background:mColor,color:"#fff",fontSize:Math.max(8,13*s),fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",pointerEvents:"none",boxShadow:`0 1px 4px rgba(0,0,0,0.3)` }}>{letter}</div>
                    );
                  })}
                  {/* Rectangle en cours de dessin */}
                  {currentRect && drawing?.vi===vi && (()=>{
                    const color = totalSteps>0 ? getZoneColor(pal,drawing.selStep,totalSteps) : pal.primary;
                    return <div style={{ position:"absolute",left:currentRect.x+'%',top:currentRect.y+'%',width:currentRect.w+'%',height:currentRect.h+'%',border:`2px dashed ${color}`,background:color+'18',boxSizing:"border-box",pointerEvents:"none" }} />;
                  })()}
                </div>
              </div>

              {/* Légende — organisée par zone */}
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:6*s,minWidth:0,borderLeft:`2px solid ${pal.primary}`,paddingLeft:10*s }}>
                {(()=>{
                  // Collecter les step indices présents dans cette vue (zones dessinées)
                  const zoneIndices = [...new Set(view.stepZones.map(z=>z.stepIndex))].sort((a,b)=>a-b);
                  // Machines placées dans cette vue, par stepId
                  const machinesByStep = {};
                  view.machineLabels.forEach(m => {
                    const item = line[m.lineIndex];
                    const si = item?.stepId ? steps.findIndex(s => s.id === item.stepId) : -1;
                    const key = si >= 0 ? si : '__none__';
                    if (!machinesByStep[key]) machinesByStep[key] = [];
                    machinesByStep[key].push(m);
                  });
                  // Zones à afficher = union des zones dessinées + zones de machines placées
                  const allZoneKeys = [...new Set([...zoneIndices, ...Object.keys(machinesByStep).filter(k=>k!=='__none__').map(Number)])].sort((a,b)=>a-b);
                  if (allZoneKeys.length === 0 && !machinesByStep['__none__']) {
                    return <div style={{ fontSize:9*s,color:"#bbb",fontStyle:"italic",marginTop:4*s }}>Aucune annotation</div>;
                  }
                  return allZoneKeys.map(si => {
                    const color = getZoneColor(pal, si, totalSteps);
                    const step = steps[si];
                    const machines = machinesByStep[si] || [];
                    return (
                      <div key={si}>
                        {/* En-tête de zone */}
                        <div style={{ display:"flex",alignItems:"center",gap:4*s,marginBottom:3*s }}>
                          <div style={{ width:16*s,height:16*s,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9*s,fontWeight:700,flexShrink:0,fontFamily:"monospace" }}>{si+1}</div>
                          <span style={{ fontSize:9*s,fontWeight:700,color:color,textTransform:"uppercase",letterSpacing:0.5 }}>{step?.title||"—"}</span>
                        </div>
                        {/* Machines de cette zone */}
                        {machines.map(m => {
                          const item = line[m.lineIndex];
                          const icon = (icons||[]).find(ic=>ic.id===(item||{}).iconId);
                          const { letter } = getMachinePlanInfo(m.lineIndex);
                          return (
                            <div key={m.id} style={{ display:"flex",alignItems:"center",gap:4*s,paddingLeft:8*s,marginBottom:2*s }}>
                              <div style={{ width:14*s,height:14*s,borderRadius:"50%",background:color,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8*s,fontWeight:700,flexShrink:0,fontFamily:"monospace" }}>{letter}</div>
                              <span style={{ fontSize:9*s,color:"#444",lineHeight:1.3 }}>{icon?.name||"—"}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — identique à PosterPreview */}
      <div style={{ display:"flex",justifyContent:"space-between",padding:`${6*s}px ${24*s}px`,background:pal.footer,color:"rgba(255,255,255,0.6)",fontSize:9*s,flexShrink:0,flexWrap:"wrap",gap:8*s }}>
        <span><strong style={{ color:"#fff" }}>Version :</strong> {data.version || '—'}</span>
        <span><strong style={{ color:"#fff" }}>Format :</strong> {data.format} · {fmt.w}×{fmt.h}mm · Plan technique</span>
        <span><strong style={{ color:"#fff" }}>Ligne :</strong> {data.header.processName}</span>
      </div>
    </div>
  );
};
