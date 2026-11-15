// Botão "?" com balão curto de explicação. Um único balão para a página: abre ao clicar,
// fecha ao clicar fora, com Esc ou ao clicar de novo no mesmo "?".
import { t } from "./i18n/index.js";

let pop = null;
let owner = null;

function ensurePop() {
  if (pop) return pop;
  pop = document.createElement("div");
  pop.className = "hint-pop small";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  document.body.append(pop);
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest?.("[data-hint]");
    if (b) {
      ev.preventDefault();
      ev.stopPropagation();
      if (owner === b && !pop.hidden) return close();
      return open(b);
    }
    if (!pop.hidden && !pop.contains(ev.target)) close();
  }, true);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") close();
  });
  window.addEventListener("resize", close);
  document.addEventListener("scroll", () => owner && place(), true);
  return pop;
}

function place() {
  const r = owner.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight, m = 8;
  let x = r.left + r.width / 2 - w / 2;
  let y = r.bottom + 6;
  if (y + h > window.innerHeight - m) y = r.top - h - 6;
  x = Math.max(m, Math.min(x, window.innerWidth - w - m));
  pop.style.left = `${x}px`;
  pop.style.top = `${Math.max(m, y)}px`;
}

function open(b) {
  owner?.setAttribute("aria-expanded", "false");
  owner = b;
  pop.textContent = t(`hint.${b.dataset.hint}`);
  pop.hidden = false;
  b.setAttribute("aria-expanded", "true");
  place();
}

function close() {
  if (!pop) return;
  pop.hidden = true;
  owner?.setAttribute("aria-expanded", "false");
  owner = null;
}

/** Cria o botão "?" para a chave de texto hint.<key> */
export function hintButton(key) {
  ensurePop();
  const b = document.createElement("button");
  b.type = "button";
  b.className = "hint";
  b.dataset.hint = key;
  b.textContent = "?";
  b.setAttribute("aria-label", t("hint.label"));
  b.setAttribute("aria-expanded", "false");
  return b;
}
