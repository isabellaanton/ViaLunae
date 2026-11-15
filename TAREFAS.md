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
- [x] 5B.7 Condições incluídas na tabela de comparação e no CSV (temperatura mín./máx., irradiância média)
- [ ] 5B.8 Cartões educativos explicando cada condição — junto com a Fase 9
- [x] 5B.9 Horizonte real: Sol atrás do relevo = sombra, com efeito na irradiância, na temperatura e na potência

## Fase 6 — Tabela de comparação de cenários
- [x] 6.1 Botão "+ Adicionar à comparação" depois de carregar um cenário (evita repetidos, até 12)
- [x] 6.2 Tabela com N cenários: luz solar, elevação média, maior período de luz, até o pôr do Sol, Terra visível, maior janela, potência média, energia, irradiância e temperaturas
- [x] 6.3 Ordenar por coluna (clique no título) e destacar em verde o melhor valor de cada coluna
- [x] 6.4 Remover e Editar (carrega o cenário no formulário para mudar só a data ou só o local e adicionar como novo); lista lembrada no navegador
- [x] 6.5 Exportar a tabela em CSV (cabeçalho no idioma atual, ponto decimal, BOM para o Excel, inclui lat/lon e painel usado)

## Fase 7 — Linha do tempo e animação
- [x] 7.1 Barra de tempo do período do cenário selecionado
- [x] 7.2 Botão animar / pausar e controle de velocidade (0,5×, 1×, 2×, 4×; 1× = período inteiro em ~12 s)
- [x] 7.3 Gráfico de elevação do Sol e da Terra no período, com o horizonte em 0°, faixas de Terra visível e cursor da barra de tempo
- [x] 7.4 Globo (luz do Sol) e condições atualizam conforme o tempo avança

## Fase 8 — Relevo LOLA e vista do horizonte (Street View)
- [x] 8.1 ✋ Fonte do relevo aprovada: terreno do Cesium Moon (LOLA 5 m do PGDA cobre só ~16–25 km e só Mons Mouton; o horizonte do polo depende de montanhas a 50–150 km)
- [x] 8.2 Amostragem do relevo no navegador (`src/horizon.js`): 180 azimutes × 27 distâncias até 150 km, em duas passadas (perto/longe)
- [x] 8.3 Perfil do horizonte por sítio em `public/data/horizon/<id>.json`; coordenadas livres calculadas ao vivo (~30–70 s) e guardadas no navegador
- [x] 8.4 Horizonte real nas métricas, potência, condições, tabela e CSV (caixa "Considerar relevo"; "atrás do relevo" e "sombra do relevo")
- [x] 8.5 Vista do chão: câmera a 2 m do solo, relevo real, Sol e Terra no céu seguindo a barra de tempo; arrastar para olhar em volta
- [x] 8.6 Botão "Ver do chão" no card de condições, com "Olhar para o Sol / Terra" e "Sair"; gráfico panorâmico do horizonte com os caminhos do Sol e da Terra

## Fase 8B — Análise com filtros (semáforo)
Ideia: cada critério vira um filtro vermelho/amarelo/verde; os filtros ligados se somam e o local com mais verde fica no topo do ranking.
**Regra: os filtros usam só dados da API Horizons (posição do Sol e da Terra vistos do local, distâncias) e cálculos feitos a partir deles.** Quando o critério depende de algo que a API não dá (inclinação do módulo, declividade, parede da cratera), isso entra como parâmetro editável do usuário e o app calcula o efeito.

**Decisões já tomadas**
- Onde: nova aba "Análise" na janela de comparação + marcadores do globo pintados com a pontuação de cada local
- Cores: 3 níveis (verde = 2, amarelo = 1, vermelho = 0); botão alterna "Limites" (valores fixos editáveis) e "Comparativo" (terço melhor/meio/pior entre os locais)
- Pontuação: média dos subfiltros de cada critério, soma dos critérios ligados, mostrada em % do máximo possível; empate aparece como empate
- Filtros principais vêm ligados; complementares vêm desligados (o usuário liga os que quiser)
- Gráficos: barras por local para cada filtro, com fundo nas faixas vermelha/amarela/verde, e ranking final

