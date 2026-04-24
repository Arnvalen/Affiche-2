/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║                           v2.0.0                                    ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { produce } from "immer";
// html-to-image et jsPDF : chargés dynamiquement à l'export (voir exportPNG/exportPDF)

import { FORMATS, MM_PX } from './constants.js';
import { PALETTES } from './utils/colors.js';
import { uid, advanceIdFromData, resetId } from './utils/uid.js';
import { emptyData, defaultData } from './utils/defaultData.js';
import { Btn } from './components/ui/Btn.jsx';
import { Input } from './components/ui/Input.jsx';
import { BookendEditor } from './components/editors/BookendEditor.jsx';
import { StepsEditor } from './components/editors/StepsEditor.jsx';
import { LineEditor } from './components/editors/LineEditor.jsx';
import { TechnicalPlanEditor } from './components/plan/TechnicalPlanEditor.jsx';
import { TechnicalPlanPreview } from './components/plan/TechnicalPlanPreview.jsx';
import { PosterPreview } from './components/preview/PosterPreview.jsx';

export default function App() {
  const [data, setData] = useState(defaultData);
  const [tab, setTab] = useState("header");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const sidebarDragRef = useRef(null);
  const fileRef = useRef(), logoRef = useRef(), bgRef = useRef();
  const previewContainerRef = useRef();
  const [previewSize, setPreviewSize] = useState({ w: 700, h: 500 });
  const [libDirHandle, setLibDirHandle] = useState(null);
  const [libFiles, setLibFiles] = useState([]);
  const [libSvgFiles, setLibSvgFiles] = useState([]);
  const [logoFiles, setLogoFiles] = useState([]);
  const [libExpanded, setLibExpanded] = useState({});
  const [electronLib, setElectronLib] = useState(null);
  const [appVersion, setAppVersion] = useState(null);
  const [previewMode, setPreviewMode] = useState('poster');
  const [planTool, setPlanTool] = useState('zone');
  const [planSelStep, setPlanSelStep] = useState(0);
  const [planSelMachine, setPlanSelMachine] = useState(null);
  const [planMachineMode, setPlanMachineMode] = useState('point');
  const [saveModal, setSaveModal] = useState(null);
  const [saveModalInput, setSaveModalInput] = useState('');
  const [versionNotice, setVersionNotice] = useState(null);

  const up = useCallback((fn) => setData(prev => produce(prev, fn)), []);

  useEffect(() => {
    if (window.__T_HTML) console.log('REACT_MOUNT +' + (Date.now() - window.__T_HTML) + 'ms depuis HTML parse');
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

  const importJSON = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { try { applyLoaded(JSON.parse(ev.target.result)); } catch { alert("JSON invalide"); } }; r.readAsText(f); };

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

  const applyLoaded = (parsed) => {
    advanceIdFromData(parsed);
    if (!parsed.technicalPlan) parsed.technicalPlan = { zoneLabel:"number", views:[
      { id:"top", label:"Vue de dessus", imageDataUrl:null, stepZones:[], machineLabels:[] },
      { id:"side", label:"Vue de face",  imageDataUrl:null, stepZones:[], machineLabels:[] },
    ]};
    if (!parsed.technicalPlan.zoneLabel) parsed.technicalPlan.zoneLabel = "number";
    if (parsed.technicalPlan.gridSize === undefined) parsed.technicalPlan.gridSize = 5;
    if (parsed.technicalPlan.legendFontSize === undefined) parsed.technicalPlan.legendFontSize = 9;
    parsed.technicalPlan.views.forEach(v => { if (v.enabled === undefined) v.enabled = true; if (v.id === 'side' && v.label === 'Vue de côté') v.label = 'Vue de face'; });
    if (parsed.pdfResolution !== undefined && parsed.pdfResolution <= 10) parsed.pdfResolution = 150;
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

  const tabs = [{ key:"header",label:"En-tête",icon:"◆" },{ key:"format",label:"Format",icon:"⊞" },{ key:"entree",label:"Entrée",icon:"▶" },{ key:"steps",label:"Process",icon:"⚙" },{ key:"sortie",label:"Sortie",icon:"◀" },{ key:"line",label:"Ligne",icon:"🏭" },{ key:"plan",label:"Plan",icon:"📐" },{ key:"export",label:"Export",icon:"↗" },{ key:"library",label:"Biblio",icon:"📚" }];

  return (
    <div style={{ display:"flex",height:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#212121",overflow:"hidden" }}>
      {/* ── Sidebar d'édition ── */}
      <div style={{ width:sidebarOpen?sidebarWidth:0,minWidth:sidebarOpen?sidebarWidth:0,transition:"width 0.2s,min-width 0.2s",display:"flex",flexDirection:"column",background:"#fff",overflow:"hidden" }}>
        {sidebarOpen && <>
          <div style={{ padding:"12px 14px",borderBottom:"1px solid #e0e0e0",background:"#C8102E",color:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div><div style={{ fontSize:14,fontWeight:700 }}>Éditeur d'affiche</div><div style={{ fontSize:10,opacity:0.8 }}>Ligne de production</div></div>
            <button onClick={()=>{if(confirm("Créer un nouveau document vide ?")){ resetId(); setVersionNotice(null); setData({...emptyData(), version: appVersion||""}); }}} style={{ background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.4)",color:"#fff",borderRadius:5,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600 }}>Nettoyer</button>
          </div>
          <div style={{ display:"flex",flexWrap:"wrap",borderBottom:"1px solid #e0e0e0" }}>
            {tabs.map(t=><button key={t.key} onClick={()=>setTab(t.key)} style={{ flex:1,minWidth:56,padding:"8px 4px",border:"none",borderBottom:tab===t.key?"2.5px solid #C8102E":"2.5px solid transparent",background:tab===t.key?"#FFF5F5":"transparent",color:tab===t.key?"#C8102E":"#888",fontSize:10,fontWeight:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1 }}><span style={{ fontSize:14 }}>{t.icon}</span>{t.label}</button>)}
          </div>
          <div style={{ flex:1,overflowY:"auto",padding:12,zoom:tab==='line'?1:Math.min(1.8,Math.max(1,sidebarWidth/360)).toFixed(3) }}>
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
            {tab === "steps" && <StepsEditor steps={data.steps} line={data.line||[]} icons={data.icons||[]} onChange={newSteps=>up(d=>{const deleted=new Set(d.steps.filter(s=>!newSteps.find(ns=>ns.id===s.id)).map(s=>s.id));d.steps=newSteps;if(deleted.size>0)(d.line||[]).forEach(m=>{if(deleted.has(m.stepId))m.stepId=null;});})} />}
            {tab === "sortie" && <BookendEditor data={data.sortie} onChange={sortie=>up(d=>{d.sortie=sortie;})} />}
            {tab === "line" && <>
              <div style={{ display:'flex',flexDirection:'column',gap:8,padding:'8px 10px',background:'#f5f5f5',borderRadius:8,marginBottom:4 }}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:'#555',minWidth:130 }}>Hauteur du bandeau</label>
                  <input type="range" min={5} max={60} step={1} value={data.bgImageHeight||25} onChange={e=>up(d=>{d.bgImageHeight=parseInt(e.target.value);})} style={{ flex:1,accentColor:'#C8102E' }} />
                  <span style={{ fontSize:11,fontWeight:700,color:'#C8102E',minWidth:32,textAlign:'right' }}>{data.bgImageHeight||25}%</span>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <label style={{ fontSize:11,fontWeight:600,color:'#555',minWidth:130 }}>Écart entre machines</label>
                  <input type="range" min={14} max={60} step={1} value={data.lineEdgeGap||14} onChange={e=>up(d=>{d.lineEdgeGap=parseInt(e.target.value);})} style={{ flex:1,accentColor:'#C8102E' }} />
                  <span style={{ fontSize:11,fontWeight:700,color:'#C8102E',minWidth:32,textAlign:'right' }}>{data.lineEdgeGap||14}</span>
                </div>
              </div>
              <LineEditor icons={data.icons||[]} line={data.line||[]} steps={data.steps}
                onChange={({icons,line})=>up(d=>{d.icons=icons;d.line=line;})}
                onRemoveMachine={id=>up(d=>{
                  d.line=(d.line||[]).filter(m=>m.id!==id).map(m=>({...m,next:(m.next||[]).filter(nid=>nid!==id)}));
                  (d.technicalPlan?.views||[]).forEach(v=>{v.machineLabels=(v.machineLabels||[]).filter(ml=>ml.lineId!==id);});
                  (d.steps||[]).forEach(st=>(st.operations||[]).forEach(op=>{if(op.lineItemId===id)op.lineItemId=null;}));
                })}
                onRemoveIcon={(iconId,removedIds)=>up(d=>{
                  d.icons=(d.icons||[]).filter(ic=>ic.id!==iconId);
                  d.line=(d.line||[]).filter(m=>m.iconId!==iconId).map(m=>({...m,next:(m.next||[]).filter(nid=>!removedIds.includes(nid))}));
                  (d.technicalPlan?.views||[]).forEach(v=>{v.machineLabels=(v.machineLabels||[]).filter(ml=>!removedIds.includes(ml.lineId));});
                  (d.steps||[]).forEach(st=>(st.operations||[]).forEach(op=>{if(removedIds.includes(op.lineItemId))op.lineItemId=null;}));
                })}
                libSvgFiles={libSvgFiles} onLoadSvg={loadSvgFromLib} /></>}
            {tab === "plan" && <TechnicalPlanEditor data={data} up={up} planTool={planTool} setPlanTool={setPlanTool} planSelStep={planSelStep} setPlanSelStep={setPlanSelStep} planSelMachine={planSelMachine} setPlanSelMachine={setPlanSelMachine} planMachineMode={planMachineMode} setPlanMachineMode={setPlanMachineMode} />}
            {tab === "export" && (
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
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
      {/* ── Poignée de redimensionnement ── */}
      {sidebarOpen && <div
        onMouseDown={e=>{e.preventDefault();const startX=e.clientX,startW=sidebarWidth;const onMove=ev=>{setSidebarWidth(Math.max(260,Math.min(700,startW+(ev.clientX-startX))));};const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);}}
        style={{ width:6,flexShrink:0,cursor:"ew-resize",background:"transparent",borderRight:"1px solid #e0e0e0" }}
      />}
      {/* ── Zone d'aperçu ── */}
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
        {(()=>{const sel=FORMATS[data.format]||{w:data.customW,h:data.customH};const pad=48;const posterW=Math.round(sel.w*MM_PX);const posterH=Math.round(sel.h*MM_PX);const sc=Math.min((previewSize.w-pad)/posterW,(previewSize.h-pad)/posterH);return <div ref={previewContainerRef} style={{ flex:1,overflow:"hidden",background:"#e8e8e8",display:"flex",justifyContent:"center",alignItems:"center" }}><div style={{ transform:`scale(${sc.toFixed(3)})`,transformOrigin:"center center" }}>{previewMode==='plan'
  ? <TechnicalPlanPreview data={data} appVersion={appVersion} interactive={true} planTool={planTool} planSelStep={planSelStep} planSelMachine={planSelMachine} planMachineMode={planMachineMode}
      onAddZone={(vi,zone)=>up(d=>{d.technicalPlan.views[vi].stepZones.push({id:uid(),...zone});})}
      onAddLabel={(vi,label)=>up(d=>{d.technicalPlan.views[vi].machineLabels.push({id:uid(),...label});})}
      onUpdateZone={(vi,zoneId,patch)=>up(d=>{const z=d.technicalPlan.views[vi].stepZones.find(z=>z.id===zoneId);if(z)Object.assign(z,patch);})}
      onUpdateLabel={(vi,labelId,patch)=>up(d=>{const m=d.technicalPlan.views[vi].machineLabels.find(m=>m.id===labelId);if(m)Object.assign(m,patch);})} />
  : <PosterPreview data={data} appVersion={appVersion} />}</div></div>;})()}
      </div>
      <style>{`@media print{body>div>div:first-child,[style*="borderBottom"]{display:none!important}[style*="overflow: auto"]{overflow:visible!important;padding:0!important;background:white!important}[style*="transform"]{transform:none!important}}`}</style>
    </div>
  );
}
