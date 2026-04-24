/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  utils/uid.js                                              v2.0.0   ║
 * ║  Générateur d'IDs uniques — compteur global partagé entre modules   ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/** Générateur d'IDs uniques pour les éléments du modèle de données */
let _id = 120;
export const uid = () => `_${_id++}`;

/** Avance le compteur après chargement d'un document, pour éviter les collisions d'IDs */
export const advanceIdFromData = (parsed) => {
  const nums = JSON.stringify(parsed).match(/"_(\d+)"/g) || [];
  const max = nums.reduce((m, s) => Math.max(m, parseInt(s.slice(2, -1))), _id - 1);
  if (max >= _id) _id = max + 1;
};

/** Remet le compteur à 120 (nouveau document vide) */
export const resetId = () => { _id = 120; };
