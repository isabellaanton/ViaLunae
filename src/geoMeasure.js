// Contas de medida na esfera lunar (funções puras, sem Cesium; testadas em test/analysis.test.js)
const R_KM = 1737.4;

export function surfaceDistanceKm(a, b) {
  // a, b: { lat, lon } em graus — distância de círculo máximo
  const p1 = a.lat * (Math.PI / 180), p2 = b.lat * (Math.PI / 180);
  const dl = (b.lon - a.lon) * (Math.PI / 180), dp = p2 - p1;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthKm(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += surfaceDistanceKm(pts[i - 1], pts[i]);
  return s;
}

// área de um polígono na esfera (km²), fórmula de excesso esférico por segmentos
export function sphericalAreaKm2(pts) {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    let dl = (b.lon - a.lon) * (Math.PI / 180);
    if (dl > Math.PI) dl -= 2 * Math.PI;
    if (dl < -Math.PI) dl += 2 * Math.PI;
    sum += dl * (2 + Math.sin(a.lat * (Math.PI / 180)) + Math.sin(b.lat * (Math.PI / 180)));
  }
  return Math.abs((sum * R_KM * R_KM) / 2);
}

// inclinação (graus) e direção da descida (azimute) a partir das alturas a leste/oeste/norte/sul
export function slopeFromHeights({ e, w, n, s }, baseM) {
  const dzdx = (e - w) / (2 * baseM); // subida para leste
  const dzdy = (n - s) / (2 * baseM); // subida para norte
  const slope = Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI);
  let downAz = Math.atan2(-dzdx, -dzdy) * (180 / Math.PI);
  if (downAz < 0) downAz += 360;
  return { slopeDeg: slope, downhillAzDeg: downAz };
}
