// Cartão "Filtros na Lua".
// - Dois modos de tempo: "Agora" (instante da barra de tempo; a Lua muda enquanto a barra anima)
//   e "Período" (resumo do período do cenário).
// - Cada filtro: liga/desliga, frase curta, botão "?" com detalhes e desenho, limites editáveis,
//   "ver só este" (destaque no mapa com legenda) e o valor no ponto escolhido.
// - Parâmetros de simulação com controles deslizantes: prévia rápida enquanto arrasta, versão nítida ao soltar.
// - Clicar na Lua (com o mapa ligado) mostra os valores daquele ponto. Ranking dos locais e marcadores coloridos.
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Ellipsoid,
  Cartographic,
  Math as CMath,
} from "cesium";
import {
  CRITERIA,
  FILTERS,
  DEFAULT_PARAMS,
  filtersFor,
  classify,
  score,
  evaluateLocation,
  evaluateInstant,
  relativeThresholds,
  bestFixedPanel,
} from "./analysisCore.js";
import { createAnalysisMap, scoreColor, COLORS } from "./analysisMap.js";
import { DRAWINGS } from "./analysisDrawings.js";
import { t, onLangChange, getLang, applyTranslations } from "./i18n/index.js";
import { loadSites } from "./sites.js";

const STORE = "vialunae.analysis";
const COUNTDOWNS = new Set(["blackoutH", "lightRunH", "darkRunH"]);
const $ = (id) => document.getElementById(id);
const css = (rgb) => `rgb(${rgb.join(",")})`;
const PARAMS = [
  // chave, id do controle, mínimo, máximo, passo, unidade
  ["moduleTiltDeg", "an-p-tilt", 0, 45, 1, "°"],
  ["slopeDeg", "an-p-slope", 0, 40, 1, "°"],
  ["wallDeg", "an-p-wall", 0, 20, 0.5, "°"],
  ["maskDeg", "an-p-mask", 0, 20, 0.5, "°"],
  ["landerHeightM", "an-p-height", 1, 15, 0.1, " m"],
];

function loadState() {
  const base = {
    enabled: FILTERS.filter((f) => f.main).map((f) => f.id),
    limits: {}, // modo Período
    limitsNow: {}, // modo Agora
    mode: "fixed", // cores: "fixed" (limites) | "relative" (comparativo)
    timeMode: "now", // "now" | "period"
    params: {},
    opacity: 0.65,
    hideApollo: true,
    relief: true,
  };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(STORE) || "{}") };
  } catch {
    return base;
  }
}

function fmt(v, unit) {
  if (v == null) return t("an.noData");
  const d = Math.abs(v) >= 100 || unit === "h" ? 0 : 1;
  return `${v.toFixed(d)} ${unit}`;
}

