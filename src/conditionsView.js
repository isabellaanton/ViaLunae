// Card "Condições no local": valores no instante escolhido + gráfico do período (SVG, sem biblioteca).
import { t, getLang } from "./i18n/index.js";
import { conditionsSeries, dayNightDurations, kToC } from "./conditions.js";

const $ = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";
const W = 320, H = 150, PAD = { l: 34, r: 34, t: 10, b: 20 };

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

function svg(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function createConditionsView() {
  const card = $("cond-card");
  const timeEl = $("cond-time");
  const values = $("cond-values");
  const chart = $("cond-chart");
  let state = null; // { series, lat, durations, index, irrMax }

  function drawChart() {
    chart.replaceChildren();
    if (!state) return;
    const { series, irrMax } = state;
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const x = (i) => PAD.l + (series.length > 1 ? (i / (series.length - 1)) * iw : 0);
    const yIrr = (v) => PAD.t + ih - (v / irrMax) * ih;
    const T_MIN = -230, T_MAX = 130; // °C, faixa fixa para comparar cenários
    const yTemp = (c) => PAD.t + ih - ((c - T_MIN) / (T_MAX - T_MIN)) * ih;

    // grade e eixos
    chart.append(svg("rect", { x: PAD.l, y: PAD.t, width: iw, height: ih, class: "ch-bg" }));
    const y0 = yTemp(0);
    chart.append(svg("line", { x1: PAD.l, x2: PAD.l + iw, y1: y0, y2: y0, class: "ch-zero" }));
    const label = (txt, xx, yy, anchor, cls) => {
      const e = svg("text", { x: xx, y: yy, "text-anchor": anchor, class: cls });
      e.textContent = txt;
      chart.append(e);
    };
    label(n(irrMax, 0), PAD.l - 4, PAD.t + 8, "end", "ch-txt irr");
    label("0", PAD.l - 4, PAD.t + ih, "end", "ch-txt irr");
    label(`${T_MAX}°`, PAD.l + iw + 4, PAD.t + 8, "start", "ch-txt temp");
    label("0°", PAD.l + iw + 4, y0 + 3, "start", "ch-txt temp");
    label(`${T_MIN}°`, PAD.l + iw + 4, PAD.t + ih, "start", "ch-txt temp");
    label(fmtTime(series[0].t).slice(0, 10), PAD.l, H - 4, "start", "ch-txt");
    label(fmtTime(series[series.length - 1].t).slice(0, 10), PAD.l + iw, H - 4, "end", "ch-txt");

    // linhas (no máximo ~600 pontos para manter o SVG leve)
    const stride = Math.max(1, Math.floor(series.length / 600));
    const pts = (fy) => {
      const out = [];
      for (let i = 0; i < series.length; i += stride) out.push(`${x(i).toFixed(1)},${fy(series[i]).toFixed(1)}`);
      return out.join(" ");
    };
    chart.append(svg("polyline", { points: pts((c) => yIrr(c.irradianceGround)), class: "ch-irr" }));
    chart.append(svg("polyline", { points: pts((c) => yTemp(kToC(c.tempK))), class: "ch-temp" }));

    // cursor do instante escolhido
    const cx = x(state.index);
    chart.append(svg("line", { x1: cx, x2: cx, y1: PAD.t, y2: PAD.t + ih, class: "ch-cursor" }));
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
      state = { series, lat, durations: dayNightDurations(samples), index: 0, irrMax };
      card.hidden = false;
      renderValues();
      drawChart();
    },
    setIndex(i) {
      if (!state) return;
      state.index = Math.max(0, Math.min(state.series.length - 1, i));
      renderValues();
      drawChart();
    },
    clear() {
      state = null;
      card.hidden = true;
    },
    rerender() {
      renderValues();
      drawChart();
    },
  };
}
