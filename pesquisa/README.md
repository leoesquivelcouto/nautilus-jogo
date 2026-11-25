# Pesquisa de balanceamento

O Nautilus foi balanceado com simulação antes de ir para a mesa. Esta pasta guarda o simulador usado para sair da versão 4 das regras e chegar à versão 5, e os resultados brutos das rodadas de teste.

## O simulador

Node puro, sem dependências. Ele monta um mapa de 70 hexágonos com as 6 bordas, usa os baralhos reais (50 baús, 50 naufrágios, 30 artefatos, 30 maldições) e joga partidas completas: turnos, pesca, comércio, combate, saque, maldições, a Virada e o fim de jogo.

Cada jogador automático decide pelo valor esperado em ouro de cada ação. Para testar estratégias, há perfis fixos: pescador, caçador de baús, agressivo e esqueleto cedo.

A medida de equilíbrio é a **força**: a taxa de vitória de uma estratégia ou posição dividida pela taxa justa. 100 significa chance igual.

| Arquivo | O que faz |
|---|---|
| `data.js`, `data_v5.js` | Cartas e regras da v4 e da v5 |
| `engine.js`, `engine2.js` | Motor da v4 e da v5 (com bots, Maré Negra, roubo de artefato, afundar e renascer) |
| `run.js`, `run2.js` | Rodadas completas de simulação com relatório em JSON |
| `variants.js`, `variantes2.js`, `variantes3.js` | Testes de variantes de regra, uma mudança por vez |
| `exp.js`, `exp2.js` | Peso de cada carta: a mesma partida com e sem a carta |
| `assento.js`, `assento2.js` | Vantagem por posição na ordem de turno e os peixes de compensação |
| `combate_testes.js` | Variantes de combate e roubo de artefato |
| `mapa_*.js` | Validação e ajuste do mapa fixo e das posições iniciais |
| `*.json`, `*.jsonl` | Resultados brutos das rodadas de teste |

## Como rodar

```bash
cd pesquisa/simulador
node run2.js padrao 200     # 200 partidas por número de jogadores (2 a 6), regras v5
node exp2.js                # efeito de cada artefato e maldição
```

O relatório traz, por número de jogadores: rodadas e minutos estimados, vitórias por posição, quando e por que aconteceu a Virada, estatísticas de combate, economia (de onde veio o ouro) e de onde vieram os artefatos.

## Principais conclusões

- **Duração**: com as regras v5, a mediana é de 13 a 15 rodadas, cerca de 58 minutos com 4 jogadores e 73 com 6.
- **Primeiro jogador**: sem compensação, vencia de 5 a 9 pontos percentuais acima do justo. A tabela de peixes de compensação deixa todas as posições a no máximo 2 pontos.
- **Cartas**: a Pérola da Fortuna dava 84% de vitória a quem a tirava cedo, contra 43% de um artefato sem efeito. O texto foi reescrito.
- **Produção**: o pico de recursos em circulação com 6 jogadores definiu as quantidades de cada carta, e a caixa caiu de 378 para 333 cartas.

O jogo do navegador (`web/src/engine.js` e `bots.js`) segue as mesmas regras. Os testes em `tests/` rodam partidas inteiras com ele a cada envio ao repositório.
