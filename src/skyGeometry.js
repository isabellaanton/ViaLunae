// Posição do Sol e da Terra no céu de qualquer coordenada da Lua (esfera lisa), a partir de dados da Horizons:
// ponto subsolar, ponto sub-Terra e distância Terra–Lua (public/data/ephem/global.json).
// O Sol é tratado como no infinito (paralaxe < 0,001°); a Terra usa o vetor real (paralaxe de até ~1°).
export const MOON_RADIUS_KM = 1737.4;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function unitVector(latDeg, lonDeg) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

// referencial local Leste/Norte/Cima de um ponto
export function enuFrame(latDeg, lonDeg) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  const sl = Math.sin(la), cl = Math.cos(la), so = Math.sin(lo), co = Math.cos(lo);
  return {
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
    up: [cl * co, cl * so, sl],
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// vetor (qualquer tamanho) -> azimute (graus, a partir do norte, sentido leste) e elevação
export function azEl(frame, v) {
  const e = dot(v, frame.east), n = dot(v, frame.north), u = dot(v, frame.up);
  const h = Math.hypot(e, n);
  let az = Math.atan2(e, n) * R2D;
  if (az < 0) az += 360;
  return { az, el: Math.atan2(u, h) * R2D };
}

// direção do Sol (unitária) e posição da Terra (km, centro da Lua) num instante i da série global
export function bodiesAt(g, i) {
  const s = unitVector(g.sunLat[i], g.sunLon[i]);
  const eu = unitVector(g.earthLat[i], g.earthLon[i]);
  const d = g.earthDistKm[i];
  return { sun: s, earth: [eu[0] * d, eu[1] * d, eu[2] * d] };
}

// Sol e Terra vistos de (lat, lon) no instante i
export function skyAt(g, i, latDeg, lonDeg, frame = enuFrame(latDeg, lonDeg)) {
  const { sun, earth } = bodiesAt(g, i);
  const p = unitVector(latDeg, lonDeg);
  const rel = [earth[0] - p[0] * MOON_RADIUS_KM, earth[1] - p[1] * MOON_RADIUS_KM, earth[2] - p[2] * MOON_RADIUS_KM];
  const S = azEl(frame, sun), E = azEl(frame, rel);
  return { sunAz: S.az, sunEl: S.el, earthAz: E.az, earthEl: E.el, sunDistAu: g.sunDistAu[i], earthDistKm: Math.hypot(...rel) };
}

// série completa de um local (mesmo formato das amostras de /api/sky)
export function skySeries(g, latDeg, lonDeg, i0 = 0, i1 = g.count) {
  const frame = enuFrame(latDeg, lonDeg);
  const t0 = Date.parse(g.start), step = g.stepMinutes * 60_000;
  const out = [];
  for (let i = i0; i < i1; i++) out.push({ t: new Date(t0 + i * step).toISOString(), ...skyAt(g, i, latDeg, lonDeg, frame) });
  return out;
}