**Filtros principais** (✋ validar limites com a equipe)
| Critério | Filtro (medida) | Parâmetro do usuário | Verde | Amarelo | Vermelho | Base |
|---|---|---|---|---|---|---|
| Orientação dos painéis solares | % da potência ideal com o painel configurado (vs. painel que segue o Sol nos 2 eixos); mostra também a melhor orientação fixa para o local | painel (modo, inclinação, azimute) | ≥ 80% | 50–80% | < 50% | SLIM: painéis virados para oeste |
| Inclinação do módulo no pouso | Energia perdida com o módulo inclinado X° na pior direção | X° (padrão 15°) | ≤ 15% | 15–40% | > 40% | IM-1 e IM-2 tombaram |
| Inclinação do módulo no pouso | % do tempo com a Terra acima do convés inclinado (antena) | X° | ≥ 70% | 40–70% | < 40% | IM-1: apontamento da antena |
| Declividade do terreno | Luz que o chão inclinado recebe em relação ao chão plano (Sol acima do plano da encosta) | declividade e direção da encosta (padrão 10°, voltada para o polo) | ≥ 80% | 50–80% | < 50% | critérios de segurança Artemis |
| Temperatura e frio da cratera | Temperatura média no período (modelo radiativo com Sol e distância da Horizons) | altura da parede da cratera em graus (padrão 0°) | ≥ −50 °C | −50 a −120 °C | < −120 °C | IM-2: frio da cratera |
| Temperatura e frio da cratera | % do tempo abaixo de −150 °C | parede da cratera | ≤ 30% | 30–60% | > 60% | sobrevivência da eletrônica |
| Visibilidade da Terra (libração) | % do tempo com a Terra acima da máscara da antena | máscara (padrão 5°) | ≥ 60% | 30–60% | < 30% | Terra baixa = reflexo e perda de sinal (NASA) |
| Visibilidade da Terra (libração) | Maior apagão sem a Terra | máscara | ≤ 3 dias | 3–14 dias | > 14 dias | VIPER: ~2 semanas/mês sem Terra |

**Filtros complementares** (sugeridos; vêm desligados)
| Critério | Filtro (medida) | Verde | Amarelo | Vermelho | Base |
|---|---|---|---|---|---|
| Energia solar | Potência média (kW) com o painel configurado | ≥ 2,0 | 1,0–2,0 | < 1,0 | painel 10 m², 30% (máx. ~4,1 kW) |
| Tempo disponível | Maior período de luz seguido | ≥ 300 h | 100–300 h | < 100 h | Blue Ghost: 346 h |
| Duração da noite lunar | Maior escuridão seguida | ≤ 50 h | 50–100 h | > 100 h | VIPER aguenta até 50 h no escuro |
| Energia + comunicação juntas | % do tempo com Sol e Terra visíveis ao mesmo tempo | ≥ 50% | 25–50% | < 25% | gerar e transmitir dados ao mesmo tempo |
| Sombra do próprio módulo | Comprimento médio da sombra de um módulo de altura h quando há Sol (h padrão 4,8 m) | ≤ 20 m | 20–100 m | > 100 m | Athena: sombras fora da previsão no pouso |

Fora dos filtros (não vem da API): luz perdida pelo relevo real, altura do horizonte real, gelo, rochas, precisão do pouso. O relevo do Cesium continua só no cenário e na vista do chão.
Limitações a mostrar na tela: inclinação, declividade e parede da cratera são simulações com valores digitados (a API não mede o terreno); a temperatura é estimativa.

