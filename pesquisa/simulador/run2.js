// Simulação completa v5 com bots. Uso: node run2.js <padrao|torneio> [N]
const E = require("./engine2");
const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s.length ? s[Math.floor(x * (s.length - 1))] : null; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "-");

function batch(aggrsFn, P, N, s0 = 1) {
  const R = { rounds: [], minutes: [], turns: [], winSeat: Array(P).fill(0), winAggr: {}, presAggr: {}, winType: {}, virada: [], viradaCause: {}, voluntary: [], att: [], sinks: [], crewDead: [], actions: {}, artSrc: {}, curses: [], curseSrc: { aguas: 0, bau: 0 }, fishGold: [], chestVal: [], steal: [], stealDef: [], waste: [], crewBought: [], atkBought: [], firstArt: [], leaderAt8Wins: 0, leaderAt8N: 0, gamesNoAttack: 0, deckEmpty: 0, games: N };
  for (let g = 0; g < N; g++) {
    const ag = aggrsFn(g); const G = E.play(ag, s0 + g * 7919 + P * 13);
    R.rounds.push(G.round); R.minutes.push(G.minutes); R.turns.push(G.st.turns);
    if (G.winner) { R.winSeat[G.winner.seat]++; R.winAggr[G.winner.aggr] = (R.winAggr[G.winner.aggr] || 0) + 1; R.winType[G.winType] = (R.winType[G.winType] || 0) + 1; }
    for (const a of ag) R.presAggr[a] = (R.presAggr[a] || 0) + 1;
    if (G.virada) { R.virada.push(G.virada); R.viradaCause[G.viradaCause] = (R.viradaCause[G.viradaCause] || 0) + 1; }
    R.voluntary.push(...G.st.voluntary);
    R.att.push(...G.st.attacks); if (!G.st.attacks.length) R.gamesNoAttack++;
    R.sinks.push(G.st.sinks); R.crewDead.push(G.st.crewDead);
    for (const k in G.st.actions) R.actions[k] = (R.actions[k] || 0) + G.st.actions[k];
    for (const k in G.st.artSrc) R.artSrc[k] = (R.artSrc[k] || 0) + G.st.artSrc[k];
    R.curses.push(G.st.curses); R.curseSrc.aguas += G.st.curseSrc.aguas; R.curseSrc.bau += G.st.curseSrc.bau;
    R.fishGold.push(G.st.fishGold); R.chestVal.push(G.st.chestVal); R.steal.push(G.st.stealVal); R.stealDef.push(G.st.stealValDef); R.waste.push(G.st.waste);
    R.crewBought.push(G.st.crewBought); R.atkBought.push(G.st.atkBought); if (G.st.firstArtRound) R.firstArt.push(G.st.firstArtRound);
    if (G.st.leaderAt8 && G.winner) { R.leaderAt8N++; if (G.st.leaderAt8.includes(G.winner.id)) R.leaderAt8Wins++; }
    if (G.st.artDeckEmpty) R.deckEmpty++;
  }
  return R;
}

