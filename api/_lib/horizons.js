// Lógica compartilhada das funções /api (Vercel) e do servidor de desenvolvimento.
// Arquivos em api/_lib não viram rotas na Vercel (pasta começa com "_").

export const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";

// ---------- erros com status HTTP ----------
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------- cache em memória (por instância da função) ----------
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map();

export async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { value: hit.value, hit: true };
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value); // remove o mais antigo
  return { value, hit: false };
}

// ---------- chamada à Horizons ----------
// params sem aspas; as aspas exigidas pela Horizons são colocadas aqui
export async function callHorizons(params) {
  const q = new URLSearchParams({ format: "json" });
  for (const [k, v] of Object.entries(params)) q.set(k, `'${v}'`);
  let res;
  try {
    res = await fetch(`${HORIZONS_URL}?${q}`, { signal: AbortSignal.timeout(25_000) });
  } catch (e) {
    throw new HttpError(504, "HORIZONS_UNREACHABLE", `Horizons não respondeu: ${e.message}`);
  }
  if (res.status === 503) throw new HttpError(503, "HORIZONS_BUSY", "Horizons sobrecarregada ou em manutenção");
  if (!res.ok) throw new HttpError(502, "HORIZONS_HTTP", `Horizons respondeu HTTP ${res.status}`);
  const json = await res.json();
  // a Horizons devolve erros de entrada com HTTP 200: checar o payload
  if (json.error) throw new HttpError(502, "HORIZONS_ERROR", String(json.error).trim());
  return json.result || "";
}

export function parseCsvTable(result) {
  const m = result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) {
    const tail = result.trim().split("\n").slice(-3).join(" ").slice(0, 300);
    throw new HttpError(502, "HORIZONS_NO_TABLE", `Resposta sem tabela: ${tail}`);
  }
  return m[1]
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((c) => c.trim()));
}

// ---------- datas ----------
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// "2026-Nov-14 03:00" (UT) -> ISO "2026-11-14T03:00:00Z"
export function horizonsTimeToIso(s) {
  const m = s.match(/^(\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return s;
  const d = new Date(Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5], +(m[6] || 0)));
  return d.toISOString().replace(".000Z", "Z");
}

const pad = (n) => String(n).padStart(2, "0");
// Date -> "2026-11-14 03:00" (UT)
export function toHorizonsTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`;
}

// ---------- validação ----------
export function num(params, name, { min, max, required = true, fallback } = {}) {
  const raw = params.get(name);
  if (raw === null || raw === "") {
    if (!required) return fallback;
    throw new HttpError(400, "MISSING_PARAM", `Parâmetro obrigatório: ${name}`);
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) throw new HttpError(400, "INVALID_PARAM", `${name} deve ser um número`);
  if ((min !== undefined && v < min) || (max !== undefined && v > max))
    throw new HttpError(400, "OUT_OF_RANGE", `${name} deve estar entre ${min} e ${max}`);
  return v;
}

// aceita "2026-11-14" ou "2026-11-14T03:00" / "...Z"
export function parseStart(raw) {
  if (!raw) throw new HttpError(400, "MISSING_PARAM", "Parâmetro obrigatório: start");
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z?)?$/.test(raw))
    throw new HttpError(400, "INVALID_PARAM", "start deve ser AAAA-MM-DD ou AAAA-MM-DDTHH:MM");
  const iso = raw.length === 10 ? `${raw}T00:00:00Z` : raw.endsWith("Z") ? raw : `${raw}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "INVALID_PARAM", "start inválido");
  // DE441 cobre milênios, mas para planejamento de missão limitamos a 1900–2100
  if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100)
    throw new HttpError(400, "OUT_OF_RANGE", "start deve estar entre 1900 e 2100");
  return d;
}

// ---------- resposta HTTP (Node req/res, funciona na Vercel e no Vite) ----------
export function sendJson(res, status, body, { cacheSeconds = 0 } = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (cacheSeconds > 0) res.setHeader("Cache-Control", `public, s-maxage=${cacheSeconds}, max-age=300`);
  else res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function sendError(res, e) {
  if (e instanceof HttpError) return sendJson(res, e.status, { error: { code: e.code, message: e.message } });
  console.error(e);
  return sendJson(res, 500, { error: { code: "INTERNAL", message: "Erro interno" } });
}

export function searchParams(req) {
  return new URL(req.url, "http://localhost").searchParams;
}
