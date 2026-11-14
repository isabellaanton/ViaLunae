import { test } from "node:test";
import assert from "node:assert/strict";
import { powerKw, powerSummary, incidenceCos, irradiance, validatePanel, DEFAULT_PANEL } from "../src/power.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const sample = (sunEl, sunAz = 180, sunDistAu = 1, t = "2026-01-01T00:00:00Z") => ({ t, sunEl, sunAz, sunDistAu });

test("irradiância cai com o quadrado da distância", () => {
  near(irradiance(1), 1361);
  near(irradiance(2), 1361 / 4);
});

test("Sol abaixo do horizonte -> zero em todos os modos", () => {
  for (const mode of ["vertical-tracking", "dual-axis", "fixed"]) {
    assert.equal(powerKw(sample(-0.1), { ...DEFAULT_PANEL, mode }), 0);
  }
});

test("painel vertical que segue o Sol: cos(i) = cos(elevação)", () => {
  near(incidenceCos(0.5, 10, DEFAULT_PANEL), Math.cos((0.5 * Math.PI) / 180));
  // 10 m², 30%, Sol rasante -> ~4,08 kW
  near(powerKw(sample(0.5), DEFAULT_PANEL), (1361 * 10 * 0.3 * Math.cos((0.5 * Math.PI) / 180)) / 1000);
});

test("painel fixo: horizontal recebe sin(el); vertical de costas para o Sol recebe zero", () => {
  const horizontal = { ...DEFAULT_PANEL, mode: "fixed", tiltDeg: 0, azimuthDeg: 0 };
  near(incidenceCos(30, 123, horizontal), 0.5);
  const verticalNorte = { ...DEFAULT_PANEL, mode: "fixed", tiltDeg: 90, azimuthDeg: 0 };
  assert.equal(incidenceCos(10, 180, verticalNorte), 0);
});

test("energia pelo trapézio: 1 kW constante por 2 h = 2 kWh", () => {
  const panel = { areaM2: 1000 / (1361 * 0.5), efficiency: 0.5, mode: "dual-axis" };
  const s = [0, 1, 2].map((h) => sample(10, 180, 1, new Date(Date.UTC(2026, 0, 1, h)).toISOString()));
  const r = powerSummary(s, panel);
  near(r.energyKwh, 2, 1e-9);
  near(r.meanKw, 1, 1e-9);
  near(r.peakKw, 1, 1e-9);
});

test("validação do painel", () => {
  assert.deepEqual(validatePanel(DEFAULT_PANEL), []);
  assert.deepEqual(validatePanel({ ...DEFAULT_PANEL, areaM2: 0, efficiency: 2 }), ["areaM2", "efficiency"]);
});
