/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          NEXANS — Éditeur d'affiche de ligne de production          ║
 * ║  components/tags/QRCodeSVG.jsx                             v2.0.0   ║
 * ║  Génération et rendu d'un QR code SVG via la lib qrcode             ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Auteur   Arnaud Valente Jacot-Descombes                            ║
 * ║           Stagiaire EPFL                                            ║
 * ║           Quality Management — NEXANS Suisse SA                     ║
 * ║           arnaud_jacot@hotmail.com · arnvalen.ch                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * Rendu SVG natif d'un QR code à partir d'une URL.
 * Utilise la lib `qrcode` pour générer la matrice de modules,
 * puis dessine chaque module comme un <rect> SVG.
 * Avantage : vectoriel pur, pas de raster → qualité parfaite en export SVG/PDF.
 */
export const QRCodeSVG = ({ url, size, bgColor }) => {
  const modules = useMemo(() => {
    try { return QRCode.create(url, { errorCorrectionLevel: "L" }).modules; }
    catch { return null; }
  }, [url]);
  if (!modules) return null;
  const n = modules.size, cell = size / (n + 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", borderRadius: 2 }}>
      <rect x="0" y="0" width={size} height={size} fill={bgColor} rx="2" />
      {Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) =>
          modules.get(r, c) ? <rect key={`${r}_${c}`} x={(c+1)*cell} y={(r+1)*cell} width={cell+0.5} height={cell+0.5} fill="#000" /> : null
        )
      )}
    </svg>
  );
};
