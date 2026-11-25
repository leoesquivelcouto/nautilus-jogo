// Executar com: node tests/mare_comparar.cjs [N]
// Compara Maré Negra por rodada (v5) com a carta Maré Negra no baralho de artefatos. node teste/mare_comparar.js N
const fs = require("fs"), path = require("path"), vm = require("vm");
global.window = global;
for (const f of ["data.js", "engine.js", "bots.js"]) vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "web", "src", f), "utf8"), { filename: f });
const E = NT.E;
E.ui = { log() {}, async anim() {}, async ask() {}, update() {}, async turnStart() {}, async humanTurn() {}, save() {}, async gameOver() {} };
const N = +(process.argv[2] || 200);
const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s[Math.floor(x * (s.length - 1))]; };
const CONF = { "rodada 8 (v5)": { mareRound: 8, mareCard: 0 }, "carta após 2/jogador": { mareRound: 0, mareCard: 2 }, "carta após 3/jogador": { mareRound: 0, mareCard: 3 } };
(async () => {
  for (const P of [2, 4, 6]) {
    for (const [nome, rules] of Object.entries(CONF)) {
      const rounds = [], vir = [], seatWin = Array(P).fill(0); let semVirada = 0, porBau = 0, lead = 0, leadN = 0;
      for (let g = 0; g < N; g++) {
        const ps = Array.from({ length: P }, (_, i) => ({ name: "B" + i, diff: "medio", color: "#fff" }));
        const G = E.newGame({ players: ps, rules }); G.autoplay = true;
        await E.run(G);
        rounds.push(G.round);
        if (!G.virada) semVirada++; else { vir.push(G.viradaRound); if (G.viradaCause === "baus") porBau++; }
        seatWin[G.order.indexOf(G.winner)]++;
        const h = G.hist; if (h[7]) { const m = Math.max(...h[7]); const L = h[7].map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0); if (L.length === 1) { leadN++; if (L[0] === G.winner) lead++; } }
      }
      const fair = 100 / P, seat = seatWin.map((w) => Math.round(((w / N) * 100 - fair) * 10) / 10).join(" / ");
      console.log(`${P}J | ${nome.padEnd(22)} | fim rodada ${q(rounds, 0.5)} (${q(rounds, 0.1)}–${q(rounds, 0.9)}) | Virada rodada ${vir.length ? `${q(vir, 0.5)} (${q(vir, 0.1)}–${q(vir, 0.9)})` : "—"} | sem Virada ${Math.round((100 * semVirada) / N)}% | por baús ${Math.round((100 * porBau) / N)}% | líder da rodada 7 vence ${leadN ? Math.round((100 * lead) / leadN) : "—"}% | vantagem por posição (pontos %) ${seat}`);
    }
  }
})();
