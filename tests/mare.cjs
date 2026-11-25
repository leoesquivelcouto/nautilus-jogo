// Executar com: node tests/mare.cjs [N]
// Em que rodada sai o k-ésimo artefato do baralho? Serve para trocar a Maré Negra (rodada 8) por uma carta no baralho de artefatos.
// node teste/mare.js N
const fs = require("fs"), path = require("path"), vm = require("vm");
global.window = global;
for (const f of ["data.js", "engine.js", "bots.js"]) vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "web", "src", f), "utf8"), { filename: f });
const E = NT.E;
E.ui = { log() {}, async anim() {}, async ask() {}, update() {}, async turnStart() {}, async humanTurn() {}, save() {}, async gameOver() {} };
const N = +(process.argv[2] || 200);
(async () => {
  for (const P of [2, 3, 4, 5, 6]) {
    const draws = {}; // k -> lista de rodadas
    const giveOrig = E.giveArt;
    for (let g = 0; g < N; g++) {
      const ps = Array.from({ length: P }, (_, i) => ({ name: "B" + i, diff: ["medio", "dificil", "medio", "facil", "medio", "dificil"][(i + g) % 6], color: "#fff" }));
      const G = E.newGame({ players: ps }); G.autoplay = true;
      let k = 0;
      E.giveArt = async function (G2, p, src) { if (G2 === G && G2.decks.art.length) { k++; (draws[k] = draws[k] || []).push(G2.round); } return giveOrig.call(this, G2, p, src); };
      await E.run(G);
      E.giveArt = giveOrig;
    }
    const med = (a) => { if (!a || a.length < N * 0.5) return "—"; const s = a.slice().sort((x, y) => x - y); return `${s[s.length >> 1]} (${s[Math.floor(s.length * 0.1)]}–${s[Math.floor(s.length * 0.9)]})`; };
    const line = [];
    for (const k of [P, Math.round(1.5 * P), 2 * P, Math.round(2.5 * P), 3 * P]) line.push(`${k}º artefato: rodada ${med(draws[k])}`);
    console.log(`${P} jogadores | ${line.join(" | ")}`);
  }
})();
