// Formulário do painel solar: valores padrão editáveis, validação e aviso de mudança.
import { DEFAULT_PANEL, validatePanel } from "./power.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "vialunae.panel";

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = { ...DEFAULT_PANEL, ...JSON.parse(raw) };
    return validatePanel(p).length ? null : p;
  } catch {
    return null;
  }
}

function store(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // armazenamento bloqueado: segue sem lembrar
  }
}

export function initPanelForm(onChange) {
  const area = $("pv-area"), eff = $("pv-eff"), mode = $("pv-mode");
  const tilt = $("pv-tilt"), az = $("pv-az"), fixedRow = $("pv-fixed"), error = $("pv-error");
  let current = readStored() ?? { ...DEFAULT_PANEL };

  function fill(p) {
    area.value = p.areaM2;
    eff.value = +(p.efficiency * 100).toFixed(2);
    mode.value = p.mode;
    tilt.value = p.tiltDeg;
    az.value = p.azimuthDeg;
    fixedRow.hidden = p.mode !== "fixed";
  }

  function read() {
    return {
      areaM2: Number(area.value),
      efficiency: Number(eff.value) / 100,
      mode: mode.value,
      tiltDeg: Number(tilt.value),
      azimuthDeg: Number(az.value),
    };
  }

  function update() {
    const p = read();
    fixedRow.hidden = p.mode !== "fixed";
    const bad = validatePanel(p);
    error.hidden = bad.length === 0;
    if (bad.length) return;
    current = p;
    store(p);
    onChange(p);
  }

  for (const el of [area, eff, mode, tilt, az]) el.addEventListener("input", update);
  $("pv-reset").addEventListener("click", () => {
    fill(DEFAULT_PANEL);
    update();
  });

  fill(current);
  return { get: () => current };
}
