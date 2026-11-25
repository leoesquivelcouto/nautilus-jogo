const E = require("./engine2"); const { batch } = require("./run2");
const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s[Math.floor(x * (s.length - 1))]; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const N = 1000;
for (const [nome, o] of [["regra atual", { artSteal: false }], ["roubo de artefato pelo atacante", { artSteal: true }]]) {
  Object.assign(E.RULES, o);
  const mix = [0, 1, 1, 2];
  const T = batch((g) => mix.map((_, i) => mix[(i + g) % 4]), 4, N, 99);
  const wr = {}; for (const a in T.presAggr) wr[a] = Math.round(((T.winAggr[a] || 0) / T.presAggr[a]) * 400);
  const S = batch(() => [1, 1, 1, 1], 4, N, 7);
  console.log(nome.padEnd(32), "força pacífico/equilibrado/agressivo:", wr[0] + "/" + wr[1] + "/" + wr[2],
    "| ataques/jogo pirata/esqueleto:", (S.att.filter((a) => !a.attSkel).length / N).toFixed(2) + "/" + (S.att.filter((a) => a.attSkel).length / N).toFixed(2),
    "| artefatos tomados/jogo:", (((S.artSrc.combate || 0) + (S.artSrc.afundar || 0)) / N).toFixed(2),
    "| líder da rodada 7 vence:", Math.round((100 * S.leaderAt8Wins) / S.leaderAt8N) + "%",
    "| rodadas:", q(S.rounds, 0.5), "(" + q(S.rounds, 0.1) + "-" + q(S.rounds, 0.9) + ")", "| min:", Math.round(q(S.minutes, 0.5)));
}
Object.assign(E.RULES, { artSteal: false });
