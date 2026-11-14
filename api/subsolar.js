// GET /api/subsolar?time=2026-11-14T03:00
// Ponto subsolar na Lua (lon leste e lat, graus) num instante. Usado para iluminar o globo.
// Truque: observar a Lua (301) do centro do Sol (500@10); o "sub-observador" é o ponto subsolar.
import {
  callHorizons,
  parseCsvTable,
  horizonsTimeToIso,
  toHorizonsTime,
  parseStart,
  cached,
  sendJson,
  sendError,
  searchParams,
  HttpError,
} from "./_lib/horizons.js";

export async function getSubsolar(time) {
  const result = await callHorizons({
    COMMAND: "301",
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "500@10",
    START_TIME: toHorizonsTime(time),
    STOP_TIME: toHorizonsTime(new Date(time.getTime() + 60_000)),
    STEP_SIZE: "1m",
    QUANTITIES: "14",
    CSV_FORMAT: "YES",
  });
  const [row] = parseCsvTable(result);
  return { t: horizonsTimeToIso(row[0]), lon: parseFloat(row[3]), lat: parseFloat(row[4]) };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw new HttpError(405, "METHOD", "Use GET");
    const raw = searchParams(req).get("time");
    // sem "time": agora, arredondado ao minuto
    const time = raw ? parseStart(raw) : new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const key = `subsolar:${time.toISOString()}`;
    const { value, hit } = await cached(key, () => getSubsolar(time));
    res.setHeader("X-Cache", hit ? "HIT" : "MISS");
    sendJson(res, 200, value, { cacheSeconds: raw ? 86_400 : 60 });
  } catch (e) {
    sendError(res, e);
  }
}
