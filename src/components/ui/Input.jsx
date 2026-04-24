/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/ui/Input.jsx                                   v2.0.0   ║
 * ║  Champ texte — onChange reçoit la valeur directement (pas l'event)  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/** Champ texte stylisé avec gestion simplifiée du onChange (reçoit directement la valeur, pas l'event). */
export const Input = ({ value, onChange, placeholder, style:st, ...r }) =>
  <input value={value} onChange={e=>onChange(e.target.value)} onFocus={e=>e.target.select()} placeholder={placeholder} style={{ width:"100%",padding:"5px 8px",borderRadius:4,border:"1.5px solid #ddd",fontSize:12,fontFamily:"inherit",outline:"none",...st }} {...r} />;