function summary(R, P) {
  const N = R.games, A = R.att, n = A.length;
  const by = (f) => A.filter(f).length;
  const res = (arr) => ({ n: arr.length, por_jogo: +(arr.length / N).toFixed(2), atacante_vence: pct(arr.filter((a) => a.result === "atacante").length, arr.length), defensor_vence: pct(arr.filter((a) => a.result === "defensor").length, arr.length), empate: pct(arr.filter((a) => a.result === "empate").length, arr.length), ancora: pct(arr.filter((a) => a.result === "ancora").length, arr.length) });
  const wins = A.filter((a) => a.result === "atacante"), losses = A.filter((a) => a.result === "defensor");
  return {
    jogadores: P, partidas: N,
    rodadas: { mediana: q(R.rounds, 0.5), p10: q(R.rounds, 0.1), p90: q(R.rounds, 0.9) },
    turnos_totais_mediana: q(R.turns, 0.5),
    minutos: { mediana: Math.round(q(R.minutes, 0.5)), p10: Math.round(q(R.minutes, 0.1)), p90: Math.round(q(R.minutes, 0.9)) },
    vitoria_por: R.winType, vitoria_por_assento: R.winSeat.map((w) => pct(w, N)),
    virada: { rodada_mediana: q(R.virada, 0.5), causa: R.viradaCause, transformacoes_voluntarias_por_jogo: +(R.voluntary.length / N).toFixed(2), rodada_mediana_voluntaria: q(R.voluntary, 0.5) },
    combate: {
      total: res(A), era_pirata: res(A.filter((a) => !a.attSkel)), era_esqueleto: res(A.filter((a) => a.attSkel)), partidas_sem_ataque: pct(R.gamesNoAttack, N),
      dados_atacante: [1, 2, 3].map((k) => pct(by((a) => a.k === k), n)), dados_defensor: [1, 2, 3].map((k) => pct(by((a) => a.d === k), n)),
      saque_medio_quando_atacante_vence: +mean(wins.map((a) => a.stolenVal)).toFixed(1), perda_media_quando_atacante_perde: +mean(losses.map((a) => a.stolenVal)).toFixed(1),
      ataques_ao_lider: pct(by((a) => a.leader), n), contra_esqueleto_sem_tripulante: pct(by((a) => a.defSkel && a.sink !== undefined && a.sink), n),
      afundamentos_por_jogo: +mean(R.sinks).toFixed(2), artefatos_tomados_por_jogo: +((R.artSrc.afundar || 0) / N).toFixed(2), tripulantes_mortos_por_jogo: +mean(R.crewDead).toFixed(1),
    },
    economia_por_jogo: { ouro_pesca: Math.round(mean(R.fishGold)), valor_baus_naufragios: Math.round(mean(R.chestVal)), valor_roubado_por_atacantes: +mean(R.steal).toFixed(1), valor_roubado_por_defensores: +mean(R.stealDef).toFixed(1), desperdicio_limite_12: +mean(R.waste).toFixed(1), tripulantes_comprados: +mean(R.crewBought).toFixed(1), bonus_ataque_comprados: +mean(R.atkBought).toFixed(1), maldicoes: +mean(R.curses).toFixed(1), maldicoes_origem: R.curseSrc },
    artefatos: { origem_por_jogo: Object.fromEntries(Object.entries(R.artSrc).map(([k, v]) => [k, +(v / N).toFixed(1)])), primeiro_na_rodada: q(R.firstArt, 0.5), lider_ao_fim_da_rodada_7_vence: pct(R.leaderAt8Wins, R.leaderAt8N), baralho_esgotou: pct(R.deckEmpty, N) },
    acoes_por_jogo: Object.fromEntries(Object.entries(R.actions).map(([k, v]) => [k, +(v / N).toFixed(1)])),
  };
}

if (require.main === module) {
  const mode = process.argv[2] || "padrao", N = +(process.argv[3] || 1000);
  if (mode === "padrao") for (const P of [2, 3, 4, 5, 6]) console.log(JSON.stringify(summary(batch(() => Array(P).fill(1), P, N), P)));
  if (mode === "torneio") {
    for (const mix of [[0, 1, 1, 2], [0, 0, 2, 2], [1, 1, 1, 2], [1, 1, 1, 0]]) {
      const P = 4; const R = batch((g) => mix.map((_, i) => mix[(i + g) % 4]), P, N, 99);
      const wr = {}; for (const a in R.presAggr) wr["agress_" + a] = Math.round(((R.winAggr[a] || 0) / R.presAggr[a]) * P * 100);
      console.log(JSON.stringify({ mesa: mix, forca_100_justo: wr, rodadas: q(R.rounds, 0.5), ataques_por_jogo: +(R.att.length / N).toFixed(2), afundamentos: +mean(R.sinks).toFixed(2) }));
    }
    for (const a of [0, 1, 2]) { const R = batch(() => [a, a, a, a], 4, N, 555); console.log(JSON.stringify({ mesa_toda_agress: a, rodadas: q(R.rounds, 0.5), minutos: Math.round(q(R.minutes, 0.5)), ataques_por_jogo: +(R.att.length / N).toFixed(2), afundamentos: +mean(R.sinks).toFixed(2) })); }
  }
}
module.exports = { batch, summary };
