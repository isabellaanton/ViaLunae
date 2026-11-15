// Tour inicial: destaca uma parte da tela por vez, com um balão explicativo.
// Abre sozinho na primeira visita e pelo botão "Tour". Esc ou "Pular" fecham.
import { t, onLangChange } from "./i18n/index.js";

const STORE = "vialunae.tourSeen";

// alvo (seletor CSS) e chave de texto de cada passo
export const STEPS = [
  { target: ".globe-wrap", key: "globe", place: "inside" },
  { target: ".globe-tools", key: "sites" },
  { target: "#scenario-card", key: "scenario", place: "left" },
  { target: ".timebar", key: "time", place: "above" },
  { target: "#analysis-card", key: "filters", place: "left" },
  { target: ".measure-tools", key: "measure" },
  { target: "#compare-card", key: "compare", place: "left" },
];

export function createTour() {
  const root = document.createElement("div");
  root.className = "tour";
  root.hidden = true;
  root.innerHTML = `<div class="tour-hole"></div>
    <div class="tour-pop" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <p class="tour-count small muted"></p>
      <h3 id="tour-title"></h3>
      <p class="tour-text small"></p>
      <div class="tour-btns">
        <button type="button" class="ghost" data-tour="skip"></button>
        <span></span>
        <button type="button" class="ghost" data-tour="prev"></button>
        <button type="button" data-tour="next"></button>
      </div>
    </div>`;
  document.body.append(root);
  const hole = root.querySelector(".tour-hole");
  const pop = root.querySelector(".tour-pop");
  let i = 0;

  function markSeen() {
    try {
      localStorage.setItem(STORE, "1");
    } catch {
      /* sem armazenamento */
    }
  }

  function place() {
    const step = STEPS[i];
    const el = document.querySelector(step.target);
    if (!el) return;
    // recorta o destaque à parte visível (cartões longos, como o de filtros, passam da tela)
    const b = el.getBoundingClientRect();
    const top = Math.max(b.top, 0), bottom = Math.min(b.bottom, window.innerHeight);
    const r = { left: b.left, right: b.right, top, bottom, width: b.width, height: Math.max(0, bottom - top) };
    const pad = 6;
    Object.assign(hole.style, {
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + 2 * pad}px`,
      height: `${r.height + 2 * pad}px`,
    });
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, m = 12;
    let x, y;
    if (step.place === "inside") {
      x = r.left + 24;
      y = r.top + 70;
    } else if (step.place === "left" && r.left - pw - m > 0) {
      x = r.left - pw - m;
      y = r.top;
    } else if (step.place === "above") {
      x = r.left + 24;
      y = r.top - ph - m;
    } else {
      x = r.left;
      y = r.bottom + m;
    }
    // não sair da tela (celular: balão embaixo)
    x = Math.max(m, Math.min(x, vw - pw - m));
    y = Math.max(m, Math.min(y, vh - ph - m));
    Object.assign(pop.style, { left: `${x}px`, top: `${y}px` });
  }

  function render() {
    const step = STEPS[i];
    const el = document.querySelector(step.target);
    el?.scrollIntoView({ block: "nearest", behavior: "instant" });
    root.querySelector(".tour-count").textContent = t("tour.count", { n: i + 1, total: STEPS.length });
    root.querySelector("#tour-title").textContent = t(`tour.${step.key}.title`);
    root.querySelector(".tour-text").textContent = t(`tour.${step.key}.text`);
    root.querySelector('[data-tour="skip"]').textContent = t("tour.skip");
    const prev = root.querySelector('[data-tour="prev"]');
    prev.textContent = t("tour.prev");
    prev.hidden = i === 0;
    root.querySelector('[data-tour="next"]').textContent = t(i === STEPS.length - 1 ? "tour.done" : "tour.next");
    requestAnimationFrame(place);
    setTimeout(place, 50);
    root.querySelector('[data-tour="next"]').focus();
  }

  function close() {
    root.hidden = true;
    markSeen();
    window.removeEventListener("resize", place);
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("scroll", place, true);
  }

  function onKey(ev) {
    if (ev.key === "Escape") close();
    else if (ev.key === "ArrowRight") go(1);
    else if (ev.key === "ArrowLeft") go(-1);
  }

  function go(d) {
    const n = i + d;
    if (n >= STEPS.length) return close();
    if (n < 0) return;
    i = n;
    render();
  }

  root.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-tour]");
    if (!b) return;
    if (b.dataset.tour === "skip") close();
    else go(b.dataset.tour === "next" ? 1 : -1);
  });

  onLangChange(() => {
    if (!root.hidden) render();
  });

  return {
    start() {
      i = 0;
      root.hidden = false;
      window.addEventListener("resize", place);
      window.addEventListener("keydown", onKey);
      document.addEventListener("scroll", place, true);
      render();
    },
    // primeira visita: abre sozinho
    startIfFirstVisit() {
      let seen = false;
      try {
        seen = localStorage.getItem(STORE) === "1";
      } catch {
        seen = true; // sem armazenamento: não insiste a cada visita
      }
      if (!seen) this.start();
    },
  };
}
