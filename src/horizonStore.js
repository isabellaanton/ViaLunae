// Onde buscar o perfil do horizonte real:
//  - locais fixos: arquivo pré-calculado /data/horizon/<id>.json
//  - coordenadas livres (ou arquivo ausente): cálculo ao vivo no globo, com cache
import { computeHorizonProfile } from "./horizon.js";
import { getTerrainTileset } from "./globe.js";

const memory = new Map();
const STORAGE_KEY = "vialunae.horizons";
const MAX_STORED = 30;

const keyOf = (lat, lon) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function store(key, profile) {
  try {
    const all = readStored();
    all[key] = profile;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_STORED))) delete all[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // armazenamento cheio ou bloqueado: fica só na memória
  }
}

async function fromFile(siteId) {
  try {
    const r = await fetch(`/data/horizon/${siteId}.json`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ siteId?: string, lat: number, lon: number }} query
 * @param {import("cesium").Viewer} viewer
 * @returns {Promise<object>} perfil do horizonte
 * @throws Error("NO_TERRAIN") quando não há relevo carregado para calcular
 */
export async function getHorizonProfile(query, viewer, onProgress) {
  const key = keyOf(query.lat, query.lon);
  if (memory.has(key)) return memory.get(key);

  if (query.siteId) {
    const p = await fromFile(query.siteId);
    if (p) {
      memory.set(key, p);
      return p;
    }
  }
  const stored = readStored()[key];
  if (stored) {
    memory.set(key, stored);
    return stored;
  }

  const tileset = getTerrainTileset();
  if (!tileset) throw new Error("NO_TERRAIN");
  const p = await computeHorizonProfile(viewer, tileset, query.lat, query.lon, onProgress);
  memory.set(key, p);
  store(key, p);
  return p;
}
