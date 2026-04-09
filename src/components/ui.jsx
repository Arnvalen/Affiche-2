/**
 * @file        ui.jsx
 * @module      src/components/ui
 * @description Primitives UI réutilisables : bouton (Btn), champ texte (Input),
 *              carte dépliable (SectionCard).
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     2026-04-09
 * @modified    2026-04-09
 * @version     1.0.0
 *
 * @exports {Component} Btn
 * @exports {Component} Input
 * @exports {Component} SectionCard
 */
import { useState } from "react";

/* ═══════════════════ UI PRIMITIVES ═══════════════════ */

/** Bouton stylisé avec variantes : couleur, petite taille, outline. Couleur par défaut = rouge Nexans. */
export const Btn = ({ children, onClick, color="#C8102E", small, outline, style:st, ...r }) => <button onClick={onClick} style={{ display:"inline-flex",alignItems:"center",gap:4,padding:small?"3px 8px":"6px 12px",borderRadius:5,border:outline?`1.5px solid ${color}`:"none",background:outline?"transparent":color,color:outline?color:"#fff",fontSize:small?11:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",...st }} {...r}>{children}</button>;

/** Champ texte stylisé avec gestion simplifiée du onChange (reçoit directement la valeur, pas l'event). */
export const Input = ({ value, onChange, placeholder, style:st, ...r }) => <input value={value} onChange={e=>onChange(e.target.value)} onFocus={e=>e.target.select()} placeholder={placeholder} style={{ width:"100%",padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit",outline:"none",...st }} {...r} />;

/** Carte dépliable avec titre, contenu et actions optionnelles dans la barre de titre. */
export const SectionCard = ({ title, children, actions, defaultOpen=true }) => { const [open,setOpen]=useState(defaultOpen); return <div style={{background:"#fff",borderRadius:8,border:"1px solid #e0e0e0",overflow:"hidden",marginBottom:10}}><div onClick={()=>setOpen(!open)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#f5f5f5",cursor:"pointer",userSelect:"none"}}><span style={{fontSize:12,fontWeight:700,color:"#424242"}}>{open?"▾":"▸"} {title}</span>{actions&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}>{actions}</div>}</div>{open&&<div style={{padding:10}}>{children}</div>}</div>; };
