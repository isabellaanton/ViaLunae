# ViaLunae — Plano de microtarefas

Aplicação web (PT/EN) para comparar locais e datas de pouso na Lua, com foco no polo sul:
globo 3D (CesiumJS), dados da JPL Horizons, relevo LOLA, potência solar em kW,
simulação das condições de uma coordenada (Sol, Terra, irradiância, temperatura estimada),
vista do horizonte, linha do tempo, modo educativo e exportação CSV. Publicação na Vercel.

Regra geral: **tudo em versão simples primeiro**, refinar só no fim (fase 10).
Cada microtarefa termina com algo que dá para ver ou testar.

Legenda: `[ ]` a fazer · `[x]` feito · ✋ precisa de ação ou aprovação sua

---

## Fase 0 — Estrutura do projeto
- [x] 0.1 Iniciar repositório Git e `.gitignore` (node_modules, dados brutos grandes, `.env`)
- [x] 0.2 Criar `package.json` com Vite (servidor de desenvolvimento e build) e CesiumJS
- [x] 0.3 Estrutura de pastas: `src/` (front-end), `api/` (funções Vercel), `data/` (dados pré-calculados), `scripts/` (geração de dados)
- [x] 0.4 Página base com layout: globo à esquerda/centro, painel lateral, barra de tempo embaixo
- [x] 0.5 Variável de ambiente `VITE_CESIUM_ION_TOKEN` e arquivo `.env.example` (✋ você coloca a chave no `.env` local)
- [x] 0.6 README com como rodar localmente
- [x] 0.7 ✋ Criar repositório no GitHub e enviar o primeiro commit — github.com/isabellaanton/ViaLunae, branch feature/lunar-site-explorer

## Fase 1 — Idiomas (PT/EN)
- [x] 1.1 Arquivos de tradução `src/i18n/pt.json` e `src/i18n/en.json`
- [x] 1.2 Função `t("chave")` e seletor de idioma no topo
- [x] 1.3 Lembrar a escolha do idioma no navegador

## Fase 2 — Globo 3D da Lua (CesiumJS)
- [x] 2.1 Teste A: globo com forma da Lua + imagem LROC do Moon Trek (WMTS, sem conta)
- [x] 2.2 Teste B: Cesium ion / Cesium Moon (terreno e imagem prontos, com token)
- [x] 2.3 ✋ Comparar os dois testes com você e escolher um — escolhido: Cesium Moon padrão, Moon Trek como alternativa
- [x] 2.4 Navegação: girar, zoom, botão "ir para o polo sul"
- [x] 2.5 Iluminação do globo pela direção do Sol na data/hora selecionada

