// Idiomas PT/EN.
// No HTML: data-i18n="chave" (texto), data-i18n-title, data-i18n-aria-label, data-i18n-placeholder.
// No JS: t("chave", { nome: "valor" }) com {nome} no texto.
import pt from "./pt.json";
import en from "./en.json";

const dictionaries = { pt, en };
const STORAGE_KEY = "lse.lang";
const listeners = new Set();
let current = "pt";

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // navegação privada ou armazenamento bloqueado: segue sem lembrar
  }
}

function detect() {
  const saved = readStored();
  if (saved && dictionaries[saved]) return saved;
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("pt") ? "pt" : "en";
}

export function t(key, vars) {
  const text = dictionaries[current][key] ?? dictionaries.pt[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : `{${name}}`));
}

export function getLang() {
  return current;
}

const ATTRS = ["title", "aria-label", "placeholder", "label"];

export function applyTranslations(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  for (const attr of ATTRS) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => {
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
    });
  }
  document.documentElement.lang = current === "pt" ? "pt-BR" : "en";
}

export function setLang(lang) {
  if (!dictionaries[lang]) return;
  current = lang;
  store(lang);
  applyTranslations();
  listeners.forEach((fn) => fn(lang));
}

// para partes da interface montadas em JS que precisam se redesenhar ao trocar o idioma
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initI18n(select) {
  current = detect();
  applyTranslations();
  if (select) {
    select.value = current;
    select.addEventListener("change", () => setLang(select.value));
  }
}
