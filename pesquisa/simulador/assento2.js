const E = require("./engine2"); const { batch } = require("./run2");
const N = 3000;
for (const [P, opts] of [[3, [[0, 1, 2], [0, 2, 3], [0, 1, 3]]], [6, [[0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 3, 4], [0, 1, 2, 2, 3, 4], [0, 1, 1, 2, 3, 4]]]]) {
  for (const sf of opts) {
    E.RULES.seatFish = sf.concat([0, 0, 0]); const R = batch(() => Array(P).fill(1), P, N, 5151);
    const w = R.winSeat.map((x) => (100 * x) / N); const fair = 100 / P;
    console.log(`${P}p ${sf.join("/").padEnd(14)} ` + w.map((x) => x.toFixed(0) + "%").join(" / ") + `  | maior desvio: ${Math.max(...w.map((x) => Math.abs(x - fair))).toFixed(1)} pts`);
  }
}
E.RULES.seatFish = [0, 0, 0, 0, 0, 0];
