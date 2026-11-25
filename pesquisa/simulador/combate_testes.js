// Bateria de testes de combate (com peixes de compensação já aplicados).
const E = require("./engine2");
const q = (a, x) => { const s = a.slice().sort((p, r) => p - r); return s[Math.floor(x * (s.length - 1))]; };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const SEAT = { 3: [0, 1, 3], 4: [0, 1, 2, 3], 6: [0, 1, 2, 3, 3, 4] };
const VARS = [
  ["Regra atual", {}],
  ["Toma 1 artefato de quem tem mais", { artSteal: true, artStealMode: "mais" }],
  ["Toma só do líder da mesa", { artSteal: true, artStealMode: "lider" }],
  ["Toma só se atacou com 3 dados", { artSteal: true, artStealMode: "3dados" }],
  ["Toma só de esqueletos", { artSteal: true, artStealMode: "esqueleto" }],
  ["Toma de quem tem mais + dano pelo vencedor", { artSteal: true, artStealMode: "mais", damageByWinner: true }],
];
const BASE = { artSteal: false, artStealMode: "mais", damageByWinner: false, lootPerDie: 1 };
function run(P, aggrFn, N, s0) {
  const out = { rounds: [], min: [], att: [], attP: 0, attE: 0, stolen: 0, sinks: 0, winSeat: Array(P).fill(0), winAg: {}, presAg: {}, lead7: 0, lead7n: 0, winCombat: 0, def1: 0, seatDev: 0 };
  for (let g = 0; g < N; g++) {
    const ag = aggrFn(g); const G = E.play(ag, s0 + g * 7919 + P);
    out.rounds.push(G.round); out.min.push(G.minutes);
    for (const a of G.st.attacks) { if (a.attSkel) out.attE++; else out.attP++; if (a.d === 1) out.def1++; }
    out.att.push(G.st.attacks.length); out.stolen += (G.st.artSrc.combate || 0) + (G.st.artSrc.afundar || 0); out.sinks += G.st.sinks;
    if (G.winner) { out.winSeat[G.winner.seat]++; out.winAg[G.winner.aggr] = (out.winAg[G.winner.aggr] || 0) + 1; }
    for (const a of ag) out.presAg[a] = (out.presAg[a] || 0) + 1;
    if (G.st.leaderAt8 && G.winner) { out.lead7n++; if (G.st.leaderAt8.includes(G.winner.id)) out.lead7++; }
    if (G.st.winCombat) out.winCombat++;
  }
  return out;
}
const rows = [];
for (const [nome, o] of VARS) for (const P of [3, 4, 6]) {
  Object.assign(E.RULES, BASE, o, { seatFish: SEAT[P].concat([0, 0, 0]) });
  const N = 1000;
  const S = run(P, () => Array(P).fill(1), N, 777);
  const mix = P === 3 ? [0, 1, 2] : P === 4 ? [0, 1, 1, 2] : [0, 0, 1, 1, 2, 2];
  const T = run(P, (g) => mix.map((_, i) => mix[(i + g) % P]), N, 999);
  const force = (a) => T.presAg[a] ? Math.round(((T.winAg[a] || 0) / T.presAg[a]) * P * 100) : "-";
  const totAtt = S.attP + S.attE;
  const seat = S.winSeat.map((w) => Math.round((100 * w) / N));
  rows.push({ regra: nome, jogadores: P, rodadas: q(S.rounds, 0.5), rodadas_p90: q(S.rounds, 0.9), minutos: Math.round(q(S.min, 0.5)), minutos_p90: Math.round(q(S.min, 0.9)),
    ataques_pirata: +(S.attP / N).toFixed(2), ataques_esqueleto: +(S.attE / N).toFixed(2), artefatos_tomados: +(S.stolen / N).toFixed(2),
    vitoria_decidida_em_combate: Math.round((100 * S.winCombat) / N) + "%", lider_rodada7_vence: Math.round((100 * S.lead7) / S.lead7n) + "%",
    defensor_1_dado: totAtt ? Math.round((100 * S.def1) / totAtt) + "%" : "-", forca_pacifico: force(0), forca_equilibrado: force(1), forca_agressivo: force(2), vitorias_por_assento: seat.join("/") });
  console.log(JSON.stringify(rows.at(-1)));
}
Object.assign(E.RULES, BASE, { seatFish: [0, 0, 0, 0, 0, 0] });
require("fs").writeFileSync("combate_testes.json", JSON.stringify(rows, null, 1));
