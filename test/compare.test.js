import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRow, sortRows, bestByColumn, toCsv, COLUMNS } from "../src/compareModel.js";
import { DEFAULT_PANEL } from "../src/power.js";

const hour = (i) => new Date(Date.UTC(2026, 0, 1, i)).toISOString();
function scenario(id, sunEls, earthEls, lat = -85) {
  return {
    id,
    query: { lat, lon: 30, days: (sunEls.length - 1) / 24 },
    series: {
      source: "file",
      samples: sunEls.map((el, i) => ({ t: hour(i), sunAz: 90, sunEl: el, earthAz: 0, earthEl: earthEls[i], sunDistAu: 1, earthDistKm: 384400 })),
    },
  };
}

test("linha: luz, Terra e potência coerentes", () => {
  const r = buildRow(scenario("a", [5, 5, -1, -1, 5], [1, 1, 1, 1, -1]), DEFAULT_PANEL, "Teste");
  assert.equal(r.site, "Teste");
  assert.equal(r.sunPct, 60);
  assert.equal(r.earthPct, 80);
  assert.equal(r.nextSunsetH, 2);
  assert.ok(r.powerMeanKw > 0);
  assert.ok(r.tempMaxC > r.tempMinC);
});

test("ordenação numérica, texto e nulos no fim", () => {
  const rows = [{ id: 1, x: 3, s: "b" }, { id: 2, x: null, s: "a" }, { id: 3, x: 7, s: "c" }];
  assert.deepEqual(sortRows(rows, "x", "desc").map((r) => r.id), [3, 1, 2]);
  assert.deepEqual(sortRows(rows, "x", "asc").map((r) => r.id), [1, 3, 2]);
  assert.deepEqual(sortRows(rows, "s", "asc").map((r) => r.id), [2, 1, 3]);
});

test("melhor valor por coluna, sem destaque com 1 linha ou empate", () => {
  const a = buildRow(scenario("a", [5, 5, 5], [1, 1, 1]), DEFAULT_PANEL, "A");
  const b = buildRow(scenario("b", [5, -1, -1], [1, 1, 1]), DEFAULT_PANEL, "B");
  const best = bestByColumn([a, b]);
  assert.equal(best.sunPct, "a");
  assert.equal(best.earthPct, undefined); // empate
  assert.deepEqual(bestByColumn([a]), {});
});

test("CSV: cabeçalho, uma linha por cenário e escape de vírgula", () => {
  const r = buildRow(scenario("a", [5, 5, 5], [1, 1, 1]), DEFAULT_PANEL, "Local, com vírgula");
  const csv = toCsv([r], (k) => k, DEFAULT_PANEL);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith("cmp.col.site,cmp.col.start"));
  assert.ok(lines[1].startsWith('"Local, com vírgula",2026-01-01T00:00:00.000Z'));
  assert.equal(lines[0].split(",").length, COLUMNS.length + 7);
});
