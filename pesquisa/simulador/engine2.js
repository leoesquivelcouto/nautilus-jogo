// Nautilus v5 — motor de simulação 2, com bots que decidem por valor esperado.
// Regras: Manual de Regras v5 + aba "Cartas v5" (19/11/2026).
const D = require("./data_v5");

// ---------------- RNG ----------------
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ri = (n) => Math.floor(rnd() * n);
const d6 = () => 1 + ri(6);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const expand = (list) => { const o = []; for (const e of list) for (let i = 0; i < e[0]; i++) o.push(e.slice(1)); return o; };

// ---------------- REGRAS v5 ----------------
const RULES = {
  startCrew: 1, startSpeed: 2, maxCrew: 7, maxSpeedBonus: 2, maxAtk: 3, handLimit: 12,
  artSteal: true, artStealMode: "esqueleto", seatFishByP: { 2: [0, 1], 3: [0, 1, 3], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 3, 4] }, lootPerDie: 1, damageByWinner: false, seatFish: [0, 0, 0, 0, 0, 0], conchaCost: 3, ladder: [2, 3, 4, 5, 6], crewCom: 3, transformCost: 3, capelaCost: 7, mare: 8, winArts: 5, maxRounds: 60,
  sell4: 3, atkCom: { ouro: 5, rum: 1, polvora: 1 }, spdCom: { ouro: 3, lona: 1, polvora: 1 }, atkTav: { rum: 1, polvora: 1 },
};
const RES = ["ouro", "peixe", "rum", "polvora", "lona", "concha"];
const SUP = ["rum", "polvora", "lona"];
const VAL = { ouro: 1, peixe: 1, rum: 2, polvora: 1, lona: 1, concha: 3.5 };

// ---------------- TEMPO (minutos por evento, estimativa de mesa) ----------------
const TIME = { base: 0.45, move: 0.1, fish: 0.1, chest: 0.45, curse: 0.3, shop: 0.35, shopOp: 0.1, attack: 1.1, sink: 0.4, oneShot: 0.2, virada: 2, round: 0.15 };

