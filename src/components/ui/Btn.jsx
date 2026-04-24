/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/ui/Btn.jsx                                     v2.0.0   ║
 * ║  Bouton stylisé — variantes couleur, small, outline                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/** Bouton stylisé avec variantes : couleur, petite taille, outline. Couleur par défaut = rouge Nexans. */
export const Btn = ({ children, onClick, color="#C8102E", small, outline, style:st, ...r }) =>
  <button onClick={onClick} style={{ display:"inline-flex",alignItems:"center",gap:4,padding:small?"3px 8px":"6px 12px",borderRadius:5,border:outline?`1.5px solid ${color}`:"none",background:outline?"transparent":color,color:outline?color:"#fff",fontSize:small?11:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",...st }} {...r}>{children}</button>;
