// Mapa dos filtros na Lua inteira: grade calculada em Web Workers e pintada como camada de imagem
// sobre o globo 3D (esfera Moon Trek). A Lua continua girável.
// Dois tipos de cálculo: "period" (resumo do período) e "now" (instante da barra de tempo).
// Duas qualidades: "preview" (grade grossa, rápida, para animar/arrastar) e "full" (nítida).
import {
  ImageryLayer,
  SingleTileImageryProvider,
  Rectangle,
  Primitive,
  GeometryInstance,
  EllipsoidGeometry,
  MaterialAppearance,
  Material,
  Color,
  Cartesian3,
  Ellipsoid,
} from "cesium";
import { FILTERS, classify, relativeThresholds, score } from "./analysisCore.js";

const IMG_W = 360; // colunas da imagem: 1° de longitude
const IMG_H = 360; // linhas da imagem: 0,5° de latitude

const QUALITY = {
  // passo de latitude (°) perto dos polos / no resto, passo de longitude, passos de tempo, passo das contagens
  full: { polar: 0.5, mid: 1, lon: 1, maxSteps: 360, scanStride: 2 },
  preview: { polar: 1, mid: 2, lon: 2, maxSteps: 120, scanStride: 6 },
};

export const COLORS = { 2: [46, 204, 113], 1: [241, 196, 15], 0: [231, 76, 60] };

// cor da pontuação (0–100%): 3 cores; o tom mostra a posição dentro da faixa
export function scoreColor(pct) {
  const level = pct >= 66.6 ? 2 : pct >= 33.3 ? 1 : 0;
  const within = level === 2 ? (pct - 66.6) / 33.4 : level === 1 ? (pct - 33.3) / 33.3 : pct / 33.3;
  const shade = 0.7 + 0.3 * (level === 0 ? 1 - within : within);
  return COLORS[level].map((c) => Math.round(c * shade));
}

function buildGrid(q) {
  const lats = [];
  for (let lat = 90 - q.polar / 2; lat > -90; ) {
    lats.push(lat);
    lat -= Math.abs(lat) >= 60 ? q.polar : q.mid;
  }
  const lons = [];
  for (let lon = -180 + q.lon / 2; lon < 180; lon += q.lon) lons.push(lon);
  // pixel da imagem -> célula mais próxima
  const rowOf = new Int32Array(IMG_H);
  for (let j = 0, r = 0; j < IMG_H; j++) {
    const lat = 90 - (j + 0.5) * (180 / IMG_H);
    while (r + 1 < lats.length && Math.abs(lats[r + 1] - lat) <= Math.abs(lats[r] - lat)) r++;
    rowOf[j] = r;
  }
  const colOf = new Int32Array(IMG_W);
  for (let i = 0; i < IMG_W; i++) colOf[i] = Math.min(lons.length - 1, Math.floor((i * lons.length) / IMG_W));
  return { lats, lons, rowOf, colOf };
}

