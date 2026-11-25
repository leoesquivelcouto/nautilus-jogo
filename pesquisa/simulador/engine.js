// Simulador do Nautilus: mapa real de 70 hexágonos, baralhos reais, jogadores automáticos.
const D = require("./data");

// ---------- RNG ----------
let seed = 1;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function setSeed(s) { seed = s >>> 0 || 1; }
const ri = (n) => Math.floor(rnd() * n);
const d6 = () => 1 + ri(6);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function expand(list) { const out = []; for (const e of list) for (let i = 0; i < e[0]; i++) out.push(e.slice(1)); return out; }

// ---------- REGRAS ----------
const V4 = {
  name: "v4 (atual)",
  startCrew: 1, startSpeed: 2, maxCrew: 7, maxSpeedBonus: 2, maxAtk: 3, handLimit: 12,
  fishPerCrew: 1, fishToGold: 2,
  conchaCost: 3,            // Pedra: 3 ouros -> 1 concha
  artCost: (n) => 1,        // Pedra: 1 ouro + 1 concha -> artefato (n = artefatos já comprados na Pedra)
  artPerTurn: 99,           // artefatos por visita
  crewTav: { lona: 1, rum: 1 }, crewCom: { ouro: 2, lona: 1, rum: 1 },
  atkTav: { rum: 1, polvora: 1 }, atkCom: { ouro: 5, rum: 1, polvora: 1 }, atkValue: 1,
  spdCom: { ouro: 3, lona: 1, polvora: 1 },
  sell4: 3, buySupply: 3,
  transformCost: 3, capelaCost: 7,
  viradaRound: null,        // rodada em que a Virada acontece de qualquer jeito (Maré Negra)
  survivalWin: true, respawn: false,
  markersPerSite: (p) => p,
  baus: D.BAUS, naufragios: D.NAUFRAGIOS,
  maxRounds: 150,
  winArtifacts: 5,
};

