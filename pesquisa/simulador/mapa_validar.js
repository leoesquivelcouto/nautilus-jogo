const E = require("./engine2"); const F = require("./mapa_fixo");
const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s[Math.floor(x * (s.length - 1))]; };
const SETS = {
  "atuais (cantos)": F.INICIOS,
  "propostos": { NO: [0, 1], NE: [1, 6], O: [2, 0], L: [4, 9], SO: [8, 0], SE: [6, 7] },
};
for (const [nome, ini] of Object.entries(SETS)) for (const P of [3, 4, 6]) {
  E.RULES.fixedMap = { ...F, INICIOS: ini };
  const N = 3000, win = {}, pres = {}, rounds = [], min = [], seat = Array(P).fill(0); let att = 0, nada = 0;
  for (let g = 0; g < N; g++) { const G = E.play(Array(P).fill(1), 31337 + g * 7919); for (const p of G.players) pres[p.start] = (pres[p.start] || 0) + 1; if (G.winner) { win[G.winner.start] = (win[G.winner.start] || 0) + 1; seat[G.winner.seat]++; } rounds.push(G.round); min.push(G.minutes); att += G.st.attacks.length; nada += G.st.actions.nada; }
  const f = Object.fromEntries(Object.keys(pres).sort().map((k) => [k, Math.round(((win[k] || 0) / pres[k]) * P * 100)]));
  const v = Object.values(f);
  console.log(nome.padEnd(16), P + "p", JSON.stringify(f), "| diferença", Math.max(...v) - Math.min(...v), "| assentos", seat.map((x) => Math.round(100 * x / N) + "%").join("/"), "| rodadas", q(rounds, .5), "(" + q(rounds, .1) + "-" + q(rounds, .9) + ") | min", Math.round(q(min, .5)), "(p90 " + Math.round(q(min, .9)) + ") | ataques", (att / N).toFixed(1), "| turnos parados", (nada / N).toFixed(1));
}
E.RULES.fixedMap = null;
