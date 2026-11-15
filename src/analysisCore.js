// Núcleo da análise por filtros (semáforo). Só usa dados da Horizons (série global: ponto subsolar,
// ponto sub-Terra e distâncias) e cálculos geométricos sobre eles. O que a API não mede
// (inclinação do módulo, encosta, parede de cratera, máscara da antena) entra como parâmetro do usuário.
// Funções puras, usadas no Web Worker do mapa e na avaliação dos locais.
import { unitVector, enuFrame, MOON_RADIUS_KM } from "./skyGeometry.js";

const D2R = Math.PI / 180;
const S0 = 1361; // W/m² a 1 au
const SIGMA = 5.670374419e-8;
const ALBEDO = 0.12, EMISS = 0.95;
const COLD_K = 123.15; // −150 °C
const TILT_DIRS = 8; // direções testadas para achar a pior inclinação do módulo

export const DEFAULT_PARAMS = Object.freeze({
  panelMode: "vertical-tracking", // "vertical-tracking" | "dual-axis" | "fixed"
  panelTiltDeg: 90,
  panelAzDeg: 0,
  panelAreaM2: 10,
  panelEff: 0.3,
  moduleTiltDeg: 15, // inclinação do módulo após o pouso (média das direções de tombamento)
  slopeDeg: 10, // declividade da encosta
  slopeFacing: "pole", // "pole" | "equator" | "east" | "west"
  wallDeg: 0, // horizonte simulado (parede de cratera), vale para Sol e Terra
  maskDeg: 5, // máscara da antena: Terra útil só acima desta elevação
  landerHeightM: 4.8, // altura do módulo (Athena/IM-2)
});

// ---------- definição dos filtros ----------
// better: "max" (maior é melhor) ou "min". Limites: max -> verde se v ≥ g, amarelo se v ≥ r;
// min -> verde se v ≤ g, amarelo se v ≤ r.
export const CRITERIA = [
  { id: "panels", main: true, filters: [{ id: "panelPct", unit: "%", better: "max", g: 80, r: 50 }] },
  {
    id: "moduleTilt",
    main: true,
    filters: [
      { id: "tiltLossPct", unit: "%", better: "min", g: 15, r: 40 },
      { id: "tiltEarthPct", unit: "%", better: "max", g: 70, r: 40 },
    ],
  },
  { id: "slope", main: true, filters: [{ id: "slopeLightPct", unit: "%", better: "max", g: 80, r: 50 }] },
  // relevo real (perfil de horizonte do relevo Cesium Moon/LOLA): só nos locais com perfil; no mapa = sem dado
  {
    id: "relief",
    main: true,
    filters: [
      { id: "reliefLossPct", unit: "%", better: "min", g: 5, r: 15, needsHorizon: true },
      { id: "horizonMaxDeg", unit: "°", better: "min", g: 3, r: 8, needsHorizon: true },
    ],
  },
  {
    id: "temperature",
    main: true,
    filters: [
      { id: "tempMeanC", unit: "°C", better: "max", g: -100, r: -160 },
      { id: "coldPct", unit: "%", better: "min", g: 40, r: 70 },
    ],
  },
  {
    id: "libration",
    main: true,
    filters: [
      { id: "earthPct", unit: "%", better: "max", g: 60, r: 30 },
      { id: "blackoutH", unit: "h", better: "min", g: 72, r: 336 },
    ],
  },
  { id: "power", main: false, filters: [{ id: "powerKw", unit: "kW", better: "max", g: 2, r: 1 }] },
  { id: "lightRun", main: false, filters: [{ id: "lightRunH", unit: "h", better: "max", g: 300, r: 100 }] },
  { id: "night", main: false, filters: [{ id: "darkRunH", unit: "h", better: "min", g: 50, r: 100 }] },
  { id: "sunEarth", main: false, filters: [{ id: "sunEarthPct", unit: "%", better: "max", g: 50, r: 25 }] },
  { id: "shadow", main: false, filters: [{ id: "shadowM", unit: "m", better: "min", g: 20, r: 100 }] },
];

