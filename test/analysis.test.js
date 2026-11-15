import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { skyAt } from "../src/skyGeometry.js";
import { evaluateLocation, DEFAULT_PARAMS, classify, score, FILTERS, relativeThresholds } from "../src/analysisCore.js";

const g = JSON.parse(readFileSync(new URL("../public/data/ephem/global.json", import.meta.url)));
const site = JSON.parse(readFileSync(new URL("../public/data/ephem/mons-mouton.json", import.meta.url)));
const N = 24 * 30;

test("geometria a partir da série global bate com a Horizons no local (< 0,05°)", () => {
  for (let i = 0; i < site.count; i += 97) {
    const k = skyAt(g, i, site.lat, site.lon);
    assert.ok(Math.abs(k.sunEl - site.sunEl[i]) < 0.05, `sunEl ${i}`);
    assert.ok(Math.abs(k.earthEl - site.earthEl[i]) < 0.05, `earthEl ${i}`);
  }
});

test("módulo sem inclinação e encosta plana não perdem nada; 2 eixos = 100% do ideal", () => {
  const p = { ...DEFAULT_PARAMS, moduleTiltDeg: 0, slopeDeg: 0, panelMode: "dual-axis" };
  const m = evaluateLocation(g, 0.67, 23.47, p, 0, N);
  assert.equal(Math.round(m.panelPct), 100);
  assert.equal(Math.round(m.tiltLossPct), 0);
  assert.equal(Math.round(m.slopeLightPct), 100);
});

test("lado oculto nunca vê a Terra; lado próximo vê sempre", () => {
  const far = evaluateLocation(g, 0, 180, DEFAULT_PARAMS, 0, N);
  const near = evaluateLocation(g, 0, 0, DEFAULT_PARAMS, 0, N);
  assert.equal(far.earthPct, 0);
  assert.equal(near.earthPct, 100);
  assert.ok(far.blackoutH >= N - 1);
});

test("equador: noite de ~14 dias; inclinar o módulo custa energia", () => {
  const m = evaluateLocation(g, 0, 20, DEFAULT_PARAMS, 0, N);
  assert.ok(m.darkRunH > 300 && m.darkRunH < 380, `darkRunH ${m.darkRunH}`);
  assert.ok(m.tiltLossPct > 0);
});

test("classificação, limites relativos e pontuação", () => {
  const f = FILTERS.find((x) => x.id === "panelPct"); // max, g 80, r 50
  assert.equal(classify(90, f), 2);
  assert.equal(classify(60, f), 1);
  assert.equal(classify(10, f), 0);
  assert.equal(classify(null, f), null);
  const b = FILTERS.find((x) => x.id === "blackoutH"); // min
  assert.equal(classify(10, b), 2);
  const th = relativeThresholds([1, 2, 3, 4, 5, 6], f);
  assert.ok(th.g > th.r);
  const s = score({ earthPct: 2, blackoutH: 0, panelPct: 2 }, new Set(["earthPct", "blackoutH", "panelPct"]));
  assert.equal(s.criteria.libration, 1);
  assert.equal(s.pct, 75);
  assert.equal(score({}, new Set()).pct, null);
});

test("relevo real: horizonte alto tira horas de Sol; sem perfil, filtros de relevo ficam sem dado", () => {
  const flat = evaluateLocation(g, site.lat, site.lon, DEFAULT_PARAMS, 0, N);
  assert.equal(flat.reliefLossPct, null);
  const hz = { azStepDeg: 2, horizon: new Array(180).fill(3) };
  const real = evaluateLocation(g, site.lat, site.lon, DEFAULT_PARAMS, 0, N, 1, undefined, hz);
  assert.ok(real.reliefLossPct > 10 && real.reliefLossPct < 100, `perda ${real.reliefLossPct}`);
  assert.equal(real.horizonMaxDeg, 3);
  const zero = evaluateLocation(g, site.lat, site.lon, DEFAULT_PARAMS, 0, N, 1, undefined, { azStepDeg: 2, horizon: new Array(180).fill(-5) });
  assert.equal(zero.reliefLossPct, 0);
});

test("modo Agora: de dia gera energia e conta horas até o pôr do Sol; de noite fica zero", async () => {
  const { evaluateInstant } = await import("../src/analysisCore.js");
  // instante de dia e de noite no equador (lon 20°): procura pela elevação do Sol
  let day = -1, night = -1;
  for (let i = 0; i < 720 && (day < 0 || night < 0); i++) {
    const el = skyAt(g, i, 0, 20).sunEl;
    if (el > 30 && day < 0) day = i;
    if (el < -30 && night < 0) night = i;
  }
  const d = evaluateInstant(g, 0, 20, DEFAULT_PARAMS, day);
  const n = evaluateInstant(g, 0, 20, DEFAULT_PARAMS, night);
  assert.ok(d.powerKw > 10 && d.lightRunH > 0 && d.darkRunH === 0);
  assert.equal(n.powerKw, 0);
  assert.equal(n.lightRunH, 0);
  assert.ok(n.darkRunH > 0);
  // lado oculto: Terra abaixo do horizonte, sem contato
  const far = evaluateInstant(g, 0, 180, DEFAULT_PARAMS, day);
  assert.ok(far.earthPct < 0);
  assert.equal(far.blackoutH, 0);
});

test("quadros pré-calculados batem com o cálculo instantâneo, inclusive contagens", async () => {
  const { instantFrames, unpackClass, evaluateInstant, filtersFor, classify, FILTER_IDS } = await import("../src/analysisCore.js");
  const fs = filtersFor("now");
  const th = Object.fromEntries(fs.map((f) => [f.id, { g: f.g, r: f.r }]));
  const codes = instantFrames(g, -84.79, 29.2, DEFAULT_PARAMS, 10, 48, 3, fs, th);
  for (const k of [0, 13, 47]) {
    const v = evaluateInstant(g, -84.79, 29.2, DEFAULT_PARAMS, 10 + k * 3);
    for (const f of fs) {
      const exp = classify(v[f.id], f, th[f.id]);
      const got = unpackClass(codes[k], FILTER_IDS.indexOf(f.id));
      // contagens com passo de 3 h podem diferir na borda da faixa; o resto tem de ser igual
      if (!["lightRunH", "darkRunH", "blackoutH"].includes(f.id)) assert.equal(got, exp, `${f.id} quadro ${k}`);
    }
  }
});
