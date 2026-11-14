// GET /api/sky?lat=-89.5&lon=0&start=2026-11-14&days=30&step=60
// Posição do Sol e da Terra (azimute/elevação) vista de um ponto da superfície lunar.
//
// Parâmetros:
//   lat   latitude selenográfica, graus (-90 a 90)
//   lon   longitude leste, graus (-180 a 360)
//   start AAAA-MM-DD ou AAAA-MM-DDTHH:MM (UTC)
//   days  duração em dias (padrão 30, máx. 400)
//   step  passo em minutos (padrão: automático para ~2000 pontos; mín. 10)
//
// Resposta: { site, start, stop, stepMinutes, samples: [{ t, sunAz, sunEl, earthAz, earthEl, sunDistAu, earthDistKm }] }
// Elevações são em relação ao horizonte liso (esfera lunar), sem relevo.
import {
  callHorizons,
  parseCsvTable,
  horizonsTimeToIso,
  toHorizonsTime,
  num,
  parseStart,
  cached,
  sendJson,
  sendError,
  searchParams,
  HttpError,
} from "./_lib/horizons.js";

const AU_KM = 149_597_870.7;
const MAX_POINTS = 5000;
const TARGET_POINTS = 2000;
const ALLOWED_STEPS = [10, 15, 20, 30, 60, 120, 180, 240, 360, 720, 1440];

function chooseStep(days, requested) {
  const totalMin = days * 1440;
  if (requested !== undefined) {
    if (totalMin / requested > MAX_POINTS)
      throw new HttpError(400, "TOO_MANY_POINTS", `Passo muito pequeno: no máximo ${MAX_POINTS} pontos por consulta`);
    return requested;
  }
  return ALLOWED_STEPS.find((s) => totalMin / s <= TARGET_POINTS) ?? 1440;
}

async function azElSeries(body, { lat, lon, startStr, stopStr, step }) {
  const result = await callHorizons({
    COMMAND: body,
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "coord@301",
    COORD_TYPE: "GEODETIC",
    SITE_COORD: `${lon},${lat},0`,
    START_TIME: startStr,
    STOP_TIME: stopStr,
    STEP_SIZE: `${step}m`,
    QUANTITIES: "4,20", // azimute/elevação + distância (delta, au)
    CSV_FORMAT: "YES",
  });
  return parseCsvTable(result).map((c) => ({
    t: horizonsTimeToIso(c[0]),
    az: parseFloat(c[3]),
    el: parseFloat(c[4]),
    distAu: parseFloat(c[5]),
  }));
}

export async function getSky({ lat, lon, start, days, step }) {
  const stop = new Date(start.getTime() + days * 86_400_000);
  const startStr = toHorizonsTime(start);
  const stopStr = toHorizonsTime(stop);
  const args = { lat, lon, startStr, stopStr, step };

  const [sun, earth] = await Promise.all([azElSeries("10", args), azElSeries("399", args)]);
  const n = Math.min(sun.length, earth.length);
  const samples = new Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = {
      t: sun[i].t,
      sunAz: sun[i].az,
      sunEl: sun[i].el,
      earthAz: earth[i].az,
      earthEl: earth[i].el,
      sunDistAu: sun[i].distAu,
      earthDistKm: Math.round(earth[i].distAu * AU_KM),
    };
  }
  return {
    site: { lat, lon },
    start: start.toISOString(),
    stop: stop.toISOString(),
    stepMinutes: step,
    horizon: "smooth-sphere",
    source: "NASA/JPL Horizons (DE441)",
    samples,
  };
}

export function parseSkyParams(params) {
  const lat = num(params, "lat", { min: -90, max: 90 });
  let lon = num(params, "lon", { min: -180, max: 360 });
  if (lon < 0) lon += 360; // Horizons usa longitude leste 0–360
  const start = parseStart(params.get("start"));
  const days = num(params, "days", { min: 0.25, max: 400, required: false, fallback: 30 });
  const reqStep = num(params, "step", { min: 10, max: 1440, required: false });
  const step = chooseStep(days, reqStep === undefined ? undefined : Math.round(reqStep));
  // arredonda para a chave de cache não explodir com casas decimais irrelevantes
  return { lat: +lat.toFixed(4), lon: +lon.toFixed(4), start, days, step };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw new HttpError(405, "METHOD", "Use GET");
    const p = parseSkyParams(searchParams(req));
    const key = `sky:${p.lat}:${p.lon}:${p.start.toISOString()}:${p.days}:${p.step}`;
    const { value, hit } = await cached(key, () => getSky(p));
    res.setHeader("X-Cache", hit ? "HIT" : "MISS");
    sendJson(res, 200, value, { cacheSeconds: 86_400 });
  } catch (e) {
    sendError(res, e);
  }
}