export function createAnalysisMap(viewer) {
  const grids = { full: buildGrid(QUALITY.full), preview: buildGrid(QUALITY.preview) };
  const nWorkers = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  let workers = null;
  let g = null;
  let jobId = 0;
  let data = null; // { key, grid, values, kind, quality }
  let layers = [];
  let opacity = 0.65;

  async function ensure() {
    if (workers) return g;
    g = await fetch("/data/ephem/global.json").then((r) => r.json());
    workers = Array.from(
      { length: nWorkers },
      () => new Worker(new URL("./analysisWorker.js", import.meta.url), { type: "module" })
    );
    for (const w of workers) w.postMessage({ type: "init", g });
    return g;
  }

  function range(startIso, days) {
    const t0 = Date.parse(g.start);
    const step = g.stepMinutes * 60_000;
    const i0 = Math.round((Date.parse(startIso) - t0) / step);
    const i1 = i0 + Math.round((days * 86_400_000) / step);
    if (i0 < 0 || i1 > g.count) return null;
    return { i0, i1 };
  }

  // instante (ISO) -> índice da série global
  function indexOf(iso) {
    const i = Math.round((Date.parse(iso) - Date.parse(g.start)) / (g.stepMinutes * 60_000));
    return i >= 0 && i < g.count ? i : null;
  }

  /**
   * @param job { kind: "period"|"now", quality: "preview"|"full", params, startIso, days, timeIso, skip: string[] }
   * @returns dados do mapa, ou null se outro cálculo começou depois (resultado descartado)
   */
  async function compute(job, onProgress) {
    await ensure();
    const q = QUALITY[job.quality];
    const grid = grids[job.quality];
    const rg = range(job.startIso, job.days);
    if (!rg) throw new Error("OUT_OF_RANGE");
    const msg = { kind: job.kind, params: job.params };
    if (job.kind === "now") {
      const index = indexOf(job.timeIso);
      if (index == null) throw new Error("OUT_OF_RANGE");
      Object.assign(msg, { index, iEnd: g.count, scanStride: q.scanStride, skip: job.skip });
    } else {
      Object.assign(msg, { ...rg, stride: Math.max(1, Math.ceil((rg.i1 - rg.i0) / q.maxSteps)) });
    }
    const key = JSON.stringify({ ...msg, quality: job.quality });
    if (data?.key === key) return { ...data, cached: true };
    const id = ++jobId;
    const chunk = Math.ceil(grid.lats.length / workers.length);
    let done = 0;
    const parts = await Promise.all(
      workers.map(
        (w, k) =>
          new Promise((resolve) => {
            const part = grid.lats.slice(k * chunk, (k + 1) * chunk);
            if (!part.length) return resolve({ offset: k * chunk, out: null });
            const onMsg = (ev) => {
              if (ev.data.jobId !== id) return;
              w.removeEventListener("message", onMsg);
              if (id === jobId) onProgress?.(++done / workers.length);
              resolve({ offset: k * chunk, out: ev.data.out });
            };
            w.addEventListener("message", onMsg);
            w.postMessage({ type: "run", jobId: id, ...msg, lons: grid.lons, lats: part });
          })
      )
    );
    if (id !== jobId) return null;
    const n = grid.lons.length;
    const values = {};
    for (const f of FILTERS) {
      const arr = new Float32Array(grid.lats.length * n);
      for (const p of parts) if (p.out) arr.set(p.out[f.id], p.offset * n);
      values[f.id] = arr;
    }
    data = { key, grid, values, kind: job.kind, quality: job.quality };
    return data;
  }

  // limites efetivos de cada filtro ligado: fixos ou relativos (terços da Lua inteira)
  function thresholdsFor(filters, enabled, limits, colorMode) {
    const th = {};
    for (const f of filters) {
      if (!enabled.has(f.id)) continue;
      th[f.id] =
        colorMode === "relative" && data
          ? relativeThresholds(Array.from(data.values[f.id]).filter((_, i) => i % 5 === 0), f)
          : limits[f.id] || f;
    }
    return th;
  }

  function paint(filters, enabled, limits, colorMode) {
    const { grid, values } = data;
    const th = thresholdsFor(filters, enabled, limits, colorMode);
    const fs = filters.filter((f) => enabled.has(f.id));
    const n = grid.lats.length * grid.lons.length;
    const cell = new Uint8ClampedArray(n * 4);
    for (let k = 0; k < n; k++) {
      const classes = {};
      for (const f of fs) classes[f.id] = classify(values[f.id][k], f, th[f.id]);
      const { pct } = score(classes, enabled);
      if (pct == null) continue; // sem dado: transparente
      const c = scoreColor(pct);
      cell[k * 4] = c[0];
      cell[k * 4 + 1] = c[1];
      cell[k * 4 + 2] = c[2];
      cell[k * 4 + 3] = 255;
    }
    return toCanvas(cell, grid);
  }

  // cores por célula (RGBA) -> imagem 360×360 em lat/lon
  function toCanvas(cell, grid) {
    const canvas = document.createElement("canvas");
    canvas.width = IMG_W;
    canvas.height = IMG_H;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(IMG_W, IMG_H);
    const nl = grid.lons.length;
    for (let j = 0; j < IMG_H; j++) {
      const r = grid.rowOf[j];
      for (let i = 0; i < IMG_W; i++) {
        const src = (r * nl + grid.colOf[i]) * 4;
        const dst = (j * IMG_W + i) * 4;
        img.data[dst] = cell[src];
        img.data[dst + 1] = cell[src + 1];
        img.data[dst + 2] = cell[src + 2];
        img.data[dst + 3] = cell[src + 3];
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function clearLayers(keep) {
    for (const { owner, layer } of layers) {
      if (layer === keep) continue;
      if (!layer.isDestroyed() && owner.contains(layer)) owner.remove(layer, true);
    }
    layers = layers.filter((l) => l.layer === keep);
  }

  // ---------- "casca" para a animação: esfera fina sobre a Lua com textura trocada a cada quadro ----------
  // Recriar uma camada de imagem custa ~90 ms; trocar a textura da casca custa poucos ms.
  let shell = null;
  function showShell(canvas) {
    clearLayers(null);
    if (!shell) {
      const r = Ellipsoid.MOON.radii.x + 150; // 150 m acima da esfera lisa
      shell = new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new EllipsoidGeometry({
            radii: new Cartesian3(r, r, r),
            stackPartitions: 180,
            slicePartitions: 360,
            vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
          }),
        }),
        appearance: new MaterialAppearance({
          material: Material.fromType("Image", { image: canvas, color: new Color(1, 1, 1, opacity) }),
          materialSupport: MaterialAppearance.MaterialSupport.TEXTURED,
          translucent: true,
          faceForward: false,
          flat: false,
        }),
        asynchronous: false,
      });
      viewer.scene.primitives.add(shell);
    } else {
      shell.appearance.material.uniforms.image = canvas;
      shell.appearance.material.uniforms.color.alpha = opacity;
    }
    shell.show = true;
    viewer.scene.requestRender();
  }
  function hideShell() {
    if (shell) shell.show = false;
  }

  async function show(canvas) {
    hideShell();
    const provider = await SingleTileImageryProvider.fromUrl(canvas.toDataURL("image/png"), {
      rectangle: Rectangle.fromDegrees(-180, -90, 180, 90),
    });
    // só na esfera (Moon Trek): o relevo 3D do Cesium Moon aceita a camada, mas não a desenha (testado no 1.147)
    const layer = new ImageryLayer(provider, { alpha: opacity });
    viewer.imageryLayers.add(layer);
    layers.push({ owner: viewer.imageryLayers, layer });
    clearLayers(layer); // a nova entra antes de a antiga sair: sem piscar
    viewer.scene.requestRender();
  }

  function valuesAt(lat, lon) {
    if (!data) return null;
    const { grid, values } = data;
    let r = 0;
    for (let k = 1; k < grid.lats.length; k++) if (Math.abs(grid.lats[k] - lat) < Math.abs(grid.lats[r] - lat)) r = k;
    const l = (((lon + 180) % 360) + 360) % 360;
    const c = Math.min(grid.lons.length - 1, Math.floor((l * grid.lons.length) / 360));
    const k = r * grid.lons.length + c;
    const out = {};
    for (const f of FILTERS) {
      const v = values[f.id][k];
      out[f.id] = Number.isNaN(v) ? null : v;
    }
    return out;
  }

  // ---------- quadros pré-calculados do modo Agora (animação lisa) ----------
  const MAX_FRAMES = 360;
  let frames = null; // { key, f0, fstep, nFrames, codes: Uint32Array [quadro][célula], grid }
  let framesJob = 0;

  /**
   * Calcula as classes de todos os filtros em todos os instantes do período (grade da prévia).
   * @param job { params, startIso, days, th }  th = limites do modo Agora por filtro
   */
  async function computeFrames(job, onProgress) {
    await ensure();
    const rg = range(job.startIso, job.days);
    if (!rg) throw new Error("OUT_OF_RANGE");
    const fstep = Math.max(1, Math.ceil((rg.i1 - rg.i0) / MAX_FRAMES));
    const nFrames = Math.floor((rg.i1 - rg.i0) / fstep) + 1;
    const key = JSON.stringify({ params: job.params, th: job.th, f0: rg.i0, fstep, nFrames });
    if (frames?.key === key) return frames;
    const id = `f${++framesJob}`;
    const grid = grids.preview;
    const nl = grid.lons.length;
    const chunk = Math.ceil(grid.lats.length / workers.length);
    const progress = new Array(workers.length).fill(0);
    const parts = await Promise.all(
      workers.map(
        (w, k) =>
          new Promise((resolve) => {
            const part = grid.lats.slice(k * chunk, (k + 1) * chunk);
            if (!part.length) {
              progress[k] = 1;
              return resolve({ offset: k * chunk, rows: 0, out: null });
            }
            const onMsg = (ev) => {
              if (ev.data.jobId !== id) return;
              if (ev.data.progress != null) {
                progress[k] = ev.data.progress;
                if (`f${framesJob}` === id) onProgress?.(progress.reduce((a, b) => a + b, 0) / workers.length);
                return;
              }
              w.removeEventListener("message", onMsg);
              resolve({ offset: k * chunk, rows: part.length, out: ev.data.out });
            };
            w.addEventListener("message", onMsg);
            w.postMessage({ type: "frames", jobId: id, params: job.params, th: job.th, f0: rg.i0, nFrames, fstep, lats: part, lons: grid.lons });
          })
      )
    );
    if (`f${framesJob}` !== id) return null; // pedido mais novo começou depois
    // [célula][quadro] dos workers -> [quadro][célula]
    const nCells = grid.lats.length * nl;
    const codes = new Uint32Array(nCells * nFrames);
    for (const p of parts) {
      if (!p.out) continue;
      const cells = p.rows * nl;
      const base = p.offset * nl;
      for (let c = 0; c < cells; c++) {
        const src = c * nFrames;
        for (let k = 0; k < nFrames; k++) codes[k * nCells + base + c] = p.out[src + k];
      }
    }
    frames = { key, f0: rg.i0, fstep, nFrames, codes, grid, nCells };
    return frames;
  }

  // quadro do instante (ISO), ou -1 se não houver quadros prontos para ele
  function frameOf(iso) {
    if (!frames) return -1;
    const i = indexOf(iso);
    if (i == null) return -1;
    const k = Math.round((i - frames.f0) / frames.fstep);
    return k >= 0 && k < frames.nFrames ? k : -1;
  }

  // pinta um quadro: decodifica as classes dos filtros ligados e calcula a pontuação de cada célula
  function paintFrame(k, enabledIds, criteriaOf) {
    const { grid, codes, nCells } = frames;
    const idx = enabledIds.map((id) => FILTERS.findIndex((f) => f.id === id));
    const crit = enabledIds.map((id) => criteriaOf[id]);
    const nCrit = Math.max(0, ...crit) + 1;
    const sum = new Float32Array(nCrit);
    const cnt = new Uint8Array(nCrit);
    const cell = new Uint8ClampedArray(nCells * 4);
    const base = k * nCells;
    for (let c = 0; c < nCells; c++) {
      sum.fill(0);
      cnt.fill(0);
      const code = codes[base + c];
      for (let e = 0; e < idx.length; e++) {
        const v = (code >>> (2 * idx[e])) & 3;
        if (v === 3) continue;
        sum[crit[e]] += v;
        cnt[crit[e]]++;
      }
      let total = 0, n = 0;
      for (let q = 0; q < nCrit; q++) if (cnt[q]) { total += sum[q] / cnt[q]; n++; }
      if (!n) continue;
      const col = scoreColor((100 * total) / (2 * n));
      cell[c * 4] = col[0];
      cell[c * 4 + 1] = col[1];
      cell[c * 4 + 2] = col[2];
      cell[c * 4 + 3] = 255;
    }
    return toCanvas(cell, grid);
  }

  return {
    computeFrames,
    frameOf,
    get framesReady() {
      return Boolean(frames);
    },
    invalidateFrames() {
      frames = null;
      framesJob++;
    },
    async renderFrame(k, enabledIds, criteriaOf) {
      if (!frames || !enabledIds.length) return this.hide();
      showShell(paintFrame(k, enabledIds, criteriaOf));
    },
    ensure,
    compute,
    indexOf,
    async render(filters, enabled, limits, colorMode) {
      if (!data || !enabled.size) return this.hide();
      await show(paint(filters, enabled, limits, colorMode));
    },
    hide() {
      clearLayers(null);
      hideShell();
      viewer.scene.requestRender();
    },
    setOpacity(a) {
      opacity = a;
      for (const { layer } of layers) if (!layer.isDestroyed()) layer.alpha = a;
      if (shell) shell.appearance.material.uniforms.color.alpha = a;
      viewer.scene.requestRender();
    },
    valuesAt,
    thresholds: (filters, enabled, limits, colorMode) => thresholdsFor(filters, enabled, limits, colorMode),
    get data() {
      return data;
    },
  };
}
