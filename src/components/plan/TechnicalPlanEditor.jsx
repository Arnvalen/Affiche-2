/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/plan/TechnicalPlanEditor.jsx                   v2.0.0   ║
 * ║  Éditeur du plan technique (import image, outils zone/machine)      ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { useState, useRef } from 'react';
import { getPalette, getZoneColor } from '../../utils/colors.js';
import { getLineLabel } from '../../utils/lineLabel.js';
import { Btn } from '../ui/Btn.jsx';
import { SectionCard } from '../ui/SectionCard.jsx';

export const TechnicalPlanEditor = ({ data, up, planTool, setPlanTool, planSelStep, setPlanSelStep, planSelMachine, setPlanSelMachine, planMachineMode, setPlanMachineMode }) => {
  const [activeView, setActiveView] = useState(0);
  const imgInputRefs = [useRef(), useRef()];

  const tp = data.technicalPlan || { zoneLabel:"number", gridSize:5, views:[
    { id:"top",label:"Vue de dessus",imageDataUrl:null,stepZones:[],machineLabels:[] },
    { id:"side",label:"Vue de face",imageDataUrl:null,stepZones:[],machineLabels:[] },
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
      {/* Vue de face optionnelle */}
      <label style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,color:"#555" }}>
        <input type="checkbox" checked={tp.views[1]?.enabled !== false}
          onChange={e=>up(d=>{d.technicalPlan.views[1].enabled=e.target.checked;})}
          style={{ accentColor:"#C8102E",width:14,height:14 }} />
        Afficher la vue de face
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

      {/* Outil actif */}
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
                const lineArr = data.line||[], stepsArr = data.steps||[];
                const sortLabel = lbl => { const m=lbl.match(/^([A-Z]+)(\d*)$/); return m?[m[1],parseInt(m[2]||0,10)]:['',0]; };
                const zoneOrder = [...stepsArr.map(s=>s.id), null];
                const grouped = zoneOrder.map(sid => ({
                  sid,
                  label: sid ? (stepsArr.find(s=>s.id===sid)?.title||'') : 'Sans zone',
                  machines: lineArr
                    .filter(m=>(m.stepId||null)===sid)
                    .map(m=>({ m, lbl:getLineLabel(lineArr,stepsArr,m.id).label, ic:(data.icons||[]).find(ic=>ic.id===m.iconId) }))
                    .sort((a,b)=>{ const[al,an]=sortLabel(a.lbl),[bl,bn]=sortLabel(b.lbl); return al<bl?-1:al>bl?1:an-bn; })
                })).filter(g=>g.machines.length>0);
                return grouped.map(g=>(
                  <optgroup key={g.sid||'__none__'} label={g.label}>
                    {g.machines.map(({m,lbl,ic})=>(
                      <option key={m.id} value={m.id}>{lbl} · {ic?.name||"Machine"}</option>
                    ))}
                  </optgroup>
                ));
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
      {tp.views.some(v => v.stepZones.length > 0 || v.machineLabels.length > 0) && (
        <SectionCard title="Annotations" defaultOpen={true}>
          {tp.views.map((v, vi) => {
            const hasAny = v.stepZones.length > 0 || v.machineLabels.length > 0;
            if (!hasAny) return null;
            return (
              <div key={v.id}>
                <div style={{ fontSize:10,fontWeight:700,color:"#999",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3,marginTop:vi>0?8:0 }}>{v.label}</div>
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
                  const { label: letter } = item ? getLineLabel(line, steps, item.id) : { label: '?' };
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
              </div>
            );
          })}
        </SectionCard>
      )}
    </div>
  );
};
