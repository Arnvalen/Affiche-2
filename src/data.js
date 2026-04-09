/**
 * @file        data.js
 * @module      src/data
 * @description Fonctions de création et de migration du modèle de données
 *              de l'affiche. Aucun effet de bord — fonctions pures.
 *
 * @author      Arnaud Valente Jacot-Descombes
 * @department  Quality Management — Nexans
 * @created     2026-04-09
 * @modified    2026-04-09
 * @version     1.0.0
 *
 * @exports {function} emptyData    — données minimales (affiche vide)
 * @exports {function} defaultData  — données avec exemples
 * @exports {function} applyLoaded  — fusionne un JSON importé avec emptyData
 */

// uid est importé pour usage futur (par ex. si defaultData génère des IDs dynamiques)
// _id est exporté depuis theme.js pour permettre à applyLoaded de connaître la valeur courante
import { _id } from "./theme";

// Imports bruts des SVG embarqués dans defaultData
// (Vite ?raw = string du fichier SVG, équivalent aux svgData inlinés dans App.jsx)
// Note : Bain.svg n'existe pas dans library/ — son SVG est inliné directement ci-dessous.
import bobinoirSvg    from "../library/Bobinoir.svg?raw";
import cabestanSvg    from "../library/Cabestan.svg?raw";
import devidoirSvg    from "../library/Devidoir.svg?raw";
import extrudeuseSvg  from "../library/Extrudeuse.svg?raw";
import freinSvg       from "../library/Frein.svg?raw";
import prechauffeurSvg from "../library/Prechauffeur.svg?raw";
import redresseurSvg  from "../library/Redresseur.svg?raw";
import sikoraSvg      from "../library/Sikora.svg?raw";
import sikoraSparkSvg from "../library/Sikora_spark.svg?raw";

/* ═══════════════════ DEFAULT DATA ═══════════════════ */

/**
 * Données minimales (affiche vide).
 * Retourne un nouvel objet à chaque appel.
 */
export const emptyData = () => ({
  header: { reference: "", processName: "", subtitle: "", logoDataUrl: "" },
  format: "A1-paysage", customW: 800, customH: 500, maxCols: 0, fontScale: 7, qrSize: 32, forceFormat: false,
  bookendWidth: 220, headerHeight: 56, bgImageHeight: 25, showLineTags: true, lineZoneLabel: "number", pdfResolution: 150,
  entree: { tags: [], sections: [] },
  sortie: { tags: [], sections: [] },
  steps: [], backgroundImage: "", icons: [], line: [], version: "",
  technicalPlan: { zoneLabel:"number", views: [
    { id:"top",  label:"Vue de dessus", imageDataUrl:null, stepZones:[], machineLabels:[] },
    { id:"side", label:"Vue de côté",   imageDataUrl:null, stepZones:[], machineLabels:[] },
  ]},
});

/**
 * Données initiales de démonstration (ligne d'extrusion mono-couche Nexans).
 * Retourne un nouvel objet à chaque appel (IDs uniques via uid()).
 * Sert aussi de référence pour la structure attendue du modèle de données.
 *
 * Note : les svgData des icônes sont chargés depuis library/ via ?raw imports
 * (équivalent aux chaînes SVG inlinées dans App.jsx).
 * Le logo et l'image de fond ne sont pas embarqués ici — ils restent vides
 * par défaut et sont chargés par App.jsx au démarrage si nécessaire.
 */
