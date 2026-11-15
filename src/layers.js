// Camadas científicas sobre o globo (só visualização; não entram nos filtros, que usam só a Horizons).
// Fontes com acesso liberado pelo navegador (CORS):
//   - NASA Moon Trek (WMTS): inclinação LOLA, abundância de rochas e temperatura média Diviner (globais)
//   - Lunaserv / LROC-ASU (WMS 1.1.1): sombra permanente (LOLA), iluminação média %, gelo estável e
//     temperatura de verão (Diviner), nos polos
import {
  WebMapTileServiceImageryProvider,
  WebMapServiceImageryProvider,
  GeographicTilingScheme,
  ImageryLayer,
  Ellipsoid,
  Credit,
} from "cesium";
import { t, onLangChange } from "./i18n/index.js";

const TREK = "https://trek.nasa.gov/tiles/Moon/EQ";
const LUNASERV = "https://wms.im-ldi.com/";

export const LAYERS = [
  { id: "slope", kind: "trek", layer: "LRO_LOLA_ClrSlope_Global_16ppd", maxLevel: 2, region: "global", credit: "NASA/GSFC LOLA, via NASA Moon Trek" },
  { id: "rocks", kind: "trek", layer: "Diviner_avg_RockAbundance", maxLevel: 6, region: "global", credit: "NASA/UCLA Diviner (Bandfield et al. 2011), via NASA Moon Trek" },
  { id: "temp", kind: "trek", layer: "LRO_Diviner_ST_Avg_Clr_Global_32ppd", maxLevel: 3, region: "global", credit: "NASA/UCLA Diviner, via NASA Moon Trek" },
  { id: "psr", kind: "wms", layer: "luna_psr_81s", region: "south", credit: "LOLA PSR (90°S–81°S), via Lunaserv (LROC/ASU)" },
  { id: "illum", kind: "wms", layer: "luna_polar_illumination_pct", region: "pole", credit: "LROC WAC — Speyerer & Robinson (2013), via Lunaserv (LROC/ASU)" },
  { id: "ice", kind: "wms", layer: "luna_diviner_sp_ice_depth_today", region: "south", credit: "Diviner — Siegler et al. (2016), via Lunaserv (LROC/ASU)" },
  { id: "tempPolar", kind: "wms", layer: "luna_diviner_polar_summer_avg", region: "pole", credit: "Diviner — Williams et al. (2019), via Lunaserv (LROC/ASU)" },
];

function provider(def) {
  const tilingScheme = new GeographicTilingScheme({ ellipsoid: Ellipsoid.MOON });
  if (def.kind === "trek") {
    return new WebMapTileServiceImageryProvider({
      url: `${TREK}/${def.layer}/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`,
      layer: def.layer,
      style: "default",
      format: "image/png",
      tileMatrixSetID: "default028mm",
      tilingScheme,
      maximumLevel: def.maxLevel,
      credit: new Credit(def.credit),
    });
  }
  return new WebMapServiceImageryProvider({
    url: LUNASERV,
    layers: def.layer,
    parameters: { service: "WMS", version: "1.1.1", request: "GetMap", styles: "", format: "image/png", transparent: true },
    tilingScheme,
    tileWidth: 256,
    tileHeight: 256,
    credit: new Credit(def.credit),
  });
}

/**
 * @param onNeedSphere(on) chamado quando passa a haver (ou deixa de haver) camada ligada:
 *        as camadas só aparecem na esfera (Moon Trek), não no relevo 3D
 */
export function createLayers(viewer, { onNeedSphere }) {
  const STORE = "vialunae.layers";
  const active = new Map(); // id -> { layer, alpha }
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch {
    saved = {};
  }
  const alphaOf = (id) => saved[id]?.alpha ?? 0.7;
  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {
      /* sem armazenamento */
    }
  };

  function attach(id) {
    const def = LAYERS.find((d) => d.id === id);
    const layer = new ImageryLayer(provider(def), { alpha: alphaOf(id) });
    // logo acima da imagem base, abaixo do mapa de filtros
    viewer.imageryLayers.add(layer, Math.min(1 + active.size, viewer.imageryLayers.length));
    active.set(id, { layer });
  }

  function detach(id) {
    const a = active.get(id);
    if (a && !a.layer.isDestroyed() && viewer.imageryLayers.contains(a.layer)) viewer.imageryLayers.remove(a.layer, true);
    active.delete(id);
  }

  function setOn(id, on) {
    const before = active.size;
    if (on && !active.has(id)) attach(id);
    if (!on) detach(id);
    if ((before === 0) !== (active.size === 0)) onNeedSphere?.(active.size > 0);
    viewer.scene.requestRender();
  }

  function render() {
    const root = document.getElementById("layers-list");
    root.innerHTML = LAYERS.map(
      (d) => `<div class="ly-item">
        <label class="an-check"><input type="checkbox" data-ly="${d.id}" ${active.has(d.id) ? "checked" : ""}>
          <span>${t(`ly.${d.id}.name`)}</span></label>
        <span class="ly-region small muted">${t(`ly.region.${d.region}`)}</span>
        <p class="small muted ly-legend">${t(`ly.${d.id}.legend`)}</p>
        <div class="ly-row small">
          <span>${t("ly.opacity")}</span>
          <input type="range" min="10" max="100" step="5" value="${Math.round(alphaOf(d.id) * 100)}" data-ly-alpha="${d.id}">
        </div>
        <p class="small muted ly-credit">${t("ly.source")}: ${d.credit}</p>
      </div>`
    ).join("");
  }

  const root = document.getElementById("layers-list");
  root.addEventListener("change", (ev) => {
    const id = ev.target.dataset.ly;
    if (id) setOn(id, ev.target.checked);
  });
  root.addEventListener("input", (ev) => {
    const id = ev.target.dataset.lyAlpha;
    if (!id) return;
    const a = Number(ev.target.value) / 100;
    saved[id] = { ...(saved[id] || {}), alpha: a };
    save();
    const act = active.get(id);
    if (act && !act.layer.isDestroyed()) act.layer.alpha = a;
    viewer.scene.requestRender();
  });
  onLangChange(render);
  render();

  return {
    get count() {
      return active.size;
    },
    // a troca de superfície apaga todas as camadas de imagem: recoloca as ligadas
    reattach() {
      for (const id of [...active.keys()]) {
        active.delete(id);
        attach(id);
      }
      viewer.scene.requestRender();
    },
  };
}
