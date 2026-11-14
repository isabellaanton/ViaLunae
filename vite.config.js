import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Em desenvolvimento, roda as mesmas funções da pasta api/ que a Vercel usa em produção.
// /api/sky -> api/sky.js, /api/subsolar -> api/subsolar.js (recarregadas a cada edição).
function apiFunctions() {
  return {
    name: "local-api-functions",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = req.url.match(/^\/api\/([a-z]+)(?:\?|$)/);
        if (!m) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (!existsSync(resolve(server.config.root, "api", `${m[1]}.js`))) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Rota de API inexistente" } }));
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { code: "DEV_SERVER", message: e.message } }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [apiFunctions()],
  server: { port: 5173 },
});
