// Modelo da comparação: colunas, linhas calculadas, ordenação, melhor valor e CSV.
// Funções puras (testáveis em Node). A interface fica em compare.js.
import { computeMetrics } from "./metrics.js";
import { powerSummary } from "./power.js";
import { conditionsSummary, kToC } from "./conditions.js";

/**
 * Colunas da tabela. better: "max" | "min" | null (sem destaque).
 * kind: "text" | "date" | "num"; digits: casas decimais na tela.
 */
export const COLUMNS = [
  { key: "site", label: "cmp.col.site", kind: "text" },
  { key: "start", label: "cmp.col.start", kind: "date" },
  { key: "days", label: "cmp.col.days", kind: "num", digits: 0 },
  { key: "sunPct", label: "cmp.col.sunPct", kind: "num", digits: 0, unit: "%", better: "max" },
  { key: "sunElMean", label: "cmp.col.sunElMean", kind: "num", digits: 1, unit: "°", better: "max" },
  { key: "sunLongestH", label: "cmp.col.sunLongestH", kind: "num", digits: 0, unit: "h", better: "max" },
  { key: "nextSunsetH", label: "cmp.col.nextSunsetH", kind: "num", digits: 0, unit: "h", better: "max" },
  { key: "earthPct", label: "cmp.col.earthPct", kind: "num", digits: 0, unit: "%", better: "max" },
  { key: "earthLongestH", label: "cmp.col.earthLongestH", kind: "num", digits: 0, unit: "h", better: "max" },
  { key: "powerMeanKw", label: "cmp.col.powerMeanKw", kind: "num", digits: 2, unit: "kW", better: "max" },
  { key: "energyKwh", label: "cmp.col.energyKwh", kind: "num", digits: 0, unit: "kWh", better: "max" },
  { key: "irrMean", label: "cmp.col.irrMean", kind: "num", digits: 0, unit: "W/m²", better: "max" },
  { key: "tempMinC", label: "cmp.col.tempMinC", kind: "num", digits: 0, unit: "°C", better: null },
  { key: "tempMaxC", label: "cmp.col.tempMaxC", kind: "num", digits: 0, unit: "°C", better: null },
];

/** Uma linha da tabela a partir de um cenário carregado ({ query, series }) e do painel solar */
export function buildRow(scenario, panel, siteLabel) {
  const { query, series } = scenario;
  const samples = series.samples;
  const m = computeMetrics(samples);
  const p = powerSummary(samples, panel);
  const c = conditionsSummary(samples, query.lat);
  return {
    id: scenario.id,
    site: siteLabel,
    lat: query.lat,
    lon: query.lon,
    start: samples[0].t,
    end: samples[samples.length - 1].t,
    days: query.days,
    sunPct: m.sun.fraction * 100,
    sunElMean: m.sun.elevation.mean,
    sunLongestH: m.sun.longestWindowHours,
    // horas até o próximo pôr do Sol (se começa de dia); null se começa de noite ou não se põe no período
    nextSunsetH: m.sun.next?.event === "set" ? m.sun.next.hours : m.sun.visibleNow ? m.totalHours : null,
    earthPct: m.earth.fraction * 100,
    earthLongestH: m.earth.longestWindowHours,
    powerMeanKw: p.meanKw,
    energyKwh: p.energyKwh,
    irrMean: c.irradianceGroundMean,
    tempMinC: kToC(c.tempMinK),
    tempMaxC: kToC(c.tempMaxK),
    source: series.source,
  };
}

/** Ordena linhas por uma coluna; null vai sempre para o fim */
export function sortRows(rows, key, dir = "desc") {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key], vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string") return sign * va.localeCompare(vb);
    return sign * (va - vb);
  });
}

/** Para cada coluna com "better", o id da linha com o melhor valor (só com 2+ linhas) */
export function bestByColumn(rows) {
  const best = {};
  if (rows.length < 2) return best;
  for (const col of COLUMNS) {
    if (!col.better) continue;
    let winner = null;
    for (const r of rows) {
      const v = r[col.key];
      if (v == null) continue;
      if (winner === null || (col.better === "max" ? v > winner.v : v < winner.v)) winner = { id: r.id, v };
    }
    // empate total não destaca ninguém
    if (winner && rows.some((r) => r.id !== winner.id && r[col.key] === winner.v)) continue;
    if (winner) best[col.key] = winner.id;
  }
  return best;
}

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV com cabeçalho traduzido (labelFn) e números com ponto decimal.
 * Inclui lat/lon e a configuração do painel usada nos cálculos.
 */
export function toCsv(rows, labelFn, panel) {
  const extra = [
    { key: "lat", header: "lat" },
    { key: "lon", header: "lon_east" },
    { key: "end", header: "end_utc" },
    { key: "source", header: "source" },
  ];
  const header = [
    ...COLUMNS.map((c) => (c.unit ? `${labelFn(c.label)} (${c.unit})` : labelFn(c.label))),
    ...extra.map((e) => e.header),
    "panel_area_m2",
    "panel_efficiency",
    "panel_mode",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const vals = COLUMNS.map((c) => {
      const v = r[c.key];
      if (v == null) return "";
      return c.kind === "num" ? Number(v.toFixed(c.digits + 2)) : v;
    });
    vals.push(...extra.map((e) => r[e.key]), panel.areaM2, panel.efficiency, panel.mode);
    lines.push(vals.map(csvCell).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