export const FILTERS = CRITERIA.flatMap((c) => c.filters.map((f) => ({ ...f, criterion: c.id, main: c.main })));
export const FILTER_IDS = FILTERS.map((f) => f.id);

// Modo "Agora": o mesmo filtro medido no instante da barra de tempo. Filtros de período viram
// contagem regressiva (horas até o pôr do Sol, até o nascer, de contato restante com a Terra).
export const NOW_OVERRIDES = {
  panelPct: { unit: "%", better: "max", g: 80, r: 50 }, // incidência no painel agora
  tiltLossPct: { unit: "%", better: "min", g: 15, r: 40 },
  tiltEarthPct: { unit: "%", better: "max", g: 70, r: 40 }, // % das direções de tombamento com a Terra acima do convés
  slopeLightPct: { unit: "%", better: "max", g: 80, r: 50 },
  reliefLossPct: { unit: "%", better: "min", g: 5, r: 15 }, // 100 = Sol escondido pelo relevo agora
  horizonMaxDeg: { unit: "°", better: "min", g: 3, r: 8 },
  tempMeanC: { unit: "°C", better: "max", g: -100, r: -160 }, // temperatura agora
  coldPct: { unit: "%", better: "min", g: 40, r: 70 }, // 100 = abaixo de −150 °C agora
  earthPct: { unit: "°", better: "max", g: 10, r: 5 }, // altura da Terra no céu agora
  blackoutH: { unit: "h", better: "max", g: 72, r: 24 }, // horas de contato restantes
  powerKw: { unit: "%", better: "max", g: 50, r: 10 }, // % da potência máxima do painel
  lightRunH: { unit: "h", better: "max", g: 72, r: 24 }, // horas até o pôr do Sol
  darkRunH: { unit: "h", better: "min", g: 0, r: 50 }, // horas até o nascer do Sol (0 = dia)
  sunEarthPct: { unit: "%", better: "max", g: 50, r: 25 }, // 100 = Sol e Terra agora
  shadowM: { unit: "m", better: "min", g: 20, r: 100 }, // sombra do módulo agora
};

export function filtersFor(mode) {
  return mode === "now" ? FILTERS.map((f) => ({ ...f, ...NOW_OVERRIDES[f.id] })) : FILTERS;
}

// ---------- vetores ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function facingAz(latDeg, facing) {
  if (facing === "east") return 90;
  if (facing === "west") return 270;
  const towardSouth = latDeg < 0 ? facing === "pole" : facing === "equator";
  return towardSouth ? 180 : 0;
}

// normal (em coordenadas locais L/N/C) de um plano inclinado tiltDeg na direção azDeg
function tiltedNormal(tiltDeg, azDeg) {
  const t = tiltDeg * D2R, a = azDeg * D2R;
  return [Math.sin(t) * Math.sin(a), Math.sin(t) * Math.cos(a), Math.cos(t)];
}

// base do convés de um módulo inclinado: cima' e dois eixos no plano do convés
function tiltedBasis(tiltDeg, azDeg) {
  const t = tiltDeg * D2R, a = azDeg * D2R;
  const dir = [Math.sin(a), Math.cos(a), 0]; // direção para onde o módulo tomba
  const side = [Math.cos(a), -Math.sin(a), 0]; // eixo de rotação (horizontal)
  const up = [dir[0] * Math.sin(t), dir[1] * Math.sin(t), Math.cos(t)];
  const fwd = [dir[0] * Math.cos(t), dir[1] * Math.cos(t), -Math.sin(t)];
  // "leste/norte" do convés: gira o par (side, fwd) de volta para alinhar com L/N quando t = 0
  const east = [side[0] * Math.cos(a) + fwd[0] * Math.sin(a), side[1] * Math.cos(a) + fwd[1] * Math.sin(a), side[2] * Math.cos(a) + fwd[2] * Math.sin(a)];
  const north = [-side[0] * Math.sin(a) + fwd[0] * Math.cos(a), -side[1] * Math.sin(a) + fwd[1] * Math.cos(a), -side[2] * Math.sin(a) + fwd[2] * Math.cos(a)];
  return { east, north, up };
}

