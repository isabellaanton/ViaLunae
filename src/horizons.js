// Cliente das funções /api (em produção: Vercel; em desenvolvimento: plugin do Vite).
// A Horizons não envia CORS, então o navegador sempre passa pelo nosso servidor.

async function getJson(url) {
  const res = await fetch(url);
  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok || body.error) {
    const err = new Error(body.error?.message || `HTTP ${res.status}`);
    err.code = body.error?.code;
    throw err;
  }
  return body;
}

// Ponto subsolar na Lua num instante (padrão: agora). -> { t, lon, lat }
export function fetchSubsolarPoint(date) {
  const q = date ? `?time=${encodeURIComponent(date.toISOString().slice(0, 16))}` : "";
  return getJson(`/api/subsolar${q}`);
}

// Série de Sol e Terra vistos de um ponto. -> { site, start, stop, stepMinutes, samples[] }
// start: Date; days: número; step (opcional): minutos
export function fetchSky({ lat, lon, start, days, step }) {
  const q = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    start: start.toISOString().slice(0, 16),
    days: String(days),
  });
  if (step) q.set("step", String(step));
  return getJson(`/api/sky?${q}`);
}
