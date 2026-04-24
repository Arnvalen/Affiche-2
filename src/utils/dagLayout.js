/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  utils/dagLayout.js                                        v2.0.0   ║
 * ║  Moteur de layout DAG — placement des machines en colonnes/tracks   ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════ DAG LAYOUT ENGINE ═══════════════════ */

// Colonnes = profondeur DAG (flux horizontal gauche→droite), avec forçage de l'ordre inter-zones.
// Lignes  = branches parallèles : chaque split secondaire obtient une nouvelle ligne.
// Label   = lettre de colonne (dans la zone) + numéro de ligne si parallèles, ex : A1, B2, C.
export function computeLayout(nodes, steps) {
  if (!nodes.length) return { col:{}, track:{}, numCols:1, maxTracks:1, zoneSpans:{}, zoneKeys:[] };

  const stepIds = (steps||[]).map(s=>s.id);
  const zk = n => n.stepId || '__none__';

  // Grouper par zone (préserve l'ordre de data.line dans chaque zone)
  const byZone = {};
  nodes.forEach(n => { const k=zk(n); if(!byZone[k])byZone[k]=[]; byZone[k].push(n); });
  const zoneKeys = [...stepIds.filter(k=>byZone[k]), ...(byZone['__none__']?['__none__']:[])];

  // Prédécesseurs + topologie
  const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const pred = Object.fromEntries(nodes.map(n=>[n.id, []]));
  nodes.forEach(n => (n.next||[]).forEach(nid => { if(pred[nid]) pred[nid].push(n.id); }));
  const inDeg = Object.fromEntries(nodes.map(n=>[n.id, pred[n.id].length]));
  const q = nodes.filter(n=>inDeg[n.id]===0).map(n=>n.id);
  const topo = [];
  while (q.length) {
    const id = q.shift(); topo.push(id);
    (byId[id]?.next||[]).forEach(nid => { if(byId[nid]) { inDeg[nid]--; if(!inDeg[nid]) q.push(nid); } });
  }
  nodes.forEach(n => { if(!topo.includes(n.id)) topo.push(n.id); });

  // Profondeur DAG brute (plus long chemin depuis une source)
  const rawD = {};
  topo.forEach(id => { rawD[id] = pred[id].length ? Math.max(...pred[id].map(p=>rawD[p]+1)) : 0; });

  // Colonnes absolues : profondeur brute + décalage de zone (respect de l'ordre des étapes)
  // Les nœuds isolés (aucune connexion entrante ni sortante) sont placés en fin de zone
  // pour ne pas perturber l'offset des nœuds connectés.
  const col = {};
  const zoneSpans = {};
  let zoneStart = 0;
  zoneKeys.forEach(k => {
    const zn = byZone[k];
    const connected = zn.filter(n => pred[n.id].length > 0 || (n.next||[]).length > 0);
    const isolated  = zn.filter(n => pred[n.id].length === 0 && (n.next||[]).length === 0);
    let zoneEndCol = zoneStart;

    if (connected.length > 0) {
      // Regrouper les nœuds connectés en composantes connexes INTERNES à la zone.
      // Chaque composante calcule son propre offset (minR indépendant).
      // → évite qu'une chaîne A2→B2 (rawD=0,1) pollue l'offset de J→K→…→P (rawD=9+).
      const zoneNodeIds = new Set(zn.map(n => n.id));
      const compOf = {};
      const components = [];
      connected.forEach(n => {
        if (compOf[n.id] !== undefined) return;
        const comp = [];
        const q = [n.id];
        const seen = new Set([n.id]);
        while (q.length) {
          const id = q.shift();
          compOf[id] = components.length;
          comp.push(byId[id]);
          (byId[id]?.next||[]).forEach(nid => {
            if (!seen.has(nid) && zoneNodeIds.has(nid)) { seen.add(nid); q.push(nid); }
          });
          pred[id].forEach(pid => {
            if (!seen.has(pid) && zoneNodeIds.has(pid)) { seen.add(pid); q.push(pid); }
          });
        }
        components.push(comp);
      });

      components.forEach(comp => {
        const minR = Math.min(...comp.map(n => rawD[n.id]||0));
        const off  = Math.max(0, zoneStart - minR);
        comp.forEach(n => { col[n.id] = (rawD[n.id]||0) + off; });
        zoneEndCol = Math.max(zoneEndCol, ...comp.map(n => col[n.id]));
      });
    }

    // Nœuds isolés : placés en colonne A de la zone (= colonne des sources)
    const colA = connected.length > 0
      ? Math.min(...connected.map(n=>col[n.id]))
      : zoneStart;
    isolated.forEach(n => { col[n.id] = colA; });
    const allCols = zn.map(n=>col[n.id]);
    zoneSpans[k] = { startCol: Math.min(...allCols), endCol: Math.max(...allCols) };
    zoneStart = Math.max(...allCols) + 2;
  });

  // Lignes (tracks) : locales par colonne — chaque colonne repart de 0
  const track = {};
  const colUsed = {};

  const allocTrack = (c) => {
    const used = colUsed[c] || new Set();
    let t = 0; while (used.has(t)) t++;
    return t;
  };
  const assignTrack = (id, t) => {
    track[id] = t;
    const c = col[id];
    if (!colUsed[c]) colUsed[c] = new Set();
    colUsed[c].add(t);
  };

  topo.forEach(id => {
    const ps = pred[id];
    const c = col[id];
    if (ps.length === 0) {
      assignTrack(id, allocTrack(c));
    } else if (ps.length === 1) {
      const pId = ps[0];
      const isPrimary = (byId[pId]?.next||[])[0] === id;
      const preferred = isPrimary ? (track[pId] ?? 0) : null;
      if (preferred !== null && !(colUsed[c]?.has(preferred))) {
        assignTrack(id, preferred);
      } else {
        assignTrack(id, allocTrack(c));
      }
    } else {
      // merge → minimum des tracks de prédécesseurs, si libre dans cette colonne
      const minP = Math.min(...ps.map(p => track[p] ?? 0));
      if (!(colUsed[c]?.has(minP))) {
        assignTrack(id, minP);
      } else {
        assignTrack(id, allocTrack(c));
      }
    }
  });

  // Réordonner les tracks PAR ZONE : branche la plus longue → track 0 (haut).
  zoneKeys.forEach(k => {
    const zn = byZone[k];
    const zoneCnt = {};
    const crossZoneTracks = new Set();
    zn.forEach(n => {
      const t = track[n.id] ?? 0;
      zoneCnt[t] = (zoneCnt[t] || 0) + 1;
      const hasCross =
        (n.next||[]).some(nid => (byId[nid]?.stepId||'__none__') !== k) ||
        pred[n.id].some(pid  => (byId[pid]?.stepId ||'__none__') !== k);
      if (hasCross) crossZoneTracks.add(t);
    });
    const sorted = Object.keys(zoneCnt).map(Number).sort((a, b) => {
      const cntDiff = zoneCnt[b] - zoneCnt[a];
      if (cntDiff !== 0) return cntDiff;
      return (crossZoneTracks.has(b) ? 1 : 0) - (crossZoneTracks.has(a) ? 1 : 0);
    });
    const remap = Object.fromEntries(sorted.map((oldT, newT) => [oldT, newT]));
    zn.forEach(n => { track[n.id] = remap[track[n.id] ?? 0] ?? (track[n.id] ?? 0); });
  });

  const numCols  = nodes.length ? Math.max(...nodes.map(n=>col[n.id]))+1 : 1;
  const maxTracks= nodes.length ? Math.max(...nodes.map(n=>track[n.id]))+1 : 1;
  return { col, track, numCols, maxTracks, zoneSpans, zoneKeys };
}