// ---------- MAPA ----------
const ROWS = [6, 7, 8, 9, 10, 9, 8, 7, 6];
function buildMap() {
  for (let tries = 0; tries < 500; tries++) {
    const hexes = []; const key = {};
    ROWS.forEach((L, r) => { for (let i = 0; i < L; i++) { const x = -(L - 1) + 2 * i; const h = { id: hexes.length, r, x, i, L }; key[x + "," + r] = h.id; hexes.push(h); } });
    for (const h of hexes) {
      h.nb = [];
      for (const [dx, dy] of [[2, 0], [-2, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const k = key[(h.x + dx) + "," + (h.r + dy)]; if (k !== undefined) h.nb.push(k); }
      h.sides = [];
      if (h.r === 0) h.sides.push("top");
      if (h.r === 8) h.sides.push("bottom");
      if (h.r <= 4 && h.i === 0) h.sides.push("ul");
      if (h.r <= 4 && h.i === h.L - 1) h.sides.push("ur");
      if (h.r >= 4 && h.i === 0) h.sides.push("ll");
      if (h.r >= 4 && h.i === h.L - 1) h.sides.push("lr");
      h.vertex = (h.r === 0 || h.r === 8 || h.r === 4) && (h.i === 0 || h.i === h.L - 1);
    }
    const tiles = [];
    const add = (t, n) => { for (let k = 0; k < n; k++) tiles.push(t); };
    add("mar", 32); add("maldita", 13); add("ilha", 4); add("cemiterio", 4); add("comercio", 6); add("pedra", 2); add("altar", 3);
    shuffle(tiles);
    let ti = 0;
    for (const h of hexes) h.t = h.vertex ? "inicio" : tiles[ti++];
    const nav = (h) => h.t === "mar" || h.t === "maldita" || h.t === "inicio";
    // conectividade
    const start = hexes.find(nav); const seen = new Set([start.id]); const q = [start.id];
    while (q.length) { const c = q.pop(); for (const n of hexes[c].nb) if (!seen.has(n) && nav(hexes[n])) { seen.add(n); q.push(n); } }
    // passagens tambem conectam topo e base
    const navCount = hexes.filter(nav).length;
    let ok = seen.size === navCount;
    for (const h of hexes) if (!nav(h) && !h.nb.some((n) => nav(hexes[n]))) ok = false;
    for (const s of ["top", "bottom", "ul", "ur", "ll", "lr"]) if (hexes.filter((h) => nav(h) && h.sides.includes(s)).length < 2) ok = false;
    if (!ok) continue;
    for (const h of hexes) h.nav = nav(h);
    return hexes;
  }
  throw new Error("mapa");
}

// ---------- JOGO ----------
function newGame(rules, strats) {
  const G = { R: rules, map: buildMap(), round: 0, log: [], st: { artPedra: 0, artBau: 0, artKill: 0, baus: 0, naufs: 0, attacks: 0, kills: 0, curses: 0, transformsVol: 0, goldFish: 0, goldBau: 0, crewBought: 0 } };
  const P = strats.length;
  G.baus = shuffle(expand(rules.baus)); G.naufs = shuffle(expand(rules.naufragios));
  G.arts = shuffle(expand(D.ARTEFATOS).map((a) => a[0])); G.curses = shuffle(expand(D.MALDICOES).map((a) => a[0]));
  G.sites = {};
  for (const h of G.map) if (h.t === "ilha" || h.t === "cemiterio") G.sites[h.id] = rules.markersPerSite(P);
  const starts = shuffle(G.map.filter((h) => h.vertex).map((h) => h.id));
  G.players = strats.map((s, i) => ({ id: i, strat: s, pos: starts[i], skel: false, alive: true, crew: rules.startCrew, wounded: 0, protect: false, woundRecoverAfter: false,
    spd: 0, atk: 0, res: { ouro: 0, peixe: 0, rum: 0, polvora: 0, lona: 0, concha: 0 }, arts: [], curses: [], extras: [], artBought: 0, skipMove: false }));
  return G;
}

const RES = ["ouro", "peixe", "rum", "polvora", "lona", "concha"];
const SUP = ["rum", "polvora", "lona"];
const hand = (p) => RES.reduce((s, k) => s + p.res[k], 0);
function gain(G, p, k, n) {
  if (n <= 0) return 0;
  const room = G.R.handLimit - hand(p);
  if (room >= n) { p.res[k] += n; return n; }
  // descarta o que vale menos para caber o que entra (peixe < suprimento < ouro < concha)
  p.res[k] += n;
  let over = hand(p) - G.R.handLimit;
  for (const d of ["peixe", "rum", "polvora", "lona", "ouro", "concha"]) { const t = Math.min(over, p.res[d]); p.res[d] -= t; over -= t; if (!over) break; }
  return n;
}
const hasArt = (p, a) => p.arts.some((x) => x.id === a && !x.used);
const permArt = (p, a) => p.arts.some((x) => x.id === a);
const hasCurse = (p, c) => p.curses.includes(c);
const avail = (p) => p.crew - p.wounded;
function speed(p) { let s = G_R.startSpeed + Math.min(p.spd, G_R.maxSpeedBonus) + (permArt(p, "proa") ? 1 : 0) - (hasCurse(p, "mapaRasgado") ? 1 : 0); return Math.max(1, s); }
let G_R = V4;

function checkWin(G, p) {
  if (p.arts.length >= G.R.winArtifacts && !G.winner) { G.winner = p; G.winType = "artefatos"; }
}
function giveArt(G, p, src, forced) {
  if (!G.arts.length) return false;
  if (forced) { const i = G.arts.indexOf(forced); if (i >= 0) G.arts.splice(i, 1); }
  const id = forced || G.arts.pop(); const a = { id, used: false }; p.arts.push(a);
  G.st[src] = (G.st[src] || 0) + 1;
  // efeitos imediatos usados na hora
  if (id === "reforcos") { p.crew = Math.min(G.R.maxCrew, p.crew + (G.R.reforcosN || 3)); a.used = true; }
  if (id === "bolsa") { gain(G, p, "rum", G.R.bolsaN || 5); a.used = true; }
  if (id === "saque") { // rouba todo rum ou pólvora (o que der mais)
    const best = SUP.map((k) => [k, G.players.reduce((s, o) => s + (o !== p && o.alive ? o.res[k] : 0), 0)]).sort((a, b) => b[1] - a[1])[0];
    if (best[1] > 0) { for (const o of G.players) if (o !== p && o.alive) { gain(G, p, best[0], o.res[best[0]]); o.res[best[0]] = 0; } a.used = true; }
  }
  checkWin(G, p);
  return true;
}
function drawCurse(G, p, forced) {
  if (p.skel || permArt(p, "reliquia")) return;
  if (p.extras.includes("amuleto")) { p.extras.splice(p.extras.indexOf("amuleto"), 1); return; }
  if (!G.curses.length) return;
  if (forced) { const i = G.curses.indexOf(forced); if (i >= 0) G.curses.splice(i, 1); }
  const c = forced || G.curses.pop(); G.st.curses++;
  const r = p.res;
  const paySup = (n) => { for (let i = 0; i < n; i++) { const k = SUP.filter((s) => r[s] > 0).sort((a, b) => r[b] - r[a])[0]; if (!k) return false; r[k]--; } return true; };
  switch (c) {
    case "banana": if (!paySup(1)) r.ouro = Math.max(0, r.ouro - 1); break;
    case "conchaOcupada": if (r.concha) r.concha--; else r.ouro = Math.max(0, r.ouro - (G.R.conchaOcupadaOuro || 5)); break;
    case "assobio": if (r.lona) r.lona = 0; else r.ouro = Math.max(0, r.ouro - 2); break;
    case "espelho": if (r.concha) r.concha--; else paySup(1); break;
    case "gatoPreto": r.ouro = Math.max(0, r.ouro - 2); break;
    case "peixesPodres": r.peixe = G.R.peixesMetade ? Math.floor(r.peixe / 2) : 0; break;
    case "ratos": if (p.crew >= 5) p.crew--; break;
    case "rumAguado": if (r.rum) r.rum = 0; else r.peixe = Math.max(0, r.peixe - 1); break;
    case "sexta13": p.skipMove = true; break;
    default: p.curses.push(c);
  }
}

// ---------- CAMINHOS ----------
function dijkstra(G, p) {
  const M = G.map; const N = M.length; const dist = new Array(N).fill(Infinity), steps = new Array(N).fill(Infinity), prev = new Array(N).fill(-1);
  const occ = new Set(G.players.filter((o) => o.alive && o !== p).map((o) => o.pos));
  dist[p.pos] = 0; steps[p.pos] = 0;
  const open = [p.pos]; const done = new Set();
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const c = open.splice(bi, 1)[0]; if (done.has(c)) continue; done.add(c);
    let nbs = M[c].nb.slice();
    if (M[c].sides.includes("top")) nbs = nbs.concat(M.filter((h) => h.sides.includes("bottom")).map((h) => h.id));
    if (M[c].sides.includes("bottom")) nbs = nbs.concat(M.filter((h) => h.sides.includes("top")).map((h) => h.id));
    for (const n of nbs) {
      const h = M[n]; if (!h.nav || occ.has(n)) continue;
      const w = 1 + (!p.skel && h.t === "maldita" ? 0.7 : 0);
      if (dist[c] + w < dist[n]) { dist[n] = dist[c] + w; steps[n] = steps[c] + 1; prev[n] = c; open.push(n); }
    }
  }
  return { dist, steps, prev };
}
function pathTo(dj, t) { const path = []; let c = t; while (dj.prev[c] !== -1) { path.unshift(c); c = dj.prev[c]; } return path; }

function targetsFor(G, p, goal) {
  const M = G.map; const out = [];
  const adjTo = (pred) => { for (const h of M) if (h.nav && h.nb.some((n) => pred(M[n]))) out.push(h.id); };
  const side = (s) => { for (const h of M) if (h.nav && h.sides.includes(s)) out.push(h.id); };
  switch (goal) {
    case "pesca": for (const h of M) if (h.t === (p.skel ? "maldita" : "mar")) out.push(h.id); break;
    case "bau": adjTo((h) => h.t === (p.skel ? "cemiterio" : "ilha") && G.sites[h.id] > 0); break;
    case "comercio": adjTo((h) => h.t === "comercio"); side("lr"); if (permArt(p, "selo")) out.push(p.pos); break;
    case "pedra": adjTo((h) => h.t === "pedra"); side("ul"); break;
    case "altar": adjTo((h) => h.t === "altar"); break;
    case "taverna": side("ur"); break;
    case "ossuario": side("lr"); break;
    case "capela": side("ll"); break;
  }
  return out;
}

// ---------- ECONOMIA ----------
const canPay = (p, c) => Object.keys(c).every((k) => p.res[k] >= c[k]);
const pay = (p, c) => { for (const k in c) p.res[k] -= c[k]; };
function artsAffordable(G, p) {
  let o = p.res.ouro + (G.R.pedraBuysFish ? Math.floor(p.res.peixe / G.R.fishToGold) : 0), c = p.res.concha, n = 0, b = p.arts.length;
  while (n < G.R.artPerTurn) {
    const cost = G.R.artCost(b);
    if (c >= 1 && o >= cost) { c--; o -= cost; n++; b++; }
    else if (o >= G.R.conchaCost + cost) { o -= G.R.conchaCost + cost; n++; b++; }
    else break;
  }
  return n;
}
function doPedra(G, p) {
  if (G.R.pedraBuysFish) { const g = Math.floor(p.res.peixe / G.R.fishToGold); p.res.peixe -= g * G.R.fishToGold; p.res.ouro += g; G.st.goldFish += g; }
  let n = 0;
  while (n < G.R.artPerTurn && artsAffordable(G, p) > 0) {
    if (!p.res.concha) { p.res.ouro -= G.R.conchaCost; p.res.concha++; }
    p.res.concha--; p.res.ouro -= G.R.artCost(p.arts.length); p.artBought++; n++;
    if (!giveArt(G, p, "artPedra")) break;
    if (G.winner) return;
  }
}
function doComercio(G, p) {
  const R = G.R;
  const fishGold = Math.floor(p.res.peixe / R.fishToGold); p.res.peixe -= fishGold * R.fishToGold; p.res.ouro += fishGold; G.st.goldFish += fishGold;
  // compra tripulante/velocidade/ataque quando sobra
  while (p.crew < (p.strat === "pescador" ? 5 : 3) && canPay(p, R.crewCom)) { pay(p, R.crewCom); p.crew++; G.st.crewBought++; }
  if (p.spd < R.maxSpeedBonus && canPay(p, R.spdCom) && p.strat !== "esqueleto") { pay(p, R.spdCom); p.spd++; }
  if (p.strat === "agressivo" && p.atk * R.atkValue < R.maxAtk && canPay(p, R.atkCom)) { pay(p, R.atkCom); p.atk++; }
  for (const s of SUP) while (p.res[s] >= 4) { p.res[s] -= 4; p.res.ouro += R.sell4; }
  if (p.res.ouro > R.handLimit) p.res.ouro = R.handLimit;
}
function doTaverna(G, p) {
  const R = G.R;
  while (p.crew < R.maxCrew && canPay(p, R.crewTav)) { pay(p, R.crewTav); p.crew++; G.st.crewBought++; }
  while (p.atk * R.atkValue < R.maxAtk && canPay(p, R.atkTav)) { pay(p, R.atkTav); p.atk++; }
}
function doFish(G, p) {
  let n = Math.max(1, (Math.max(0, avail(p)) + (G.R.fishBase || 0)) * G.R.fishPerCrew);
  if (hasCurse(p, "albatroz")) n = Math.max(1, n - 1);
  if (permArt(p, "rede")) n++;
  if (permArt(p, "perola") && G.R.perola === "pesca") gain(G, p, "ouro", 1);
  gain(G, p, "peixe", n);
}
function doChest(G, p, h) {
  const deck = p.skel ? G.naufs : G.baus; if (!deck.length) return;
  G.sites[h]--; let card = deck.pop();
  const bad = (c) => !Object.keys(c[1]).length || c[2].curse;
  if ((permArt(p, "olhoAbismo") || p.extras.includes("vigia")) && bad(card) && deck.length) {
    if (!permArt(p, "olhoAbismo")) p.extras.splice(p.extras.indexOf("vigia"), 1);
    deck.unshift(card); card = deck.pop();
  }
  G.st[p.skel ? "naufs" : "baus"]++;
  const [, res, fl] = card;
  let coroa = permArt(p, "coroa");
  if (coroa && G.R.coroa === "ouro" && Object.keys(res).length) { gain(G, p, "ouro", 1); coroa = false; }
  for (const k of RES) if (res[k]) { gain(G, p, k, res[k] + (coroa ? 1 : 0)); coroa = false; if (k === "ouro") G.st.goldBau += res[k]; }
  if (fl.curse) drawCurse(G, p);
  if (fl.eff === "crew1") { if (p.crew < G.R.maxCrew) p.crew++; else gain(G, p, "ouro", 3); }
  if (fl.eff) p.extras.push(fl.eff);
  if (res.art) giveArt(G, p, "artBau");
  if (!p.skel && Object.keys(G.sites).every((id) => G.map[id].t !== "ilha" || G.sites[id] === 0)) virada(G);
}
function virada(G) {
  if (G.virada) return; G.virada = G.round;
  for (const p of G.players) if (p.alive && !p.skel) transform(G, p);
}
function transform(G, p) { p.skel = true; p.wounded = 0; p.protect = false; p.curses = []; }

// ---------- COMBATE ----------
const pwCache = {};
function pWin(a, d, diff) {
  const k = a + "," + d + "," + diff; if (pwCache[k] !== undefined) return pwCache[k];
  let w = 0, l = 0; for (let i = 0; i < 4000; i++) { let ma = 0, md = 0; for (let j = 0; j < a; j++) ma = Math.max(ma, d6()); for (let j = 0; j < d; j++) md = Math.max(md, d6()); if (ma + diff > md) w++; else if (ma + diff < md) l++; }
  return (pwCache[k] = [w / 4000, l / 4000]);
}
function dice(p) { let n = avail(p) <= 0 ? 1 : Math.min(3, avail(p)); if (hasCurse(p, "santelmo")) n = Math.max(1, n - 1); return n; }
function atkBonus(G, p, opp, spend) {
  let b = Math.min(G.R.maxAtk, p.atk * G.R.atkValue);
  if (permArt(p, "ultimo") && p.crew === 0) b += 5;
  if (hasCurse(p, "peEsquerdo")) b -= 1;
  if (hasCurse(opp, "luaSangue")) b += 1;
  return b;
}
function defBonus(G, p, opp) {
  let b = 0;
  if (permArt(p, "casco2")) b = 2; else if (permArt(p, "casco1")) b = 1;
  if (permArt(p, "casco2") && permArt(p, "casco1")) b = 3;
  if (permArt(p, "ultimo") && p.crew === 0) b += 2;
  if (hasCurse(p, "peEsquerdo")) b -= 1;
  if (hasCurse(p, "luaSangue")) b -= 1;
  return b;
}
const attackable = (o) => o.alive && !(o.protect && !o.skel);
function evalAttack(G, p, o) {
  const a = dice(p), d = dice(o); const diff = atkBonus(G, p, o) - defBonus(G, o, p);
  const [w, l] = pWin(a, d, diff);
  const gainEV = w * Math.min(a, hand(o)) - l * Math.min(d, hand(p));
  const crewRisk = l * (p.skel ? Math.min(a, avail(p)) * 3 : 0.3 * Math.min(a, avail(p)));
  const killBonus = o.skel && o.crew === 0 ? w * (3 + o.arts.length * 4) : 0;
  return gainEV - crewRisk + killBonus;
}
function attack(G, p, o) {
  G.st.attacks++;
  if (hasArt(o, "ancora") && evalAttack(G, p, o) > 1) { o.arts.find((x) => x.id === "ancora" && !x.used).used = true; return; }
  const a = dice(p), d = dice(o);
  let ba = atkBonus(G, p, o), bd = defBonus(G, o, p);
  for (const one of ["bandeira", "gancho"]) if (hasArt(p, one)) { p.arts.find((x) => x.id === one && !x.used).used = true; ba += one === "bandeira" ? 4 : 3; break; }
  for (const [e, v] of [["combat2", 2], ["combat1", 1]]) { if (p.extras.includes(e)) { p.extras.splice(p.extras.indexOf(e), 1); ba += v; break; } }
  let ma = 0, md = 0; for (let j = 0; j < a; j++) ma = Math.max(ma, d6()); for (let j = 0; j < d; j++) md = Math.max(md, d6());
  if (p.extras.includes("reroll") && ma <= 3) { p.extras.splice(p.extras.indexOf("reroll"), 1); ma = 0; for (let j = 0; j < a; j++) ma = Math.max(ma, d6()); }
  const A = ma + ba, Dd = md + bd;
  if (A === Dd) return;
  const [win, lose, nWin, nLose] = A > Dd ? [p, o, a, d] : [o, p, d, a];
  // saque aleatório
  for (let k = 0; k < nWin; k++) {
    const pool = []; for (const r of RES) for (let i = 0; i < lose.res[r]; i++) pool.push(r);
    if (!pool.length) break; const r = pool[ri(pool.length)]; lose.res[r]--; gain(G, win, r, 1);
  }
  // dano
  if (!lose.skel) { const w = Math.min(nLose, avail(lose)); lose.wounded += w; if (lose.wounded > 0) { lose.protect = true; lose.woundRecoverAfter = lose === G.cur ? "next" : "this"; } }
  else {
    if (lose.crew > 0) lose.crew = Math.max(0, lose.crew - nLose);
    else eliminate(G, lose, win);
  }
}
function eliminate(G, lose, win) {
  G.st.kills++;
  if (G.R.respawn) {
    // afunda e volta: perde metade dos recursos, entrega 1 artefato ao vencedor
    if (lose.arts.length) { const a = lose.arts.splice(ri(lose.arts.length), 1)[0]; win.arts.push(a); G.st.artKill++; checkWin(G, win); }
    for (const r of RES) lose.res[r] = Math.floor(lose.res[r] / 2);
    lose.crew = 1; const free = G.map.filter((h) => h.vertex && !G.players.some((o) => o.alive && o.pos === h.id)); if (free.length) lose.pos = free[ri(free.length)].id;
    return;
  }
  lose.alive = false; for (const a of lose.arts) { win.arts.push(a); G.st.artKill++; } lose.arts = [];
  checkWin(G, win);
  const alive = G.players.filter((x) => x.alive);
  if (G.R.survivalWin && alive.length === 1 && !G.winner) { G.winner = alive[0]; G.winType = "sobrevivencia"; }
}

// ---------- IA ----------
function chooseGoal(G, p) {
  const R = G.R;
  if (p.strat === "pescador" && p.crew < 4 && canPay(p, R.crewCom)) return "comercio";
  if (artsAffordable(G, p) >= 1) return "pedra";
  if (!p.skel && p.strat === "esqueleto" && p.res.ouro >= R.transformCost) return "altar";
  if (p.crew < (p.strat === "agressivo" ? 7 : 5) && canPay(p, R.crewTav)) return "taverna";
  if (p.strat === "agressivo" && p.atk * R.atkValue < R.maxAtk && canPay(p, R.atkTav)) return "taverna";
  if (p.res.peixe >= 6 || hand(p) >= R.handLimit - 1 || SUP.some((s) => p.res[s] >= 4)) return "comercio";
  if (!p.skel && p.curses.length >= 2 && p.res.ouro >= R.capelaCost) return "capela";
  const chestsLeft = Object.keys(G.sites).some((id) => G.map[id].t === (p.skel ? "cemiterio" : "ilha") && G.sites[id] > 0);
  if (chestsLeft && p.strat !== "pescador") return "bau";
  if (chestsLeft && p.strat === "pescador" && rnd() < 0.3) return "bau";
  return "pesca";
}
function doActivity(G, p, goal, here) {
  const M = G.map;
  switch (goal) {
    case "pesca": if (M[here].t === (p.skel ? "maldita" : "mar")) { doFish(G, p); return true; } return false;
    case "bau": { const s = M[here].nb.find((n) => M[n].t === (p.skel ? "cemiterio" : "ilha") && G.sites[n] > 0); if (s === undefined) return false; doChest(G, p, s); return true; }
    case "pedra": doPedra(G, p); return true;
    case "comercio": doComercio(G, p); if (p.skel && G.R.ossuario !== false) { while (p.res.ouro >= 4 + 1 && false) { } } return true;
    case "taverna": doTaverna(G, p); return true;
    case "altar": if (p.res.ouro >= G.R.transformCost) { p.res.ouro -= G.R.transformCost; transform(G, p); G.st.transformsVol++; if (G.R.transformGift) for (const k in G.R.transformGift) gain(G, p, k, G.R.transformGift[k]); } return true;
    case "capela": if (p.res.ouro >= G.R.capelaCost) { p.res.ouro -= G.R.capelaCost; p.curses = []; } return true;
  }
}
function tryAttackHere(G, p, threshold) {
  const M = G.map; let best = null, bv = threshold;
  for (const o of G.players) if (o !== p && attackable(o) && M[p.pos].nb.includes(o.pos)) { const v = evalAttack(G, p, o); if (v > bv) { bv = v; best = o; } }
  if (best) { attack(G, p, best); return true; } return false;
}
function turn(G, p) {
  G.cur = p; const R = G.R;
  if (permArt(p, "perola") && (!G.R.perola || (G.R.perola === "cada2" && G.round % 2 === 0))) gain(G, p, "ouro", 1);
  if (hasArt(p, "saque")) { const tot = Math.max(...SUP.map((k) => G.players.reduce((a, o) => a + (o !== p && o.alive ? o.res[k] : 0), 0))); if (tot >= 3) { const k = SUP.map((k) => [k, G.players.reduce((a, o) => a + (o !== p && o.alive ? o.res[k] : 0), 0)]).sort((a, b) => b[1] - a[1])[0][0]; for (const o of G.players) if (o !== p && o.alive) { gain(G, p, k, o.res[k]); o.res[k] = 0; } p.arts.find((x) => x.id === "saque" && !x.used).used = true; } }
  const thr = p.strat === "agressivo" ? 0.3 : 1.5;
  let acted = false;
  // ataque oportunista antes de mover
  if (tryAttackHere(G, p, thr)) acted = true;
  let goal = chooseGoal(G, p);
  // agressivo procura alvo se não tem nada melhor
  if (!acted && p.strat === "agressivo" && (goal === "pesca" || goal === "bau") && avail(p) >= 2) {
    const dj = dijkstra(G, p); const sp = speed(p);
    let best = null, bv = 1;
    for (const o of G.players) if (o !== p && attackable(o)) for (const n of G.map[o.pos].nb) if (dj.steps[n] <= sp) { const v = evalAttack(G, p, o); if (v > bv) { bv = v; best = [o, n]; } }
    if (best) { const path = pathTo(dj, best[1]); move(G, p, path, sp); if (G.map[p.pos].nb.includes(best[0].pos)) { attack(G, p, best[0]); acted = true; } }
  }
  if (!acted && !G.winner) {
    const tg = new Set(targetsFor(G, p, goal));
    if (tg.has(p.pos) && doActivity(G, p, goal, p.pos)) acted = true;
    else if (!p.skipMove) {
      const dj = dijkstra(G, p); let best = -1;
      for (const t of tg) if (dj.dist[t] < Infinity && (best < 0 || dj.dist[t] < dj.dist[best])) best = t;
      if (best >= 0) {
        const sp = (hasArt(p, "bussola") && dj.steps[best] > speed(p)) ? (p.arts.find((x) => x.id === "bussola" && !x.used).used = true, 6) : speed(p);
        const path = pathTo(dj, best);
        // se não chega, para num hexágono onde dá para pescar
        if (path.length > sp) {
          let stop = sp; const fishT = p.skel ? "maldita" : "mar";
          for (let k = sp; k >= 1; k--) if (G.map[path[k - 1]].t === fishT) { stop = k; break; }
          move(G, p, path, stop);
          if (G.map[p.pos].t === fishT) { doFish(G, p); acted = true; }
          else if (tryAttackHere(G, p, thr)) acted = true;
        } else { move(G, p, path, sp); acted = doActivity(G, p, goal, p.pos); }
      }
    }
    if (!acted && !G.winner) { if (G.map[p.pos].t === (p.skel ? "maldita" : "mar")) doFish(G, p); else tryAttackHere(G, p, thr); }
  }
  p.skipMove = false;
  if (hasCurse(p, "bolsoFurado") && p.res.ouro > 0) p.res.ouro--;
  // recuperação de feridos
  if (p.wounded > 0) { if (p.woundRecoverAfter === "this") { p.wounded = 0; p.protect = false; } else p.woundRecoverAfter = "this"; }
}
function move(G, p, path, n) {
  let cursed = false; const steps = path.slice(0, n);
  for (const h of steps) if (!p.skel && G.map[h].t === "maldita") cursed = true;
  if (steps.length) p.pos = steps[steps.length - 1];
  if (cursed) drawCurse(G, p);
}

function play(rules, strats, s) {
  setSeed(s); G_R = rules;
  const G = newGame(rules, strats);
  const order = shuffle(G.players.slice());
  while (!G.winner && G.round < rules.maxRounds) {
    G.round++;
    if (rules.gift && G.round === rules.gift.round) { const p0 = G.players[0]; if (rules.gift.art) giveArt(G, p0, "gift", rules.gift.art); if (rules.gift.curse) drawCurse(G, p0, rules.gift.curse); }
    if (rules.viradaRound && G.round >= rules.viradaRound) virada(G);
    for (const p of order) { if (!p.alive || G.winner) continue; turn(G, p);
      G.peak = G.peak || {}; for (const k of RES) { const t = G.players.reduce((a, o) => a + o.res[k], 0); G.peak[k] = Math.max(G.peak[k] || 0, t); }
      const sp = G.players.reduce((a, o) => a + o.spd, 0), at = G.players.reduce((a, o) => a + o.atk, 0), cr = G.players.reduce((a, o) => a + o.crew, 0); G.peak.spd = Math.max(G.peak.spd || 0, sp); G.peak.atk = Math.max(G.peak.atk || 0, at); G.peak.crew = Math.max(G.peak.crew || 0, cr); }
  }
  return G;
}

module.exports = { V4, play, D };
