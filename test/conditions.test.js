import { test } from "node:test";
import assert from "node:assert/strict";
import { surfaceTempK, nightFloorK, earthIlluminatedFraction, conditionsAt, dayNightDurations } from "../src/conditions.js";

const near = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b} (±${eps})`);

test("temperatura: Sol a pino no equador perto de ~385 K (≈ 112 °C)", () => {
  near(surfaceTempK(90, 1, 0), 385, 5);
});

test("temperatura: noite usa o piso por latitude", () => {
  assert.equal(surfaceTempK(-10, 1, 0), nightFloorK(0));
  near(nightFloorK(0), 95, 0.01);
  near(nightFloorK(-90), 50, 0.01);
});

test("temperatura: Sol rasante no polo fica bem mais fria que no equador", () => {
  const polo = surfaceTempK(1.5, 1, -85);
  assert.ok(polo < 170 && polo > 100, `polo ${polo}`);
});

test("fase da Terra: Sol atrás do observador = Terra cheia; Sol atrás da Terra = Terra nova", () => {
  // Terra no zênite (el 90). Sol no nadir (el -90): o observador está entre Sol e Terra -> cheia
  const cheia = earthIlluminatedFraction({ sunAz: 0, sunEl: -90, earthAz: 0, earthEl: 90, sunDistAu: 1, earthDistKm: 384400 });
  near(cheia, 1, 1e-3);
  // Sol no zênite, bem além da Terra -> lado escuro voltado para nós -> nova
  const nova = earthIlluminatedFraction({ sunAz: 0, sunEl: 90, earthAz: 0, earthEl: 90, sunDistAu: 1, earthDistKm: 384400 });
  near(nova, 0, 1e-3);
});

test("condições: noite tem irradiância zero e atraso ~1,28 s a 384.400 km", () => {
  const c = conditionsAt({ t: "x", sunAz: 0, sunEl: -5, earthAz: 0, earthEl: 30, sunDistAu: 1, earthDistKm: 384400 }, 0);
  assert.equal(c.isDay, false);
  assert.equal(c.irradianceGround, 0);
  near(c.delayS, 1.282, 0.001);
});

test("duração do dia: só conta janelas completas", () => {
  const h = (i) => new Date(Date.UTC(2026, 0, 1, i)).toISOString();
  const els = [-1, 1, 1, 1, -1, -1, 1];
  const r = dayNightDurations(els.map((el, i) => ({ t: h(i), sunEl: el })));
  assert.equal(r.dayHours, 2); // 01:00 a 03:00
  assert.equal(r.nightHours, 1); // 04:00 a 05:00
});
