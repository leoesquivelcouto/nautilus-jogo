const E = require("./engine2"); const F = require("./mapa_fixo");
const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s[Math.floor(x * (s.length - 1))]; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function run(fixed, P, N, s0) {
  E.RULES.fixedMap = fixed;
  const st = { rounds: [], min: [], win: {}, pres: {}, att: [], acts: {}, siteUse: {}, curses: [] };
  for (let g = 0; g < N; g++) {
    const G = E.play(Array(P).fill(1), s0 + g * 7919);
    st.rounds.push(G.round); st.min.push(G.minutes); st.att.push(G.st.attacks.length); st.curses.push(G.st.curses);
    for (const p of G.players) { st.pres[p.start] = (st.pres[p.start] || 0) + 1; }
    if (G.winner) st.win[G.winner.start] = (st.win[G.winner.start] || 0) + 1;
    for (const k in G.st.actions) st.acts[k] = (st.acts[k] || 0) + G.st.actions[k];
  }
  E.RULES.fixedMap = null;
  return st;
}
const N = +(process.argv[2] || 3000);
for (const P of [3, 4, 6]) {
  const st = run(F, P, N, 4040 + P);
  const force = Object.fromEntries(Object.keys(st.pres).sort().map((k) => [k, Math.round(((st.win[k] || 0) / st.pres[k]) * P * 100)]));
  console.log(`${P}p mapa impresso | rodadas ${q(st.rounds, .5)} (${q(st.rounds, .1)}-${q(st.rounds, .9)}) | min ${Math.round(q(st.min, .5))} | ataques ${mean(st.att).toFixed(2)} | maldicoes ${mean(st.curses).toFixed(1)} | força por ponto de partida ${JSON.stringify(force)}`);
  console.log("   acoes/jogo", JSON.stringify(Object.fromEntries(Object.entries(st.acts).map(([k, v]) => [k, +(v / N).toFixed(1)]))));
}
// distâncias (em passos navegáveis) de cada início até os locais-chave, mapa impresso
E.RULES.fixedMap = F;
const G = E.play([1, 1, 1, 1, 1, 1], 1); const M = G.map;
function bfs(src) { const d = new Array(M.length).fill(Infinity); d[src] = 0; const qq = [src]; while (qq.length) { const c = qq.shift(); for (const n of M[c].edges) if (d[n] === Infinity) { d[n] = d[c] + 1; qq.push(n); } } return d; }
const near = (d, pred) => Math.min(...M.filter((h) => h.nav && pred(h)).map((h) => d[h.id]));
const adjT = (t) => (h) => h.nb.some((n) => M[n].t === t);
console.log("\nDistância (hexágonos) de cada início até o local mais próximo:");
for (const h of M.filter((x) => x.vertex)) {
  const d = bfs(h.id);
  console.log(h.startName.padEnd(3), `(${h.t})`, "Pedra", Math.min(near(d, adjT("pedra")), near(d, (x) => x.sides.includes("ul"))), "| ilha", near(d, adjT("ilha")), "| cemitério", near(d, adjT("cemiterio")), "| comércio", Math.min(near(d, adjT("comercio")), near(d, (x) => x.sides.includes("lr"))), "| taverna", near(d, (x) => x.sides.includes("ur")), "| altar", near(d, adjT("altar")), "| mar", near(d, (x) => x.t === "mar"));
}
E.RULES.fixedMap = null;
