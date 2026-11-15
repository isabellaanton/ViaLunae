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
  getTerrainTileset,
} from "./globe.js";
import { createAnalysisPanel } from "./analysisPanel.js";
import { createMissionCard } from "./missionCard.js";
import { createTour } from "./tour.js";
import { createSouthPoleCard } from "./southPole.js";
import { createLayers } from "./layers.js";
import { createMeasureTools } from "./measure.js";
import { fetchSubsolarPoint } from "./horizons.js";
import { createMarkers } from "./markers.js";
import { initScenarioPanel } from "./scenario.js";
import { initPanelForm } from "./panel.js";
import { createConditionsView } from "./conditionsView.js";
import { createTimeline } from "./timeline.js";
import { createComparison } from "./compare.js";
import { createGroundView } from "./groundView.js";

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
    analysis?.redraw();
    layers?.reattach();
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
  onSelectSite: (site) => {
    markers.onSelect?.(site);
    missionCard.open(site.id);
  },
  onPickCoordinate: (lat, lon) => markers.onPick?.(lat, lon),
});
let scenario = null;
let afterLoad = null; // ação a fazer quando o próximo cenário terminar de carregar
const loadSiteScenario = (then) => {
  afterLoad = then || null;
  $("scenario-form").requestSubmit();
  $("scenario-card").scrollIntoView({ behavior: "smooth", block: "start" });
};
const missionCard = createMissionCard({
  onLoad: () => loadSiteScenario(),
  onGround: () =>
    loadSiteScenario(() => {
      if (loaded?.horizon) $("btn-ground").click();
    }),
  onFilter: (criterion) => analysis?.showCriterion(criterion),
});
let loaded = null; // { query, series }
const conditions = createConditionsView();
const ground = createGroundView(viewer);
let currentIndex = 0;
const groundLabels = () => ({ sun: t("ground.sun"), earth: t("ground.earth") });
onLangChange(() => {
  conditions.rerender();
  ground.setLabels(groundLabels());
});

function setGroundUi(on) {
  $("ground-bar").hidden = !on;
  document.querySelector(".globe-tools").hidden = on;
  document.querySelector(".measure-tools").hidden = on;
  if (on) measure.stop();
}
function exitGround() {
  ground.exit();
  setGroundUi(false);
}
$("btn-ground").addEventListener("click", () => {
  if (!loaded?.horizon) return;
  ground.enter({
    lat: loaded.query.lat,
    lon: loaded.query.lon,
    groundHeightM: loaded.horizon.groundHeightM,
    sample: loaded.series.samples[currentIndex],
    labels: groundLabels(),
  });
  setGroundUi(true);
});
$("ground-exit").addEventListener("click", exitGround);
$("ground-sun").addEventListener("click", () => {
  const s = loaded?.series.samples[currentIndex];
  if (s) ground.lookAt(s.sunAz, s.sunEl);
});
$("ground-earth").addEventListener("click", () => {
  const s = loaded?.series.samples[currentIndex];
  if (s) ground.lookAt(s.earthAz, s.earthEl);
});

// instante escolhido na barra de tempo -> condições e luz do globo
const timeline = createTimeline((i) => {
  if (!loaded) return;
  currentIndex = i;
  conditions.setIndex(i);
  const s = loaded.series.samples[i];
  ground.update(s);
  analysis?.setTime(s.t);
  const p = setSunFromLocalAzEl(viewer, loaded.query.lat, loaded.query.lon, s.sunAz, s.sunEl);
  sunStatus = { key: "globe.sunAt", vars: { time: s.t.replace("T", " ").replace(/:00Z$|Z$/, ""), lon: p.lon.toFixed(1), lat: p.lat.toFixed(1) } };
  setStatus(sunStatus.key, sunStatus.vars);
});

let comparison = null;
let analysis = null;
let surfaceBeforeMap = null;
// mapa de filtros e camadas científicas só aparecem na esfera (Moon Trek): troca e depois volta
const sphereUsers = new Set();
function needSphere(who, on) {
  const before = sphereUsers.size;
  if (on) sphereUsers.add(who);
  else sphereUsers.delete(who);
  if (before === 0 && sphereUsers.size > 0 && surfaceSelect.value === "ion") {
    surfaceBeforeMap = "ion";
    surfaceSelect.value = "trek";
    applySurface("trek");
    setStatus("an.surfaceSwitched");
  } else if (before > 0 && sphereUsers.size === 0 && surfaceBeforeMap) {
    surfaceSelect.value = surfaceBeforeMap;
    surfaceBeforeMap = null;
    applySurface(surfaceSelect.value);
  }
}
const periodOf = () => {
  const start = $("sc-start").value;
  const days = Number($("sc-days").value) || 30;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : new Date().toISOString().slice(0, 10);
  return { startIso: `${day}T00:00:00Z`, days };
};
const panelForm = initPanelForm(() => {
  scenario?.rerender();
  comparison?.rerender();
  analysis?.update();
});
initScenarioPanel({
  viewer,
  markers,
  getPanel: () => panelForm.get(),
  onScenarioLoaded: (r) => {
    loaded = r;
    exitGround();
    currentIndex = 0;
    conditions.setScenario(r.series.samples, r.query.lat, r.horizon);
    timeline.load(r.series.samples);
    const then = afterLoad;
    afterLoad = null;
    then?.(r);
    analysis?.setPoint(r.query.lat, r.query.lon, scenario?.siteLabel(r.query) ?? `${r.query.lat.toFixed(2)}, ${r.query.lon.toFixed(2)}`, r.horizon);
  },
  onScenarioCleared: () => {
    loaded = null;
    exitGround();
    conditions.clear();
    timeline.clear();
  },
})
  .then((ctl) => {
    scenario = ctl;
    analysis = createAnalysisPanel({
      viewer,
      markers,
      getPanel: () => panelForm.get(),
      getPeriod: periodOf,
      // o mapa colorido só é desenhado na esfera: troca para Moon Trek e depois volta
      onShowChange: (on) => needSphere("filters", on),
    });
    for (const id of ["sc-start", "sc-days"]) $(id).addEventListener("change", () => analysis.update());
    comparison = createComparison({
      getPanel: () => panelForm.get(),
      siteLabel: ctl.siteLabel,
      loadSeries: (q) => ctl.loadSeries(q),
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

createSouthPoleCard({
  onFilter: (criterion) => analysis?.showCriterion(criterion),
  onMission: (siteId) => missionCard.open(siteId),
});

// ---------- camadas científicas e ferramentas de medida ----------
const layers = createLayers(viewer, { onNeedSphere: (on) => needSphere("layers", on) });
const measure = createMeasureTools(viewer, {
  getTileset: getTerrainTileset,
  onUseSlope: ({ slopeDeg, downhillAzDeg }) => {
    // direção da encosta: para onde o chão desce (convertida para as opções da simulação)
    const lat = Number($("sc-lat").value) || 0;
    const az = downhillAzDeg;
    const facing = az >= 45 && az < 135 ? "east" : az >= 225 && az < 315 ? "west" : (az >= 135 && az < 225) === lat < 0 ? "pole" : "equator";
    analysis?.setSlope(slopeDeg, facing);
  },
});

// ---------- tour ----------
const tour = createTour();
$("btn-tour").addEventListener("click", () => tour.start());
setTimeout(() => tour.startIfFirstVisit(), 1500);

applySurface(DEFAULT_SURFACE);
flyToGlobal(viewer, 0);
lightNow();
