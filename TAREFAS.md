# Lunar Site Explorer — Plano de microtarefas

Aplicação web (PT/EN) para comparar locais e datas de pouso na Lua, com foco no polo sul:
globo 3D (CesiumJS), dados da JPL Horizons, relevo LOLA, potência solar em kW,
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
- [ ] 0.7 ✋ Criar repositório no GitHub e enviar o primeiro commit

## Fase 1 — Idiomas (PT/EN)
- [x] 1.1 Arquivos de tradução `src/i18n/pt.json` e `src/i18n/en.json`
- [x] 1.2 Função `t("chave")` e seletor de idioma no topo
- [x] 1.3 Lembrar a escolha do idioma no navegador

## Fase 2 — Globo 3D da Lua (CesiumJS)
- [x] 2.1 Teste A: globo com forma da Lua + imagem LROC do Moon Trek (WMTS, sem conta)
- [x] 2.2 Teste B: Cesium ion / Cesium Moon (terreno e imagem prontos, com token)
- [ ] 2.3 ✋ Comparar os dois testes com você e escolher um
- [x] 2.4 Navegação: girar, zoom, botão "ir para o polo sul"
- [x] 2.5 Iluminação do globo pela direção do Sol na data/hora selecionada

## Fase 3 — Proxy e dados da Horizons
- [ ] 3.1 Função `api/sky.js` (Vercel): recebe lat, lon, início, duração e passo; devolve Sol e Terra (azimute e elevação) em JSON
- [ ] 3.2 Validação de parâmetros, limite de duração e mensagens de erro claras
- [ ] 3.3 Cache simples de respostas para não repetir consultas iguais
- [ ] 3.4 Rodar a função localmente (`vercel dev` ou servidor Vite com proxy)

## Fase 4 — Locais fixos e dados pré-calculados
- [ ] 4.1 Lista de locais `data/sites.json`: 6 sítios Apollo + sítios do polo sul (nome PT/EN, lat, lon, tipo, descrição)
- [ ] 4.2 ✋ Conferir comigo a lista de sítios do polo sul (propostos: borda de Shackleton, crista conectora, + 1 a confirmar no PGDA)
- [ ] 4.3 Script `scripts/precompute.js`: consulta a Horizons para cada local fixo num período padrão e grava `data/ephem/<sitio>.json`
- [ ] 4.4 Marcadores dos locais no globo, com nome e clique para selecionar
- [ ] 4.5 Entrada de coordenadas livres (lat/lon) que consulta a API ao vivo

## Fase 5 — Métricas e potência solar
- [ ] 5.1 Módulo `src/metrics.js`: a partir da série de Sol/Terra, calcular
  - elevação do Sol (atual, mínima, máxima, média)
  - duração da luz solar (% do período e horas) e tempo até o próximo pôr do Sol
  - visibilidade da Terra (% do período, janelas) e tempo até o próximo pôr da Terra
- [ ] 5.2 Módulo `src/power.js`: potência em kW com valores padrão editáveis (área, eficiência, inclinação, azimute; padrão = painel vertical que segue o Sol)
- [ ] 5.3 Formulário do painel solar com os valores padrão
- [ ] 5.4 Testes unitários simples das funções de métricas e potência

## Fase 6 — Tabela de comparação de cenários
- [ ] 6.1 Criar cenário: local + data inicial + duração, botão "adicionar à comparação"
- [ ] 6.2 Tabela com N cenários e as quatro métricas em colunas
- [ ] 6.3 Ordenar por coluna e destacar o melhor valor de cada métrica
- [ ] 6.4 Remover e duplicar cenário (para mudar só a data ou só o local)
- [ ] 6.5 Exportar a tabela em CSV

## Fase 7 — Linha do tempo e animação
- [ ] 7.1 Barra de tempo do período do cenário selecionado
- [ ] 7.2 Botão animar / pausar e controle de velocidade
- [ ] 7.3 Gráfico simples de elevação do Sol e da Terra ao longo do tempo, com o horizonte em 0°
- [ ] 7.4 Globo e métricas atualizam conforme o tempo avança

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
