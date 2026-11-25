const E = require("./engine");
// monkeypatch: roda e imprime estado ao fim de cada rodada
const R = Object.assign({}, E.V4, { maxRounds: 1 });
const { play } = E;
const strats = ["pescador","cacador","agressivo","esqueleto"];
for (let r = 1; r <= 12; r++) {
  const G = play(Object.assign({}, E.V4, { maxRounds: r }), strats, 4242);
  console.log("R" + r, G.players.map(p => `${p.strat[0]}:${p.skel?"E":"P"} c${p.crew}${p.wounded?"w"+p.wounded:""} art${p.arts.length} ${JSON.stringify(p.res).replace(/"|\{|\}/g,"")}`).join(" | "), G.winner ? "WIN " + G.winner.strat : "");
}
const G = play(E.V4, strats, 4242); console.log(G.st);
