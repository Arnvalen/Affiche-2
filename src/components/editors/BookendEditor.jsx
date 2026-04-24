/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/editors/BookendEditor.jsx                      v2.0.0   ║
 * ║  Éditeur des panneaux Entrée et Sortie (sections › éléments › tags) ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { produce } from "immer";
import { uid } from '../../utils/uid.js';
import { Btn } from '../ui/Btn.jsx';
import { Input } from '../ui/Input.jsx';
import { SectionCard } from '../ui/SectionCard.jsx';
import { TagEditor } from '../tags/TagEditor.jsx';

/**
 * Éditeur pour les panneaux Entrée ou Sortie.
 * Structure : tags du panneau + catégories (sections) > éléments > tags par élément.
 */
export const BookendEditor = ({ data, onChange }) => {
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
      <Btn small outline color="#555" onClick={()=>up(d=>{d.sections.push({id:uid(),title:"Nouvelle catégorie",items:[]});})}>+ Catégorie</Btn>
    </div>
  );
};
