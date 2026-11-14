// Cliente da API JPL Horizons, via /api/horizons
// (dev: proxy do Vite; produção: função da Vercel na Fase 3 — a Horizons não envia CORS).

const ENDPOINT = "/api/horizons";

const pad = (n) => String(n).padStart(2, "0");
// Date -> "2026-11-14 03:00" (UT)
export function toHorizonsTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`;
}

// Chamada genérica: params sem aspas; as aspas exigidas pela Horizons são colocadas aqui.
export async function horizons(params) {
  const q = new URLSearchParams({ format: "json" });
  for (const [k, v] of Object.entries(params)) q.set(k, `'${v}'`);
  const res = await fetch(`${ENDPOINT}?${q}`);
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

// Extrai as linhas CSV entre $$SOE e $$EOE
export function parseCsvTable(result) {
  const m = result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error("Horizons: tabela não encontrada na resposta");
  return m[1]
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((c) => c.trim()));
}

// Ponto subsolar na Lua (lon leste, lat; graus) num instante.
// Truque: observar a Lua (301) a partir do centro do Sol (500@10); o "sub-observador" é o ponto subsolar.
export async function fetchSubsolarPoint(date) {
  const start = toHorizonsTime(date);
  const stop = toHorizonsTime(new Date(date.getTime() + 60_000));
  const result = await horizons({
    COMMAND: "301",
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "500@10",
    START_TIME: start,
    STOP_TIME: stop,
    STEP_SIZE: "1m",
    QUANTITIES: "14",
    CSV_FORMAT: "YES",
  });
  const [row] = parseCsvTable(result);
  return { time: row[0], lon: parseFloat(row[3]), lat: parseFloat(row[4]) };
}