// cosseno de incidência no painel para um Sol em coordenadas locais (unitário) num referencial dado
function panelCos(sun, basis, p) {
  const u = dot(sun, basis.up);
  if (u <= 0) return 0;
  if (p.panelMode === "dual-axis") return 1;
  const e = dot(sun, basis.east), n = dot(sun, basis.north);
  if (p.panelMode === "vertical-tracking") return Math.hypot(e, n); // = cos(elevação no convés)
  const nrm = tiltedNormal(p.panelTiltDeg, p.panelAzDeg);
  return Math.max(0, e * nrm[0] + n * nrm[1] + u * nrm[2]);
}

const LEVEL = { east: [1, 0, 0], north: [0, 1, 0], up: [0, 0, 1] };

/**
 * Acumula as métricas de UM local ao longo da série global.
 * @param g série global (global.json)
 * @param lat, lon graus (lon leste)
 * @param p parâmetros (DEFAULT_PARAMS)
 * @param i0, i1, stride índices da série usados
 * @returns objeto { panelPct, tiltLossPct, ... } (null quando não há base de cálculo, ex.: nunca há Sol)
 */
// horizonte real (opcional): { horizon: [graus por azimute], azStepDeg }; o Sol e a Terra só contam
// acima do relevo. Sem ele, a Lua é lisa e os filtros de relevo ficam "sem dado".
export function horizonAt(profile, azDeg) {
  const h = profile.horizon, step = profile.azStepDeg, n = h.length;
  const x = (((azDeg % 360) + 360) % 360) / step;
  const i = Math.floor(x) % n, j = (i + 1) % n, f = x - Math.floor(x);
  return h[i] * (1 - f) + h[j] * f;
}

const azOf = (v) => {
  const a = Math.atan2(v[0], v[1]) / D2R;
  return a < 0 ? a + 360 : a;
};

