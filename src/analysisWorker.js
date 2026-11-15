// Web Worker: calcula os filtros numa faixa de linhas da grade da Lua inteira.
// kind "period": resumo do período (evaluateLocation); kind "now": instante da barra de tempo (evaluateInstant).
import { evaluateLocation, evaluateInstant, instantFrames, filtersFor, prepare, FILTER_IDS } from "./analysisCore.js";

let g = null;
self.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === "init") {
    g = m.g;
    return;
  }
  if (m.type === "frames") {
    // quadros do modo Agora: classes empacotadas, layout [célula][quadro]
    const { jobId, params, f0, nFrames, fstep, th, lats, lons } = m;
    const fs = filtersFor("now");
    const out = new Uint32Array(lats.length * lons.length * nFrames);
    for (let r = 0; r < lats.length; r++) {
      const ctx = prepare(params, lats[r]);
      for (let c = 0; c < lons.length; c++) {
        out.set(instantFrames(g, lats[r], lons[c], params, f0, nFrames, fstep, fs, th, ctx), (r * lons.length + c) * nFrames);
      }
      self.postMessage({ jobId, progress: (r + 1) / lats.length });
    }
    self.postMessage({ jobId, out }, [out.buffer]);
    return;
  }
  if (m.type !== "run") return;
  const { jobId, kind, params, i0, i1, stride, index, iEnd, scanStride, skip, lats, lons } = m;
  const skipSet = new Set(skip || []);
  const out = {};
  for (const id of FILTER_IDS) out[id] = new Float32Array(lats.length * lons.length);
  for (let r = 0; r < lats.length; r++) {
    const ctx = prepare(params, lats[r]);
    for (let c = 0; c < lons.length; c++) {
      const v =
        kind === "now"
          ? evaluateInstant(g, lats[r], lons[c], params, index, iEnd, ctx, null, { scanStride, skip: skipSet })
          : evaluateLocation(g, lats[r], lons[c], params, i0, i1, stride, ctx);
      const k = r * lons.length + c;
      for (const id of FILTER_IDS) out[id][k] = v[id] == null ? NaN : v[id];
    }
  }
  self.postMessage({ jobId, out }, Object.values(out).map((a) => a.buffer));
};
