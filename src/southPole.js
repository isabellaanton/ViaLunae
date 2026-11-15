// Cartão "Por que o polo sul é difícil?": três explicações ilustradas, cada uma ligada a uma missão
// real (abre a ficha) e a um filtro do app (mostra na Lua).
import { t, onLangChange } from "./i18n/index.js";
import { DRAWINGS } from "./analysisDrawings.js";

const ITEMS = [
  { key: "sun", drawing: "shadow", criterion: "shadow", site: "mons-mouton" },
  { key: "crater", drawing: "relief", criterion: "relief", site: "mons-mouton" },
  { key: "earth", drawing: "libration", criterion: "libration", site: "malapert-a" },
];

export function createSouthPoleCard({ onFilter, onMission }) {
  const root = document.getElementById("sp-items");

  function render() {
    root.innerHTML = ITEMS.map(
      (it) => `<article class="sp-item">
        <div class="an-draw">${DRAWINGS[it.drawing]}</div>
        <h3>${t(`sp.${it.key}.title`)}</h3>
        <p class="small">${t(`sp.${it.key}.text`)}</p>
        <p class="small muted">${t(`sp.${it.key}.mission`)}</p>
        <div class="btn-row">
          <button type="button" class="ghost small" data-sp-filter="${it.criterion}">${t("sp.showFilter")}</button>
          <button type="button" class="ghost small" data-sp-site="${it.site}">${t("sp.openMission")}</button>
        </div>
      </article>`
    ).join("");
  }

  root.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.spFilter) onFilter?.(b.dataset.spFilter);
    if (b.dataset.spSite) onMission?.(b.dataset.spSite);
  });

  onLangChange(render);
  render();
}