export function evaluateLocation(g, lat, lon, p, i0, i1, stride = 1, ctx = prepare(p, lat), horizon = null) {
  const fr = enuFrame(lat, lon);
  const pos = unitVector(lat, lon);
  const sinWall = Math.sin(p.wallDeg * D2R);
  const sinMask = Math.sin(Math.max(p.maskDeg, p.wallDeg) * D2R);
  const stepH = (g.stepMinutes * stride) / 60;

  let n = 0, nSun = 0, nSunSmooth = 0, nEarth = 0, nBoth = 0, nCold = 0;
  let eConfig = 0, eIdeal = 0, eFlat = 0, eSlope = 0, tempSum = 0, sinElSum = 0;
  const eTilt = new Float64Array(TILT_DIRS);
  const earthTilt = new Uint32Array(TILT_DIRS);
  let run = 0, bestLight = 0, darkRun = 0, bestDark = 0, gap = 0, bestGap = 0;
  // começo da série: run inicial conta como contínuo com o fim? Não — período é aberto.

  for (let i = i0; i < i1; i += stride) {
    // Sol (unitário) e Terra (vetor topocêntrico) em L/N/C
    const sl = g.sunLat[i] * D2R, so = g.sunLon[i] * D2R;
    const sx = Math.cos(sl) * Math.cos(so), sy = Math.cos(sl) * Math.sin(so), sz = Math.sin(sl);
    const sun = [
      sx * fr.east[0] + sy * fr.east[1] + sz * fr.east[2],
      sx * fr.north[0] + sy * fr.north[1] + sz * fr.north[2],
      sx * fr.up[0] + sy * fr.up[1] + sz * fr.up[2],
    ];
    const el_ = g.earthLat[i] * D2R, eo = g.earthLon[i] * D2R, d = g.earthDistKm[i];
    const ex = Math.cos(el_) * Math.cos(eo) * d - pos[0] * MOON_RADIUS_KM;
    const ey = Math.cos(el_) * Math.sin(eo) * d - pos[1] * MOON_RADIUS_KM;
    const ez = Math.sin(el_) * d - pos[2] * MOON_RADIUS_KM;
    const dn = Math.hypot(ex, ey, ez);
    const earth = [
      (ex * fr.east[0] + ey * fr.east[1] + ez * fr.east[2]) / dn,
      (ex * fr.north[0] + ey * fr.north[1] + ez * fr.north[2]) / dn,
      (ex * fr.up[0] + ey * fr.up[1] + ez * fr.up[2]) / dn,
    ];
    const irr = S0 / (g.sunDistAu[i] * g.sunDistAu[i]);
    n++;

    const sunUpSmooth = sun[2] > sinWall;
    let sunUp = sunUpSmooth;
    let earthUp = earth[2] > sinMask;
    if (horizon) {
      if (sunUpSmooth) {
        nSunSmooth++;
        sunUp = sun[2] > Math.sin(horizonAt(horizon, azOf(sun)) * D2R);
      }
      if (earthUp) earthUp = earth[2] > Math.sin(horizonAt(horizon, azOf(earth)) * D2R);
    }

    // temperatura (equilíbrio radiativo, piso noturno por latitude)
    let tK = ctx.floorK;
    if (sunUp) {
      const tEq = Math.pow(((1 - ALBEDO) * irr * sun[2]) / (EMISS * SIGMA), 0.25);
      if (tEq > tK) tK = tEq;
    }
    tempSum += tK;
    if (tK < COLD_K) nCold++;

    if (sunUp) {
      nSun++;
      sinElSum += sun[2];
      eIdeal += irr;
      eConfig += irr * panelCos(sun, LEVEL, p);
      eFlat += irr * sun[2];
      const cs = dot(sun, ctx.slopeN);
      if (cs > 0) eSlope += irr * cs;
      for (let k = 0; k < TILT_DIRS; k++) {
        const b = ctx.tiltBases[k];
        eTilt[k] += irr * panelCos(sun, b, p);
      }
      run++; if (run > bestLight) bestLight = run;
      darkRun = 0;
    } else {
      run = 0;
      darkRun++; if (darkRun > bestDark) bestDark = darkRun;
    }
    if (earthUp) {
      nEarth++;
      if (sunUp) nBoth++;
      gap = 0;
      for (let k = 0; k < TILT_DIRS; k++) {
        if (dot(earth, ctx.tiltBases[k].up) > sinMask) earthTilt[k]++;
      }
    } else {
      gap++; if (gap > bestGap) bestGap = gap;
    }
  }

  // média das 8 direções possíveis de tombamento (a direção real não é conhecida antes do pouso)
  let tiltE = 0, tiltEarth = 0;
  for (let k = 0; k < TILT_DIRS; k++) { tiltE += eTilt[k] / TILT_DIRS; tiltEarth += earthTilt[k] / TILT_DIRS; }
  const totalH = n * stepH;
  const meanSinEl = nSun ? sinElSum / nSun : 0;
  const meanEl = Math.asin(Math.min(1, meanSinEl));
  return {
    panelPct: eIdeal > 0 ? (100 * eConfig) / eIdeal : null,
    tiltLossPct: eConfig > 0 ? Math.max(0, 100 * (1 - tiltE / eConfig)) : null,
    tiltEarthPct: nEarth > 0 ? (100 * tiltEarth) / n : 0,
    slopeLightPct: eFlat > 0 ? (100 * eSlope) / eFlat : null,
    tempMeanC: tempSum / n - 273.15,
    coldPct: (100 * nCold) / n,
    earthPct: (100 * nEarth) / n,
    blackoutH: bestGap * stepH,
    powerKw: totalH > 0 ? (eConfig * p.panelAreaM2 * p.panelEff * stepH) / 1000 / totalH : 0,
    lightRunH: bestLight * stepH,
    darkRunH: bestDark * stepH,
    sunEarthPct: (100 * nBoth) / n,
    shadowM: nSun ? Math.min(10_000, p.landerHeightM / Math.tan(Math.max(meanEl, 1e-4))) : null,
    // relevo real: % das horas de Sol (Lua lisa) perdidas atrás do relevo; maior altura do horizonte
    reliefLossPct: horizon ? (nSunSmooth ? (100 * (nSunSmooth - nSun)) / nSunSmooth : 0) : null,
    horizonMaxDeg: horizon ? Math.max(...horizon.horizon) : null,
  };
}

