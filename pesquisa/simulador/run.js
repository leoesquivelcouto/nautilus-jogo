// Uso: node run.js <variante> [jogos]
const { V4, play } = require("./engine");
const VARIANTS = require("./variants");

const STRATS = ["pescador", "cacador", "agressivo", "esqueleto"];
function pct(a, b) { return b ? ((100 * a) / b).toFixed(0) + "%" : "-"; }
function quant(arr, q) { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; }

function runVariant(R, N, players) {
  const res = { rounds: [], winType: {}, winStrat: {}, playStrat: {}, virada: 0, viradaRound: [], st: {}, timeouts: 0, eliminated: 0, endSkel: 0 };
  for (let g = 0; g < N; g++) {
    const strats = []; for (let i = 0; i < players; i++) strats.push(STRATS[(g + i) % 4]);
    const G = play(R, strats, 1000 + g * 7919 + players);
    res.rounds.push(G.round);
    for (const s of strats) res.playStrat[s] = (res.playStrat[s] || 0) + 1;
    if (G.winner) { res.winType[G.winType] = (res.winType[G.winType] || 0) + 1; res.winStrat[G.winner.strat] = (res.winStrat[G.winner.strat] || 0) + 1; }
    else res.timeouts++;
    if (G.virada) { res.virada++; res.viradaRound.push(G.virada); }
    res.eliminated += G.players.filter((p) => !p.alive).length;
    for (const k in G.st) res.st[k] = (res.st[k] || 0) + G.st[k];
  }
  return res;
}

function report(R, N) {
  const out = [];
  for (const P of [4, 5, 6]) {
    const r = runVariant(R, N, P);
    const st = {}; for (const k in r.st) st[k] = +(r.st[k] / N).toFixed(1);
    // taxa de vitória normalizada: vitórias / presenças * jogadores
    const wr = {}; for (const s of STRATS) wr[s] = r.playStrat[s] ? (((r.winStrat[s] || 0) / r.playStrat[s]) * P * 100).toFixed(0) : "-";
    out.push({ P, rodadas_med: quant(r.rounds, 0.5), p10: quant(r.rounds, 0.1), p90: quant(r.rounds, 0.9), sem_vencedor: pct(r.timeouts, N), virada: pct(r.virada, N),
      virada_rodada: r.viradaRound.length ? quant(r.viradaRound, 0.5) : "-", vitoria: r.winType, eliminados_por_jogo: (r.eliminated / N).toFixed(2), forca_estrategia_100_justo: wr, por_jogo: st });
  }
  return out;
}

if (require.main === module) {
  const name = process.argv[2] || "v4"; const N = +(process.argv[3] || 400);
  const R = name === "v4" ? V4 : VARIANTS[name];
  console.log("=== " + R.name + " ===");
  for (const o of report(R, N)) console.log(JSON.stringify(o));
}
module.exports = { report, runVariant };
