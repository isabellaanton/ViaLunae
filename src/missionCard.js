// Ficha da missão: abre ao clicar num marcador do globo. Fotos com crédito, ficha rápida, resumo,
// como foi, prós e contras, fontes e — nas missões com problema — o que deu errado e qual filtro mostra isso.
import { t, getLang, onLangChange } from "./i18n/index.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const AREA_ICON = { power: "⚡", relief: "⛰", comms: "📡", time: "⏱" };

let dataPromise = null;
const loadMissions = () =>
  (dataPromise ??= fetch("/data/missions.json")
    .then((r) => (r.ok ? r.json() : { missions: {} }))
    .then((j) => j.missions));

export function createMissionCard({ onLoad, onGround, onFilter }) {
  const dlg = $("mission-dialog");
  let current = null; // id do local
  let photo = 0;
  let tab = "summary";

  const L = (o) => (o ? o[getLang()] ?? o.pt ?? o.en : "");
  // destaca "(conferir)" / "(to check)" no texto
  const mark = (s) => esc(s).replace(/\((conferir|to check)\)/g, '<span class="mc-check">($1)</span>');

  function render(m) {
    const photos = m.photos || [];
    photo = Math.min(photo, Math.max(0, photos.length - 1));
    const p = photos[photo];
    const all = JSON.stringify(m);
    const hasCheck = /\((conferir|to check)\)/.test(all);

    const facts = (m.facts || [])
      .map((f) => `<dt>${esc(t(`mc.fact.${f.k}`))}</dt><dd>${mark(L(f.v))}</dd>`)
      .join("");

    const problems = (m.problems || [])
      .map(
        (pr) => `<li><span class="mc-area" title="${esc(t(`mc.area.${pr.area}`))}">${AREA_ICON[pr.area] || "•"}</span>
          <span>${mark(L(pr.text))}</span>
          <button type="button" class="ghost small" data-filter="${esc(pr.criterion)}">${esc(t("mc.showFilter"))}</button></li>`
      )
      .join("");

    const list = (arr) => `<ul>${(arr || []).map((x) => `<li>${mark(x)}</li>`).join("")}</ul>`;
    const tabs = {
      summary: `<p>${mark(L(m.summary))}</p>${
        problems ? `<h4>${esc(t("mc.problems"))}</h4><ul class="mc-problems">${problems}</ul>` : ""
      }`,
      story: `<p>${mark(L(m.story))}</p>`,
      proscons: `<h4>${esc(t("mc.pros"))}</h4>${list(L(m.pros))}<h4>${esc(t("mc.cons"))}</h4>${list(L(m.cons))}`,
      sources: `<ul>${(m.sources || [])
        .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`)
        .join("")}${
        m.officialLink
          ? `<li><a href="${esc(m.officialLink.url)}" target="_blank" rel="noopener">${esc(m.officialLink.title)}</a></li>`
          : ""
      }</ul><p class="muted small">${esc(t("mc.photoNote"))}</p>`,
    };

    dlg.querySelector(".mc-body").innerHTML = `
      <header class="mc-head">
        <h2>${esc(L(m.title))}</h2>
        <button type="button" class="ghost" data-close aria-label="${esc(t("mc.close"))}">✕</button>
      </header>
      ${hasCheck ? `<p class="mc-warn small">${esc(t("mc.checkNote"))}</p>` : ""}
      <div class="mc-grid">
        <figure class="mc-photo">
          ${
            p
              ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" title="${esc(t("mc.openPhoto"))}"><img src="${esc(p.src)}" alt="${esc(L(p.caption))}" loading="lazy"></a>
                 <figcaption><span>${esc(L(p.caption))}</span> <span class="muted">${esc(t("mc.credit"))}: ${esc(p.credit)}</span></figcaption>`
              : `<div class="mc-nophoto muted small">${esc(t("mc.noPhoto"))}</div>`
          }
          ${
            photos.length > 1
              ? `<div class="mc-thumbs">${photos
                  .map(
                    (ph, i) =>
                      `<button type="button" data-photo="${i}" class="${i === photo ? "active" : ""}" aria-label="${esc(L(ph.caption))}"><img src="${esc(ph.src)}" alt="" loading="lazy"></button>`
                  )
                  .join("")}</div>`
              : ""
          }
        </figure>
        <dl class="mc-facts">${facts}</dl>
      </div>
      <div class="mc-tabs" role="tablist">
        ${["summary", "story", "proscons", "sources"]
          .map(
            (k) =>
              `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}" class="${k === tab ? "active" : ""}">${esc(t(`mc.tab.${k}`))}</button>`
          )
          .join("")}
      </div>
      <div class="mc-tab small" role="tabpanel">${tabs[tab]}</div>
      <div class="btn-row mc-actions">
        <button type="button" data-act="load">${esc(t("mc.load"))}</button>
        <button type="button" class="ghost" data-act="ground">${esc(t("mc.ground"))}</button>
      </div>`;
  }

  async function show() {
    const missions = await loadMissions();
    const m = missions[current];
    if (!m) return false;
    render(m);
    return true;
  }

  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg) return dlg.close(); // clique no fundo escuro
    const el = ev.target.closest("button");
    if (!el) return;
    if (el.dataset.close != null) return dlg.close();
    if (el.dataset.photo != null) {
      photo = Number(el.dataset.photo);
      return show();
    }
    if (el.dataset.tab) {
      tab = el.dataset.tab;
      return show();
    }
    if (el.dataset.filter) {
      dlg.close();
      return onFilter?.(el.dataset.filter);
    }
    if (el.dataset.act === "load") {
      dlg.close();
      return onLoad?.(current);
    }
    if (el.dataset.act === "ground") {
      dlg.close();
      return onGround?.(current);
    }
  });

  onLangChange(() => {
    if (dlg.open) show();
  });

  return {
    async open(siteId) {
      if (current !== siteId) {
        photo = 0;
        tab = "summary";
      }
      current = siteId;
      if (await show()) {
        if (!dlg.open) dlg.showModal();
      }
    },
  };
}