// Sol (unitário) e Terra (unitário, topocêntrico) em coordenadas locais L/N/C no instante j
function localBodies(g, j, fr, pos) {
  const sl = g.sunLat[j] * D2R, so = g.sunLon[j] * D2R;
  const sx = Math.cos(sl) * Math.cos(so), sy = Math.cos(sl) * Math.sin(so), sz = Math.sin(sl);
  const el_ = g.earthLat[j] * D2R, eo = g.earthLon[j] * D2R, d = g.earthDistKm[j];
  const ex = Math.cos(el_) * Math.cos(eo) * d - pos[0] * MOON_RADIUS_KM;
  const ey = Math.cos(el_) * Math.sin(eo) * d - pos[1] * MOON_RADIUS_KM;
  const ez = Math.sin(el_) * d - pos[2] * MOON_RADIUS_KM;
  const dn = Math.hypot(ex, ey, ez);
  const proj = (x, y, z, k) => [
    (x * fr.east[0] + y * fr.east[1] + z * fr.east[2]) / k,
    (x * fr.north[0] + y * fr.north[1] + z * fr.north[2]) / k,
    (x * fr.up[0] + y * fr.up[1] + z * fr.up[2]) / k,
  ];
  return { sun: proj(sx, sy, sz, 1), earth: proj(ex, ey, ez, dn) };
}

const COUNTDOWN_MAX_H = 720; // contagens regressivas param em 30 dias

/**
 * Valores dos filtros NO INSTANTE i (modo "Agora"). Mesmos ids de evaluateLocation, com o
 * significado de NOW_OVERRIDES. As contagens regressivas olham para a frente na série (até iEnd).
 * scanStride > 1 deixa a contagem mais grossa (prévia rápida).
 */
export function evaluateInstant(g, lat, lon, p, i, iEnd = g.count, ctx = prepare(p, lat), horizon = null, opts = {}) {
  const scanStride = opts.scanStride || 1;
  const skip = opts.skip; // Set de ids cujas contagens não precisam ser calculadas
  const fr = enuFrame(lat, lon);
  const pos = unitVector(lat, lon);
  const sinWall = Math.sin(p.wallDeg * D2R);
  const sinMask = Math.sin(Math.max(p.maskDeg, p.wallDeg) * D2R);
  const sunVisible = (sun) =>
    sun[2] > sinWall && (!horizon || sun[2] > Math.sin(horizonAt(horizon, azOf(sun)) * D2R));
  const earthVisible = (earth) =>
    earth[2] > sinMask && (!horizon || earth[2] > Math.sin(horizonAt(horizon, azOf(earth)) * D2R));

  const { sun, earth } = localBodies(g, i, fr, pos);
  const irr = S0 / (g.sunDistAu[i] * g.sunDistAu[i]);
  const smoothUp = sun[2] > sinWall;
  const sunUp = sunVisible(sun);
  const earthUp = earthVisible(earth);

  // contagem: horas até a condição mudar, olhando para a frente
  const stepH = g.stepMinutes / 60;
  const last = Math.min(iEnd, g.count, i + Math.round(COUNTDOWN_MAX_H / stepH));
  function hoursUntil(id, pred, now) {
    if (skip?.has(id)) return null;
    if (!now) return 0;
    for (let j = i + scanStride; j < last; j += scanStride) {
      if (!pred(localBodies(g, j, fr, pos))) return (j - i) * stepH;
    }
    return (last - i) * stepH;
  }

  let tK = ctx.floorK;
  if (sunUp) {
    const tEq = Math.pow(((1 - ALBEDO) * irr * sun[2]) / (EMISS * SIGMA), 0.25);
    if (tEq > tK) tK = tEq;
  }
  const level = sunUp ? panelCos(sun, LEVEL, p) : 0;
  let tilt = 0, tiltEarth = 0;
  for (let k = 0; k < TILT_DIRS; k++) {
    if (sunUp) tilt += panelCos(sun, ctx.tiltBases[k], p) / TILT_DIRS;
    if (earthUp && dot(earth, ctx.tiltBases[k].up) > sinMask) tiltEarth += 1 / TILT_DIRS;
  }
  const cs = dot(sun, ctx.slopeN);
  const elRad = Math.asin(Math.max(-1, Math.min(1, sun[2])));
  const maxKw = (S0 * p.panelAreaM2 * p.panelEff) / 1000;
  const kw = (irr * p.panelAreaM2 * p.panelEff * level) / 1000;
  return {
    panelPct: sunUp ? 100 * level : 0,
    tiltLossPct: level > 0 ? Math.max(0, 100 * (1 - tilt / level)) : null,
    tiltEarthPct: 100 * tiltEarth,
    slopeLightPct: sunUp && sun[2] > 0 ? (100 * Math.max(0, cs)) / sun[2] : null,
    reliefLossPct: horizon ? (smoothUp ? (sunUp ? 0 : 100) : null) : null,
    horizonMaxDeg: horizon ? Math.max(...horizon.horizon) : null,
    tempMeanC: tK - 273.15,
    coldPct: tK < COLD_K ? 100 : 0,
    earthPct: Math.asin(Math.max(-1, Math.min(1, earth[2]))) / D2R,
    blackoutH: hoursUntil("blackoutH", (b) => earthVisible(b.earth), earthUp),
    powerKw: maxKw > 0 ? Math.min(100, (100 * kw) / maxKw) : 0, // perto do periélio passaria de 100%
    lightRunH: hoursUntil("lightRunH", (b) => sunVisible(b.sun), sunUp),
    darkRunH: hoursUntil("darkRunH", (b) => !sunVisible(b.sun), !sunUp),
    sunEarthPct: sunUp && earthUp ? 100 : 0,
    shadowM: sunUp ? Math.min(10_000, p.landerHeightM / Math.tan(Math.max(elRad, 1e-4))) : null,
  };
}

