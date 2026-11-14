import "./style.css";
import { initI18n, t, onLangChange } from "./i18n/index.js";
import {
  createMoonViewer,
  setSurface,
  flyToSouthPole,
  flyToGlobal,
  setSunFromSubsolarPoint,
  setSunFromLocalAzEl,
  hasIonToken,
} from "./globe.js";
import { fetchSubsolarPoint } from "./horizons.js";
import { createMarkers } from "./markers.js";
import { initScenarioPanel } from "./scenario.js";
import { initPanelForm } from "./panel.js";
import { createConditionsView } from "./conditionsView.js";
import { createTimeline } from "./timeline.js";
import { createComparison } from "./compare.js";
import { getSeries } from "./sites.js";

const $ = (id) => document.getElementById(id);

initI18n($("lang"));

const viewer = createMoonViewer($("globe"));
window.__viewer = viewer; // depuração no console

// ---------- status sobre o globo ----------
let status = null; // { key, vars, error }
function renderStatus() {
  const el = $("globe-status");
  el.textContent = status ? t(status.key, status.vars) : "";
  el.classList.toggle("error", Boolean(status?.error));
}
function setStatus(key, vars, error = false) {
  status = key ? { key, vars, error } : null;
  renderStatus();
}
onLangChange(renderStatus);

// ---------- superfície (teste A: Moon Trek / teste B: Cesium Moon) ----------
const surfaceSelect = $("surface");
let sunStatus = null;

async function applySurface(source) {
  setStatus("globe.loading");
  try {
    await setSurface(viewer, source);
    if (sunStatus) setStatus(sunStatus.key, sunStatus.vars);
    else setStatus(null);
  } catch (e) {
    if (e.message === "NO_TOKEN") setStatus("globe.noToken", null, true);
    else setStatus("globe.ionError", { msg: e.message }, true);
    surfaceSelect.value = "trek";
    await setSurface(viewer, "trek");
  }
}
surfaceSelect.addEventListener("change", () => applySurface(surfaceSelect.value));
// Padrão: Cesium Moon (relevo 3D). Sem chave do Cesium ion, fica só o Moon Trek.
const DEFAULT_SURFACE = hasIonToken ? "ion" : "trek";
if (!hasIonToken) surfaceSelect.querySelector('option[value="ion"]').disabled = true;
surfaceSelect.value = DEFAULT_SURFACE;

// ---------- navegação ----------
$("btn-south").addEventListener("click", () => flyToSouthPole(viewer));
let subsolarLon = 0;
$("btn-global").addEventListener("click", () => flyToGlobal(viewer, 1.5, subsolarLon));

// ---------- luz do Sol agora ----------
async function lightNow() {
  try {
    const p = await fetchSubsolarPoint();
    setSunFromSubsolarPoint(viewer, p.lon, p.lat);
    subsolarLon = p.lon;
    flyToGlobal(viewer, 1.0, subsolarLon);
    sunStatus = {
      key: "globe.sunAt",
      vars: { time: p.t.replace("T", " ").replace(/:00Z$|Z$/, ""), lon: p.lon.toFixed(1), lat: p.lat.toFixed(1) },
    };
    setStatus(sunStatus.key, sunStatus.vars);
  } catch (e) {
    setStatus("globe.sunError", { msg: e.message }, true);
  }
}

// ---------- locais e cenário ----------
const markers = createMarkers(viewer, {
  onSelectSite: (site) => markers.onSelect?.(site),
  onPickCoordinate: (lat, lon) => markers.onPick?.(lat, lon),
});
let scenario = null;
let loaded = null; // { query, series }
const conditions = createConditionsView();
onLangChange(() => conditions.rerender());

// instante escolhido na barra de tempo -> condições e luz do globo
const timeline = createTimeline((i) => {
  if (!loaded) return;
  conditions.setIndex(i);
  const s = loaded.series.samples[i];
  const p = setSunFromLocalAzEl(viewer, loaded.query.lat, loaded.query.lon, s.sunAz, s.sunEl);
  sunStatus = { key: "globe.sunAt", vars: { time: s.t.replace("T", " ").replace(/:00Z$|Z$/, ""), lon: p.lon.toFixed(1), lat: p.lat.toFixed(1) } };
  setStatus(sunStatus.key, sunStatus.vars);
});

let comparison = null;
const panelForm = initPanelForm(() => {
  scenario?.rerender();
  comparison?.rerender();
});
initScenarioPanel({
  viewer,
  markers,
  getPanel: () => panelForm.get(),
  onScenarioLoaded: (r) => {
    loaded = r;
    conditions.setScenario(r.series.samples, r.query.lat);
    timeline.load(r.series.samples);
  },
  onScenarioCleared: () => {
    loaded = null;
    conditions.clear();
    timeline.clear();
  },
})
  .then((ctl) => {
    scenario = ctl;
    comparison = createComparison({
      getPanel: () => panelForm.get(),
      siteLabel: ctl.siteLabel,
      loadSeries: getSeries,
      onEdit: ctl.loadQuery,
    });
    const addBtn = document.getElementById("sc-add");
    addBtn.addEventListener("click", () => {
      const r = scenario.getLast();
      if (!r || r.error) return;
      const res = comparison.add(r);
      addBtn.textContent = t({ added: "cmp.added", duplicate: "cmp.duplicate", full: "cmp.full" }[res]);
      addBtn.disabled = res === "added" || res === "duplicate";
    });
  })
  .catch((e) => setStatus("scenario.error", { msg: e.message }, true));

applySurface(DEFAULT_SURFACE);
flyToGlobal(viewer, 0);
lightNow();