## Fase 3 — Proxy e dados da Horizons
- [x] 3.1 Funções `api/sky.js` e `api/subsolar.js` (Vercel): recebe lat, lon, início, duração e passo; devolve Sol e Terra (azimute e elevação) em JSON
- [x] 3.2 Validação de parâmetros, limite de duração e mensagens de erro claras
- [x] 3.3 Cache simples de respostas para não repetir consultas iguais
- [x] 3.4 Rodar as funções localmente (plugin do Vite executa api/*.js no `npm run dev`)

## Fase 4 — Locais fixos e dados pré-calculados
- [x] 4.1 Lista de locais `public/data/sites.json`: 6 sítios Apollo + Mons Mouton (IM-2) e Malapert A (IM-1), nomes PT/EN, lat, lon, ano, descrição e fonte
- [x] 4.2 ✋ Lista do polo sul aprovada: Mons Mouton (IM-2 Athena) e Malapert A (IM-1 Odysseus)
- [x] 4.3 Script `scripts/precompute.mjs`: 12 meses (2026-11-01 a 2027-11-01, passo 1 h) por sítio em `public/data/ephem/<sitio>.json`, com distância do Sol e da Terra
- [x] 4.4 Marcadores dos locais no globo, com nome e clique para selecionar
- [x] 4.5 Coordenadas livres (digitadas ou clicando no globo) consultam a API ao vivo; locais fixos fora dos 12 meses também

## Fase 5 — Métricas e potência solar
- [x] 5.1 Módulo `src/metrics.js`: elevação do Sol (início, mín., média, máx.), luz solar (% e horas, maior período, próximo pôr/nascer), Terra visível (%, janelas, próximo pôr/nascer da Terra) e atraso do sinal
- [x] 5.2 Módulo `src/power.js`: potência em kW (irradiância 1361 W/m² ÷ d², ângulo de incidência), modos vertical seguindo o Sol (padrão), 2 eixos e fixo; potência no início, média, pico e energia (kWh)
- [x] 5.3 Formulário do painel solar com padrão editável (10 m², 30%, vertical seguindo o Sol), lembrado no navegador
- [x] 5.4 Testes unitários (`npm test`, 10 testes) de métricas e potência

## Fase 5B — Simulação das condições de uma coordenada
Para um ponto (lat/lon) e uma data/hora, mostrar "como está lá agora" e como muda ao longo do período.
- [x] 5B.1 Card "Condições no local": dia/noite, Sol e Terra (elevação e azimute) no instante escolhido na barra de tempo
- [x] 5B.2 Irradiância (raios diretos e no chão, W/m²) com a distância ao Sol vinda da Horizons
- [x] 5B.3 Temperatura estimada (°C e K): equilíbrio radiativo de dia (albedo 0,12, emissividade 0,95) e piso noturno por latitude; aviso na tela
- [x] 5B.4 Atraso do sinal e distância Terra–local no instante
- [x] 5B.5 Fração iluminada da Terra vista do local e duração do dia e da noite (quando há ciclo completo no período)
- [x] 5B.6 Gráfico SVG de irradiância e temperatura no período, com cursor ligado à barra de tempo
- [ ] 5B.7 Condições incluídas na tabela de comparação e no CSV (temperatura mín./máx., irradiância média) — junto com a Fase 6 (`conditionsSummary` já pronto)
- [ ] 5B.8 Cartões educativos explicando cada condição — junto com a Fase 9
- [ ] 5B.9 (refino, Fase 8) Usar o horizonte LOLA: Sol atrás do relevo = sombra, com efeito na irradiância e na temperatura

## Fase 6 — Tabela de comparação de cenários
- [ ] 6.1 Criar cenário: local + data inicial + duração, botão "adicionar à comparação"
- [ ] 6.2 Tabela com N cenários e as quatro métricas em colunas
- [ ] 6.3 Ordenar por coluna e destacar o melhor valor de cada métrica
- [ ] 6.4 Remover e duplicar cenário (para mudar só a data ou só o local)
- [ ] 6.5 Exportar a tabela em CSV

## Fase 7 — Linha do tempo e animação
- [x] 7.1 Barra de tempo do período do cenário selecionado
- [x] 7.2 Botão animar / pausar (velocidade fixa: período inteiro em ~12 s)
- [ ] 7.3 Gráfico simples de elevação do Sol e da Terra ao longo do tempo, com o horizonte em 0°
- [x] 7.4 Globo (luz do Sol) e condições atualizam conforme o tempo avança

## Fase 8 — Relevo LOLA e vista do horizonte (Street View)
- [ ] 8.1 ✋ Escolher e aprovar os arquivos LOLA 5 m do PGDA (nome, tamanho e origem antes de baixar)
- [ ] 8.2 Script que recorta e reduz cada sítio para um mapa de altura leve (ex.: PNG 16 bits ou binário) em `data/terrain/`
- [ ] 8.3 Cálculo do perfil do horizonte (elevação do terreno em cada azimute) para cada sítio
- [ ] 8.4 Usar o horizonte real nas métricas (Sol/Terra visíveis só acima do relevo)
- [ ] 8.5 Panorama 3D: câmera no chão, terreno sombreado, Sol e Terra no céu na hora escolhida
- [ ] 8.6 Botão "ver do chão" a partir do globo e da tabela

## Fase 9 — Modo educativo
- [ ] 9.1 Cartões de explicação curtos (PT/EN) ao lado de cada métrica (ícone "?")
- [ ] 9.2 Tour inicial de 4 a 6 passos na primeira visita
- [ ] 9.3 Cartões sobre por que o polo sul é difícil (Sol rasante, crateras em sombra, Terra baixa no céu)

## Fase 10 — Publicação e acabamento
- [ ] 10.1 Build de produção e teste local da versão final
- [ ] 10.2 ✋ Conectar o repositório GitHub à Vercel e configurar o token do Cesium nas variáveis da Vercel
- [ ] 10.3 Testar o link público (globo, tabela, API ao vivo, CSV, idiomas)
- [ ] 10.4 Ajustes visuais, responsividade em tela menor e textos finais
- [ ] 10.5 Roteiro curto de demonstração para a apresentação do hackathon

---

## Fora do escopo da v1 (só se sobrar tempo)
- Panoramas reais das missões Apollo
- Detalhes históricos completos das missões
- Missões de outros países
- Relevo LOLA de alta resolução fora dos sítios escolhidos
