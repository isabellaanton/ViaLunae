// Desenha o resultado de um cenário: resumo, métricas de Sol/Terra e potência.
import { t, getLang } from "./i18n/index.js";
import { computeMetrics } from "./metrics.js";
import { powerSummary } from "./power.js";
import { hintButton } from "./hint.js";

const LIGHT_KM_S = 299_792.458;
const fmtTime = (iso) => iso.replace("T", " ").replace(/:00Z$|Z$/, "");

function nf(digits) {
  return new Intl.NumberFormat(getLang() === "pt" ? "pt-BR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
const n = (v, d = 1) => nf(d).format(v);

// horas -> "5,0 h" ou "3,2 dias (77 h)"
function dur(hours) {
  if (hours < 48) return t("units.hours", { v: n(hours, 1) });
  return t("units.days", { v: n(hours / 24, 1), h: n(hours, 0) });
}

function next(info, setKey, riseKey) {
  if (!info) return t("metrics.noChange");
  return t(info.event === "set" ? setKey : riseKey, { d: dur(info.hours) });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function section(title, cls, rows) {
  const box = el("div", `metric-block ${cls}`);
  box.append(el("h3", null, title));
  const dl = el("dl");
  for (const [k, v, hint] of rows) {
    const dt = el("dt", null, k);
    if (hint) dt.append(" ", hintButton(hint));
    dl.append(dt, el("dd", null, v));
  }
  box.append(dl);
  return box;
}

export function computeScenario(series, panel) {
  return { metrics: computeMetrics(series.samples), power: powerSummary(series.samples, panel) };
}

export function renderScenarioResult(container, lastResult, panel) {
  container.replaceChildren();
  if (!lastResult) return;
  if (lastResult.error) {
    const { key, vars } = lastResult.error;
    container.append(el("p", "error", t(key, vars)));
    return;
  }
  const { series } = lastResult;
  const { metrics: m, power: p } = computeScenario(series, panel);
  const s0 = series.samples[0];
  const last = series.samples[series.samples.length - 1];
  // visível / atrás do relevo (acima da esfera, mas escondido pelo terreno) / abaixo do horizonte
  const vis = (v, el) => (v ? t("scenario.visible") : el > 0 ? t("metrics.behindTerrain") : t("scenario.below"));

  container.append(
    el("p", "muted small", t("scenario.summary", { n: series.samples.length, step2: series.stepMinutes, from: fmtTime(s0.t), to: fmtTime(last.t) })),
    el("p", "muted small", t("scenario.source", { source: t(series.source === "file" ? "scenario.sourceFile" : "scenario.sourceLive") })),

    section(t("metrics.sun"), "sun", [
      [t("metrics.atStart"), `${n(m.sun.elevationNow)}° · ${vis(m.sun.visibleNow, m.sun.elevationNow)}`, "sunNow"],
      [t("metrics.elevRange"), t("metrics.minMeanMax", { min: n(m.sun.elevation.min), mean: n(m.sun.elevation.mean), max: n(m.sun.elevation.max) }), "sunElev"],
      [t("metrics.sunlight"), t("metrics.fractionOf", { pct: n(m.sun.fraction * 100, 0), d: dur(m.sun.hours) }), "sunlight"],
      [t("metrics.longest"), dur(m.sun.longestWindowHours), "sunLongest"],
      [t("metrics.next"), next(m.sun.next, "metrics.sunsetIn", "metrics.sunriseIn"), "sunNext"],
    ]),

    section(t("metrics.earth"), "earth", [
      [t("metrics.atStart"), `${n(m.earth.elevationNow)}° · ${vis(m.earth.visibleNow, m.earth.elevationNow)}`, "earthNow"],
      [t("metrics.commWindow"), t("metrics.fractionOf", { pct: n(m.earth.fraction * 100, 0), d: dur(m.earth.hours) }), "earthWindow"],
      [t("metrics.windows"), t("metrics.windowsCount", { count: m.earth.windows.length, longest: dur(m.earth.longestWindowHours) }), "earthWindows"],
      [t("metrics.next"), next(m.earth.next, "metrics.earthsetIn", "metrics.earthriseIn"), "earthNext"],
      ...(m.earth.distanceKmNow
        ? [[t("metrics.delay"), t("metrics.delayValue", { s: n(m.earth.distanceKmNow / LIGHT_KM_S, 2), km: n(m.earth.distanceKmNow, 0) }), "delay"]]
        : []),
    ]),

    section(t("metrics.power"), "power", [
      [t("metrics.powerNow"), t("units.kw", { v: n(p.nowKw, 2) }), "powerNow"],
      [t("metrics.powerMean"), t("units.kw", { v: n(p.meanKw, 2) }), "powerMean"],
      [t("metrics.powerPeak"), t("units.kw", { v: n(p.peakKw, 2) }), "powerPeak"],
      [t("metrics.energy"), t("units.kwh", { v: n(p.energyKwh, 0) }), "energy"],
    ]),

    el("p", "muted small note", lastResult.horizon ? t("metrics.terrainNote", { km: lastResult.horizon.maxRangeKm }) : t("metrics.smoothNote")),
    ...(lastResult.horizonError ? [el("p", "error small", t(lastResult.horizonError))] : [])
  );
}
