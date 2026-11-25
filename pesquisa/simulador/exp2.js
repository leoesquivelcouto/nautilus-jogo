const { play } = require("./engine"); const V = require("./variants");
const S = ["pescador", "cacador", "agressivo", "esqueleto"]; const N = 1500;
function rate(R) { let w = 0; for (let g = 0; g < N; g++) { const st = [0, 1, 2, 3].map((i) => S[(g + i) % 4]); const G = play(R, st, 77 + g * 7919); if (G.winner && G.winner.id === 0) w++; } return 100 * w / N; }
const base = rate(Object.assign({}, V.v5, { gift: { round: 1, art: "nada" } }));
const tests = [
  ["Pérola atual (+1 ouro todo turno)", "perola", {}],
  ["Pérola: +1 ouro só quando pescar", "perola", { perola: "pesca" }],
  ["Pérola: +1 ouro a cada 2 turnos", "perola", { perola: "cada2" }],
  ["Reforços atual (+3 tripulantes)", "reforcos", {}],
  ["Reforços: +2 tripulantes", "reforcos", { reforcosN: 2 }],
  ["Reforços: +1 tripulante", "reforcos", { reforcosN: 1 }],
  ["Bolsa atual (5 suprimentos)", "bolsa", {}],
  ["Bolsa: 3 suprimentos", "bolsa", { bolsaN: 3 }],
  ["Bolsa: 2 suprimentos", "bolsa", { bolsaN: 2 }],
  ["Coroa atual (+1 do material)", "coroa", {}],
  ["Coroa: +1 ouro por carta com recurso", "coroa", { coroa: "ouro" }],
];
console.log("base (artefato sem efeito):", base.toFixed(1));
for (const [n, a, o] of tests) console.log(n.padEnd(40), "efeito", (rate(Object.assign({}, V.v5, o, { gift: { round: 1, art: a } })) - base).toFixed(1));
