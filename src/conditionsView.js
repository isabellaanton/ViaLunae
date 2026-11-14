// Card "Condições no local": valores no instante escolhido + gráficos do período.
//  1) Elevação do Sol e da Terra com o horizonte em 0° (faixas: Terra visível)
//  2) Irradiância no chão e temperatura estimada
import { t, getLang } from "./i18n/index.js";
import { conditionsSeries, dayNightDurations, kToC } from "./conditions.js";
import { drawLineChart, niceRange } from "./chart.js";

const $ = (id) => document.getElementById(id);
const fmtTime = (iso) => iso.replace("T", " ").replace(/:00Z$|Z$/, "");
function n(v, d = 1) {
  return new Intl.NumberFormat(getLang() === "pt" ? "pt-BR" : "en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
}
function dur(hours) {
  if (hours == null) return t("cond.needLonger");
  return hours < 48 ? t("units.hours", { v: n(hours, 1) }) : t("units.days", { v: n(hours / 24, 1), h: n(hours, 0) });
}

const T_MIN_C = -230, T_MAX_C = 130; // faixa fixa de temperatura para comparar cenários

export function createConditionsView() {
  const card = $("cond-card");
  const timeEl = $("cond-time");
  const values = $("cond-values");
  const elevChart = $("elev-chart");
  const condChart = $("cond-chart");
  let state = null; // { series, lat, durations, index, irrMax, elev }

  function drawCharts() {
    if (!state) {
      elevChart.replaceChildren();
      condChart.replaceChildren();
      return;
    }
    const { series, irrMax, elev } = state;
    const xLabels = [fmtTime(series[0].t).slice(0, 10), fmtTime(series[series.length - 1].t).slice(0, 10)];
    const deg = (v) => `${n(v, 0)}°`;

    drawLineChart(elevChart, {
      count: series.length,
      pad: { l: 34, r: 10, t: 10, b: 20 },
      lines: [
        { values: series.map((c) => c.earthEl), cls: "ch-earth" },
        { values: series.map((c) => c.sunEl), cls: "ch-sun" },
      ],
      left: {
        min: elev.min,
        max: elev.max,
        ticks: [{ v: elev.max, label: deg(elev.max) }, { v: 0, label: "0°" }, { v: elev.min, label: deg(elev.min) }],
      },
      refLines: [{ v: 0, cls: "ch-horizon" }],
      bands: [{ values: series.map((c) => c.earthVisible), cls: "ch-band-earth" }],
      xLabels,
      cursor: state.index,
    });

    drawLineChart(condChart, {
      count: series.length,
      lines: [
        { values: series.map((c) => c.irradianceGround), cls: "ch-irr" },
        { values: series.map((c) => kToC(c.tempK)), cls: "ch-temp", axis: "right" },
      ],
      left: { min: 0, max: irrMax, cls: "irr", ticks: [{ v: irrMax, label: n(irrMax, 0) }, { v: 0, label: "0" }] },
      right: {
        min: T_MIN_C,
        max: T_MAX_C,
        cls: "temp",
        ticks: [{ v: T_MAX_C, label: `${T_MAX_C}°` }, { v: 0, label: "0°" }, { v: T_MIN_C, label: `${T_MIN_C}°` }],
      },
      refLines: [{ v: 0, axis: "right", cls: "ch-zero" }],
      xLabels,
      cursor: state.index,
    });
  }

  function renderValues() {
    if (!state) return;
    const c = state.series[state.index];
    timeEl.textContent = t("cond.at", { time: fmtTime(c.t) });
    const rows = [
      [t("cond.dayNight"), c.isDay ? t("cond.day") : t("cond.night"), c.isDay ? "sun" : ""],
      [t("cond.sun"), t("cond.azEl", { el: n(c.sunEl), az: n(c.sunAz) }), "sun"],
      [t("cond.irrNormal"), t("units.wm2", { v: n(c.irradianceNormal, 0) }), "sun"],
      [t("cond.irrGround"), t("units.wm2", { v: n(c.irradianceGround, 0) }), "sun"],
      [t("cond.temp"), t("cond.tempValue", { c: n(kToC(c.tempK), 0), k: n(c.tempK, 0) }), "temp"],
      [t("cond.earth"), `${t("cond.azEl", { el: n(c.earthEl), az: n(c.earthAz) })} · ${c.earthVisible ? t("scenario.visible") : t("scenario.below")}`, "earth"],
      ...(c.earthPhase != null ? [[t("cond.earthPhase"), t("cond.pct", { v: n(c.earthPhase * 100, 0) }), "earth"]] : []),
      ...(c.delayS != null ? [[t("metrics.delay"), t("metrics.delayValue", { s: n(c.delayS, 2), km: n(c.earthDistKm, 0) }), "earth"]] : []),
      [t("cond.dayLength"), dur(state.durations.dayHours), ""],
      [t("cond.nightLength"), dur(state.durations.nightHours), ""],
    ];
    values.replaceChildren(
      ...rows.flatMap(([k, v, cls]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        if (cls) dd.className = cls;
        return [dt, dd];
      })
    );
  }

  return {
    setScenario(samples, lat) {
      const series = conditionsSeries(samples, lat);
      const irrMax = Math.max(100, ...series.map((c) => c.irradianceGround));
      const elev = niceRange([...series.map((c) => c.sunEl), ...series.map((c) => c.earthEl)]);
      state = { series, lat, durations: dayNightDurations(samples), index: 0, irrMax, elev };
      card.hidden = false;
      renderValues();
      drawCharts();
    },
    setIndex(i) {
      if (!state) return;
      state.index = Math.max(0, Math.min(state.series.length - 1, i));
      renderValues();
      drawCharts();
    },
    clear() {
      state = null;
      card.hidden = true;
    },
    rerender() {
      renderValues();
      drawCharts();
    },
  };
}
