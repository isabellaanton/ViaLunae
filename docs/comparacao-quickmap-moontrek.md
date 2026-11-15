# ViaLunae × Quickmap × Moon Trek

Comparação do ViaLunae (Fases 8B, 8C, 8D e 9) com as duas ferramentas da NASA indicadas no desafio:

- **Quickmap (LROC):** https://quickmap.lroc.im-ldi.com/
- **Moon Trek (JPL):** https://trek.nasa.gov/moon/

> As linhas marcadas com 🆕 mudaram desde a primeira comparação. O que está escrito sobre o Quickmap e o Moon Trek se baseia no que eles oferecem publicamente; vale conferir rapidamente antes do pitch.

Legenda: ✅ atende · ⚠️ atende em parte · ❌ não atende

## Comparação pelos objetivos do desafio

| Objetivo do desafio | Quickmap (LROC) | Moon Trek (JPL) | **ViaLunae** |
|---|---|---|---|
| Locais famosos ou coordenada livre | ✅ busca, pontos e camadas | ✅ busca e marcadores | ✅ 8 locais e coordenada livre, mas **lista curta** |
| Comparar locais lado a lado | ❌ um ponto por vez | ❌ | ✅ **tabela de N cenários, ranking por filtros, CSV** |
| Escolher data e hora | ⚠️ só para iluminação visual | ⚠️ para iluminação e sombras | ✅ data e período de até 365 dias |
| Sol e Terra em relação ao horizonte | ⚠️ Sol para sombreamento | ⚠️ ângulo do Sol | ✅ **panorama do horizonte com Sol e Terra, vista do chão** |
| Tempo até o pôr do Sol / da Terra | ❌ | ❌ | ✅ **contagens regressivas** |
| Energia e comunicação | ❌ dados brutos | ❌ | ✅ **kW, energia, % de Sol, janelas com a Terra, atraso do sinal** |
| Visualização 2D e 3D | ✅ 2D e 3D | ✅ 2D, 3D, VR, impressão 3D | ✅ globo 3D, mapa colorido da Lua inteira, gráficos |
| Animação no tempo | ⚠️ limitada | ⚠️ limitada | ✅ **cores mudando em tempo real (cerca de 22 quadros/s)** |
| Relevo real (LOLA), sem refração | ✅ DEMs de alta resolução | ✅ DEMs | ⚠️ horizonte real nos locais; 🆕 **perfil e inclinação no relevo real**; o mapa global ainda é de Lua lisa |
| Libração e órbita | ❌ | ❌ | ✅ vem da Horizons |
| Para leigos e educadores | ❌ para especialistas | ⚠️ técnico | ✅ 🆕 **tour, 25 botões "?", fichas de missão com fotos, cartão do polo sul, PT/EN** |
| 🆕 Camadas científicas | ✅ **dezenas** | ✅ **muitas** | ⚠️ **7 camadas**: inclinação, rochas, temperatura, sombra permanente, iluminação, gelo, temperatura polar |
| 🆕 Ferramentas de medida | ✅ distância, perfil, área e outras | ✅ distância, perfil, área, ângulo do Sol | ✅ **distância, perfil, área e inclinação** (+ "usar na simulação") |

**O que mudou desde a primeira comparação:** as duas linhas que eram ❌ (camadas e medidas) agora estão cobertas, e a parte educativa ficou bem mais forte.

## O que só o ViaLunae tem

1. **Responde à pergunta do desafio num clique:** local + data → Sol, Terra, energia e comunicação.
2. **Comparação de cenários** com ranking e CSV, para quando a missão atrasa.
3. **Janelas com a Terra e contagens regressivas** até o pôr do Sol e até perder a Terra.
4. **Energia em kW** com painel configurável, melhor orientação fixa e perda com o módulo inclinado.
5. **Lua inteira pintada por filtros** que viram pontuação, animada no tempo.
6. **Vista do chão** com o horizonte real, o Sol e a Terra.
7. **Fichas de missões reais** (Apollo, IM-1, IM-2) ligando cada falha ao filtro que a revela.
8. 🆕 **Inclinação medida que vira parâmetro da simulação:** mede o chão e já recalcula os filtros.

## Onde a NASA ainda é melhor

- **Quantidade de camadas** (dezenas contra 7) e **resolução** (DEMs de metros no polo sul).
- **Relevo em todo lugar:** no ViaLunae, o mapa da Lua inteira não usa relevo real.
- **Camadas e relevo ao mesmo tempo:** no ViaLunae, camadas e mapa de filtros só aparecem na imagem plana (Moon Trek).
- **Extras do Moon Trek:** VR, impressão 3D, sobrevoos.

## Melhorias que continuam valendo (por impacto no desafio)

1. **Calendário das melhores datas** para um local: responde direto ao cenário de atraso de missão e nenhuma das duas ferramentas faz isso.
2. **Locais próximos alternativos** num raio de X km.
3. **Mais locais:** CLPS (Blue Ghost, Nobile/VIPER), regiões do Artemis, SLIM, Chandrayaan-3, Chang'e.
4. **Gráficos por filtro e colunas novas no CSV.**
5. **Relevo real numa região do polo sul** no mapa de filtros (Mons Mouton e Shackleton).
6. **Camadas sobre o relevo 3D**, sem trocar para Moon Trek.
7. **Link compartilhável** com o cenário e os filtros.
8. **Celular, desempenho e roteiro do pitch** (Fase 10).
