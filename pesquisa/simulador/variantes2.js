const E = require("./engine2"); const { batch } = require("./run2");
const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s[Math.floor(x * (s.length - 1))]; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const base = JSON.parse(JSON.stringify({ lootPerDie: E.RULES.lootPerDie, damageByWinner: E.RULES.damageByWinner, seatFish: E.RULES.seatFish }));
function withRules(o, fn) { Object.assign(E.RULES, o); const r = fn(); Object.assign(E.RULES, base); return r; }
const N = 800;
console.log("== COMPENSAÇÃO DE ASSENTO (4 jogadores, bots equilibrados) — vitórias por assento");
for (const [nome, sf] of [["regra atual", [0, 0, 0, 0]], ["peixes iniciais 0/1/2/3", [0, 1, 2, 3]], ["peixes iniciais 0/1/1/2", [0, 1, 1, 2]], ["peixes iniciais 0/2/3/4", [0, 2, 3, 4]]]) {
  const R = withRules({ seatFish: sf.concat([0, 0]) }, () => batch(() => [1, 1, 1, 1], 4, 2000, 4242));
  console.log(nome.padEnd(26), R.winSeat.map((w) => Math.round((100 * w) / 2000) + "%").join(" / "), "rodadas", q(R.rounds, 0.5));
}
console.log("\n== VARIANTES DE COMBATE (4 jogadores)");
for (const [nome, o] of [["regra atual", {}], ["saque = 2 cartas por dado", { lootPerDie: 2 }], ["dano = dados do vencedor", { damageByWinner: true }], ["as duas juntas", { lootPerDie: 2, damageByWinner: true }]]) {
  const mix = [0, 1, 1, 2];
  const T = withRules(o, () => batch((g) => mix.map((_, i) => mix[(i + g) % 4]), 4, N, 99));
  const wr = {}; for (const a in T.presAggr) wr[a] = Math.round(((T.winAggr[a] || 0) / T.presAggr[a]) * 400);
  const S = withRules(o, () => batch(() => [1, 1, 1, 1], 4, N, 7));
  const def1 = S.att.length ? Math.round((100 * S.att.filter((a) => a.d === 1).length) / S.att.length) : 0;
  const pir = (S.att.filter((a) => !a.attSkel).length / N).toFixed(2), esq = (S.att.filter((a) => a.attSkel).length / N).toFixed(2);
  console.log(nome.padEnd(28), "força pacífico/equilibrado/agressivo:", wr[0] + "/" + wr[1] + "/" + wr[2], "| ataques por jogo (pirata/esqueleto):", pir + "/" + esq, "| defensor usa 1 dado:", def1 + "%", "| afundamentos:", mean(S.sinks).toFixed(2), "| rodadas:", q(S.rounds, 0.5), "| min:", Math.round(q(S.minutes, 0.5)));
}