// ---------- quadros pré-calculados (animação lisa do modo Agora) ----------
// Cada quadro guarda a CLASSE de cada filtro (2 bits: 0 vermelho, 1 amarelo, 2 verde, 3 sem dado)
// num Uint32 por célula. Ligar/desligar filtros só muda a decodificação; mudar limites ou parâmetros recalcula.
export const NO_CLASS = 3;
const ALL_COUNTDOWNS = new Set(["blackoutH", "lightRunH", "darkRunH"]);

export function packClasses(classes, ids = FILTER_IDS) {
  let code = 0;
  for (let k = 0; k < ids.length; k++) code |= (classes[ids[k]] ?? NO_CLASS) << (2 * k);
  return code >>> 0;
}

export function unpackClass(code, k) {
  const c = (code >>> (2 * k)) & 3;
  return c === NO_CLASS ? null : c;
}

/**
 * Classes de todos os filtros (modo Agora) de UM local em nFrames instantes: f0, f0+fstep, ...
 * As contagens regressivas saem de uma passada de trás para a frente (sem varrer o futuro a cada quadro).
 * @param fs filtros do modo Agora; th limites por id { g, r }
 * @returns Uint32Array(nFrames)
 */
export function instantFrames(g, lat, lon, p, f0, nFrames, fstep, fs, th, ctx = prepare(p, lat)) {
  const fr = enuFrame(lat, lon);
  const pos = unitVector(lat, lon);
  const sinWall = Math.sin(p.wallDeg * D2R);
  const sinMask = Math.sin(Math.max(p.maskDeg, p.wallDeg) * D2R);
  const stepH = (g.stepMinutes / 60) * fstep;
  // visibilidade nos quadros + até 30 dias depois (para as contagens não pararem no fim do período)
  const last = Math.min(g.count - 1, f0 + (nFrames - 1) * fstep + Math.round(COUNTDOWN_MAX_H / (g.stepMinutes / 60)));
  const total = Math.max(nFrames, Math.floor((last - f0) / fstep) + 1);
  const sunV = new Uint8Array(total);
  const earthV = new Uint8Array(total);
  for (let k = 0; k < total; k++) {
    const j = Math.min(g.count - 1, f0 + k * fstep);
    const b = localBodies(g, j, fr, pos);
    sunV[k] = b.sun[2] > sinWall ? 1 : 0;
    earthV[k] = b.earth[2] > sinMask ? 1 : 0;
  }
  const until = (vis, want) => {
    const out = new Float32Array(total);
    for (let k = total - 1; k >= 0; k--) {
      const ok = vis[k] === want;
      out[k] = ok ? Math.min(COUNTDOWN_MAX_H, stepH + (k + 1 < total ? out[k + 1] : 0)) : 0;
    }
    return out;
  };
  const lightLeft = until(sunV, 1);
  const darkLeft = until(sunV, 0);
  const earthLeft = until(earthV, 1);

  const codes = new Uint32Array(nFrames);
  const classes = {};
  for (let k = 0; k < nFrames; k++) {
    const v = evaluateInstant(g, lat, lon, p, f0 + k * fstep, g.count, ctx, null, { skip: ALL_COUNTDOWNS });
    v.lightRunH = lightLeft[k];
    v.darkRunH = darkLeft[k];
    v.blackoutH = earthLeft[k];
    for (const f of fs) classes[f.id] = classify(v[f.id], f, th[f.id] || f);
    codes[k] = packClasses(classes);
  }
  return codes;
}

