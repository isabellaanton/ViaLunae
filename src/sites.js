// Locais e séries de Sol/Terra.
// Locais fixos: dados pré-calculados em /data/ephem/<id>.json quando o período cabe no arquivo;
// fora dele (ou coordenadas livres), consulta ao vivo em /api/sky.
import { fetchSky } from "./horizons.js";

let sitesPromise = null;
const ephemCache = new Map();

export function loadSites() {
  sitesPromise ??= fetch("/data/sites.json")
    .then((r) => {
      if (!r.ok) throw new Error(`sites.json HTTP ${r.status}`);
      return r.json();
    })
    .then((j) => j.sites);
  return sitesPromise;
}

async function loadEphem(id) {
  if (!ephemCache.has(id)) {
    ephemCache.set(
      id,
      fetch(`/data/ephem/${id}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    );
  }
  return ephemCache.get(id);
}

// formato compacto (colunas) -> lista de amostras
function sliceEphem(e, start, end) {
  const t0 = Date.parse(e.start);
  const stepMs = e.stepMinutes * 60_000;
  const i0 = Math.max(0, Math.ceil((start.getTime() - t0) / stepMs));
  const i1 = Math.min(e.count - 1, Math.floor((end.getTime() - t0) / stepMs));
  const samples = [];
  for (let i = i0; i <= i1; i++) {
    samples.push({
      t: new Date(t0 + i * stepMs).toISOString().replace(".000Z", "Z"),
      sunAz: e.sunAz[i],
      sunEl: e.sunEl[i],
      earthAz: e.earthAz[i],
      earthEl: e.earthEl[i],
      sunDistAu: e.sunDistAu[i],
      earthDistKm: e.earthDistKm[i],
    });
  }
  return samples;
}

/**
 * Série de Sol e Terra para um local e período.
 * @param {{ siteId?: string, lat: number, lon: number, start: Date, days: number }} q
 * @returns {Promise<{ samples: object[], stepMinutes: number, source: "file" | "live" }>}
 */
export async function getSeries({ siteId, lat, lon, start, days }) {
  const end = new Date(start.getTime() + days * 86_400_000);
  if (siteId) {
    const e = await loadEphem(siteId);
    if (e && start >= new Date(e.start) && end <= new Date(e.end)) {
      return { samples: sliceEphem(e, start, end), stepMinutes: e.stepMinutes, source: "file" };
    }
  }
  const res = await fetchSky({ lat, lon, start, days });
  return { samples: res.samples, stepMinutes: res.stepMinutes, source: "live" };
}
