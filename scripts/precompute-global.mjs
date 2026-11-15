// Pré-calcula, para a Lua inteira, os pontos subsolar e sub-Terra e as distâncias (NASA/JPL Horizons).
// Com esses dois pontos a posição do Sol e da Terra no céu de QUALQUER coordenada sai por geometria
// (src/skyGeometry.js), o que permite pintar os filtros na Lua inteira.
// Uso: node scripts/precompute-global.mjs [AAAA-MM-DD início] [dias]   (padrão: 2026-11-01, 365)
// Saída: public/data/ephem/global.json (colunas, passo de 60 min)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { callHorizons, parseCsvTable, horizonsTimeToIso, toHorizonsTime } from "../api/_lib/horizons.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const AU_KM = 149_597_870.7;
const STEP_MIN = 60;
const CHUNK_DAYS = 90;
const start = new Date(`${process.argv[2] || "2026-11-01"}T00:00:00Z`);
const totalDays = Number(process.argv[3] || 365);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

const cols = { t: [], sunLon: [], sunLat: [], earthLon: [], earthLat: [], sunDistAu: [], earthDistKm: [] };
for (let d = 0; d < totalDays; d += CHUNK_DAYS) {
  const days = Math.min(CHUNK_DAYS, totalDays - d);
  const a = new Date(start.getTime() + d * 86_400_000);
  const b = new Date(a.getTime() + days * 86_400_000);
  // observador no geocentro olhando a Lua: 14 = ponto sub-observador (sub-Terra), 15 = ponto subsolar,
  // 19 = distância Sol–Lua (au), 20 = distância Terra–Lua (au)
  const result = await callHorizons({
    COMMAND: "301", OBJ_DATA: "NO", MAKE_EPHEM: "YES", EPHEM_TYPE: "OBSERVER", CENTER: "500@399",
    START_TIME: toHorizonsTime(a), STOP_TIME: toHorizonsTime(b), STEP_SIZE: `${STEP_MIN}m`,
    QUANTITIES: "14,15,19,20", CSV_FORMAT: "YES", ANG_FORMAT: "DEG",
  });
  for (const row of parseCsvTable(result)) {
    const t = horizonsTimeToIso(row[0]);
    if (cols.t.length && t <= cols.t[cols.t.length - 1]) continue;
    // colunas: data, flags(2), ObsSub-LON, ObsSub-LAT, SunSub-LON, SunSub-LAT, r, rdot, delta, deldot
    const [eLon, eLat, sLon, sLat, rAu, , deltaAu] = row.slice(3).map(Number);
    cols.t.push(t);
    cols.earthLon.push(r(eLon, 4)); cols.earthLat.push(r(eLat, 4));
    cols.sunLon.push(r(sLon, 4)); cols.sunLat.push(r(sLat, 4));
    cols.sunDistAu.push(r(rAu, 6)); cols.earthDistKm.push(Math.round(deltaAu * AU_KM));
  }
  process.stdout.write(".");
  await sleep(1500);
}
const { t, ...series } = cols;
mkdirSync(join(root, "public", "data", "ephem"), { recursive: true });
const out = join(root, "public", "data", "ephem", "global.json");
writeFileSync(out, JSON.stringify({
  version: 1, start: t[0], end: t[t.length - 1], stepMinutes: STEP_MIN, count: t.length,
  lonConvention: "east", source: "NASA/JPL Horizons (DE441), observador 500@399, quantidades 14,15,19,20",
  generatedAt: new Date().toISOString(), ...series,
}));
console.log(` ${t.length} pontos -> ${out.replace(root, ".")}`);