// partes que só dependem dos parâmetros e da latitude
export function prepare(p, lat) {
  const tiltBases = [];
  for (let k = 0; k < TILT_DIRS; k++) tiltBases.push(tiltedBasis(p.moduleTiltDeg, (360 / TILT_DIRS) * k));
  return {
    tiltBases,
    slopeN: tiltedNormal(p.slopeDeg, facingAz(lat, p.slopeFacing)),
    floorK: 50 + 45 * Math.cos(lat * D2R),
  };
}

// ---------- classificação ----------
// 2 = verde, 1 = amarelo, 0 = vermelho, null = sem dado
export function classify(v, f, th = f) {
  if (v == null || Number.isNaN(v)) return null;
  if (f.better === "max") return v >= th.g ? 2 : v >= th.r ? 1 : 0;
  return v <= th.g ? 2 : v <= th.r ? 1 : 0;
}

// limites relativos (modo Comparativo): terços da população de valores
export function relativeThresholds(values, f) {
  const xs = values.filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!xs.length) return { g: f.g, r: f.r };
  const q = (p) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
  return f.better === "max" ? { g: q(2 / 3), r: q(1 / 3) } : { g: q(1 / 3), r: q(2 / 3) };
}

/**
 * Pontuação: média dos subfiltros ligados de cada critério; soma dos critérios; % do máximo (2 por critério).
 * @param classes { filterId: 0|1|2|null }
 * @param enabled Set de ids de filtros ligados
 * @returns { pct: 0–100 | null, criteria: { id: média 0–2 | null } }
 */
export function score(classes, enabled) {
  let sum = 0, count = 0;
  const criteria = {};
  for (const c of CRITERIA) {
    const vals = c.filters.filter((f) => enabled.has(f.id)).map((f) => classes[f.id]).filter((v) => v != null);
    if (!vals.length) { criteria[c.id] = null; continue; }
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    criteria[c.id] = m;
    sum += m;
    count++;
  }
  return { pct: count ? (100 * sum) / (2 * count) : null, criteria };
}

// melhor orientação fixa do painel para um local (busca em grade), em % da potência ideal
export function bestFixedPanel(g, lat, lon, p, i0, i1, stride) {
  let best = { tiltDeg: 90, azDeg: 0, pct: -1 };
  for (let tilt = 0; tilt <= 90; tilt += 15) {
    for (let az = 0; az < 360; az += tilt === 0 ? 360 : 30) {
      const q = { ...p, panelMode: "fixed", panelTiltDeg: tilt, panelAzDeg: az };
      const m = evaluateLocation(g, lat, lon, q, i0, i1, stride);
      if (m.panelPct != null && m.panelPct > best.pct) best = { tiltDeg: tilt, azDeg: az, pct: m.panelPct };
    }
  }
  return best.pct < 0 ? null : best;
}
