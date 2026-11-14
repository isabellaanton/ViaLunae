import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, windows, timeToChange } from "../src/metrics.js";

// série sintética de 1 em 1 hora a partir de 2026-01-01T00:00Z
const series = (sunEls, earthEls = sunEls.map(() => 10)) =>
  sunEls.map((el, i) => ({
    t: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
    sunAz: 90, sunEl: el, earthAz: 0, earthEl: earthEls[i], sunDistAu: 1, earthDistKm: 384400,
  }));

test("janelas de visibilidade contínuas", () => {
  const s = series([-1, 2, 3, -1, -2, 5]);
  const w = windows(s, (x) => x.sunEl > 0);
  assert.equal(w.length, 2);
  assert.equal(w[0].hours, 1); // de 01:00 a 02:00
  assert.equal(w[1].truncated, true); // termina no fim do período
});

test("tempo até o pôr e até o nascer", () => {
  assert.deepEqual(timeToChange(series([5, 4, 3, -1]), "sunEl"), { hours: 3, event: "set" });
  assert.deepEqual(timeToChange(series([-5, -4, 2]), "sunEl"), { hours: 2, event: "rise" });
  assert.equal(timeToChange(series([5, 6, 7]), "sunEl"), null); // não muda no período
});

test("métricas: fração de luz, elevação e Terra", () => {
  const m = computeMetrics(series([10, 20, -5, -5], [1, 1, 1, -1]));
  assert.equal(m.totalHours, 3);
  assert.equal(m.sun.fraction, 0.5);
  assert.equal(m.sun.elevation.max, 20);
  assert.equal(m.sun.elevation.min, -5);
  assert.equal(m.sun.visibleNow, true);
  assert.equal(m.earth.fraction, 0.75);
  assert.deepEqual(m.earth.next, { hours: 3, event: "set" });
});

test("série vazia gera erro", () => {
  assert.throws(() => computeMetrics([]));
});