**Mapa da Lua inteira (estilo Lunaserv), em 3D e girável**
Método: a Horizons dá o ponto subsolar, o ponto sub-Terra e as distâncias (2 séries para a Lua inteira, `public/data/ephem/global.json`, 12 meses, passo 1 h). Com eles, a posição do Sol e da Terra em qualquer coordenada sai por geometria (`src/skyGeometry.js`), validada contra a Horizons nos 8 locais: erro máximo de 0,02°.
- [x] 8B.M1 Série global da Horizons (`scripts/precompute-global.mjs`) e geometria local + teste de validação
- [x] 8B.M2 Núcleo dos filtros (`src/analysisCore.js`): 5 critérios principais (8 filtros) + 5 complementares, classificação, modo Limites/Comparativo, pontuação + testes
- [x] 8B.M3 Mapa na Lua inteira: grade 1° × 0,5° (polos) calculada em Web Workers (~5 s) e pintada como camada sobre o globo 3D, com transparência
- [x] 8B.M4 Cartão "Filtros na Lua": liga/desliga, limites editáveis, parâmetros de simulação, valores no ponto do cenário, melhor painel fixo, ranking dos locais e marcadores coloridos (Apollo como referência)
- [x] 8B.M4b Critério "Relevo e sombras (relevo real)" no ranking dos locais: horas de Sol perdidas atrás do relevo e altura máxima do horizonte, usando os perfis do Cesium Moon/LOLA já calculados (caixa liga/desliga); no mapa da Lua inteira fica "sem dado"
- [ ] 8B.M5 Relevo 3D (Cesium Moon) não desenha a camada colorida: com o mapa ligado a superfície troca para Moon Trek e volta ao desligar (investigar depois)
- [ ] 8B.M6 Gráficos de barras por filtro e ranking na janela de comparação; colunas novas no CSV

**Microtarefas**
- [x] 8B.1 Métricas a partir das séries da Horizons: maior período de luz, maior escuridão, maior apagão da Terra, % Sol + Terra juntos, % Terra acima da máscara, temperatura média e % abaixo de −150 °C + testes
- [x] 8B.2 Painéis: % da potência ideal e busca da melhor orientação fixa (inclinação e azimute) + testes
- [x] 8B.3 Módulo inclinado X°: perda de energia e Terra acima do convés na pior direção + testes
- [x] 8B.4 Encosta (declividade e direção): Sol acima do plano da encosta e luz relativa ao chão plano + testes
- [x] 8B.5 Parede da cratera (altura em graus) aplicada à temperatura; comprimento da sombra do módulo + testes
- [x] 8B.6 Modelo de filtros (`src/analysisCore.js`): limites, classificação, modo Limites/Comparativo, principais × complementares, pontuação com filtros ligados/desligados + testes
- [x] 8B.7 Cartão "Filtros na Lua": filtros com liga/desliga e limites editáveis, parâmetros (X°, encosta, parede, máscara, altura do módulo), botão de modo, legenda
- [ ] 8B.8 Gráficos de barras por filtro com faixas coloridas e ranking final (pontuação em %)
- [ ] 8B.9 Marcadores do globo pintados com a cor da pontuação; limites e parâmetros lembrados no navegador; colunas novas na tabela e no CSV
- [ ] 8B.10 ✋ Locais do polo sul novos (proposta: Shackleton (borda), Nobile (alvo do VIPER), Haworth, Connecting Ridge) com efemérides pré-calculadas
- [x] 8B.11 ✋ Apollo na análise: proposta = aparecem como referência em cinza, fora do ranking (sem filtro de gelo elas venceriam quase tudo por estarem no equador e de frente para a Terra)
- [ ] 8B.12 Textos PT/EN de cada filtro (o que mede, por que importa, missão de referência) e fontes no README
- [ ] 8B.13 (opcional, visual) Painel "Camadas" do Lunaserv no globo — iluminação %, sombra permanente, gelo, sombras na data — só para visualizar, não entra nos filtros

