const E = require("./engine2"); const { batch } = require("./run2");
const N = 2000;
for (const P of [2, 3, 4, 5, 6]) {
  for (const [nome, sf] of [["atual", [0, 0, 0, 0, 0, 0]], ["0/1/2/3/4/5 peixes", [0, 1, 2, 3, 4, 5]]]) {
    E.RULES.seatFish = sf; const R = batch(() => Array(P).fill(1), P, N, 3131);
    const w = R.winSeat.map((x) => (100 * x) / N); const fair = 100 / P;
    console.log(`${P}p ${nome.padEnd(20)} ` + w.map((x) => x.toFixed(0) + "%").join(" / ") + `  | maior desvio do justo (${fair.toFixed(0)}%): ${Math.max(...w.map((x) => Math.abs(x - fair))).toFixed(1)} pts`);
  }
}
E.RULES.seatFish = [0, 0, 0, 0, 0, 0];
