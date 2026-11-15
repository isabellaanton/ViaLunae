// Ferramentas de medida no globo: distância, perfil de elevação, área e inclinação no ponto.
// Distância e área usam a esfera lunar (raio 1737,4 km). Perfil e inclinação usam o relevo real
// do Cesium Moon (dados LOLA), por isso exigem a superfície "Cesium Moon (relevo)".
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian3,
  Cartographic,
  Color,
  Ellipsoid,
  EllipsoidGeodesic,
  HeightReference,
  PolylineDashMaterialProperty,
  Math as CMath,
} from "cesium";
import { t, getLang, onLangChange } from "./i18n/index.js";
import { drawLineChart } from "./chart.js";
import { interaction } from "./interaction.js";
import { surfaceDistanceKm, pathLengthKm, sphericalAreaKm2, slopeFromHeights } from "./geoMeasure.js";

const R_KM = 1737.4;
const PROFILE_SAMPLES = 160;
const SLOPE_BASE_M = 60; // distância entre os pontos usados para a inclinação (ordem da base do LOLA)
const $ = (id) => document.getElementById(id);
const nf = (v, d = 1) =>
  new Intl.NumberFormat(getLang() === "pt" ? "pt-BR" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

// ---------- ferramenta ----------
export function createMeasureTools(viewer, { getTileset, onUseSlope }) {
  const scene = viewer.scene;
  let tool = null; // "distance" | "profile" | "area" | "slope"
  let pts = []; // { lat, lon }
  let entities = [];
  let lastSlope = null;
  let seq = 0; // cada pedido de relevo tem um número; resposta de pedido antigo é descartada

  const panel = $("measure-panel");
  const out = $("measure-out");
  const chart = $("measure-chart");

  function clearDrawing() {
    for (const e of entities) viewer.entities.remove(e);
    entities = [];
    scene.requestRender();
  }

  function draw() {
    clearDrawing();
    const color = Color.fromCssColorString("#ffd45e");
    for (const p of pts) {
      entities.push(
        viewer.entities.add({
          position: Cartesian3.fromDegrees(p.lon, p.lat, 0, Ellipsoid.MOON),
          point: { pixelSize: 8, color, outlineColor: Color.BLACK, outlineWidth: 2, heightReference: HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        })
      );
    }
    if (pts.length >= 2) {
      const ring = tool === "area" && pts.length >= 3 ? [...pts, pts[0]] : pts;
      entities.push(
        viewer.entities.add({
          polyline: {
            positions: ring.map((p) => Cartesian3.fromDegrees(p.lon, p.lat, 0, Ellipsoid.MOON)),
            width: 3,
            clampToGround: true,
            material: tool === "area" ? new PolylineDashMaterialProperty({ color }) : color,
          },
        })
      );
    }
    scene.requestRender();
  }

  function pickLonLat(pos) {
    let cart = null;
    if (getTileset() && scene.pickPositionSupported) cart = scene.pickPosition(pos);
    if (!cart) cart = viewer.camera.pickEllipsoid(pos, Ellipsoid.MOON);
    if (!cart) return null;
    const c = Cartographic.fromCartesian(cart, Ellipsoid.MOON);
    return { lat: CMath.toDegrees(c.latitude), lon: CMath.toDegrees(c.longitude) };
  }

  async function heightsAt(points) {
    const ts = getTileset();
    if (!ts || !ts.show) throw new Error("NEED_TERRAIN");
    const my = ++seq;
    const carts = points.map((p) => Cartographic.fromDegrees(p.lon, p.lat));
    const res = await scene.sampleHeightMostDetailed(carts);
    if (my !== seq) throw new Error("STALE");
    return res.map((c) => (c && Number.isFinite(c.height) ? c.height : null));
  }

  function setOut(html) {
    out.innerHTML = html;
    panel.hidden = false;
  }

  function hint() {
    chart.setAttribute("hidden", "");
    setOut(`<p class="small">${t(`ms.${tool}.hint`)}</p>`);
  }

  // ---------- cálculos de cada ferramenta ----------
  function showDistance() {
    if (pts.length < 2) return hint();
    const segs = [];
    for (let i = 1; i < pts.length; i++) segs.push(surfaceDistanceKm(pts[i - 1], pts[i]));
    const total = segs.reduce((a, b) => a + b, 0);
    setOut(`<p><strong>${t("ms.total")}: ${nf(total, 2)} km</strong></p>
      ${segs.length > 1 ? `<p class="small muted">${segs.map((s, i) => `${t("ms.segment")} ${i + 1}: ${nf(s, 2)} km`).join(" · ")}</p>` : ""}
      <p class="small muted">${t("ms.distanceNote")}</p>`);
  }

  function showArea() {
    if (pts.length < 3) return hint();
    const area = sphericalAreaKm2(pts);
    const per = pathLengthKm([...pts, pts[0]]);
    setOut(`<p><strong>${t("ms.area")}: ${nf(area, area < 10 ? 2 : 0)} km²</strong></p>
      <p class="small muted">${t("ms.perimeter")}: ${nf(per, 2)} km</p>`);
  }

  async function showProfile() {
    if (pts.length < 2) return hint();
    // pontos igualmente espaçados ao longo do caminho (geodésicas entre os cliques)
    const total = pathLengthKm(pts);
    const samples = [];
    for (let i = 1; i < pts.length; i++) {
      const g = new EllipsoidGeodesic(
        Cartographic.fromDegrees(pts[i - 1].lon, pts[i - 1].lat),
        Cartographic.fromDegrees(pts[i].lon, pts[i].lat),
        Ellipsoid.MOON
      );
      const segKm = surfaceDistanceKm(pts[i - 1], pts[i]);
      const n = Math.max(2, Math.round((segKm / total) * PROFILE_SAMPLES));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const c = g.interpolateUsingFraction(k / n);
        samples.push({ lat: CMath.toDegrees(c.latitude), lon: CMath.toDegrees(c.longitude) });
      }
    }
    setOut(`<p class="small">${t("ms.sampling")}</p>`);
    let hs;
    try {
      hs = await heightsAt(samples);
    } catch (e) {
      if (e.message === "STALE") return;
      return setOut(`<p class="small error">${t(e.message === "NEED_TERRAIN" ? "ms.needTerrain" : "ms.error")}</p>`);
    }
    const dist = [0];
    for (let i = 1; i < samples.length; i++) dist.push(dist[i - 1] + surfaceDistanceKm(samples[i - 1], samples[i]));
    let up = 0, down = 0, maxSlope = 0;
    for (let i = 1; i < hs.length; i++) {
      if (hs[i] == null || hs[i - 1] == null) continue;
      const dz = hs[i] - hs[i - 1];
      if (dz > 0) up += dz;
      else down -= dz;
      const run = (dist[i] - dist[i - 1]) * 1000;
      if (run > 0) maxSlope = Math.max(maxSlope, Math.atan(Math.abs(dz) / run) * (180 / Math.PI));
    }
    const valid = hs.filter((h) => h != null);
    if (!valid.length) return setOut(`<p class="small error">${t("ms.error")}</p>`);
    // buracos (sem relevo carregado) herdam o valor anterior para a linha não quebrar
    let prev = valid[0];
    const km = hs.map((h) => (prev = h ?? prev) / 1000);
    const lo = Math.min(...km), hi = Math.max(...km), padKm = Math.max(0.05, (hi - lo) * 0.1);
    const range = { min: lo - padKm, max: hi + padKm };
    chart.removeAttribute("hidden");
    drawLineChart(chart, {
      width: 340,
      height: 140,
      count: hs.length,
      lines: [{ values: km, cls: "ln-profile" }],
      left: {
        min: range.min,
        max: range.max,
        ticks: [
          { v: range.max, label: `${nf(range.max, 1)} km` },
          { v: range.min, label: `${nf(range.min, 1)} km` },
        ],
      },
      xLabels: ["0 km", `${nf(total, 1)} km`],
    });
    out.innerHTML = `<p><strong>${t("ms.profileTitle", { km: nf(total, 2) })}</strong></p>
      <p class="small">${t("ms.profileStats", {
        min: nf(Math.min(...valid) / 1000, 2),
        max: nf(Math.max(...valid) / 1000, 2),
        up: nf(up, 0),
        down: nf(down, 0),
        slope: nf(maxSlope, 1),
      })}</p>
      <p class="small muted">${t("ms.profileNote")}</p>`;
    panel.hidden = false;
  }

  async function showSlope() {
    if (!pts.length) return hint();
    const p = pts[pts.length - 1];
    const dLat = (SLOPE_BASE_M / 1000 / R_KM) * (180 / Math.PI);
    const dLon = dLat / Math.max(0.01, Math.cos(p.lat * (Math.PI / 180)));
    setOut(`<p class="small">${t("ms.sampling")}</p>`);
    let hs;
    try {
      hs = await heightsAt([
        { lat: p.lat, lon: p.lon + dLon },
        { lat: p.lat, lon: p.lon - dLon },
        { lat: p.lat + dLat, lon: p.lon },
        { lat: p.lat - dLat, lon: p.lon },
        p,
      ]);
    } catch (e) {
      if (e.message === "STALE") return;
      return setOut(`<p class="small error">${t(e.message === "NEED_TERRAIN" ? "ms.needTerrain" : "ms.error")}</p>`);
    }
    if (hs.some((h) => h == null)) return setOut(`<p class="small error">${t("ms.error")}</p>`);
    const [e, w, n, s, c] = hs;
    lastSlope = slopeFromHeights({ e, w, n, s }, SLOPE_BASE_M);
    const dir = t(`ms.dir.${Math.round(lastSlope.downhillAzDeg / 45) % 8}`);
    setOut(`<p><strong>${t("ms.slopeValue", { v: nf(lastSlope.slopeDeg, 1) })}</strong></p>
      <p class="small">${t("ms.slopeDetail", { dir, az: nf(lastSlope.downhillAzDeg, 0), h: nf(c, 0), lat: nf(p.lat, 3), lon: nf(p.lon, 3) })}</p>
      <p class="small muted">${t("ms.slopeNote", { m: SLOPE_BASE_M })}</p>
      <button type="button" class="ghost small" data-ms-use>${t("ms.useSlope")}</button>`);
  }

  async function refresh() {
    if (tool === "distance") showDistance();
    else if (tool === "area") showArea();
    else if (tool === "profile") await showProfile();
    else if (tool === "slope") await showSlope();
  }

  // ---------- eventos ----------
  const handler = new ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((ev) => {
    if (!tool) return;
    const p = pickLonLat(ev.position);
    if (!p) return;
    if (tool === "slope") pts = [p];
    else pts.push(p);
    draw();
    // perfil: calcula a cada novo ponto (a partir de 2); os outros são instantâneos
    refresh();
  }, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(() => {
    if (tool && pts.length) {
      pts.pop();
      draw();
      refresh();
    }
  }, ScreenSpaceEventType.RIGHT_CLICK);

  function setTool(next) {
    tool = tool === next ? null : next;
    seq++;
    interaction.measuring = Boolean(tool);
    pts = [];
    lastSlope = null;
    clearDrawing();
    viewer.container.style.cursor = tool ? "crosshair" : "";
    for (const b of document.querySelectorAll("[data-ms-tool]")) {
      b.classList.toggle("active", b.dataset.msTool === tool);
      b.setAttribute("aria-pressed", String(b.dataset.msTool === tool));
    }
    if (tool) hint();
    else panel.hidden = true;
  }

  document.querySelector(".measure-tools").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-ms-tool]");
    if (b) setTool(b.dataset.msTool);
  });
  panel.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-ms-close]")) setTool(null);
    else if (ev.target.closest("[data-ms-clear]")) {
      pts = [];
      seq++;
      clearDrawing();
      hint();
    } else if (ev.target.closest("[data-ms-use]") && lastSlope) onUseSlope?.(lastSlope);
  });
  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && tool) setTool(null);
  });
  onLangChange(() => tool && refresh());

  return {
    stop: () => tool && setTool(null),
  };
}
