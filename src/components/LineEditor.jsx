/**
 * @file        LineEditor.jsx
 * @module      src/components/LineEditor
 * @description Éditeur de la ligne de production : machines, icônes SVG, association aux étapes.
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     2026-04-09
 * @modified    2026-04-09
 * @version     1.0.0
 *
 * @exports {Component} LineEditor
 */
import { useRef } from "react";
import { Fragment } from "react";
import { uid, ZONE_COLORS } from "../theme";
import { Btn } from "./ui";

/* ═══════════════════ LINE EDITOR ═══════════════════ */

/** Composant image SVG scalée : height fixe en px, width auto, centrée. */
const svgUrl = (svgData) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
const SvgIcon = ({ svgData, height, style }) => (
  <img src={svgUrl(svgData)} alt="" style={{ height, width:'auto', maxWidth:'100%', display:'block', objectFit:'contain', ...style }} />
);

export const LineEditor = ({ icons, line, steps, onChange, libSvgFiles, onLoadSvg }) => {
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
