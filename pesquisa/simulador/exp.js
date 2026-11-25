// Experimento: dá um artefato (rodada 1) ou maldição (rodada 4) ao jogador 0 e mede a taxa de vitória dele.
const { play } = require("./engine"); const V = require("./variants");
const S = ["pescador", "cacador", "agressivo", "esqueleto"];
const N = +(process.argv[2] || 1500); const base = process.argv[3] ? V[process.argv[3]] : V.v5;
const extra = process.argv[4] ? JSON.parse(process.argv[4]) : {};
function rate(gift) {
  const R = Object.assign({}, base, extra, { gift }); let w = 0, rounds = 0;
  for (let g = 0; g < N; g++) { const st = [0, 1, 2, 3].map((i) => S[(g + i) % 4]); const G = play(R, st, 77 + g * 7919); if (G.winner && G.winner.id === 0) w++; rounds += G.round; }
  return [w / N, rounds / N];
}
const arts = ["nada", "ancora", "bandeira", "bolsa", "bussola", "gancho", "saque", "reforcos", "casco1", "casco2", "coroa", "proa", "olhoAbismo", "perola", "rede", "reliquia", "selo", "ultimo"];
const curses = ["nenhuma", "banana", "conchaOcupada", "luaSangue", "albatroz", "santelmo", "assobio", "bolsoFurado", "espelho", "gatoPreto", "mapaRasgado", "peEsquerdo", "peixesPodres", "ratos", "rumAguado", "sexta13"];
const out = { arts: {}, curses: {} };
const [b] = rate({ round: 1, art: "nada" });
for (const a of arts) { const [r, rd] = rate({ round: 1, art: a }); out.arts[a] = { vitoria: +(100 * r).toFixed(1), efeito: +(100 * (r - b)).toFixed(1), rodadas: +rd.toFixed(1) }; }
const [bc] = rate({ round: 4 });
for (const c of curses) { const [r] = rate(c === "nenhuma" ? { round: 4 } : { round: 4, curse: c }); out.curses[c] = { vitoria: +(100 * r).toFixed(1), efeito: +(100 * (r - bc)).toFixed(1) }; }
console.log(JSON.stringify(out));
