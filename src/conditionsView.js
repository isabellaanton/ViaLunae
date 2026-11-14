// Card "Condições no local": valores no instante escolhido + gráficos do período.
//  1) Elevação do Sol e da Terra com o horizonte em 0° (faixas: Terra visível)
//  2) Irradiância no chão e temperatura estimada
import { t, getLang } from "./i18n/index.js";
import { conditionsSeries, dayNightDurations, kToC } from "./conditions.js";
import { drawLineChart, niceRange } from "./chart.js";

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Panorama do horizonte: azimute (x) × elevação (y), relevo preenchido e caminhos do Sol e da Terra */
function drawHorizonChart(svg, { profile, series, index }) {
  const W = 320, H = 150, pad = { l: 30, r: 8, t: 8, b: 20 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const hz = profile.horizon;
  // faixa vertical: relevo + parte do caminho do Sol/Terra perto do horizonte
  const near = series.flatMap((c) => [c.sunEl, c.earthEl]).filter((v) => v > -10 && v < 25);
  const r = niceRange([...hz, ...near, 0], { minSpan: 8 });
  const x = (az) => pad.l + (az / 360) * iw;
  const y = (el) => pad.t + ih - ((Math.max(r.min, Math.min(r.max, el)) - r.min) / (r.max - r.min)) * ih;

  svg.replaceChildren(svgEl("rect", { x: pad.l, y: pad.t, width: iw, height: ih, class: "ch-sky" }));
  const pts = hz.map((e, i) => `${x(i * profile.azStepDeg).toFixed(1)},${y(e).toFixed(1)}`);
  pts.push(`${x(360).toFixed(1)},${y(hz[0]).toFixed(1)}`);
  svg.append(svgEl("polygon", { points: `${x(0)},${pad.t + ih} ${pts.join(" ")} ${x(360)},${pad.t + ih}`, class: "ch-terrain" }));
  svg.append(svgEl("line", { x1: pad.l, x2: pad.l + iw, y1: y(0), y2: y(0), class: "ch-horizon" }));

  const stride = Math.max(1, Math.floor(series.length / 400));
  for (let i = 0; i < series.length; i += stride) {
    const c = series[i];
    if (c.sunEl > r.min && c.sunEl < r.max) svg.append(svgEl("circle", { cx: x(c.sunAz), cy: y(c.sunEl), r: 0.9, class: "ch-sunpath" }));
    if (c.earthEl > r.min && c.earthEl < r.max) svg.append(svgEl("circle", { cx: x(c.earthAz), cy: y(c.earthEl), r: 0.9, class: "ch-earthpath" }));
  }
  const now = series[index];
  svg.append(svgEl("circle", { cx: x(now.earthAz), cy: y(now.earthEl), r: 4.5, class: "ch-earthnow" }));
  svg.append(svgEl("circle", { cx: x(now.sunAz), cy: y(now.sunEl), r: 4.5, class: "ch-sunnow" }));

  const text = (txt, xx, yy, anchor) => {
    const t = svgEl("text", { x: xx, y: yy, "text-anchor": anchor, class: "ch-txt" });
    t.textContent = txt;
    svg.append(t);
  };
  [["N", 0], ["L", 90], ["S", 180], ["O", 270], ["N", 360]].forEach(([lbl, az]) => text(lbl, x(az), H - 6, "middle"));
  text(`${r.max}°`, pad.l - 3, pad.t + 8, "end");
  text("0°", pad.l - 3, y(0) + 3, "end");
  text(`${r.min}°`, pad.l - 3, pad.t + ih, "end");
}

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
  const hzChart = $("hz-chart");
  const hzWrap = $("hz-wrap");
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

    if (state.horizon) drawHorizonChart(hzChart, { profile: state.horizon, series, index: state.index });

    drawLineChart(elevChart, {
      count: series.length,
      pad: { l: 34, r: 10, t: 10, b: 20 },
      lines: [
        // relevo na direção do Sol: o Sol só aparece quando a linha amarela passa acima desta
        ...(state.horizon ? [{ values: series.map((c) => c.sunHz), cls: "ch-sunhz" }] : []),
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
      [t("cond.dayNight"), c.isDay ? t("cond.day") : c.shadowed ? t("cond.shadow") : t("cond.night"), c.isDay ? "sun" : ""],
      ...(c.sunHz != null ? [[t("cond.hzSun"), t("cond.hzValue", { v: n(c.sunHz) }), "terrain"]] : []),
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
    setScenario(samples, lat, horizon = null) {
      const series = conditionsSeries(samples, lat);
      const irrMax = Math.max(100, ...series.map((c) => c.irradianceGround));
      const elev = niceRange([...series.map((c) => c.sunEl), ...series.map((c) => c.earthEl), ...(horizon ? series.map((c) => c.sunHz) : [])]);
      state = { series, lat, durations: dayNightDurations(samples), index: 0, irrMax, elev, horizon };
      hzWrap.hidden = !horizon;
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
