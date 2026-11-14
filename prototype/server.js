// Servidor mínimo: serve index.html e faz proxy para a API JPL Horizons
// (a Horizons não envia cabeçalho CORS, então o navegador não pode chamá-la direto).
// Uso: node server.js   ->  http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");

const HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api";

async function azEl(body, lon, lat, start, stop, step) {
  const p = new URLSearchParams({
    format: "json",
    COMMAND: `'${body}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${lon},${lat},0'`,
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
    QUANTITIES: "'4'",
    CSV_FORMAT: "'YES'",
  });
  const r = await fetch(`${HORIZONS}?${p}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  const text = j.result || "";
  const m = text.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error(text.slice(-400));
  return m[1]
    .trim()
    .split("\n")
    .map((l) => {
      const c = l.split(",").map((s) => s.trim());
      return { t: c[0], az: parseFloat(c[3]), el: parseFloat(c[4]) };
    });
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/sky") {
    try {
      const lon = parseFloat(url.searchParams.get("lon"));
      const lat = parseFloat(url.searchParams.get("lat"));
      const start = url.searchParams.get("start");
      const days = Math.min(Math.max(parseInt(url.searchParams.get("days")) || 30, 1), 60);
      if (![lon, lat].every(Number.isFinite) || !/^\d{4}-\d{2}-\d{2}$/.test(start || ""))
        throw new Error("Parâmetros inválidos");
      const stop = addDays(start, days);
      const [sun, earth] = await Promise.all([
        azEl("10", lon, lat, start, stop, "60m"),
        azEl("399", lon, lat, start, stop, "60m"),
      ]);
      const n = Math.min(sun.length, earth.length);
      const out = [];
      for (let i = 0; i < n; i++)
        out.push({ t: sun[i].t, sunAz: sun[i].az, sunEl: sun[i].el, earthAz: earth[i].az, earthEl: earth[i].el });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(3000, () => console.log("http://localhost:3000"));
