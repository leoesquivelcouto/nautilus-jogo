const E = require("./engine2"); const F = require("./mapa_fixo");
const clone = (f) => ({ ...f, LINHAS: f.LINHAS.map((r) => r.slice()) });
function force(fixed, P, N, s0) {
  E.RULES.fixedMap = fixed; const win = {}, pres = {}; let nada = 0, rounds = [];
  for (let g = 0; g < N; g++) { const G = E.play(Array(P).fill(1), s0 + g * 7919); for (const p of G.players) pres[p.start] = (pres[p.start] || 0) + 1; if (G.winner) win[G.winner.start] = (win[G.winner.start] || 0) + 1; nada += G.st.actions.nada; rounds.push(G.round); }
  E.RULES.fixedMap = null; rounds.sort((a, b) => a - b);
  const f = Object.fromEntries(Object.keys(pres).sort().map((k) => [k, Math.round(((win[k] || 0) / pres[k]) * P * 100)]));
  const vals = Object.values(f); return { f, spread: Math.max(...vals) - Math.min(...vals), nada: +(nada / N).toFixed(1), rodadas: rounds[rounds.length >> 1] };
}
const V = {};
V["mapa impresso"] = F;
{ const m = clone(F); m.LINHAS[4][1] = "mar"; m.LINHAS[5][6] = "pedra"; V["Pedra (linha 5) movida para o sudeste"] = m; }
{ const m = clone(F); m.LINHAS[4][1] = "mar"; m.LINHAS[5][6] = "pedra"; m.LINHAS[1][1] = "comercio"; V["+ 6º comércio no noroeste"] = m; }
{ const m = clone(F); m.LINHAS[4][1] = "mar"; m.LINHAS[4][7] = "pedra"; V["Pedra (linha 5) movida para o leste"] = m; }
for (const [n, m] of Object.entries(V)) for (const P of [4, 6]) { const r = force(m, P, 3000, 777 + P); console.log(n.padEnd(40), P + "p", "força", JSON.stringify(r.f), "| diferença máx", r.spread, "| turnos sem ação", r.nada, "| rodadas", r.rodadas); }
