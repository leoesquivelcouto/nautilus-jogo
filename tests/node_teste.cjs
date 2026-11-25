// Executar com: node tests/node_teste.cjs [N]
// Roda partidas só com bots no Node para testar o motor (node teste/node_teste.js N)
const fs = require("fs"), path = require("path"), vm = require("vm");
global.window = global; global.NT = undefined;
for (const f of ["data.js", "engine.js", "bots.js"]) vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "web", "src", f), "utf8"), { filename: f });
const E = NT.E;
let errs = 0;
E.ui = { log() {}, async anim() {}, async ask() { throw new Error("ask humano"); }, update() {}, async turnStart() {}, async humanTurn() {}, save() {}, async gameOver() {} };
const N = +(process.argv[2] || 200);
const res = { rounds: [], winDiff: {}, presDiff: {}, attacks: 0, sinks: 0, steals: 0, trades: 0, types: {}, virada: [], artFrom: {}, turnsNoAct: 0 };
(async () => {
  for (let g = 0; g < N; g++) {
    const P = 2 + (g % 5);
    const diffs = ["facil", "medio", "dificil"];
    const players = Array.from({ length: P }, (_, i) => ({ name: "Bot" + i, human: false, diff: diffs[(g + i) % 3], color: NT.CORES[i].c }));
    const G = E.newGame({ players, mapMode: g % 4 === 0 ? "impresso" : "aleatorio" });
    G.autoplay = true; G.botDelay = 0;
    try { await E.run(G); } catch (e) { errs++; if (errs < 4) console.error("ERRO", e.stack); continue; }
    res.rounds.push(G.round);
    const w = G.players[G.winner]; res.winDiff[w.diff] = (res.winDiff[w.diff] || 0) + 1;
    for (const p of G.players) res.presDiff[p.diff] = (res.presDiff[p.diff] || 0) + 1;
    res.attacks += G.stats.attacks; res.sinks += G.stats.sinks; res.steals += G.stats.artSteals; res.trades += G.stats.trades;
    res.types[G.winType] = (res.types[G.winType] || 0) + 1; res.virada.push(G.viradaRound);
    for (const k in G.stats.artFrom) res.artFrom[k] = (res.artFrom[k] || 0) + G.stats.artFrom[k];
  }
  const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s[Math.floor(x * (s.length - 1))]; };
  console.log("erros", errs, "| partidas", res.rounds.length, "| rodadas med", q(res.rounds, .5), "p10", q(res.rounds, .1), "p90", q(res.rounds, .9));
  console.log("vitorias por dificuldade (100=justo)", Object.fromEntries(Object.keys(res.presDiff).map((k) => [k, ((res.winDiff[k] || 0) / res.presDiff[k] * 100 / (res.rounds.length / res.rounds.length)).toFixed(0) ])));
  console.log("tipos", JSON.stringify(res.types), "| ataques/jogo", (res.attacks / N).toFixed(2), "| afund", (res.sinks / N).toFixed(2), "| roubos art", (res.steals / N).toFixed(2), "| virada med", q(res.virada, .5), "| artefatos de", JSON.stringify(res.artFrom));
  if (errs) process.exitCode = 1; // falha no CI se alguma partida quebrar
})();
