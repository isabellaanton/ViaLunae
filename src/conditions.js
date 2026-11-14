// Condições na superfície num instante: luz, irradiância, temperatura estimada, Terra e comunicação.
// Funções puras sobre as amostras { t, sunAz, sunEl, earthAz, earthEl, sunDistAu, earthDistKm }.
import { irradiance } from "./power.js";
import { windows, isUp } from "./metrics.js";

const AU_KM = 149_597_870.7;
const LIGHT_KM_S = 299_792.458;
const SIGMA = 5.670374419e-8; // Stefan–Boltzmann, W/m²/K⁴

// Propriedades típicas do regolito lunar (valores médios; variam de lugar para lugar)
export const REGOLITH = Object.freeze({ albedo: 0.12, emissivity: 0.95 });

const rad = (d) => (d * Math.PI) / 180;

/**
 * Temperatura da superfície ESTIMADA (K), sem inércia térmica:
 *  - dia: equilíbrio radiativo de uma superfície plana, T = [(1−A)·E·sin(el) / (ε·σ)]^¼
 *  - noite ou Sol rasante: piso noturno que cai com a latitude
 *    (~95 K no equador a ~50 K nos polos, ordem de grandeza das medições do Diviner/LRO)
 * Crateras em sombra permanente podem ficar abaixo de 40 K; isso entra com o relevo (Fase 8).
 */
export function nightFloorK(latDeg) {
  return 50 + 45 * Math.cos(rad(latDeg));
}

export function surfaceTempK(sunEl, sunDistAu, latDeg) {
  const floor = nightFloorK(latDeg);
  if (sunEl <= 0) return floor;
  const absorbed = (1 - REGOLITH.albedo) * irradiance(sunDistAu) * Math.sin(rad(sunEl));
  const tEq = Math.pow(absorbed / (REGOLITH.emissivity * SIGMA), 0.25);
  return Math.max(floor, tEq);
}

// azimute (a partir do norte, horário) + elevação -> vetor unitário local (leste, norte, cima)
function enu(azDeg, elDeg) {
  const az = rad(azDeg), el = rad(elDeg);
  return [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
}

/**
 * Fração iluminada da Terra vista do local (0 = "Terra nova", 1 = "Terra cheia").
 * Ângulo de fase na Terra = ângulo entre Terra→Sol e Terra→observador.
 */
export function earthIlluminatedFraction(s) {
  if (s.sunDistAu == null || s.earthDistKm == null) return null;
  const dSun = s.sunDistAu * AU_KM;
  const sun = enu(s.sunAz, s.sunEl).map((c) => c * dSun);
  const earth = enu(s.earthAz, s.earthEl).map((c) => c * s.earthDistKm);
  const toSun = sun.map((c, i) => c - earth[i]);
  const toObs = earth.map((c) => -c);
  const dot = toSun.reduce((a, c, i) => a + c * toObs[i], 0);
  const cosPhase = dot / (Math.hypot(...toSun) * Math.hypot(...toObs));
  return (1 + cosPhase) / 2;
}

/** Condições num instante */
export function conditionsAt(s, latDeg) {
  const sunUp = isUp(s, "sunEl");
  const shadowed = !sunUp && s.sunEl > 0; // Sol acima da esfera, mas atrás do relevo
  const normal = irradiance(s.sunDistAu ?? 1);
  return {
    t: s.t,
    isDay: sunUp,
    sunEl: s.sunEl,
    sunAz: s.sunAz,
    earthEl: s.earthEl,
    earthAz: s.earthAz,
    earthVisible: isUp(s, "earthEl"),
    shadowed,
    sunHz: s.sunHz ?? null,
    earthHz: s.earthHz ?? null,
    // irradiância perpendicular aos raios e sobre o chão plano
    irradianceNormal: sunUp ? normal : 0,
    irradianceGround: sunUp ? normal * Math.sin(rad(s.sunEl)) : 0,
    tempK: surfaceTempK(sunUp ? s.sunEl : -1, s.sunDistAu ?? 1, latDeg),
    earthPhase: earthIlluminatedFraction(s),
    earthDistKm: s.earthDistKm ?? null,
    delayS: s.earthDistKm != null ? s.earthDistKm / LIGHT_KM_S : null,
  };
}

export function conditionsSeries(samples, latDeg) {
  return samples.map((s) => conditionsAt(s, latDeg));
}

/**
 * Duração típica do dia e da noite no local, a partir de janelas completas dentro do período.
 * Retorna horas ou null quando o período não contém um dia/noite inteiro.
 * Perto dos polos o dia pode durar o período todo (ou nunca acontecer).
 */
export function dayNightDurations(samples) {
  const mean = (ws) => {
    const full = ws.filter((w) => !w.truncated);
    return full.length ? full.reduce((a, w) => a + w.hours, 0) / full.length : null;
  };
  return {
    dayHours: mean(windows(samples, (s) => isUp(s, "sunEl"))),
    nightHours: mean(windows(samples, (s) => !isUp(s, "sunEl"))),
  };
}

/** Resumo de temperatura e irradiância no período (para tabela e CSV) */
export function conditionsSummary(samples, latDeg) {
  const c = conditionsSeries(samples, latDeg);
  const temps = c.map((x) => x.tempK);
  const irr = c.map((x) => x.irradianceGround);
  return {
    tempMinK: Math.min(...temps),
    tempMaxK: Math.max(...temps),
    irradianceGroundMean: irr.reduce((a, v) => a + v, 0) / irr.length,
    ...dayNightDurations(samples),
  };
}

export const kToC = (k) => k - 273.15;
