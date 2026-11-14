# ViaLunae
Lunar Landing Site Navigator

Aplicação web (PT/EN) para comparar locais e datas de pouso na Lua, com foco no polo sul.
Mostra a posição do Sol e da Terra em relação ao horizonte, a potência solar estimada e as
janelas de comunicação direta com a Terra.

- Globo 3D: [CesiumJS](https://cesium.com/platform/cesiumjs/)
- Efemérides: [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
- Relevo e horizonte real: [Cesium Moon Terrain](https://cesium.com/platform/cesium-ion/content/cesium-moon-terrain) (Cesium ion, asset 2684829)
- Plano de trabalho: [TAREFAS.md](TAREFAS.md)

## Como rodar localmente

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env   # e coloque sua chave do Cesium ion em VITE_CESIUM_ION_TOKEN
npm run dev
```

Abra http://localhost:5173.

O `npm install` copia os arquivos estáticos do Cesium para `public/cesium` (pasta ignorada pelo Git).

## API

As funções em `api/` rodam na Vercel em produção e no próprio `npm run dev` localmente.
A Horizons não envia CORS, por isso o navegador sempre passa por elas.

| Rota | Parâmetros | Retorna |
|---|---|---|
| `GET /api/sky` | `lat`, `lon` (leste; negativo aceito), `start` (`AAAA-MM-DD` ou `AAAA-MM-DDTHH:MM`, UTC), `days` (padrão 30, máx. 400), `step` (min., opcional) | Azimute e elevação do Sol e da Terra no local, em série temporal |
| `GET /api/subsolar` | `time` (opcional, padrão agora) | Ponto subsolar na Lua (lon, lat) |

Erros vêm como `{ "error": { "code", "message" } }` com status 400, 502, 503 ou 504.
Respostas são guardadas em cache (memória da função + `Cache-Control` na CDN da Vercel).
As elevações consideram o horizonte liso (esfera lunar); o relevo LOLA entra na Fase 8.

## Dados pré-calculados

Os locais fixos têm 12 meses de Sol e Terra gravados em `public/data/ephem/`. Para regenerar:

```bash
node scripts/precompute.mjs 2026-11-01 365
```

Fora desse período, ou para coordenadas livres, o app consulta `/api/sky` ao vivo.

## Horizonte real

Com "Considerar relevo", o app usa o perfil do horizonte do local: a elevação do terreno em 180 direções,
amostrada no relevo do Cesium Moon até 150 km. O Sol e a Terra só contam como visíveis acima desse perfil.
Os locais fixos têm o perfil em `public/data/horizon/`; coordenadas livres são calculadas no navegador.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | Front-end (globo, painel, métricas, idiomas) |
| `api/` | Funções serverless da Vercel (proxy da Horizons) |
| `public/data/` | Locais (`sites.json`) e efemérides pré-calculadas (`ephem/`) |
| `data/raw/` | Dados brutos grandes (LOLA), fora do Git |
| `scripts/` | Scripts de geração de dados e build |
| `prototype/` | Primeiro protótipo (three.js + Node), só como referência |

## Créditos

Dados de efemérides: NASA/JPL Horizons. Relevo: Cesium Moon Terrain (dados NASA e USGS Astrogeology). Imagem: LROC WAC (NASA/GSFC/ASU) via NASA Moon Trek.
