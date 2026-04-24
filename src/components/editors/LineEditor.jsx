/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/editors/LineEditor.jsx                         v2.0.0   ║
 * ║  Éditeur de la ligne de production (DAG, zones, bibliothèque SVG)   ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { useRef, useState, Fragment } from "react";
import { uid } from '../../utils/uid.js';
import { ZONE_COLORS } from '../../constants.js';
import { computeLayout } from '../../utils/dagLayout.js';
import { getLineLabel } from '../../utils/lineLabel.js';
import { Btn } from '../ui/Btn.jsx';
import { SvgIcon } from '../ui/SvgIcon.jsx';

/* ═══════════════════ LINE FLOW EDITOR ═══════════════════ */

export const LineEditor = ({ icons, line, steps, onChange, onRemoveMachine, onRemoveIcon, libSvgFiles, onLoadSvg }) => {
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
    if (onRemoveMachine) { onRemoveMachine(id); return; }
    upLine(line.filter(m => m.id !== id).map(m => ({...m, next:(m.next||[]).filter(nid=>nid!==id)})));
  };
  const removeIcon = (iconId) => {
    const removedIds = line.filter(m => m.iconId === iconId).map(m => m.id);
    if (onRemoveIcon && removedIds.length) { onRemoveIcon(iconId, removedIds); return; }
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
                const sortLabel = (lbl) => { const m=lbl.match(/^([A-Z]+)(\d*)$/); return m?[m[1],parseInt(m[2]||0,10)]:['',0]; };
                const sortedMachinesInZone = [...machinesInZone]
                  .map(m=>({m, lbl:getLineLabel(line,steps,m.id).label}))
                  .sort((a,b)=>{ const [al,an]=sortLabel(a.lbl); const [bl,bn]=sortLabel(b.lbl); return al<bl?-1:al>bl?1:an-bn; });
                const machineChips = (selectedId, onSelect) => (
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                    <div onClick={()=>onSelect(null)} style={chipStyle(selectedId===null)}>Aucune</div>
                    {sortedMachinesInZone.map(({m,lbl})=>{
                      const mic=icons.find(ic=>ic.id===m.iconId);
                      return <div key={m.id} onClick={()=>onSelect(m.id)} style={chipStyle(selectedId===m.id)}>{lbl} {mic?.name}</div>;
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

          // Layout DAG — calculé une fois pour toutes les zones
          const layout = computeLayout(line, steps);
          const { col: dagCol, track: dagTrack, zoneSpans } = layout;

          return (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {zones.map(zone=>{
                const k = zone.step?.id || '__none__';
                const startCol = zoneSpans[k]?.startCol ?? 0;

                // Grouper les machines par colonne locale (= profondeur dans la zone)
                const byLocalCol = {};
                zone.machines.forEach(item => {
                  const lc = (dagCol[item.id] ?? 0) - startCol;
                  if (!byLocalCol[lc]) byLocalCol[lc] = [];
                  byLocalCol[lc].push(item);
                });
                // Colonnes triées gauche→droite, machines triées par track dans chaque colonne
                const columns = Object.keys(byLocalCol)
                  .map(Number).sort((a,b)=>a-b)
                  .map(lc => byLocalCol[lc].slice().sort((a,b)=>(dagTrack[a.id]??0)-(dagTrack[b.id]??0)));

                return (
                  <div key={zone.step?.id||'unlinked'} style={{borderRadius:8,border:`2px solid ${zone.color}`,background:zone.color+'12',padding:'8px'}}>
                    {/* Titre de zone */}
                    <div style={{display:'flex',justifyContent:'center',marginBottom:6}}>
                      <div style={{background:zone.color,color:'#fff',fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:10}}>
                        {zone.step?.title||'Sans zone'}
                      </div>
                    </div>
                    {/* Vue colonne-flux */}
                    <div style={{display:'flex',alignItems:'flex-start',gap:0,overflowX:'auto',paddingBottom:4}}>
                      {columns.map((colMachines, ci)=>(
                        <Fragment key={ci}>
                          {/* Flèche entre colonnes */}
                          {ci>0 && (
                            <div style={{display:'flex',alignItems:'center',alignSelf:'stretch',padding:'0 4px'}}>
                              <span style={{color:zone.color,fontSize:18,fontWeight:900}}>→</span>
                            </div>
                          )}
                          {/* Colonne : machines empilées verticalement */}
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            {colMachines.map(item=>{
                              const icon=icons.find(ic=>ic.id===item.iconId);
                              if(!icon) return null;
                              const {label:letter}=getLineLabel(line,steps,item.id);
                              return (
                                <div key={item.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'#fafafa',border:'1px solid #eee',borderRadius:6,padding:'6px 8px',minWidth:60}}>
                                  <div style={{width:16,height:16,borderRadius:'50%',background:zone.color,color:'#fff',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{letter}</div>
                                  <SvgIcon svgData={icon.svgData} height={32} />
                                  <span style={{fontSize:8,color:'#555',textAlign:'center',maxWidth:56,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{icon.name}</span>
                                  <select value={item.stepId||''} onChange={e=>updateLineItem(item.id,{stepId:e.target.value||null})}
                                    style={{fontSize:8,padding:'1px 2px',border:'1px solid #ddd',borderRadius:3,maxWidth:64}}>
                                    <option value="">— —</option>
                                    {steps.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
                                  </select>
                                  <div style={{display:'flex',gap:2}}>
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
                                    {(()=>{
                                      const candidates = line.filter(m=>m.id!==item.id&&!(item.next||[]).includes(m.id));
                                      const sortLabel = (lbl) => { const m=lbl.match(/^([A-Z]+)(\d*)$/); return m?[m[1],parseInt(m[2]||0,10)]:['',0]; };
                                      const zoneOrder = [...steps.map(s=>s.id), null];
                                      const grouped = zoneOrder.map(sid => ({
                                        sid,
                                        label: sid ? (steps.find(s=>s.id===sid)?.title||'') : 'Sans zone',
                                        machines: candidates
                                          .filter(m=>(m.stepId||null)===sid)
                                          .map(m=>({m, lbl:getLineLabel(line,steps,m.id).label, ic:icons.find(ic=>ic.id===m.iconId)}))
                                          .sort((a,b)=>{ const [al,an]=sortLabel(a.lbl); const [bl,bn]=sortLabel(b.lbl); return al<bl?-1:al>bl?1:an-bn; })
                                      })).filter(g=>g.machines.length>0);
                                      return grouped.map(g=>(
                                        <optgroup key={g.sid||'__none__'} label={g.label}>
                                          {g.machines.map(({m,lbl,ic})=>(
                                            <option key={m.id} value={m.id}>{lbl} {ic?.name||'?'}</option>
                                          ))}
                                        </optgroup>
                                      ));
                                    })()}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        </Fragment>
                      ))}
                      {/* Drop target pour ajouter une machine dans cette zone */}
                      <div onDragOver={e=>e.preventDefault()}
                        onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('iconId');if(id){const stepId=zone.step?.id||null;upLine([...line,{id:uid(),iconId:id,stepId,next:[]}]);}}}
                        style={{width:40,height:56,border:'2px dashed #ddd',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'#ccc',fontSize:20,cursor:'copy',alignSelf:'center',marginLeft:4}}>+</div>
                    </div>
                  </div>
                );
              })}
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