## Fase 8C — Filtros em tempo real e explicações
**Decisões**
- Dois modos, com botão: **Agora** (a Lua é pintada no instante da barra de tempo e muda enquanto ela anima: o Sol se põe, a energia cai, o local fica vermelho) e **Período** (resumo atual: médias e maiores intervalos)
- No modo Agora, filtros de período viram contagem regressiva: horas até o pôr do Sol, horas até o nascer do Sol, horas de contato restantes com a Terra
- Energia no modo Agora: % da potência máxima do painel (verde ≥ 50%, amarelo 10–50%, vermelho < 10%; sem Sol = vermelho)
- Velocidade: prévia rápida (grade mais grossa) enquanto anima ou arrasta, e versão nítida quando para
- Explicação de cada filtro: frase curta sempre visível + botão "?" com detalhes (como é calculado, por que importa, missão de referência) + desenho do filtro + filtro em destaque no mapa com legenda dos valores
- Valores de um ponto da Lua: ao clicar no globo (sem caixinha ao passar o mouse)

**Microtarefas**
- [x] 8C.1 Valores instantâneos de cada filtro e contagens regressivas (`src/analysisCore.js`) + testes
- [x] 8C.2 Mapa com prévia rápida + refino (período e instante)
- [x] 8C.3 Modo Agora ligado à barra de tempo (anima junto) e parâmetros com controles deslizantes ao vivo
- [x] 8C.4 Frase curta, botão "?" com detalhes e desenho de cada filtro (PT/EN)
- [x] 8C.5 Filtro em destaque: clicar no nome mostra só aquele filtro no mapa, com legenda dos valores
- [x] 8C.6 Clicar num ponto da Lua mostra os valores daquele ponto no cartão
- [x] 8C.7 Animação lisa: ao ligar o mapa no modo Agora, todos os instantes do período são pré-calculados (~10 s, até 360 quadros, classes empacotadas em 2 bits por filtro); durante o ▶ cada quadro só é decodificado e desenhado numa casca fina sobre a Lua (~20+ quadros/s). Ao pausar, volta a versão nítida. No modo de cores Comparativo a animação usa a prévia ao vivo

## Fase 9 — Modo educativo
- [ ] 9.1 Cartões de explicação curtos (PT/EN) ao lado de cada métrica (ícone "?")
- [ ] 9.2 Tour inicial de 4 a 6 passos na primeira visita
- [ ] 9.3 Cartões sobre por que o polo sul é difícil (Sol rasante, crateras em sombra, Terra baixa no céu)
- [ ] 9.4 Ficha da missão ao clicar num ponto do globo: janela com fotos e explicação da missão daquele local (PT/EN)
  - Conteúdo: ficha rápida (datas, tripulação/operador, tempo na superfície, amostras), resumo curto, como foi, pontos positivos e negativos, fontes — base em `apollo-missoes-resumos.md` e `PROBLEMAS PRINCIPAIS DAS MISSOES.md` da equipe
  - Missões com problema ligadas aos filtros: o que deu errado (energia, relevo e sombras, comunicação, tempo) e qual filtro do app mostra isso (ex.: IM-2 → relevo e sombras)
  - Fotos: galeria de 2 a 4 imagens por missão, com crédito e link da fonte em cada foto; prioridade a imagens da NASA (domínio público). Imagens de JAXA, ISRO e empresas (Intuitive Machines, Firefly) só com licença que permita uso, senão link para a página oficial
  - ✋ Validar com a equipe a lista de fotos e conferir os números marcados "(conferir)" antes de publicar
  - Botões na ficha: "Carregar cenário deste local" e "Ver do chão"

## Fase 10 — Publicação e acabamento
- [ ] 10.1 Build de produção e teste local da versão final
- [x] 10.2 ✋ Conectar o repositório GitHub à Vercel e configurar o token do Cesium nas variáveis da Vercel
- [x] 10.3 Testar o link público (globo, tabela, API ao vivo, CSV, idiomas)
- [ ] 10.4 Ajustes visuais, responsividade em tela menor e textos finais
- [ ] 10.5 Roteiro curto de demonstração para a apresentação do hackathon

---

## Fora do escopo da v1 (só se sobrar tempo)
- Panoramas reais das missões Apollo
- Detalhes históricos completos das missões
- Missões de outros países
- Relevo LOLA de alta resolução fora dos sítios escolhidos
