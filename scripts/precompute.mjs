// Pré-calcula Sol e Terra (azimute, elevação, distância) para os locais fixos.
// Uso: node scripts/precompute.mjs [AAAA-MM-DD início] [dias]   (padrão: 1º dia do mês atual, 365 dias)
//      node scripts/precompute.mjs 2026-11-01 365 apollo11     (só um sítio)
//
// Saída: public/data/ephem/<id>.json em formato compacto (colunas), passo de 60 min.
// Consulta a Horizons em blocos para respeitar o limite de pontos e não sobrecarregar o serviço.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSky } from "../api/sky.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "data", "ephem");
const { sites } = JSON.parse(readFileSync(join(root, "public", "data", "sites.json"), "utf8"));

const STEP_MIN = 60;
const CHUNK_DAYS = 60;
const PAUSE_MS = 1500;

const now = new Date();
const startArg = process.argv[2];
const start = startArg
  ? new Date(`${startArg}T00:00:00Z`)
  : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const totalDays = Number(process.argv[3] || 365);
const only = process.argv[4];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

async function precomputeSite(site) {
  const cols = { t: [], sunAz: [], sunEl: [], earthAz: [], earthEl: [], sunDistAu: [], earthDistKm: [] };
  for (let d = 0; d < totalDays; d += CHUNK_DAYS) {
    const days = Math.min(CHUNK_DAYS, totalDays - d);
    const chunkStart = new Date(start.getTime() + d * 86_400_000);
    const lon = site.lon < 0 ? site.lon + 360 : site.lon;
    const res = await getSky({ lat: site.lat, lon, start: chunkStart, days, step: STEP_MIN });
    for (const s of res.samples) {
      if (cols.t.length && s.t <= cols.t[cols.t.length - 1]) continue; // borda repetida entre blocos
      cols.t.push(s.t);
      cols.sunAz.push(r(s.sunAz, 3));
      cols.sunEl.push(r(s.sunEl, 3));
      cols.earthAz.push(r(s.earthAz, 3));
      cols.earthEl.push(r(s.earthEl, 3));
      cols.sunDistAu.push(r(s.sunDistAu, 6));
      cols.earthDistKm.push(s.earthDistKm);
    }
    process.stdout.write(".");
    await sleep(PAUSE_MS);
  }
  const { t, ...series } = cols;
  return {
    version: 1,
    siteId: site.id,
    lat: site.lat,
    lon: site.lon,
    start: t[0],
    end: t[t.length - 1],
    stepMinutes: STEP_MIN,
    count: t.length,
    horizon: "smooth-sphere",
    source: "NASA/JPL Horizons (DE441)",
    generatedAt: new Date().toISOString(),
    ...series,
  };
}

mkdirSync(outDir, { recursive: true });
console.log(`Período: ${start.toISOString().slice(0, 10)} + ${totalDays} dias, passo ${STEP_MIN} min`);
for (const site of sites) {
  if (only && site.id !== only) continue;
  process.stdout.write(`${site.id} `);
  const data = await precomputeSite(site);
  const file = join(outDir, `${site.id}.json`);
  writeFileSync(file, JSON.stringify(data));
  console.log(` ${data.count} pontos -> ${file.replace(root, ".")}`);
}