export function createAnalysisPanel({ viewer, markers, getPanel, getPeriod, onShowChange }) {
  const state = loadState();
  const map = createAnalysisMap(viewer);
  let g = null;
  let sites = [];
  let point = null; // { lat, lon, label, horizon }
  let timeIso = null; // instante da barra de tempo
  let focus = null; // filtro em destaque no mapa
  const horizons = {}; // perfis de horizonte reais dos locais fixos
  const hz = (h) => (state.relief ? h || null : null);

  const save = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch {
      /* sem armazenamento: segue sem lembrar */
    }
  };
  const isNow = () => state.timeMode === "now";
  const filters = () => filtersFor(state.timeMode);
  const filterById = (id) => filters().find((f) => f.id === id);
  const limitStore = () => (isNow() ? state.limitsNow : state.limits);
  const limitOf = (f) => limitStore()[f.id] || { g: f.g, r: f.r };
  const limitsAll = () => Object.fromEntries(filters().map((f) => [f.id, limitOf(f)]));
  const enabled = () => new Set(state.enabled);
  const mapEnabled = () => (focus ? new Set([focus]) : enabled());
  const shown = () => $("an-show").checked;

  function params() {
    const p = getPanel();
    return {
      ...DEFAULT_PARAMS,
      ...state.params,
      panelMode: p.mode,
      panelTiltDeg: p.tiltDeg ?? 90,
      panelAzDeg: p.azimuthDeg ?? 0,
      panelAreaM2: p.areaM2,
      panelEff: p.efficiency,
    };
  }

  function currentTime() {
    return timeIso || getPeriod().startIso;
  }

  // ---------- lista de filtros ----------
  function buildList() {
    const root = $("an-filters");
    root.innerHTML = "";
    const fs = filters();
    const nowSuffix = isNow() ? "n" : "";
    for (const group of [true, false]) {
      const h = document.createElement("h3");
      h.className = "an-group";
      h.textContent = t(group ? "an.main" : "an.extra");
      root.append(h);
      for (const c of CRITERIA.filter((x) => x.main === group)) {
        const box = document.createElement("div");
        box.className = "an-crit";
        box.innerHTML = `<div class="an-crit-head">
            <span class="an-crit-title">${t(`an.c.${c.id}`)}</span>
            <button type="button" class="an-help" data-help="${c.id}" aria-expanded="false" title="${t("an.helpBtn")}">?</button>
          </div>
          <div class="an-detail" data-detail="${c.id}" hidden>
            <div class="an-draw">${DRAWINGS[c.id] || ""}</div>
            <p class="small">${t(`an.h.${c.id}`)}</p>
          </div>`;
        if (c.id === "relief") {
          const note = document.createElement("p");
          note.className = "muted small";
          note.textContent = t("an.reliefNote");
          box.append(note);
        }
        for (const base of c.filters) {
          const f = fs.find((x) => x.id === base.id);
          const lim = limitOf(f);
          const ge = f.better === "max" ? "≥" : "≤";
          const lt = f.better === "max" ? "<" : ">";
          const row = document.createElement("div");
          row.className = "an-f" + (focus === f.id ? " focused" : "");
          row.innerHTML = `
            <label class="an-check"><input type="checkbox" data-f="${f.id}" ${state.enabled.includes(f.id) ? "checked" : ""}>
              <span>${t(`an.f${nowSuffix}.${f.id}`)}</span></label>
            <span class="an-val" data-v="${f.id}"></span>
            <p class="an-desc small muted">${t(`an.d${nowSuffix}.${f.id}`)}</p>
            <span class="an-lim small">
              <span class="dot g"></span>${ge}<input type="number" step="any" data-g="${f.id}" value="${lim.g}">
              <span class="dot r"></span>${lt}<input type="number" step="any" data-r="${f.id}" value="${lim.r}">
              <span class="muted">${f.unit}</span>
              <button type="button" class="an-focus ghost small" data-focus="${f.id}">${t(focus === f.id ? "an.focusOff" : "an.focusOn")}</button>
            </span>`;
          box.append(row);
        }
        root.append(box);
      }
    }
    root.querySelectorAll("[data-help]").forEach((b) =>
      b.addEventListener("click", () => {
        const d = root.querySelector(`[data-detail="${b.dataset.help}"]`);
        d.hidden = !d.hidden;
        b.setAttribute("aria-expanded", String(!d.hidden));
      })
    );
    root.querySelectorAll("[data-f]").forEach((el) =>
      el.addEventListener("change", () => {
        const id = el.dataset.f;
        state.enabled = el.checked ? [...new Set([...state.enabled, id])] : state.enabled.filter((x) => x !== id);
        save();
        // contagem regressiva desligada não é calculada no mapa: ao ligar, recalcula
        if (el.checked && isNow() && COUNTDOWNS.has(id)) live();
        else repaint();
      })
    );
    root.querySelectorAll("[data-g],[data-r]").forEach((el) =>
      el.addEventListener("change", () => {
        const id = el.dataset.g || el.dataset.r;
        const lim = { ...limitOf(filterById(id)) };
        const v = Number(el.value);
        if (!Number.isFinite(v)) return;
        if (el.dataset.g) lim.g = v;
        else lim.r = v;
        limitStore()[id] = lim;
        save();
        if (isNow()) scheduleFrames();
        repaint();
      })
    );
    root.querySelectorAll("[data-focus]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.focus;
        focus = focus === id ? null : id;
        if (focus && !state.enabled.includes(focus)) {
          state.enabled.push(focus);
          save();
        }
        buildList();
        if (focus && isNow() && COUNTDOWNS.has(focus)) live();
        else repaint();
      })
    );
  }

  // ---------- limites efetivos ----------
  function thresholds(siteValues) {
    const fs = filters();
    if (state.mode === "fixed") return limitsAll();
    if (map.data && shown()) return { ...limitsAll(), ...map.thresholds(fs, enabled(), limitsAll(), "relative") };
    return Object.fromEntries(fs.map((f) => [f.id, relativeThresholds(siteValues.map((v) => v[f.id]), f)]));
  }
  const classesOf = (values, th) =>
    Object.fromEntries(filters().map((f) => [f.id, classify(values[f.id], f, th[f.id])]));

  function rangeOf() {
    const { startIso, days } = getPeriod();
    const t0 = Date.parse(g.start);
    const step = g.stepMinutes * 60_000;
    const i0 = Math.round((Date.parse(startIso) - t0) / step);
    const i1 = i0 + Math.round((days * 86_400_000) / step);
    if (!(i0 >= 0 && i1 <= g.count)) return null;
    return { i0, i1, stride: Math.max(1, Math.ceil((i1 - i0) / 720)) };
  }

  // valores de um local no modo atual
  function evalAt(lat, lon, horizon, rg, p) {
    if (isNow()) {
      const i = map.indexOf(currentTime());
      if (i == null) return null;
      return evaluateInstant(g, lat, lon, p, i, g.count, undefined, horizon);
    }
    return evaluateLocation(g, lat, lon, p, rg.i0, rg.i1, rg.stride, undefined, horizon);
  }

  // ---------- valores no ponto + ranking dos locais ----------
  function renderSites() {
    if (!g) return;
    const rg = rangeOf();
    const list = $("an-rank");
    list.innerHTML = "";
    document.querySelectorAll("#an-filters [data-v]").forEach((el) => {
      el.textContent = "";
      el.style.removeProperty("--c");
    });
    $("an-point").textContent = "";
    $("an-best").textContent = "";
    const outOfRange = () => t("an.outOfRange", { start: g.start.slice(0, 10), end: g.end.slice(0, 10) });
    if (!rg || (isNow() && map.indexOf(currentTime()) == null)) {
      $("an-status").textContent = outOfRange();
      markers.setScoreColors(null);
      return;
    }
    const p = params();
    const en = enabled();
    const evals = sites.map((s) => ({ s, v: evalAt(s.lat, s.lon, hz(horizons[s.id]), rg, p) }));
    const th = thresholds(evals.map((e) => e.v));

    if (point) {
      const v = evalAt(point.lat, point.lon, hz(point.horizon), rg, p);
      const cls = classesOf(v, th);
      for (const f of filters()) {
        const el = document.querySelector(`#an-filters [data-v="${f.id}"]`);
        if (!el) continue;
        el.textContent = fmt(v[f.id], f.unit);
        el.style.setProperty("--c", cls[f.id] == null ? "#777" : css(COLORS[cls[f.id]]));
      }
      const { pct } = score(cls, en);
      $("an-point").textContent = t(isNow() ? "an.pointValuesNow" : "an.pointValues", {
        name: point.label,
        score: pct == null ? t("an.noData") : `${pct.toFixed(0)}%`,
      });
      if (!isNow()) {
        const best = bestFixedPanel(g, point.lat, point.lon, p, rg.i0, rg.i1, Math.max(rg.stride, 4));
        if (best) $("an-best").textContent = t("an.bestPanel", { tilt: best.tiltDeg, az: best.azDeg, pct: best.pct.toFixed(0) });
      }
    }

    const colors = {};
    const rows = evals.map(({ s, v }) => {
      const { pct } = score(classesOf(v, th), en);
      const ref = state.hideApollo && s.group === "apollo";
      if (pct != null) colors[s.id] = ref ? "#8a8f98" : css(scoreColor(pct));
      return { s, pct, ref };
    });
    rows.sort((a, b) => a.ref - b.ref || (b.pct ?? -1) - (a.pct ?? -1));
    const lang = getLang();
    let rank = 0;
    for (const r of rows) {
      const li = document.createElement("li");
      li.className = r.ref ? "ref" : "";
      const pctTxt = r.pct == null ? t("an.noData") : `${r.pct.toFixed(0)}%`;
      li.innerHTML = `<span class="pos">${r.ref ? "—" : ++rank}</span><span class="dot" style="background:${colors[r.s.id] || "#555"}"></span>
        <span class="name">${r.s.name[lang] ?? r.s.name.en}</span><span class="pct">${pctTxt}</span>`;
      if (r.ref) li.title = t("an.refNote");
      list.append(li);
    }
    markers.setScoreColors(en.size ? colors : null);
  }

  // ---------- legenda sobre o globo ----------
  function renderLegend() {
    const box = $("an-map-legend");
    if (!shown() || !map.data) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const when = isNow()
      ? t("an.legendNow", { time: currentTime().replace("T", " ").slice(0, 16) })
      : t("an.legendPeriod", { start: getPeriod().startIso.slice(0, 10), days: getPeriod().days });
    let body;
    if (focus) {
      const f = filterById(focus);
      const th = state.mode === "fixed" ? limitOf(f) : map.thresholds([f], new Set([f.id]), limitsAll(), "relative")[f.id];
      const r = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : +v.toFixed(1));
      const [gs, ys, rs] =
        f.better === "max"
          ? [`≥ ${r(th.g)}`, `${r(th.r)} – ${r(th.g)}`, `< ${r(th.r)}`]
          : [`≤ ${r(th.g)}`, `${r(th.g)} – ${r(th.r)}`, `> ${r(th.r)}`];
      body = `<strong>${t(`an.f${isNow() ? "n" : ""}.${f.id}`)}</strong>
        <span><span class="dot g"></span>${gs} ${f.unit}</span><span><span class="dot y"></span>${ys} ${f.unit}</span><span><span class="dot r"></span>${rs} ${f.unit}</span>`;
    } else {
      body = `<strong>${t("an.legendSum", { n: enabled().size })}</strong>
        <span><span class="dot g"></span>${t("an.legendGreen")}</span><span><span class="dot y"></span>${t("an.legendYellow")}</span><span><span class="dot r"></span>${t("an.legendRed")}</span>`;
    }
    box.innerHTML = `${body}<span class="muted">${when}${state.mode === "relative" ? " · " + t("an.modeRelative") : ""}</span>`;
  }

  // ---------- mapa: prévia rápida + refino ----------
  let running = false;
  let queued = null;
  let refineTimer = null;

  function job(quality) {
    const { startIso, days } = getPeriod();
    return {
      kind: state.timeMode,
      quality,
      params: params(),
      startIso,
      days,
      timeIso: currentTime(),
      skip: [...COUNTDOWNS].filter((id) => !state.enabled.includes(id) && focus !== id),
    };
  }

  async function runMap(quality) {
    if (!shown() || !enabled().size) {
      map.hide();
      renderLegend();
      return;
    }
    if (running) {
      queued = queued === "full" || quality === "full" ? "full" : "preview";
      return;
    }
    running = true;
    try {
      const t0 = performance.now();
      if (quality === "full" && !isNow()) $("an-status").textContent = t("an.computing", { pct: 0 });
      const res = await map.compute(job(quality), (f) => {
        if (quality === "full" && !isNow()) $("an-status").textContent = t("an.computing", { pct: Math.round(f * 100) });
      });
      if (res) {
        await map.render(filters(), mapEnabled(), limitsAll(), state.mode);
        if (quality === "full") {
          $("an-status").textContent = res.cached
            ? t("an.ready")
            : t("an.done", { s: ((performance.now() - t0) / 1000).toFixed(1) });
        }
        renderLegend();
      }
    } catch (e) {
      $("an-status").textContent =
        e.message === "OUT_OF_RANGE"
          ? t("an.outOfRange", { start: g.start.slice(0, 10), end: g.end.slice(0, 10) })
          : t("an.error", { msg: e.message });
      map.hide();
      renderLegend();
    }
    running = false;
    if (queued) {
      const q = queued;
      queued = null;
      runMap(q);
    }
  }

  // ---------- animação lisa: quadros pré-calculados do período inteiro (modo Agora, cores por Limites) ----------
  const CRIT_INDEX = Object.fromEntries(CRITERIA.flatMap((c, i) => c.filters.map((f) => [f.id, i])));
  let framesTimer = null;
  let frameBusy = false;
  let framePending = -1;
  const framesUsable = () => isNow() && shown() && state.mode === "fixed";

  function scheduleFrames(delay = 600) {
    clearTimeout(framesTimer);
    map.invalidateFrames();
    if (!framesUsable()) {
      $("an-frames").textContent = "";
      return;
    }
    framesTimer = setTimeout(prepareFrames, delay);
  }

  async function prepareFrames() {
    if (!framesUsable()) return;
    const { startIso, days } = getPeriod();
    try {
      const res = await map.computeFrames({ params: params(), startIso, days, th: limitsAll() }, (f) => {
        $("an-frames").textContent = t("an.framesPreparing", { pct: Math.round(f * 100) });
      });
      if (res) $("an-frames").textContent = t("an.framesReady", { n: res.nFrames });
    } catch (e) {
      $("an-frames").textContent = e.message === "OUT_OF_RANGE" ? "" : t("an.error", { msg: e.message });
    }
  }

  // desenha o quadro do instante; devolve false se não houver quadro pronto
  function drawFrame() {
    if (!framesUsable() || !map.framesReady) return false;
    const k = map.frameOf(currentTime());
    if (k < 0) return false;
    const ids = [...mapEnabled()];
    if (frameBusy) {
      framePending = k;
      return true;
    }
    frameBusy = true;
    map.renderFrame(k, ids, CRIT_INDEX).finally(() => {
      frameBusy = false;
      renderLegend();
      if (framePending >= 0) {
        framePending = -1;
        drawFrame();
      }
    });
    return true;
  }

  // mudança contínua (barra de tempo, controle deslizante): prévia agora, nítido depois de parar
  function live() {
    renderSites();
    if (!drawFrame()) runMap("preview");
    clearTimeout(refineTimer);
    refineTimer = setTimeout(() => runMap("full"), 450);
  }
  // mudança pontual de parâmetro: recalcula nítido
  function recompute() {
    renderSites();
    clearTimeout(refineTimer);
    runMap("full");
    scheduleFrames(0);
  }
  // só cores (filtro ligado, limite, modo de cor, destaque): repinta sem recalcular
  async function repaint() {
    renderSites();
    if (!shown() || !map.data) return runMap("full");
    if (!enabled().size) {
      map.hide();
      renderLegend();
      return;
    }
    await map.render(filters(), mapEnabled(), limitsAll(), state.mode);
    renderLegend();
  }

  // ---------- controles ----------
  function setTimeModeUi() {
    for (const b of document.querySelectorAll("[data-time-mode]")) {
      b.classList.toggle("active", b.dataset.timeMode === state.timeMode);
      b.setAttribute("aria-pressed", String(b.dataset.timeMode === state.timeMode));
    }
    $("an-time-note").textContent = t(isNow() ? "an.nowNote" : "an.periodNote");
  }

  function initControls() {
    for (const b of document.querySelectorAll("[data-time-mode]")) {
      b.addEventListener("click", () => {
        state.timeMode = b.dataset.timeMode;
        save();
        setTimeModeUi();
        buildList();
        recompute();
      });
    }
    setTimeModeUi();
    $("an-mode").value = state.mode;
    $("an-mode").addEventListener("change", () => {
      state.mode = $("an-mode").value;
      save();
      scheduleFrames();
      repaint();
    });
    $("an-opacity").value = String(Math.round(state.opacity * 100));
    $("an-opacity").addEventListener("input", () => {
      state.opacity = Number($("an-opacity").value) / 100;
      map.setOpacity(state.opacity);
      save();
    });
    $("an-show").addEventListener("change", () => {
      onShowChange?.(shown());
      if (!shown()) {
        focus = null;
        buildList();
      }
      recompute();
    });
    $("an-relief").checked = state.relief;
    $("an-relief").addEventListener("change", () => {
      state.relief = $("an-relief").checked;
      save();
      renderSites();
    });
    $("an-hide-apollo").checked = state.hideApollo;
    $("an-hide-apollo").addEventListener("change", () => {
      state.hideApollo = $("an-hide-apollo").checked;
      save();
      renderSites();
    });
    for (const [key, id, min, max, step, unit] of PARAMS) {
      const el = $(id);
      Object.assign(el, { type: "range", min, max, step });
      el.value = state.params[key] ?? DEFAULT_PARAMS[key];
      const out = $(`${id}-v`);
      const show = () => (out.textContent = `${el.value}${unit}`);
      show();
      el.addEventListener("input", () => {
        state.params[key] = Number(el.value);
        show();
        scheduleFrames(800); // quadros antigos deixam de valer
        live();
      });
      el.addEventListener("change", () => save());
    }
    const facing = $("an-p-facing");
    facing.value = state.params.slopeFacing ?? DEFAULT_PARAMS.slopeFacing;
    facing.addEventListener("change", () => {
      state.params.slopeFacing = facing.value;
      save();
      recompute();
    });
    $("an-reset").addEventListener("click", () => {
      state.limits = {};
      state.limitsNow = {};
      state.params = {};
      state.enabled = FILTERS.filter((f) => f.main).map((f) => f.id);
      focus = null;
      save();
      for (const [key, id, , , , unit] of PARAMS) {
        $(id).value = DEFAULT_PARAMS[key];
        $(`${id}-v`).textContent = `${DEFAULT_PARAMS[key]}${unit}`;
      }
      facing.value = DEFAULT_PARAMS.slopeFacing;
      buildList();
      recompute();
    });
    $("an-all").addEventListener("click", () => {
      state.enabled = FILTERS.map((f) => f.id);
      save();
      buildList();
      recompute();
    });
    $("an-none").addEventListener("click", () => {
      state.enabled = [];
      focus = null;
      save();
      buildList();
      repaint();
    });

    // clicar na Lua com o mapa ligado: valores daquele ponto
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((ev) => {
      if (!shown()) return;
      if (viewer.scene.pick(ev.position)?.id) return; // clique num marcador: o cenário cuida
      const cart = viewer.camera.pickEllipsoid(ev.position, Ellipsoid.MOON);
      if (!cart) return;
      const c = Cartographic.fromCartesian(cart, Ellipsoid.MOON);
      const lat = CMath.toDegrees(c.latitude);
      const lon = CMath.toDegrees(c.longitude);
      point = { lat, lon, label: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, horizon: null };
      renderSites();
      $("an-point").scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  onLangChange(() => {
    buildList();
    setTimeModeUi();
    renderSites();
    renderLegend();
  });

  const ready = (async () => {
    [g, sites] = await Promise.all([map.ensure(), loadSites()]);
    await Promise.all(
      sites.map((s) =>
        fetch(`/data/horizon/${s.id}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((h) => {
            if (h?.horizon) horizons[s.id] = h;
          })
          .catch(() => {})
      )
    );
    initControls();
    buildList();
    applyTranslations($("analysis-card"));
    renderSites();
  })();

  return {
    ready,
    setPoint(lat, lon, label, horizon = null) {
      point = { lat, lon, label, horizon };
      ready.then(() => recompute());
    },
    // instante da barra de tempo (modo Agora acompanha)
    setTime(iso) {
      timeIso = iso;
      ready.then(() => {
        if (isNow()) live();
      });
    },
    redraw() {
      ready.then(() => repaint());
    },
    update() {
      ready.then(() => recompute());
    },
  };
}
