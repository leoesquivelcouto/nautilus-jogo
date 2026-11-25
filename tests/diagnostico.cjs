// Executar com: node tests/diagnostico.cjs [N]
// Mede quais regras e lojas realmente entram em jogo (node teste/diagnostico.js N)
const fs = require("fs"), path = require("path"), vm = require("vm");
global.window = global;
for (const f of ["data.js", "engine.js", "bots.js"]) vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "web", "src", f), "utf8"), { filename: f });
const E = NT.E;
const ops = {}; let discards = 0, curseNow = 0, cursePerm = 0;
E.ui = {
  log(G, msg, kind) {
    if (kind === "shop") { const m = msg.match(/\(([^()]+)\)\.$/); const k = (m ? m[1] : "?") + ": " + msg.replace(/^\S+ \S* ?/, "").replace(/\([^()]+\)\.$/, "").replace(/\d+/g, "n").trim(); ops[k] = (ops[k] || 0) + 1; }
    if (/devolve ao pote/.test(msg)) discards++;
  },
  async anim() {}, async ask() {}, update() {}, async turnStart() {}, async humanTurn() {}, save() {}, async gameOver() {},
};
(async () => {
  const N = +(process.argv[2] || 200);
  const cause = {}, rounds = [], r4 = [], from = {}, firstArt = []; let ties = 0, atk = 0, lead7 = 0, lead7n = 0, altar = 0, skelEarly = 0;
  for (let g = 0; g < N; g++) {
    const ps = [0, 1, 2, 3].map((i) => ({ name: "B" + i, diff: ["medio", "medio", "dificil", "medio"][(i + g) % 4], color: "#fff" }));
    const G = E.newGame({ players: ps }); G.autoplay = true;
    await E.run(G);
    rounds.push(G.round); cause[G.viradaCause || "sem virada"] = (cause[G.viradaCause || "sem virada"] || 0) + 1;
    ties += G.stats.ties; atk += G.stats.attacks;
    const h = G.hist;
    if (h[7]) { const m = Math.max(...h[7]); const L = h[7].map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0); if (L.length === 1) { lead7n++; if (L[0] === G.winner) lead7++; } }
    for (let r = 1; r < h.length; r++) if (h[r] && Math.max(...h[r]) >= 4) { r4.push(r); break; }
    for (let r = 1; r < h.length; r++) if (h[r] && Math.max(...h[r]) >= 1) { firstArt.push(r); break; }
    for (const k in G.stats.artFrom) from[k] = (from[k] || 0) + G.stats.artFrom[k];
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  console.log(`partidas ${N} (4 jogadores) | fim na rodada (mediana) ${med(rounds)} | 1º artefato na rodada ${med(firstArt)} | alguém com 4 artefatos na rodada ${med(r4)}`);
  console.log(`virada por: ${JSON.stringify(cause)} | ataques/partida ${(atk / N).toFixed(1)} | empates ${((100 * ties) / atk).toFixed(0)}% dos ataques | líder sozinho na rodada 7 vence ${((100 * lead7) / lead7n).toFixed(0)}%`);
  console.log(`artefatos vieram de: ${JSON.stringify(from)} | descartes por limite de mão ${(discards / N).toFixed(1)}/partida`);
  console.log("operações de loja por partida:");
  for (const [k, v] of Object.entries(ops).sort((a, b) => b[1] - a[1])) console.log(`  ${(v / N).toFixed(2).padStart(6)}  ${k}`);
})();
