// Executar com: node tests/dificuldade.cjs [N]
// Mede ataques e vitórias por dificuldade (node teste/dificuldade.js N)
const fs = require("fs"), path = require("path"), vm = require("vm");
global.window = global;
for (const f of ["data.js", "engine.js", "bots.js"]) vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "web", "src", f), "utf8"), { filename: f });
const E = NT.E;
E.ui = { log() {}, async anim() {}, async ask() {}, update() {}, async turnStart() {}, async humanTurn() {}, save() {}, async gameOver() {} };
const N = +(process.argv[2] || 150);
(async () => {
  for (const mesa of [["facil", "facil", "facil", "facil"], ["medio", "medio", "medio", "medio"], ["dificil", "dificil", "dificil", "dificil"], ["facil", "medio", "dificil", "medio"]]) {
    const at = {}, win = {}, pres = {}, rounds = []; let atk = 0, sinks = 0, steals = 0;
    for (let g = 0; g < N; g++) {
      const ps = mesa.map((d, i) => ({ name: "B" + i, diff: mesa[(i + g) % 4], color: "#fff" }));
      const G = E.newGame({ players: ps }); G.autoplay = true;
      await E.run(G);
      rounds.push(G.round); atk += G.stats.attacks; sinks += G.stats.sinks; steals += G.stats.artSteals;
      for (const p of G.players) { at[p.diff] = (at[p.diff] || 0) + p.st.attacks; pres[p.diff] = (pres[p.diff] || 0) + 1; }
      const w = G.players[G.winner]; win[w.diff] = (win[w.diff] || 0) + 1;
    }
    rounds.sort((a, b) => a - b);
    console.log(mesa.join("/").padEnd(28), "rodadas", rounds[N >> 1], "| ataques/jogo", (atk / N).toFixed(2), "| afund", (sinks / N).toFixed(2), "| roubos", (steals / N).toFixed(2),
      "| ataques por jogador", JSON.stringify(Object.fromEntries(Object.keys(at).map((k) => [k, (at[k] / pres[k]).toFixed(2)]))), "| força", JSON.stringify(Object.fromEntries(Object.keys(pres).map((k) => [k, Math.round(((win[k] || 0) / pres[k]) * 400)]))));
  }
})();