// ---------------- MAPA ----------------
const ROWS = [6, 7, 8, 9, 10, 9, 8, 7, 6];
module.exports.ROWS = ROWS;
function buildFixed(F) {
  const H = []; const key = {};
  ROWS.forEach((L, r) => { for (let i = 0; i < L; i++) { const x = -(L - 1) + 2 * i; key[x + "," + r] = H.length; H.push({ id: H.length, r, x, i, L, t: F.LINHAS[r][i] }); } });
  const at = (r, i) => H.find((h) => h.r === r && h.i === i);
  for (const h of H) { h.nb = []; for (const [dx, dy] of [[2, 0], [-2, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const k = key[(h.x + dx) + "," + (h.r + dy)]; if (k !== undefined) h.nb.push(k); } h.sides = []; h.vertex = false; }
  for (const side in F.BORDAS) for (const [r, i] of F.BORDAS[side]) at(r, i).sides.push(side);
  for (const name in F.INICIOS) { const [r, i] = F.INICIOS[name]; const h = at(r, i); h.vertex = true; h.startName = name; }
  for (const h of H) h.nav = h.t === "mar" || h.t === "maldita" || h.vertex;
  const top = H.filter((h) => h.sides.includes("top") && h.nav).map((h) => h.id), bot = H.filter((h) => h.sides.includes("bottom") && h.nav).map((h) => h.id);
  for (const h of H) { h.edges = h.nb.filter((n) => H[n].nav); if (h.sides.includes("top") && h.nav) h.edges = h.edges.concat(bot); if (h.sides.includes("bottom") && h.nav) h.edges = h.edges.concat(top); }
  return H;
}
function buildMap() {
  if (RULES.fixedMap) return buildFixed(RULES.fixedMap);
  for (let tries = 0; tries < 1000; tries++) {
    const H = []; const key = {};
    ROWS.forEach((L, r) => { for (let i = 0; i < L; i++) { const x = -(L - 1) + 2 * i; key[x + "," + r] = H.length; H.push({ id: H.length, r, x, i, L }); } });
    for (const h of H) {
      h.nb = [];
      for (const [dx, dy] of [[2, 0], [-2, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const k = key[(h.x + dx) + "," + (h.r + dy)]; if (k !== undefined) h.nb.push(k); }
      h.sides = [];
      if (h.r === 0) h.sides.push("top"); if (h.r === 8) h.sides.push("bottom");
      if (h.r <= 4 && h.i === 0) h.sides.push("ul"); if (h.r <= 4 && h.i === h.L - 1) h.sides.push("ur");
      if (h.r >= 4 && h.i === 0) h.sides.push("ll"); if (h.r >= 4 && h.i === h.L - 1) h.sides.push("lr");
      h.vertex = (h.r === 0 || h.r === 8 || h.r === 4) && (h.i === 0 || h.i === h.L - 1);
    }
    const tiles = []; const add = (t, n) => { for (let k = 0; k < n; k++) tiles.push(t); };
    add("mar", 32); add("maldita", 13); add("ilha", 4); add("cemiterio", 4); add("comercio", 6); add("pedra", 2); add("altar", 3);
    shuffle(tiles); let ti = 0;
    for (const h of H) h.t = h.vertex ? "inicio" : tiles[ti++];
    for (const h of H) h.nav = h.t === "mar" || h.t === "maldita" || h.t === "inicio";
    const s0 = H.find((h) => h.nav); const seen = new Set([s0.id]); const q = [s0.id];
    while (q.length) { const c = q.pop(); for (const n of H[c].nb) if (!seen.has(n) && H[n].nav) { seen.add(n); q.push(n); } }
    let ok = seen.size === H.filter((h) => h.nav).length;
    for (const h of H) if (!h.nav && !h.nb.some((n) => H[n].nav)) ok = false;
    for (const s of ["top", "bottom", "ul", "ur", "ll", "lr"]) if (H.filter((h) => h.nav && h.sides.includes(s)).length < 2) ok = false;
    if (!ok) continue;
    const top = H.filter((h) => h.sides.includes("top") && h.nav).map((h) => h.id), bot = H.filter((h) => h.sides.includes("bottom") && h.nav).map((h) => h.id);
    for (const h of H) { h.edges = h.nb.filter((n) => H[n].nav); if (h.sides.includes("top")) h.edges = h.edges.concat(bot); if (h.sides.includes("bottom")) h.edges = h.edges.concat(top); }
    return H;
  }
  throw new Error("mapa");
}

// ---------------- UTILIDADES DO JOGADOR ----------------
const hand = (p) => RES.reduce((s, k) => s + p.res[k], 0);
const handVal = (p) => RES.reduce((s, k) => s + p.res[k] * VAL[k], 0);
const unitVal = (p) => { const h = hand(p); return h ? handVal(p) / h : 0; };
const avail = (p) => Math.max(0, p.crew - p.wounded);
const permArt = (p, a) => p.arts.some((x) => x.id === a);
const hasArt = (p, a) => p.arts.some((x) => x.id === a && !x.used);
const useArt = (p, a) => { const x = p.arts.find((y) => y.id === a && !y.used); if (x) x.used = true; };
const hasCurse = (p, c) => p.curses.includes(c);
const hasX = (p, e) => p.extras.includes(e);
const useX = (p, e) => { const i = p.extras.indexOf(e); if (i >= 0) { p.extras.splice(i, 1); return true; } return false; };
const maxDice = (p) => { let n = avail(p) <= 0 ? 1 : Math.min(3, avail(p)); if (hasCurse(p, "santelmo")) n = Math.max(1, n - 1); return n; };
function speed(G, p) {
  let s = RULES.startSpeed + Math.min(p.spd, RULES.maxSpeedBonus) + (permArt(p, "proa") ? 1 : 0) - (hasCurse(p, "mapaRasgado") ? 1 : 0);
  if (hasX(p, "mov1")) s += 1; if (hasX(p, "mov2")) s += 2;
  return Math.max(1, s);
}
const remRounds = (G) => Math.max(3, 17 - G.round);
const crewVal = (G, p) => p.crew >= RULES.maxCrew ? 0 : Math.min(5, Math.max(1.5, remRounds(G) * 0.6));
const nextArtCost = (p) => RULES.ladder[Math.min(p.arts.length, 4)] + (p.res.concha > 0 ? 0 : RULES.conchaCost);
const buyPower = (p) => p.res.ouro + p.res.peixe; // na Pedra peixe vale ouro
const maxOtherArts = (G, p) => Math.max(0, ...G.players.filter((o) => o !== p).map((o) => o.arts.length));
function artValue(G, p) { const n = p.arts.length; return n >= RULES.winArts - 1 ? 60 : 14 + 3 * n; }

function gain(G, p, k, n) {
  if (n <= 0) return;
  p.res[k] += n;
  let over = hand(p) - RULES.handLimit;
  if (over > 0) {
    for (const d of ["polvora", "lona", "peixe", "ouro", "rum", "concha"]) { if (d === k && over < n) continue; const t = Math.min(over, p.res[d]); p.res[d] -= t; over -= t; G.st.waste += t; if (!over) break; }
    if (over > 0) { const t = Math.min(over, p.res[k]); p.res[k] -= t; G.st.waste += t; }
  }
}
const pay = (p, c) => { for (const k in c) p.res[k] -= c[k]; };
const canPay = (p, c) => Object.keys(c).every((k) => p.res[k] >= c[k]);
function payGold(p, n) { const g = Math.min(p.res.ouro, n); p.res.ouro -= g; p.res.peixe -= n - g; } // Pedra: ouro, depois peixe

function checkWin(G, p, how) {
  if (!G.winner && p.arts.length >= RULES.winArts) { G.winner = p; G.winType = how || "artefatos"; }
}
function giveArt(G, p, src) {
  if (!G.arts.length) { G.st.artDeckEmpty = true; return false; }
  const id = G.arts.pop(); const a = { id, used: false }; p.arts.push(a); G.st.artSrc[src] = (G.st.artSrc[src] || 0) + 1;
  if (G.st.firstArtRound === null) G.st.firstArtRound = G.round;
  if (id === "reforcos") { p.crew = Math.min(RULES.maxCrew, p.crew + 2); a.used = true; }
  if (id === "bolsa") { const r = Math.min(3, RULES.maxCrew - p.crew); gain(G, p, "rum", r); for (let i = r; i < 3; i++) gain(G, p, i % 2 ? "lona" : "polvora", 1); a.used = true; }
  if (id === "reliquia") p.curses = [];
  checkWin(G, p);
  return true;
}

function drawCurse(G, p, src) {
  if (p.skel || permArt(p, "reliquia")) return;
  if (useX(p, "amuleto")) return;
  if (!G.curses.length) return;
  const c = G.curses.pop(); G.st.curses++; G.st.curseSrc[src]++; G.turnTime += TIME.curse;
  const r = p.res;
  const paySup = () => { const k = SUP.filter((s) => r[s] > 0).sort((a, b) => r[b] - r[a])[0]; if (!k) return false; r[k]--; return true; };
  switch (c) {
    case "banana": if (!paySup()) r.ouro = Math.max(0, r.ouro - 1); break;
    case "conchaOcupada": if (r.concha) r.concha--; else r.ouro = Math.max(0, r.ouro - 3); break;
    case "assobio": if (r.lona) r.lona -= Math.min(3, r.lona); else r.ouro = Math.max(0, r.ouro - 2); break;
    case "espelho": if (r.concha) r.concha--; else paySup(); break;
    case "gatoPreto": r.ouro = Math.max(0, r.ouro - 2); break;
    case "peixesPodres": r.peixe -= Math.ceil(r.peixe / 2); break;
    case "ratos": if (p.crew >= 5) p.crew--; break;
    case "rumAguado": if (r.rum) r.rum -= Math.min(3, r.rum); else r.peixe = Math.max(0, r.peixe - 1); break;
    case "sexta13": p.skipMove = true; break;
    default: p.curses.push(c);
  }
}

// ---------------- COMBATE: probabilidades exatas ----------------
const PMAX = {}; for (let k = 1; k <= 3; k++) PMAX[k] = [0, 1, 2, 3, 4, 5, 6].map((i) => (i === 0 ? 0 : (Math.pow(i, k) - Math.pow(i - 1, k)) / Math.pow(6, k)));
const PC = {};
function prob(a, d, diff) {
  const key = a + "," + d + "," + diff; if (PC[key]) return PC[key];
  let w = 0, l = 0;
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) { const pr = PMAX[a][i] * PMAX[d][j]; if (i + diff > j) w += pr; else if (i + diff < j) l += pr; }
  return (PC[key] = [w, l]);
}
function atkBonus(G, A, Dd) {
  let b = Math.min(RULES.maxAtk, A.atk);
  if (permArt(A, "ultimo") && avail(A) <= 2) b += 2;
  if (hasCurse(A, "peEsquerdo")) b -= 1;
  if (hasCurse(Dd, "luaSangue")) b += 1;
  if (hasX(A, "atk2")) b += 2;
  if (hasX(A, "combat2")) b += 2; else if (hasX(A, "combat1")) b += 1;
  return b;
}
function defBonus(G, Dd, A) {
  let b = (permArt(Dd, "casco1") ? 1 : 0) + (permArt(Dd, "casco2") ? 2 : 0);
  if (permArt(Dd, "reliquia") && Dd.skel) b += 1;
  if (permArt(Dd, "ultimo") && avail(Dd) <= 2) b += 1;
  if (hasCurse(Dd, "peEsquerdo")) b -= 1;
  if (hasCurse(A, "luaSangue")) b += 1;
  if (hasX(Dd, "def1")) b += 1;
  if (hasX(Dd, "combat2")) b += 2; else if (hasX(Dd, "combat1")) b += 1;
  return b;
}
// custo de perder n tripulantes / afundar
function lossCost(G, p, n) {
  if (!p.skel) { const w = Math.min(n, avail(p)); return w > 0 ? 0.4 * w - 0.8 : 0; }
  if (p.crew > 0) return Math.min(n, p.crew) * (crewVal(G, p) + 1);
  return sinkCost(G, p);
}
const sinkCost = (G, p) => (p.arts.length ? artValue(G, p) : 0) + 0.5 * handVal(p) + 3;
// valor para A de vencer D
function winGain(G, A, Dd, k, d) {
  let g = Math.min(k * RULES.lootPerDie, hand(Dd)) * unitVal(Dd);
  const lead = Dd.arts.length - maxOtherArts(G, Dd); if (lead >= 0 && Dd.arts.length >= 3) g *= 1.4; // frear o líder
  if (Dd.skel && Dd.crew === 0) g += Dd.arts.length ? artValue(G, A) : 2; // afundar rouba 1 artefato
  else if (Dd.skel) g += Math.min(d, Dd.crew) * (Dd.arts.length >= 3 ? 3 : 0.6);
  if (canSteal(G, A, Dd, k)) g = Math.max(g, artValue(G, A) + (Dd.arts.length >= 4 ? 25 : 4));
  // bloqueio: roubar de quem está perto de comprar o artefato da vitória
  const ameaca = Dd.arts.length >= 4 ? 25 : Dd.arts.length === 3 ? 8 : 0;
  if (ameaca) { const folga = buyPower(Dd) - nextArtCost(Dd); g += ameaca * (folga >= 0 ? Math.min(1, Math.min(k, hand(Dd)) / (folga + 1)) * 0.8 : 0.25); }
  return g;
}
// melhor par de dados (atacante antecipa a resposta do defensor)
function planAttack(G, A, Dd, extraAtk = 0) {
  const diff = atkBonus(G, A, Dd) + extraAtk - defBonus(G, Dd, A);
  let best = null;
  for (let k = 1; k <= maxDice(A); k++) {
    let bd = 1, bdv = -Infinity;
    for (let d = 1; d <= maxDice(Dd); d++) {
      const [w, l] = prob(k, d, diff);
      const dv = l * Math.min(d * RULES.lootPerDie, hand(A)) * unitVal(A) - w * (Math.min(k * RULES.lootPerDie, hand(Dd)) * unitVal(Dd) + lossCost(G, Dd, RULES.damageByWinner ? k : d));
      if (dv > bdv) { bdv = dv; bd = d; }
    }
    const [w, l] = prob(k, bd, diff);
    const ev = w * winGain(G, A, Dd, k, bd) - l * (Math.min(bd * RULES.lootPerDie, hand(A)) * unitVal(A) + lossCost(G, A, RULES.damageByWinner ? bd : k));
    if (!best || ev > best.ev) best = { k, d: bd, ev, w, l };
  }
  return best;
}
function canSteal(G, A, Dd, k) {
  if (!RULES.artSteal || Dd.arts.length <= A.arts.length) return false;
  const m = RULES.artStealMode;
  if (m === "lider" && Dd.arts.length < Math.max(...G.players.map((o) => o.arts.length))) return false;
  if (m === "3dados" && k < 3) return false;
  if (m === "esqueleto" && !Dd.skel) return false;
  return true;
}
const attackable = (A, o) => o !== A && o.alive && !(o.protect && !o.skel);

function resolveAttack(G, A, Dd) {
  G.turnTime += TIME.attack;
  let plan = planAttack(G, A, Dd);
  // artefatos de uso único do atacante
  let extra = 0;
  for (const [a, v] of [["bandeira", 4], ["gancho", 3]]) if (hasArt(A, a)) { const p2 = planAttack(G, A, Dd, v); if (p2.w - plan.w >= 0.2 || (Dd.skel && Dd.crew === 0 && Dd.arts.length)) { useArt(A, a); extra = v; plan = p2; G.turnTime += TIME.oneShot; G.st.oneShotUse++; } break; }
  const rec = { round: G.round, attSkel: A.skel, defSkel: Dd.skel, k: plan.k, d: plan.d, ev: plan.ev, leader: Dd.arts.length >= maxOtherArts(G, Dd) && Dd.arts.length > 0, result: "", stolen: 0, stolenVal: 0, dmg: 0, sink: false, artTaken: false, aggr: A.aggr };
  // Âncora Falsa (reação do defensor)
  if (hasArt(Dd, "ancora") && plan.w * (Math.min(plan.k, hand(Dd)) * unitVal(Dd) + lossCost(G, Dd, plan.d)) > 4) { useArt(Dd, "ancora"); rec.result = "ancora"; G.st.attacks.push(rec); return; }
  const ba = atkBonus(G, A, Dd) + extra, bd = defBonus(G, Dd, A);
  for (const p of [A, Dd]) { useX(p, "combat2") || useX(p, "combat1"); }
  useX(A, "atk2"); useX(Dd, "def1");
  const roll = (n) => { let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, d6()); return m; };
  let ma = roll(plan.k), md = roll(plan.d);
  if (ma + ba <= md + bd && useX(A, "reroll")) ma = roll(plan.k);
  if (md + bd <= ma + ba && useX(Dd, "reroll")) md = roll(plan.d);
  const ta = ma + ba, td = md + bd;
  if (ta === td) { rec.result = "empate"; G.st.attacks.push(rec); return; }
  const [win, lose, nWin, nLose0] = ta > td ? [A, Dd, plan.k, plan.d] : [Dd, A, plan.d, plan.k]; const nLose = RULES.damageByWinner ? nWin : nLose0;
  rec.result = win === A ? "atacante" : "defensor";
  // saque às cegas (ou artefato, na variante)
  if (win === A && canSteal(G, A, lose, plan.k)) { lose.arts.sort((a, b) => (b.used ? 1 : 0) - (a.used ? 1 : 0)); win.arts.push(lose.arts.shift()); rec.artTaken = true; G.st.artSrc.combate = (G.st.artSrc.combate || 0) + 1; checkWin(G, win); if (G.winner === win) G.st.winCombat = true; } else
  for (let i = 0; i < nWin * RULES.lootPerDie; i++) {
    const pool = []; for (const r of RES) for (let j = 0; j < lose.res[r]; j++) pool.push(r);
    if (!pool.length) break; const r = pool[ri(pool.length)]; lose.res[r]--; gain(G, win, r, 1); rec.stolen++; rec.stolenVal += VAL[r];
  }
  if (win === A) G.st.stealVal += rec.stolenVal; else G.st.stealValDef += rec.stolenVal;
  // dano
  if (!lose.skel) { const w = Math.min(nLose, avail(lose)); if (w > 0) { lose.wounded += w; lose.protect = true; lose.recoverIn = lose === G.cur ? 2 : 1; rec.dmg = w; } }
  else if (lose.crew > 0) { const k = Math.min(nLose, lose.crew); lose.crew -= k; rec.dmg = k; G.st.crewDead += k; }
  else { rec.sink = true; rec.artTaken = sink(G, lose, win); }
  G.st.attacks.push(rec);
}
function sink(G, lose, win) {
  G.turnTime += TIME.sink; G.st.sinks++;
  let took = false;
  if (lose.arts.length) {
    // entrega o artefato de menor valor para si (usado de uso único primeiro)
    lose.arts.sort((a, b) => (b.used ? 1 : 0) - (a.used ? 1 : 0));
    const a = lose.arts.shift(); win.arts.push(a); G.st.artSrc.afundar = (G.st.artSrc.afundar || 0) + 1; took = true; checkWin(G, win, "artefatos"); if (G.winner === win) G.st.winCombat = true;
  }
  for (const r of RES) lose.res[r] -= Math.ceil(lose.res[r] / 2);
  lose.crew = 1; lose.wounded = 0;
  const occ = new Set(G.players.map((o) => o.pos));
  const free = G.map.filter((h) => h.vertex && !occ.has(h.id)); if (free.length) lose.pos = free[ri(free.length)].id;
  return took;
}

// ---------------- CAMINHOS ----------------
function paths(G, p) {
  const M = G.map, N = M.length;
  const cost = new Array(N).fill(Infinity), steps = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  const occ = new Set(G.players.filter((o) => o !== p && o.alive).map((o) => o.pos));
  const curseW = !p.skel && !permArt(p, "reliquia") ? 1.5 : 0;
  cost[p.pos] = 0; steps[p.pos] = 0;
  for (;;) {
    let c = -1; for (let i = 0; i < N; i++) if (!done[i] && cost[i] < Infinity && (c < 0 || cost[i] < cost[c])) c = i;
    if (c < 0) break; done[c] = true;
    for (const n of M[c].edges) { if (occ.has(n)) continue; const w = 1 + (M[n].t === "maldita" ? curseW : 0); if (cost[c] + w < cost[n]) { cost[n] = cost[c] + w; steps[n] = steps[c] + 1; prev[n] = c; } }
  }
  return { cost, steps, prev };
}
const pathTo = (P, t) => { const path = []; let c = t; while (P.prev[c] !== -1) { path.unshift(c); c = P.prev[c]; } return path; };

// ---------------- AVALIAÇÃO DE AÇÕES ----------------
const fishYield = (p) => { let n = Math.max(1, avail(p) + 1); if (hasCurse(p, "albatroz")) n = Math.max(1, n - 1); if (permArt(p, "rede")) n++; return n; };
function fishValue(G, p) { const room = RULES.handLimit - hand(p); return Math.min(fishYield(p), Math.max(0, room)) + (permArt(p, "perola") ? 1 : 0) + (room <= 0 ? -1 : 0); }
const deckEV = (G, p) => (p.skel ? G.ev.nauf : G.ev.bau) + (permArt(p, "coroa") ? 1 : 0) + (permArt(p, "olhoAbismo") ? 0.8 : 0) - (!p.skel && !permArt(p, "reliquia") ? 0.3 : 0);
function shopPlan(G, p, where) {
  // retorna valor estimado de visitar o local agora
  const R = RULES;
  if (where === "pedra") {
    if (buyPower(p) + 0 >= nextArtCost(p) && G.arts.length) return artValue(G, p);
    return 0;
  }
  if (where === "taverna") {
    let v = 0, rum = p.res.rum, crew = p.crew, pol = p.res.polvora, atk = p.atk;
    while (rum > 0 && crew < R.maxCrew && crewVal(G, { crew }) > 1.6) { rum--; crew++; v += crewVal(G, p) - 0.5; }
    const atkWant = p.aggr === 0 ? 0 : p.aggr === 1 ? 1 : 3;
    while (rum > 0 && pol > 0 && atk < atkWant) { rum--; pol--; atk++; v += p.aggr === 2 ? 2.5 : 1.5; }
    return v;
  }
  if (where === "comercio") {
    const reserve = nextArtCost(p);
    let spare = buyPower(p) - reserve, v = 0, crew = p.crew;
    while (spare >= R.crewCom && crew < 6 && crewVal(G, p) > R.crewCom + 0.3) { spare -= R.crewCom; crew++; v += crewVal(G, p) - R.crewCom; }
    if (p.spd < R.maxSpeedBonus && p.res.lona >= 1 && p.res.polvora >= 1 && spare >= 3) v += 1.2;
    const supGold = SUP.reduce((s, k) => s + (k === "rum" && p.crew < 7 ? 0 : Math.floor(p.res[k] / 4) * 3), 0);
    if (supGold > 0 && buyPower(p) < reserve && buyPower(p) + supGold >= reserve) v += 0.4 * artValue(G, p);
    if (hand(p) >= R.handLimit - 1 && supGold > 0) v += 1;
    return v;
  }
  if (where === "altar") {
    if (p.skel || p.res.ouro < R.transformCost) return 0;
    const islandsLeft = G.islandMarkers(), P = G.players.length;
    let v = 3.5 - R.transformCost + 0.8 * p.curses.length;
    if (islandsLeft <= P) v += 3; if (G.round >= 6) v += 1.5; if (G.round <= 3) v -= 3;
    v -= 0.8 * p.arts.length; // esqueleto pode afundar e perder artefato
    return v;
  }
  if (where === "capela") {
    if (p.skel || p.curses.length < 2 || p.res.ouro < R.capelaCost || G.round >= RULES.mare - 1) return 0;
    return p.curses.length * 2.5 - R.capelaCost + 3;
  }
  return 0;
}
function doShop(G, p, where) {
  const R = RULES; let ops = 0;
  if (where === "pedra") {
    if (buyPower(p) >= nextArtCost(p) && G.arts.length) {
      if (!p.res.concha) { payGold(p, R.conchaCost); p.res.concha++; ops++; }
      p.res.concha--; payGold(p, R.ladder[Math.min(p.arts.length, 4)]); giveArt(G, p, "pedra"); ops++;
    }
  } else if (where === "taverna") {
    while (p.res.rum > 0 && p.crew < R.maxCrew && crewVal(G, p) > 1.6) { p.res.rum--; p.crew++; G.st.crewBought++; ops++; }
    const atkWant = p.aggr === 0 ? 0 : p.aggr === 1 ? 1 : 3;
    while (canPay(p, R.atkTav) && p.atk < atkWant) { pay(p, R.atkTav); p.atk++; G.st.atkBought++; ops++; }
  } else if (where === "comercio") {
    for (const k of SUP) while (p.res[k] >= 4 && !(k === "rum" && p.crew < 7)) { p.res[k] -= 4; p.res.ouro += R.sell4; ops++; }
    p.res.ouro += p.res.peixe; p.res.peixe = 0; // 1 peixe = 1 ouro
    const reserve = nextArtCost(p);
    while (p.res.ouro - reserve >= R.crewCom && p.crew < 6 && crewVal(G, p) > R.crewCom + 0.3) { p.res.ouro -= R.crewCom; p.crew++; G.st.crewBought++; ops++; }
    if (p.spd < R.maxSpeedBonus && canPay(p, R.spdCom) && p.res.ouro - 3 >= reserve) { pay(p, R.spdCom); p.spd++; G.st.spdBought++; ops++; }
    if (p.aggr === 2 && p.atk < 3 && canPay(p, R.atkCom) && p.res.ouro - 5 >= reserve) { pay(p, R.atkCom); p.atk++; G.st.atkBought++; ops++; }
  } else if (where === "altar") {
    if (!p.skel && p.res.ouro >= R.transformCost) { p.res.ouro -= R.transformCost; gain(G, p, "concha", 1); transform(G, p); G.st.voluntary.push(G.round); ops++; }
  } else if (where === "capela") {
    p.res.ouro -= R.capelaCost; p.curses = []; G.st.capela++; ops++;
  }
  G.turnTime += TIME.shop + TIME.shopOp * Math.max(0, ops - 1);
}
function transform(G, p) { p.skel = true; p.wounded = 0; p.protect = false; p.curses = []; }
function virada(G, cause) {
  if (G.virada) return; G.virada = G.round; G.viradaCause = cause; G.timeExtra += TIME.virada;
  for (const p of G.players) if (!p.skel) transform(G, p);
}

function doChest(G, p, site) {
  const deck = p.skel ? G.naufs : G.baus; if (!deck.length) return;
  G.sites[site]--; G.turnTime += TIME.chest;
  const bad = (c) => !Object.keys(c[1]).length || c[2].curse || c[2].risk;
  let card = deck.pop();
  if (bad(card) && deck.length) {
    if (permArt(p, "olhoAbismo")) { deck.unshift(card); card = deck.pop(); }
    else if (!p.skel && useX(p, "vigia")) { const c2 = deck.pop(); deck.unshift(card); card = c2; }
  }
  G.st[p.skel ? "naufs" : "baus"]++;
  const [, res, fl] = card;
  let coroa = permArt(p, "coroa"); let v = 0;
  for (const k of RES) if (res[k]) { const n = res[k] + (coroa ? 1 : 0); coroa = false; gain(G, p, k, n); v += n * VAL[k]; }
  G.st.chestVal += v;
  if (fl.curse) drawCurse(G, p, "bau");
  switch (fl.eff) {
    case "crew1": if (p.crew < 4) p.crew++; else gain(G, p, "ouro", 3); break;
    case "crew2": p.crew = Math.min(RULES.maxCrew, p.crew + 2); break;
    case "sino": for (const o of G.players) if (o !== p && o.skel && G.map[p.pos].nb.includes(o.pos) && o.crew > 0) { o.crew--; G.st.crewDead++; } break;
    case "luneta": { const top = deck.splice(-3); const val = (c) => Object.keys(c[1]).reduce((s, k) => s + VAL[k] * c[1][k], 0) - (c[2].risk ? 3 : 0); top.sort((a, b) => val(b) - val(a)); deck.push(...top); break; } // pior no topo para o próximo
    case undefined: break;
    default: p.extras.push(fl.eff);
  }
  if (fl.risk === "kraken" && p.crew > 0) { p.crew--; G.st.crewDead++; }
  if (fl.risk === "correntes") p.skipMove = true;
  if (res.art) giveArt(G, p, p.skel ? "naufragio" : "bau");
  if (!p.skel && G.islandMarkers() === 0) virada(G, "baus");
}

function targetsFor(G, p, goal) {
  const M = G.map, out = [];
  const adj = (pred) => { for (const h of M) if (h.nav && h.nb.some((n) => pred(M[n]))) out.push(h.id); };
  const side = (s) => { for (const h of M) if (h.nav && h.sides.includes(s)) out.push(h.id); };
  switch (goal) {
    case "pesca": for (const h of M) if (h.t === (p.skel ? "maldita" : "mar")) out.push(h.id); break;
    case "bau": adj((h) => h.t === (p.skel ? "cemiterio" : "ilha") && G.sites[h.id] > 0); break;
    case "comercio": adj((h) => h.t === "comercio"); side("lr"); if (permArt(p, "selo")) out.push(p.pos); break;
    case "pedra": adj((h) => h.t === "pedra"); side("ul"); break;
    case "altar": adj((h) => h.t === "altar"); break;
    case "taverna": side("ur"); break;
    case "capela": side("ll"); break;
  }
  return out;
}
// valor imediato do que dá para fazer parado no hexágono h
function bestHere(G, p, h) {
  const M = G.map; let best = { v: 0 };
  const consider = (v, act, arg) => { if (v > best.v) best = { v, act, arg }; };
  if (M[h].t === (p.skel ? "maldita" : "mar")) consider(fishValue(G, p), "pesca");
  const site = M[h].nb.find((n) => M[n].t === (p.skel ? "cemiterio" : "ilha") && G.sites[n] > 0);
  if (site !== undefined) consider(deckEV(G, p), "bau", site);
  for (const g of ["comercio", "pedra", "altar", "taverna", "capela"]) if (targetsFor(G, p, g).includes(h)) consider(shopPlan(G, p, g), g);
  if (p.aggr > 0) for (const o of G.players) if (attackable(p, o) && M[h].nb.includes(o.pos)) {
    const pl = planAttack(G, p, o); const v = pl.ev + (p.aggr === 2 ? 1.5 : 0); if (pl.ev > (p.aggr === 2 ? -0.5 : 0.3)) consider(v, "ataque", o);
  }
  return best;
}
// risco de ficar parado em h (esqueleto frágil perto de inimigos)
function threat(G, p, h) {
  if (!p.skel) return 0; let t = 0;
  for (const o of G.players) if (o !== p && o.alive && o.aggr > 0 && G.map[h].nb.concat([h]).some((x) => G.map[o.pos].nb.includes(x) || o.pos === x)) {
    const pl = planAttack(G, o, p); if (pl.ev > 0) t += pl.w * lossCost(G, p, pl.d);
  }
  return t * 0.5;
}

function turn(G, p) {
  G.cur = p; G.turnTime = TIME.base;
  // Saque dos Suprimentos: usa quando alguém tem 3+ de um suprimento
  if (hasArt(p, "saque")) {
    let best = null; for (const o of G.players) if (o !== p) for (const k of SUP) if (o.res[k] >= 3 && (!best || o.res[k] * VAL[k] > best.v)) best = { o, k, v: o.res[k] * VAL[k] };
    if (best) { gain(G, p, best.k, best.o.res[best.k]); best.o.res[best.k] = 0; useArt(p, "saque"); G.turnTime += TIME.oneShot; G.st.oneShotUse++; }
  }
  const P = paths(G, p); const sp = p.skipMove ? 0 : speed(G, p);
  // candidatos
  const cands = [];
  const reach = (goal, value, extraFilter) => {
    if (value <= 0) return;
    let bestT = -1, bc = Infinity;
    for (const t of targetsFor(G, p, goal)) { if (extraFilter && !extraFilter(t)) continue; const c = P.cost[t] + (t !== p.pos ? threat(G, p, t) : 0); if (P.steps[t] < Infinity && c < bc) { bc = c; bestT = t; } }
    if (bestT < 0) return;
    const steps = P.steps[bestT]; const tt = steps <= sp ? 0 : Math.ceil((steps - sp) / Math.max(1, speed(G, p)));
    cands.push({ goal, value, hex: bestT, t: tt, score: value / (1 + 0.6 * tt) });
  };
  reach("pesca", fishValue(G, p));
  if (G.siteMarkers(p.skel ? "cemiterio" : "ilha") > 0) reach("bau", deckEV(G, p));
  for (const g of ["comercio", "pedra", "altar", "taverna", "capela"]) reach(g, shopPlan(G, p, g));
  // ataques alcançáveis neste turno
  if (p.aggr > 0) for (const o of G.players) if (attackable(p, o)) {
    const pl = planAttack(G, p, o); const thr = p.aggr === 2 ? -0.5 : 0.3; if (pl.ev <= thr) continue;
    let bh = -1; for (const n of G.map[o.pos].nb) if (G.map[n].nav && P.steps[n] <= sp && (bh < 0 || P.cost[n] < P.cost[bh])) bh = n;
    if (bh >= 0) cands.push({ goal: "ataque", value: pl.ev + (p.aggr === 2 ? 1.5 : 0), hex: bh, t: 0, score: pl.ev + (p.aggr === 2 ? 1.5 : 0), target: o });
  }
  cands.sort((a, b) => b.score - a.score);
  const C = cands[0];
  let acted = false;
  const act = (a, arg) => {
    if (a === "pesca") { gain(G, p, "peixe", fishYield(p)); if (permArt(p, "perola")) gain(G, p, "ouro", 1); G.st.fishGold += fishYield(p) + (permArt(p, "perola") ? 1 : 0); G.turnTime += TIME.fish; G.st.actions.pesca++; }
    else if (a === "bau") { doChest(G, p, arg); G.st.actions.bau++; }
    else if (a === "ataque") { resolveAttack(G, p, arg); G.st.actions.ataque++; }
    else { doShop(G, p, a); G.st.actions[a] = (G.st.actions[a] || 0) + 1; }
    acted = true;
  };
  const moveAlong = (path, n) => {
    const steps = path.slice(0, n); if (!steps.length) return;
    let cursed = false; for (const h of steps) if (!p.skel && G.map[h].t === "maldita") cursed = true;
    p.pos = steps[steps.length - 1]; G.turnTime += TIME.move;
    if (useX(p, "mov2") || useX(p, "mov1")) { /* consumido */ }
    if (cursed) drawCurse(G, p, "aguas");
  };
  if (C) {
    if (C.t === 0) {
      const path = pathTo(P, C.hex);
      moveAlong(path, path.length);
      if (C.goal === "ataque") { if (attackable(p, C.target) && G.map[p.pos].nb.includes(C.target.pos)) act("ataque", C.target); }
      else { const h = bestHere(G, p, p.pos); if (C.goal === "bau") { const s = G.map[p.pos].nb.find((n) => G.map[n].t === (p.skel ? "cemiterio" : "ilha") && G.sites[n] > 0); if (s !== undefined) act("bau", s); } else if (C.goal === "pesca") act("pesca"); else act(C.goal); }
    } else {
      // longe: agir aqui e depois mover, ou mover e agir no caminho
      const path = pathTo(P, C.hex);
      const here = bestHere(G, p, p.pos);
      let bestStop = 0, bestV = -1;
      for (let s = Math.min(sp, path.length); s >= 1; s--) { const h = path[s - 1]; const v = bestHere(G, { ...p, pos: h }, h).v + 0.4 * s - threat(G, p, h); if (v > bestV) { bestV = v; bestStop = s; } }
      const vHere = here.v + 0.4 * Math.min(sp, path.length) - threat(G, p, path[Math.min(sp, path.length) - 1] ?? p.pos);
      if (here.v > 0 && vHere >= bestV) { act(here.act, here.arg); if (!G.winner) moveAlong(pathTo(paths(G, p), C.hex), sp); }
      else { moveAlong(path, bestStop); const h = bestHere(G, p, p.pos); if (h.v > 0) act(h.act, h.arg); }
    }
  }
  if (!acted && !G.winner) { const h = bestHere(G, p, p.pos); if (h.v > 0) act(h.act, h.arg); else G.st.actions.nada++; }
  p.skipMove = false;
  if (hasCurse(p, "bolsoFurado") && p.res.ouro > 0) p.res.ouro--;
  if (p.wounded > 0) { p.recoverIn--; if (p.recoverIn <= 0) { p.wounded = 0; p.protect = false; } }
  G.minutes += G.turnTime; G.st.turns++;
}

function newGame(n, aggrs) {
  const G = { map: buildMap(), round: 0, minutes: 0, timeExtra: 0, turnTime: 0, winner: null, virada: 0,
    st: { turns: 0, attacks: [], sinks: 0, crewDead: 0, crewBought: 0, atkBought: 0, spdBought: 0, curses: 0, curseSrc: { aguas: 0, bau: 0 }, baus: 0, naufs: 0, chestVal: 0, fishGold: 0, stealVal: 0, stealValDef: 0, waste: 0, artSrc: {}, firstArtRound: null, voluntary: [], capela: 0, oneShotUse: 0, actions: { pesca: 0, bau: 0, ataque: 0, nada: 0 }, artsByRound: [], leaderAt8: null } };
  G.baus = shuffle(expand(D.BAUS)); G.naufs = shuffle(expand(D.NAUFRAGIOS));
  G.arts = shuffle(expand(D.ARTEFATOS).map((a) => a[0])); G.curses = shuffle(expand(D.MALDICOES).map((a) => a[0]));
  const ev = (deck) => deck.reduce((s, c) => s + Object.keys(c[1]).reduce((a, k) => a + (k === "art" ? 7 : VAL[k] * c[1][k]), 0) - (c[2].curse ? 1.5 : 0) - (c[2].risk ? 2.5 : 0) + (c[2].eff ? 1.5 : 0), 0) / deck.length;
  G.ev = { bau: ev(G.baus), nauf: ev(G.naufs) };
  G.sites = {}; for (const h of G.map) if (h.t === "ilha" || h.t === "cemiterio") G.sites[h.id] = n;
  G.siteMarkers = (t) => Object.keys(G.sites).reduce((s, id) => s + (G.map[id].t === t ? G.sites[id] : 0), 0);
  G.islandMarkers = () => G.siteMarkers("ilha");
  const starts = shuffle(G.map.filter((h) => h.vertex).map((h) => h.id));
  G.players = aggrs.map((a, i) => ({ id: i, seat: i, aggr: a, pos: starts[i], start: G.map[starts[i]].startName || null, skel: false, alive: true, crew: RULES.startCrew, wounded: 0, protect: false, recoverIn: 0,
    spd: 0, atk: 0, res: { ouro: 0, peixe: (RULES.seatFishByP ? RULES.seatFishByP[aggrs.length][i] : RULES.seatFish[i]) || 0, rum: 0, polvora: 0, lona: 0, concha: 0 }, arts: [], curses: [], extras: [], skipMove: false }));
  return G;
}

function play(aggrs, s) {
  seed = s >>> 0 || 1;
  const G = newGame(aggrs.length, aggrs);
  while (!G.winner && G.round < RULES.maxRounds) {
    G.round++; G.minutes += TIME.round;
    if (G.round >= RULES.mare) virada(G, "mare");
    for (const p of G.players) { if (G.winner) break; turn(G, p); }
    G.st.artsByRound.push(G.players.map((p) => p.arts.length));
    if (G.round === 7) { const m = Math.max(...G.players.map((p) => p.arts.length)); G.st.leaderAt8 = G.players.filter((p) => p.arts.length === m).map((p) => p.id); }
    if (!G.winner && G.st.artDeckEmpty) { const s2 = G.players.slice().sort((a, b) => b.arts.length - a.arts.length || handVal(b) - handVal(a)); G.winner = s2[0]; G.winType = "baralho de artefatos acabou"; }
  }
  G.minutes += G.timeExtra;
  return G;
}

module.exports = { play, RULES, TIME, prob, D };
