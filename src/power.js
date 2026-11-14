// Potência solar estimada de um painel na superfície lunar (sem atmosfera).
//
//   irradiância (W/m²) = S0 / d²            S0 = constante solar a 1 au; d = distância ao Sol (au)
//   cos(i) = sin(el)·cos(β) + cos(el)·sin(β)·cos(azSol − γ)   β = inclinação, γ = azimute do painel
//   potência (kW) = irradiância · área · eficiência · max(0, cos i) / 1000
//
// Modos:
//   "vertical-tracking": painel vertical (β = 90°) que gira para seguir o Sol em azimute.
//                        cos(i) = cos(el). Típico do polo sul, onde o Sol fica baixo no horizonte.
//   "dual-axis":         aponta sempre para o Sol. cos(i) = 1.
//   "fixed":             inclinação e azimute fixos, escolhidos pelo usuário.
// Sol abaixo do horizonte -> potência zero (relevo LOLA entra na Fase 8).

export const SOLAR_CONSTANT_W_M2 = 1361;

export const DEFAULT_PANEL = Object.freeze({
  areaM2: 10,
  efficiency: 0.3,
  mode: "vertical-tracking",
  tiltDeg: 90,
  azimuthDeg: 0,
});

const rad = (d) => (d * Math.PI) / 180;

export function irradiance(sunDistAu = 1) {
  return SOLAR_CONSTANT_W_M2 / (sunDistAu * sunDistAu);
}

export function incidenceCos(sunEl, sunAz, panel) {
  if (sunEl <= 0) return 0;
  switch (panel.mode) {
    case "dual-axis":
      return 1;
    case "vertical-tracking":
      return Math.cos(rad(sunEl));
    case "fixed": {
      const el = rad(sunEl), beta = rad(panel.tiltDeg);
      const c = Math.sin(el) * Math.cos(beta) + Math.cos(el) * Math.sin(beta) * Math.cos(rad(sunAz - panel.azimuthDeg));
      return Math.max(0, c);
    }
    default:
      throw new Error(`modo de painel desconhecido: ${panel.mode}`);
  }
}

/** Potência instantânea em kW para uma amostra */
export function powerKw(sample, panel) {
  const cos = incidenceCos(sample.sunEl, sample.sunAz, panel);
  if (cos === 0) return 0;
  return (irradiance(sample.sunDistAu ?? 1) * panel.areaM2 * panel.efficiency * cos) / 1000;
}

/**
 * Resumo de potência no período: agora, pico, média e energia (regra do trapézio).
 * @returns {{ nowKw, peakKw, meanKw, energyKwh, series: number[] }}
 */
export function powerSummary(samples, panel) {
  const series = samples.map((s) => powerKw(s, panel));
  let energyKwh = 0;
  for (let i = 1; i < samples.length; i++) {
    const dtH = (Date.parse(samples[i].t) - Date.parse(samples[i - 1].t)) / 3_600_000;
    energyKwh += ((series[i] + series[i - 1]) / 2) * dtH;
  }
  const totalH = samples.length > 1 ? (Date.parse(samples.at(-1).t) - Date.parse(samples[0].t)) / 3_600_000 : 0;
  return {
    nowKw: series[0] ?? 0,
    peakKw: series.length ? Math.max(...series) : 0,
    meanKw: totalH > 0 ? energyKwh / totalH : series[0] ?? 0,
    energyKwh,
    series,
  };
}

export function validatePanel(p) {
  const errors = [];
  if (!(p.areaM2 > 0 && p.areaM2 <= 10_000)) errors.push("areaM2");
  if (!(p.efficiency > 0 && p.efficiency <= 1)) errors.push("efficiency");
  if (!["vertical-tracking", "dual-axis", "fixed"].includes(p.mode)) errors.push("mode");
  if (p.mode === "fixed") {
    if (!(p.tiltDeg >= 0 && p.tiltDeg <= 90)) errors.push("tiltDeg");
    if (!(p.azimuthDeg >= 0 && p.azimuthDeg < 360)) errors.push("azimuthDeg");
  }
  return errors;
}
