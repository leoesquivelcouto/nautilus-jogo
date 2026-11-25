const { runVariant } = require("./run"); const V = require("./variants");
const q = (a, x) => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(x * (s.length - 1))]; };
for (const [n, R] of [["K", V.K], ["K marcadores min 4", Object.assign({}, V.K, { markersPerSite: (p) => Math.max(4, p) })]]) for (const P of [2, 3]) {
  const r = runVariant(R, 300, P); const wr = {}; for (const s in r.playStrat) wr[s] = Math.round(((r.winStrat[s] || 0) / r.playStrat[s]) * P * 100);
  console.log(n, P + "p rodadas", q(r.rounds, .5), "(" + q(r.rounds, .1) + "-" + q(r.rounds, .9) + ")", JSON.stringify(wr), "baus/jogo", (r.st.baus / 300).toFixed(1)); }
