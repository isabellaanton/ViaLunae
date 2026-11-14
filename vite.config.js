import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Em desenvolvimento, /api/horizons vai direto para a Horizons.
      // Em produção, a função api/horizons.js da Vercel faz o mesmo (Fase 3).
      "/api/horizons": {
        target: "https://ssd.jpl.nasa.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/horizons/, "/api/horizons.api"),
      },
    },
  },
});
