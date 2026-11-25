const E = require("./engine2");
const seed = +(process.argv[2] || 7), aggr = JSON.parse(process.argv[3] || "[1,1,1,1]");
for (let r = 1; r <= 40; r++) {
  const RR = E.RULES.maxRounds; E.RULES.maxRounds = r; const G = E.play(aggr, seed); E.RULES.maxRounds = RR;
  const at = G.st.attacks.filter((a) => a.round === r).map((a) => `${a.k}v${a.d}:${a.result}${a.sink ? "!AFUNDOU" : ""}`).join(",");
  console.log(`R${String(r).padStart(2)} ${G.virada ? "V" : " "} ` + G.players.map((p) => `${p.skel ? "E" : "P"}c${p.crew}${p.wounded ? "w" + p.wounded : ""} a${p.arts.length} o${p.res.ouro} f${p.res.peixe} r${p.res.rum} p${p.res.polvora} l${p.res.lona} s${p.res.concha}${p.atk ? " +" + p.atk : ""}${p.curses.length ? " M" + p.curses.length : ""}`).join(" | ") + (at ? "  ATQ " + at : "") + (G.winner ? `  VENCEU j${G.winner.id} (${G.winType}) ${G.minutes.toFixed(0)}min` : ""));
  if (G.winner) { console.log("acoes", JSON.stringify(G.st.actions), "artes", JSON.stringify(G.st.artSrc)); break; }
}
