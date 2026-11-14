// Métricas de um cenário a partir da série de Sol e Terra (horizonte liso, sem relevo).
// Funções puras: recebem amostras { t, sunAz, sunEl, earthAz, earthEl, sunDistAu?, earthDistKm? }.

// Considera o astro "visível" quando o centro está acima do horizonte (elevação > 0°).
// Refinamento possível: borda do disco (Sol ~0,27°, Terra ~0,95°) e relevo LOLA (Fase 8).
export const HORIZON_DEG = 0;

/**
 * Astro visível? Com relevo, a amostra traz sunHz/earthHz (elevação do horizonte real naquela direção);
 * sem relevo, o horizonte é a esfera lisa (0°). key: "sunEl" ou "earthEl".
 */
export function isUp(s, key) {
  const hz = s[key === "sunEl" ? "sunHz" : "earthHz"];
  return s[key] > (hz ?? HORIZON_DEG);
}

const hoursBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 3_600_000;

/** Trechos contínuos em que pred(amostra) é verdadeiro -> [{ start, end, hours }] */
export function windows(samples, pred) {
  const out = [];
  let open = null;
  for (let i = 0; i < samples.length; i++) {
    const on = pred(samples[i]);
    if (on && open === null) open = i;
    if ((!on || i === samples.length - 1) && open !== null) {
      const endIdx = on ? i : i - 1;
      out.push({
        start: samples[open].t,
        end: samples[endIdx].t,
        hours: hoursBetween(samples[open].t, samples[endIdx].t),
        // trecho cortado pelo início/fim do período: a duração real pode ser maior
        truncated: open === 0 || (on && i === samples.length - 1),
      });
      open = null;
    }
  }
  return out;
}

/**
 * Horas a partir da amostra 0 até o estado mudar (ex.: pôr do Sol se estava visível).
 * Retorna { hours, event: "set" | "rise" } ou null se não muda dentro do período.
 */
export function timeToChange(samples, key) {
  if (!samples.length) return null;
  const up0 = isUp(samples[0], key);
  for (let i = 1; i < samples.length; i++) {
    if (isUp(samples[i], key) !== up0) {
      return { hours: hoursBetween(samples[0].t, samples[i].t), event: up0 ? "set" : "rise" };
    }
  }
  return null;
}

function stats(values) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: values.length ? sum / values.length : NaN };
}

/** Fração de amostras visíveis e horas correspondentes no período */
function visibility(samples, key, totalHours) {
  const visible = samples.filter((s) => isUp(s, key)).length;
  const fraction = samples.length ? visible / samples.length : 0;
  return { fraction, hours: fraction * totalHours };
}

export function computeMetrics(samples) {
  if (!samples.length) throw new Error("série vazia");
  const totalHours = hoursBetween(samples[0].t, samples[samples.length - 1].t);
  const sunUp = (s) => isUp(s, "sunEl");
  const earthUp = (s) => isUp(s, "earthEl");

  const sunWins = windows(samples, sunUp);
  const earthWins = windows(samples, earthUp);
  const s0 = samples[0];

  return {
    totalHours,
    sun: {
      elevationNow: s0.sunEl,
      azimuthNow: s0.sunAz,
      visibleNow: sunUp(s0),
      elevation: stats(samples.map((s) => s.sunEl)),
      ...visibility(samples, "sunEl", totalHours),
      next: timeToChange(samples, "sunEl"),
      windows: sunWins,
      longestWindowHours: sunWins.reduce((m, w) => Math.max(m, w.hours), 0),
    },
    earth: {
      elevationNow: s0.earthEl,
      azimuthNow: s0.earthAz,
      visibleNow: earthUp(s0),
      elevation: stats(samples.map((s) => s.earthEl)),
      ...visibility(samples, "earthEl", totalHours),
      next: timeToChange(samples, "earthEl"),
      windows: earthWins,
      longestWindowHours: earthWins.reduce((m, w) => Math.max(m, w.hours), 0),
      distanceKmNow: s0.earthDistKm,
    },
  };
}
