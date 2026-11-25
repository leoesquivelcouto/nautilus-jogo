const { runVariant } = require("./run"); const { V4 } = require("./engine"); const V = require("./variants");
const names = process.argv.slice(2); const N = 300;
const q = (a, x) => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(x * (s.length - 1))]; };
for (const n of names) { const R = n === "v4" ? V4 : V[n]; console.log("== " + R.name);
  for (const P of [4, 6]) { const r = runVariant(R, N, P); const wr = {}; for (const s in r.playStrat) wr[s] = Math.round(((r.winStrat[s] || 0) / r.playStrat[s]) * P * 100);
    const st = {}; for (const k in r.st) st[k] = +(r.st[k] / N).toFixed(1);
    console.log(` ${P}p rodadas ${q(r.rounds,.5)} (${q(r.rounds,.1)}-${q(r.rounds,.9)}) | forca ${JSON.stringify(wr)} | atq ${st.attacks} mortes ${st.kills} | art pedra/bau/kill ${st.artPedra}/${st.artBau}/${st.artKill} | ouro peixe ${st.goldFish} bau+nauf ${st.goldBau} | trip comprados ${st.crewBought} | maldicoes ${st.curses} | sem vencedor ${r.timeouts}`); } }
