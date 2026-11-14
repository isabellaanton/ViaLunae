import "./style.css";
import { initI18n, t, onLangChange } from "./i18n/index.js";
import {
  createMoonViewer,
  setSurface,
  flyToSouthPole,
  flyToGlobal,
  setSunFromSubsolarPoint,
  hasIonToken,
} from "./globe.js";
import { fetchSubsolarPoint } from "./horizons.js";

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
if (!hasIonToken) surfaceSelect.querySelector('option[value="ion"]').textContent += " 🔒";

// ---------- navegação ----------
$("btn-south").addEventListener("click", () => flyToSouthPole(viewer));
let subsolarLon = 0;
$("btn-global").addEventListener("click", () => flyToGlobal(viewer, 1.5, subsolarLon));

// ---------- luz do Sol agora ----------
async function lightNow() {
  try {
    const p = await fetchSubsolarPoint(new Date());
    setSunFromSubsolarPoint(viewer, p.lon, p.lat);
    subsolarLon = p.lon;
    flyToGlobal(viewer, 1.0, subsolarLon);
    sunStatus = {
      key: "globe.sunAt",
      vars: { time: p.time, lon: p.lon.toFixed(1), lat: p.lat.toFixed(1) },
    };
    setStatus(sunStatus.key, sunStatus.vars);
  } catch (e) {
    setStatus("globe.sunError", { msg: e.message }, true);
  }
}

applySurface("trek");
flyToGlobal(viewer, 0);
lightNow();