export const defaultData = () => ({
  header: { reference: "", processName: "", subtitle: "", logoDataUrl: "" },
  format: "A1-paysage", customW: 800, customH: 500, maxCols: 0, fontScale: 7, qrSize: 32, forceFormat: false, bookendWidth: 220, headerHeight: 56, bgImageHeight: 25, showLineTags: true, lineZoneLabel: "number", pdfResolution: 150, palette: "nexans",
  entree: { tags: [], sections: [] },
  steps: [],
  sortie: { tags: [], sections: [] },
  backgroundImage: "",
  icons: [
    {
      "id": "_101",
      "name": "Bain",
      "description": "",
      "svgData": "<svg width=\"1035\" height=\"1321\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xml:space=\"preserve\" overflow=\"hidden\"><g transform=\"translate(-1133 -578)\"><path d=\"M1143.5 634.168C1143.5 608.946 1163.95 588.5 1189.17 588.5L2111.83 588.5C2137.05 588.5 2157.5 608.946 2157.5 634.168L2157.5 816.832C2157.5 842.054 2137.05 862.5 2111.83 862.5L1189.17 862.5C1163.95 862.5 1143.5 842.054 1143.5 816.832Z\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-miterlimit=\"8\" fill=\"none\" fill-rule=\"evenodd\"/><g><g><g><path d=\"M1598.96 751.542C1598.96 779.731 1621.81 802.583 1650 802.583 1678.19 802.583 1701.04 779.731 1701.04 751.542 1701.04 719.079 1650 647.417 1650 647.417 1650 647.417 1598.96 719.283 1598.96 751.542ZM1696.96 751.542C1696.96 777.476 1675.93 798.5 1650 798.5 1624.07 798.5 1603.04 777.476 1603.04 751.542 1603.04 725.624 1638.78 671.08 1650 654.594 1661.23 671.043 1696.96 725.449 1696.96 751.542Z\" stroke=\"#000000\" stroke-width=\"25.0212\" fill=\"none\"/></g></g></g><path d=\"M1143.5 725.5 1143.5 1726.52\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M2157.5 725.5 2157.5 1725.79\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M0 0 686.184 0.0046916\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 0 0 -1 1308.5 1887.5)\"/><path d=\"M1306.22 1887.5C1217.03 1888.17 1144.18 1816.19 1143.5 1726.72 1143.5 1726.56 1143.5 1726.4 1143.5 1726.24\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\"/><path d=\"M160.281 0.0046063C249.472-0.670683 322.322 71.3097 322.995 160.777 322.996 160.939 322.997 161.101 322.998 161.263\" stroke=\"#000000\" stroke-width=\"20.625\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-miterlimit=\"10\" fill=\"none\" fill-rule=\"evenodd\" transform=\"matrix(1 -1.22465e-16 -1.22465e-16 -1 1834.5 1887.5)\"/></g></svg>"
    },
    {
      "id": "_103",
      "name": "Bobinoir",
      "description": "",
      "svgData": bobinoirSvg
    },
    {
      "id": "_105",
      "name": "Cabestan",
      "description": "",
      "svgData": cabestanSvg
    },
    {
      "id": "_107",
      "name": "Devidoir",
      "description": "",
      "svgData": devidoirSvg
    },
    {
      "id": "_109",
      "name": "Extrudeuse",
      "description": "",
      "svgData": extrudeuseSvg
    },
    {
      "id": "_111",
      "name": "Frein",
      "description": "",
      "svgData": freinSvg
    },
    {
      "id": "_113",
      "name": "Prechauffeur",
      "description": "",
      "svgData": prechauffeurSvg
    },
    {
      "id": "_115",
      "name": "Redresseur",
      "description": "",
      "svgData": redresseurSvg
    },
    {
      "id": "_117",
      "name": "Sikora",
      "description": "",
      "svgData": sikoraSvg
    },
    {
      "id": "_119",
      "name": "Sikora_spark",
      "description": "",
      "svgData": sikoraSparkSvg
    }
  ],
  line: [], version: "",
  technicalPlan: { zoneLabel:"number", views: [
    { id:"top",  label:"Vue de dessus", imageDataUrl:null, stepZones:[], machineLabels:[] },
    { id:"side", label:"Vue de côté",   imageDataUrl:null, stepZones:[], machineLabels:[] },
  ]},
});

/**
 * Fusionne un JSON importé avec emptyData : migrations de rétrocompatibilité.
 * Fonction pure — ne modifie pas d'état React.
 * Après appel, passer le résultat à setData() dans le composant App.
 *
 * @param {object} parsed — objet JSON parsé depuis un fichier .json importé
 * @param {number} currentId — valeur courante de _id (pour avancer le compteur)
 * @returns {{ data: object, nextId: number }}
 */
export const applyLoaded = (parsed, currentId) => {
  // Avance le générateur d'IDs pour éviter les collisions avec les IDs chargés
  const nums = JSON.stringify(parsed).match(/"_(\d+)"/g) || [];
  const max = nums.reduce((m, s) => Math.max(m, parseInt(s.slice(2, -1))), currentId - 1);
  const nextId = max >= currentId ? max + 1 : currentId;

  // Rétrocompatibilité : ajouter technicalPlan si absent
  if (!parsed.technicalPlan) parsed.technicalPlan = { zoneLabel:"number", views:[
    { id:"top", label:"Vue de dessus", imageDataUrl:null, stepZones:[], machineLabels:[] },
    { id:"side", label:"Vue de côté",  imageDataUrl:null, stepZones:[], machineLabels:[] },
  ]};
  if (!parsed.technicalPlan.zoneLabel) parsed.technicalPlan.zoneLabel = "number";
  if (parsed.pdfResolution !== undefined && parsed.pdfResolution <= 10) parsed.pdfResolution = 150;

  return { data: parsed, nextId };
};
