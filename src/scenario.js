// Painel "Cenário": escolher local (fixo ou coordenadas livres) e período, e carregar a série de Sol/Terra.
import { t, getLang, onLangChange } from "./i18n/index.js";
import { loadSites, getSeries } from "./sites.js";
import { flyToSite } from "./markers.js";
import { renderScenarioResult } from "./results.js";
import { getHorizonProfile } from "./horizonStore.js";
import { applyHorizon } from "./horizon.js";

const $ = (id) => document.getElementById(id);

export async function initScenarioPanel({ viewer, markers, getPanel, onScenarioLoaded, onScenarioCleared }) {
  const sel = $("sc-site");
  const lat = $("sc-lat");
  const lon = $("sc-lon");
  const start = $("sc-start");
  const days = $("sc-days");
  const desc = $("sc-site-desc");
  const hint = $("sc-pick-hint");
  const result = $("sc-result");
  const btn = $("sc-load");
  const terrain = $("sc-terrain");

  const sites = await loadSites();
  const byId = new Map(sites.map((s) => [s.id, s]));

  // ---------- lista de locais ----------
  function renderOptions() {
    const lang = getLang();
    for (const group of ["apollo", "southpole"]) {
      const og = $(`sc-group-${group}`);
      og.replaceChildren(
        ...sites
          .filter((s) => s.group === group)
          .map((s) => new Option(s.name[lang] ?? s.name.en, s.id))
      );
    }
  }
  renderOptions();
  markers.addSites(sites, getLang());

  // ---------- estado do formulário ----------
  let lastResult = null; // para redesenhar ao trocar o idioma

  function renderDesc() {
    const s = byId.get(sel.value);
    desc.textContent = s ? `${s.description[getLang()] ?? s.description.en} ${t("scenario.year", { year: s.year })}` : "";
  }

  function applySelection({ fly = true } = {}) {
    const custom = sel.value === "custom";
    lat.readOnly = lon.readOnly = !custom;
    hint.hidden = !custom;
    markers.setPickMode(custom);
    if (custom) {
      markers.highlight(null);
      if (lat.value && lon.value) markers.setCustom(+lat.value, +lon.value);
    } else {
      const s = byId.get(sel.value);
      lat.value = s.lat;
      lon.value = s.lon;
      markers.setCustom(null);
      markers.highlight(s.id);
      if (fly) flyToSite(viewer, s.lat, s.lon);
    }
    renderDesc();
  }

  const addBtn = $("sc-add");

  function clearResult() {
    lastResult = null;
    result.replaceChildren();
    addBtn.hidden = true;
    onScenarioCleared?.();
  }

  sel.addEventListener("change", () => {
    clearResult();
    applySelection();
  });

  // clicar num marcador seleciona o sítio
  markers.onSelect = (site) => {
    sel.value = site.id;
    clearResult();
    applySelection();
  };

  // no modo de coordenadas livres, clicar no globo preenche lat/lon
  markers.onPick = (la, lo) => {
    lat.value = la.toFixed(4);
    lon.value = lo.toFixed(4);
    markers.setCustom(la, lo);
  };

  for (const input of [lat, lon]) {
    input.addEventListener("change", () => {
      if (sel.value === "custom" && lat.value && lon.value) markers.setCustom(+lat.value, +lon.value);
    });
  }

  // ---------- carregar ----------
  function valid() {
    const la = Number(lat.value), lo = Number(lon.value), d = Number(days.value);
    return (
      lat.value !== "" && lon.value !== "" &&
      la >= -90 && la <= 90 && lo >= -180 && lo <= 360 &&
      /^\d{4}-\d{2}-\d{2}$/.test(start.value) &&
      Number.isInteger(d) && d >= 1 && d <= 365
    );
  }

  function renderResult() {
    renderScenarioResult(result, lastResult, getPanel());
  }

  $("scenario-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!valid()) {
      lastResult = { error: { key: "scenario.invalid" } };
      renderResult();
      return;
    }
    btn.disabled = true;
    btn.textContent = t("scenario.loading");
    try {
      const q = {
        siteId: sel.value === "custom" ? undefined : sel.value,
        lat: Number(lat.value),
        lon: Number(lon.value),
        start: new Date(`${start.value}T00:00:00Z`),
        days: Number(days.value),
        terrain: terrain.checked,
      };
      const loaded = await loadSeries(q, (frac) => {
        btn.textContent = t("scenario.horizonProgress", { pct: Math.round(frac * 100) });
      });
      if (!loaded.series.samples.length) throw new Error("sem dados");
      lastResult = { query: q, ...loaded };
      renderResult();
      addBtn.hidden = false;
      addBtn.disabled = false;
      addBtn.textContent = t("cmp.add");
      onScenarioLoaded?.(lastResult);
    } catch (e) {
      lastResult = { error: { key: "scenario.error", vars: { msg: e.message } } };
      addBtn.hidden = true;
      onScenarioCleared?.();
      renderResult();
    } finally {
      btn.disabled = false;
      btn.textContent = t("scenario.load");
    }
  });

  onLangChange((lang) => {
    const current = sel.value;
    renderOptions();
    sel.value = current;
    markers.setLang(lang);
    renderDesc();
    renderResult();
  });

  // ---------- valores iniciais ----------
  start.value = new Date().toISOString().slice(0, 10);
  sel.value = "mons-mouton";
  applySelection({ fly: false });

  /**
   * Série + horizonte real (se pedido). Usado aqui e para recarregar a comparação.
   * Se o relevo não puder ser calculado, segue com horizonte liso e avisa (horizonError).
   */
  async function loadSeries(q, onProgress) {
    const series = await getSeries(q);
    let horizon = null, horizonError = null;
    if (q.terrain) {
      if (!q.siteId) btn.textContent = t("scenario.horizonComputing");
      try {
        horizon = await getHorizonProfile(q, viewer, onProgress);
      } catch (e) {
        horizonError = e.message === "NO_TERRAIN" ? "scenario.noTerrain" : "scenario.horizonFailed";
      }
    }
    return { series: { ...series, samples: applyHorizon(series.samples, horizon) }, horizon, horizonError };
  }

  // nome do local de uma consulta, no idioma atual
  function siteLabel(q) {
    const s = q.siteId && byId.get(q.siteId);
    if (s) return s.name[getLang()] ?? s.name.en;
    return t("cmp.customSite", { lat: q.lat.toFixed(2), lon: q.lon.toFixed(2) });
  }

  // preenche o formulário com uma consulta (para editar/duplicar) e carrega
  function loadQuery(q) {
    sel.value = q.siteId && byId.has(q.siteId) ? q.siteId : "custom";
    clearResult();
    applySelection();
    if (sel.value === "custom") {
      lat.value = q.lat;
      lon.value = q.lon;
      markers.setCustom(q.lat, q.lon);
    }
    start.value = q.start.toISOString().slice(0, 10);
    days.value = q.days;
    terrain.checked = q.terrain !== false;
    $("scenario-form").requestSubmit();
    $("scenario-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return { rerender: renderResult, getLast: () => lastResult, siteLabel, loadQuery, loadSeries };
}
