/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/editors/StepsEditor.jsx                        v2.0.0   ║
 * ║  Éditeur des étapes process (opérations, points de contrôle, tags)  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { produce } from "immer";
import { uid } from '../../utils/uid.js';
import { getLineLabel } from '../../utils/lineLabel.js';
import { Btn } from '../ui/Btn.jsx';
import { Input } from '../ui/Input.jsx';
import { SectionCard } from '../ui/SectionCard.jsx';
import { TagEditor } from '../tags/TagEditor.jsx';

/**
 * Éditeur des étapes du process (zone centrale du poster).
 * Chaque étape contient un titre, des tags de process, et des opérations.
 * Les opérations peuvent être normales ou des points de contrôle (barre bleue).
 * Supporte le réordonnement (↑↓) des étapes et des opérations.
 */
export const StepsEditor = ({ steps, onChange, line, icons }) => {
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
                    {(()=>{
                      const sortLabel=lbl=>{const m=lbl.match(/^([A-Z]+)(\d*)$/);return m?[m[1],parseInt(m[2]||0,10)]:['',0];};
                      return (line||[])
                        .map(m=>({m,lbl:getLineLabel(line,steps,m.id).label,ic:(icons||[]).find(i=>i.id===m.iconId)}))
                        .sort((a,b)=>{const[al,an]=sortLabel(a.lbl),[bl,bn]=sortLabel(b.lbl);return al<bl?-1:al>bl?1:an-bn;})
                        .map(({m,lbl,ic})=><option key={m.id} value={m.id}>{lbl} · {ic?.name||m.id}</option>);
                    })()}
                  </select>
                </div>
              )}
            </div>
          ))}
          <Btn small outline color="#888" onClick={()=>up(d=>{d.find(x=>x.id===step.id).operations.push({id:uid(),name:"Opération",tags:[]});})}>+ Opération</Btn>
          <Btn small outline color="#1565C0" onClick={()=>up(d=>{d.find(x=>x.id===step.id).operations.push({id:uid(),isControlPoint:true,name:"Point de contrôle",description:"",tags:[]});})}>+ PC</Btn>
        </SectionCard>
      ))}
      <Btn onClick={()=>up(d=>{d.push({id:uid(),title:"Nouvelle étape",tags:[],operations:[]});})} style={{ alignSelf:"flex-start" }}>+ Étape process</Btn>
    </div>
  );
};
