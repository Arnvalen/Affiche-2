/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/preview/LineFlowBand.jsx                       v2.0.0   ║
 * ║  Bande SVG de la ligne de production (DAG, flèches, icônes, zones)  ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { Component } from 'react';
import { useMemo } from 'react';
import { TAG_COLORS } from '../../constants.js';
import { getZoneColor } from '../../utils/colors.js';
import { svgUrl, getSVGRatio } from '../../utils/svgUtils.js';
import { computeLayout } from '../../utils/dagLayout.js';

export class LineFlowErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.error('LineFlowBand:', e); }
  render() {
    if (this.state.err)
      return <div style={{height:this.props.bh,background:'#fafafa',borderTop:'1px solid #eee',
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#999'}}>
        Erreur de rendu (voir console)</div>;
    return this.props.children;
  }
}

export const LineFlowBand = ({ data, bh, s, pal, posterW }) => {
  const nodes = data.line || [];
  const steps = data.steps || [];
  const layout = useMemo(() => computeLayout(nodes, steps), [nodes, steps]);
  const { col, track, numCols, maxTracks, zoneSpans, zoneKeys } = layout;
  if (!nodes.length) return null;

  // ── Dimensionnement ──────────────────────────────────────────
  const pad = 8 * s;
  const availW = posterW - pad * 2;
  const letterR = Math.max(6, 9 * s);
  const nameH = 9 * s;
  const topMargin = letterR * 2 + 4 * s;
  const arrowLen = 7 * s;
  const zoneH = bh - topMargin - 2 * s;
  const rowH  = zoneH / maxTracks;

  const nodesAtCol = {};
  nodes.forEach(n => { const c = col[n.id]; nodesAtCol[c] = (nodesAtCol[c]||0) + 1; });
  const occupiedCols = new Set(Object.keys(nodesAtCol).map(Number));
  const gapCount     = numCols - occupiedCols.size;
  const nodeColCount = occupiedCols.size;
  const gapW = Math.max(arrowLen * 3 + 4 * s, 20 * s);
  const iconSize = Math.max(12, rowH - letterR * 2 - nameH - 10 * s);
  const rawNodeColW = nodeColCount > 0 ? (availW - gapCount * gapW) / nodeColCount : availW;
  const nodeColW    = Math.min(rawNodeColW, Math.max(16 * s, iconSize + 8 * s));

  const colMaxImgW = {};
  occupiedCols.forEach(c => {
    const nodesInCol = nodes.filter(n => (col[n.id] ?? 0) === c);
    colMaxImgW[c] = Math.max(8*s, ...nodesInCol.map(n => {
      const icon = (data.icons||[]).find(ic => ic.id === n.iconId);
      if (!icon) return iconSize * 0.5;
      const r = getSVGRatio(icon.svgData);
      return Math.min(iconSize * (n.size||1) * r, nodeColW * 0.9);
    }));
  });
  const minEdgeGap = Math.max((data.lineEdgeGap ?? 14) * s, arrowLen * 2);
  const colW = {};
  occupiedCols.forEach(c => { colW[c] = colMaxImgW[c] + minEdgeGap; });

  const totalW = [...occupiedCols].reduce((sum, c) => sum + colW[c], 0) + gapCount * gapW;
  const hPad   = pad + Math.max(0, availW - totalW) / 2;

  const _colStarts = (() => {
    const a = []; let x = hPad;
    for (let i = 0; i < numCols; i++) { a.push(x); x += occupiedCols.has(i) ? colW[i] : gapW; }
    a.push(x);
    return a;
  })();
  const colLeft = (ci) => _colStarts[Math.min(ci, numCols)] ?? (hPad + totalW);
  const colCx   = (ci) => _colStarts[ci] + (occupiedCols.has(ci) ? (colW[ci] ?? gapW) : gapW) / 2;

  const cx = id => colCx(col[id] || 0);
  const cy = id => {
    const t = track[id] || 0;
    const rowBottomY = topMargin + (t + 1) * rowH - 2 * s;
    return rowBottomY - nameH - 6 * s - iconSize / 2;
  };

  const totalSteps = steps.length;
  const arrowId = 'lf-arr-' + (pal.primary||'').replace(/[^a-zA-Z0-9]/g,'');

  const getIconHalfW = (n) => {
    const icon = (data.icons||[]).find(ic => ic.id === n.iconId);
    if (!icon) return iconSize * 0.5;
    const r = getSVGRatio(icon.svgData);
    const iSz = iconSize * (n.size || 1);
    const cw = colW[col[n.id] ?? 0] ?? nodeColW;
    return Math.min(iSz * r, cw * 0.88) / 2;
  };

  return (
    <svg width={posterW} height={bh} style={{flexShrink:0,display:'block',background:'#fafafa',borderTop:'1px solid #eee',overflow:'hidden'}}>
      <defs>
        <marker id={arrowId}
          markerWidth={arrowLen} markerHeight={5*s}
          refX={0} refY={2.5*s}
          orient="auto" markerUnits="userSpaceOnUse">
          <path d={`M0,0 L0,${5*s} L${arrowLen},${2.5*s} z`} fill={pal.accent||pal.primary} />
        </marker>
      </defs>

      {/* ── 1. Zone backgrounds ── */}
      {zoneKeys.map((k) => {
        if (k === '__none__') return null;
        const si = steps.findIndex(st=>st.id===k);
        if (si < 0) return null;
        const color = getZoneColor(pal, si, totalSteps);
        const { startCol, endCol } = zoneSpans[k];
        const rx = colLeft(startCol);
        const rw = colLeft(endCol + 1) - colLeft(startCol);
        const ry = topMargin;
        const rh = bh - topMargin - 2 * s;
        const labelText = (data.lineZoneLabel||'number')==='title' ? (steps[si]?.title||'?') : String(si+1);
        const labelX = rx + rw / 2;
        return (
          <g key={k}>
            <rect x={rx} y={ry} width={rw} height={rh}
              rx={5*s} fill={color+'18'} stroke={color} strokeWidth={1.5*s} />
            {(data.lineZoneLabel||'number')==='title'
              ? <text x={labelX} y={ry-3*s} textAnchor="middle" fill={color}
                  fontSize={Math.max(7,9*s)} fontWeight={700} fontFamily="sans-serif">{labelText}</text>
              : <g transform={`translate(${labelX},${letterR + s})`}>
                  <circle r={letterR} fill={color}/>
                  <text textAnchor="middle" dy="0.35em" fill="#fff" fontSize={Math.max(8,12*s)} fontWeight={700} fontFamily="monospace">{labelText}</text>
                </g>
            }
          </g>
        );
      })}

      {/* ── 2. Arêtes ── */}
      {nodes.map(n => {
        const srcNexts = n.next || [];
        const fanCnt = srcNexts.length;
        return srcNexts.map((nid, fanOutIdx) => {
          const tgt = nodes.find(m => m.id === nid);
          if (!tgt) return null;
          const si = n.stepId ? steps.findIndex(st => st.id === n.stepId) : -1;
          const color = si >= 0 ? getZoneColor(pal, si, totalSteps) : (pal.accent || pal.primary);
          const sw = Math.max(1, 1.5 * s);
          const exitX = cx(n.id) + getIconHalfW(n) + 2 * s;
          const tipX     = cx(tgt.id) - getIconHalfW(tgt) - 2 * s;
          const pathEndX = tipX - arrowLen;
          if (pathEndX <= exitX) return null;
          const srcY = cy(n.id);
          const tgtY = cy(tgt.id);
          let d;
          if (Math.abs(srcY - tgtY) < 1) {
            d = `M${exitX},${srcY} H${pathEndX}`;
          } else {
            const tgtColLeft = colLeft(col[tgt.id]);
            let laneX;
            if (tgtColLeft >= exitX) {
              const crossZone = (n.stepId||'__none__') !== (tgt.stepId||'__none__');
              if (crossZone) {
                const gapCol = col[tgt.id] - 1;
                laneX = (!occupiedCols.has(gapCol) && gapCol >= 0) ? colCx(gapCol) : tgtColLeft;
              } else {
                laneX = tgtColLeft;
              }
            } else {
              laneX = exitX + (pathEndX - exitX) * (fanCnt > 1 ? (fanOutIdx + 1) / (fanCnt + 1) : 0.5);
            }
            d = `M${exitX},${srcY} H${laneX} V${tgtY} H${pathEndX}`;
          }
          return <path key={n.id + '-' + nid} d={d} fill="none"
            stroke={color} strokeWidth={sw} markerEnd={`url(#${arrowId})`} />;
        });
      })}

      {/* ── 3. Nœuds ── */}
      {nodes.map(n => {
        const icon = (data.icons||[]).find(ic=>ic.id===n.iconId);
        if (!icon) return null;
        const si = n.stepId ? steps.findIndex(st=>st.id===n.stepId) : -1;
        const color = si>=0 ? getZoneColor(pal,si,totalSteps) : '#9E9E9E';
        const k = n.stepId || '__none__';
        const localColIdx = col[n.id] - (zoneSpans[k]?.startCol ?? 0);
        const letter = String.fromCharCode(65 + localColIdx);
        const rowNum = (track[n.id]||0) + 1;
        const showRow = (nodesAtCol[col[n.id]]||1) > 1;
        const label = showRow ? `${letter}${rowNum}` : letter;
        const iSz = iconSize * (n.size||1);
        const x = cx(n.id); const y = cy(n.id);
        const linkedOp = data.showLineTags!==false
          ? (()=>{ for(const st of steps) for(const op of (st.operations||[])) if(op.lineItemId===n.id) return op; return null; })()
          : null;
        const ratio = getSVGRatio(icon.svgData);
        const rawW = iSz * ratio;
        const cw = colW[col[n.id] ?? 0] ?? nodeColW;
        const imgW = Math.min(rawW, cw * 0.88);
        const imgH = imgW / ratio;
        return (
          <g key={n.id}>
            <image href={svgUrl(icon.svgData)}
              x={x-imgW/2} y={y-imgH/2} width={imgW} height={imgH}
              preserveAspectRatio="xMidYMid meet" />
            <circle cx={x} cy={y-imgH/2-letterR-1*s} r={letterR} fill={color}/>
            <text x={x} y={y-imgH/2-letterR-1*s} textAnchor="middle" dy="0.35em" fill="#fff"
              fontSize={Math.max(5, Math.min(12*s, letterR*1.4))} fontWeight={700} fontFamily="monospace">{label}</text>
            <text x={x} y={y+imgH/2+8*s} textAnchor="middle" fill="#555"
              fontSize={Math.max(6,8*s)} fontWeight={600} fontFamily="sans-serif"
              style={{dominantBaseline:'hanging'}}>{icon.name}</text>
            {linkedOp && (linkedOp.tags||[]).length>0 && linkedOp.tags.map((t,ti)=>{
              const tc = TAG_COLORS[t.type]||{bg:'#eee',color:'#333',border:'#ccc'};
              const tw = Math.max(16, 20*s); const th = Math.max(8, 11*s);
              return <rect key={t.id}
                x={x+(ti-linkedOp.tags.length/2+0.5)*tw-tw/2} y={y-imgH/2-letterR*2-th-1*s}
                width={tw} height={th} rx={2} fill={tc.bg} stroke={tc.border} strokeWidth={0.5}/>;
            })}
          </g>
        );
      })}
    </svg>
  );
};
