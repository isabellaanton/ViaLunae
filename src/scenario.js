// Painel "Cenário": escolher local (fixo ou coordenadas livres) e período, e carregar a série de Sol/Terra.
import { t, getLang, onLangChange } from "./i18n/index.js";
import { loadSites, getSeries } from "./sites.js";
import { flyToSite } from "./markers.js";

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 1) => Number(n).toFixed(d);
const fmtTime = (iso) => iso.replace("T", " ").replace(/:00Z$|Z$/, "");

export async function initScenarioPanel({ viewer, markers, onScenarioLoaded }) {
  const sel = $("sc-site");
  const lat = $("sc-lat");
  const lon = $("sc-lon");
  const start = $("sc-start");
  const days = $("sc-days");
  const desc = $("sc-site-desc");
  const hint = $("sc-pick-hint");
  const result = $("sc-result");
  const btn = $("sc-load");

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

  function clearResult() {
    lastResult = null;
    result.replaceChildren();
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
    if (!lastResult) return;
    if (lastResult.error) {
      result.innerHTML = "";
      const p = document.createElement("p");
      p.className = "error";
      p.textContent = lastResult.error.key ? t(lastResult.error.key, lastResult.error.vars) : lastResult.error;
      result.append(p);
      return;
    }
    const { series } = lastResult;
    const s0 = series.samples[0];
    const last = series.samples[series.samples.length - 1];
    const state = (el) => (el > 0 ? t("scenario.visible") : t("scenario.below"));
    const lines = [
      [t("scenario.summary", { n: series.samples.length, step2: series.stepMinutes, from: fmtTime(s0.t), to: fmtTime(last.t) }), "muted small"],
      [t("scenario.source", { source: t(series.source === "file" ? "scenario.sourceFile" : "scenario.sourceLive") }), "muted small"],
      [t("scenario.atStart"), "strong"],
      [t("scenario.sunEl", { el: fmt(s0.sunEl), az: fmt(s0.sunAz), state: state(s0.sunEl) }), "sun"],
      [t("scenario.earthEl", { el: fmt(s0.earthEl), az: fmt(s0.earthAz), state: state(s0.earthEl) }), "earth"],
    ];
    result.replaceChildren(
      ...lines.map(([text, cls]) => {
        const p = document.createElement("p");
        p.className = cls;
        p.textContent = text;
        return p;
      })
    );
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
      };
      const series = await getSeries(q);
      if (!series.samples.length) throw new Error("sem dados");
      lastResult = { query: q, series };
      renderResult();
      onScenarioLoaded?.(lastResult);
    } catch (e) {
      lastResult = { error: { key: "scenario.error", vars: { msg: e.message } } };
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
}
