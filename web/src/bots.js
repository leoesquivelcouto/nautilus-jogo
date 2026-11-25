// Nautilus online — bots. Cada bot avalia as opções do turno em valor de ouro; a dificuldade muda precisão, agressividade e esperteza.
(function (NT) {
  const E = NT.E, B = (NT.Bot = {});
  const RES = NT.RES, SUP = NT.SUP, VAL = E.VAL;
  const rnd = () => Math.random();
  B.DIFF = {
    facil: { n: "Fácil", noise: 2.6, aggr: 0, atkThr: 3.5, leader: 0, denial: false, threat: 0, margin: -0.6, propose: 0, prebuy: false, useAncora: 0.6 },
    medio: { n: "Médio", noise: 0.8, aggr: 1, atkThr: 0.6, leader: 0.6, denial: false, threat: 0.5, margin: 0.4, propose: 0.25, prebuy: true, useAncora: 3 },
    dificil: { n: "Difícil", noise: 0, aggr: 2, atkThr: -0.4, leader: 1, denial: true, threat: 0.6, margin: 1.2, propose: 0.6, prebuy: true, useAncora: 2 },
  };
  const D = (p) => B.DIFF[p.diff] || B.DIFF.medio;
  const R = (G) => G.rules;
  const hand = E.hand, avail = E.avail, permArt = E.permArt, hasArt = E.hasArt;
  const handVal = (p) => RES.reduce((s, k) => s + p.res[k] * VAL[k], 0);
  const unitVal = (p) => { const h = hand(p); return h ? handVal(p) / h : 0; };
  const remRounds = (G) => Math.max(3, 16 - G.round);
  const crewVal = (G, p) => (p.crew >= R(G).maxCrew ? 0 : Math.min(5, Math.max(1.5, remRounds(G) * 0.6)));
  const artValue = (G, p) => (p.arts.length >= R(G).winArts - 1 ? 60 : 14 + 3 * p.arts.length);
  const maxOtherArts = (G, p) => Math.max(0, ...G.players.filter((o) => o !== p && o.alive).map((o) => o.arts.length));
  const hexDist = (G, a, b) => { const A = G.map[a], Bh = G.map[b]; const dr = Math.abs(A.r - Bh.r), dq = Math.abs(A.q - Bh.q); return Math.max(dr, (dq + dr) / 2); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  B.ART_VAL = { casco1: 2, casco2: 3, coroa: 3, proa: 4, olho: 3, perola: 5, rede: 4, reliquia: 2, selo: 2, ultimo: 1, bandeira: 3, gancho: 3, ancora: 3, bolsa: 3, bussola: 1, saque: 2, reforcos: 4 };
  B.leastArt = (p) => { let best = 0, bv = Infinity; p.arts.forEach((a, i) => { const v = a.used ? 0 : B.ART_VAL[a.id] || 2; if (v < bv) { bv = v; best = i; } }); return best; };
  B.autoDiscard = (p, n) => {
    const out = {}; let left = n;
    const order = ["polvora", "lona", "peixe", "ouro", "rum", "concha"];
    while (left > 0) { const k = order.filter((x) => p.res[x] - (out[x] || 0) > 0).sort((a, b) => VAL[a] - VAL[b] || (p.res[b] - (out[b] || 0)) - (p.res[a] - (out[a] || 0)))[0]; if (!k) break; out[k] = (out[k] || 0) + 1; left--; }
    return out;
  };

  // ---------- valores ----------
  function deckEV(G, p) {
    const deck = G.decks[p.skel ? "nauf" : "bau"]; if (!deck.length) return 0;
    let v = deck.reduce((s, c) => s + E.cardValue(c), 0) / deck.length;
    if (permArt(p, "coroa")) v += 1; if (permArt(p, "olho")) v += 0.8;
    if (!p.skel && !permArt(p, "reliquia")) v -= 0.3;
    return v;
  }
  function fishValue(G, p) { const room = R(G).handLimit - hand(p); return Math.min(E.fishYield(G, p), Math.max(0, room)) + (permArt(p, "perola") ? 1 : 0) - (room <= 0 ? 1 : 0); }
  function lossCost(G, p, n) {
    if (!p.skel) { const w = Math.min(n, avail(p)); return w > 0 ? 0.4 * w - 0.6 : 0; }
    if (p.crew > 0) return Math.min(n, p.crew) * (crewVal(G, p) + 1);
    return (p.arts.length ? artValue(G, p) : 0) + 0.5 * handVal(p) + 3;
  }
  function winGain(G, A, Dd, k, d) {
    const lp = R(G).lootPerDie;
    let g = Math.min(k * lp, hand(Dd)) * unitVal(Dd);
    const dd = D(A);
    const isLeader = Dd.arts.length > 0 && Dd.arts.length >= maxOtherArts(G, Dd);
    if (isLeader && Dd.arts.length >= 3) g *= 1 + 0.4 * dd.leader;
    if (E.canSteal(G, A, Dd)) g = Math.max(g, artValue(G, A) + (Dd.arts.length >= R(G).winArts - 1 ? 25 : 4));
    if (Dd.skel && Dd.crew === 0 && R(G).respawn) g += Dd.arts.length ? artValue(G, A) : 2;
    else if (Dd.skel) g += Math.min(R(G).dmgByWinner ? k : d, Dd.crew) * (Dd.arts.length >= 3 ? 3 : 0.6) * (dd.leader || 0.5);
    if (dd.denial) {
      const threat = Dd.arts.length >= R(G).winArts - 1 ? 25 : Dd.arts.length === R(G).winArts - 2 ? 8 : 0;
      if (threat) { const folga = E.goldPower(G, Dd) - E.nextArtTotal(G, Dd); g += threat * (folga >= 0 ? Math.min(1, Math.min(k * lp, hand(Dd)) / (folga + 1)) * 0.8 : 0.25); }
    }
    return g;
  }
  B.planAttack = function (G, A, Dd, extra = 0) {
    const diff = E.atkBonus(G, A, Dd, extra) - E.defBonus(G, Dd, A), lp = R(G).lootPerDie;
    let best = null;
    for (let k = 1; k <= E.maxDice(A); k++) {
      let bd = 1, bdv = -Infinity;
      for (let d = 1; d <= E.maxDice(Dd); d++) {
        const [w, l] = E.prob(k, d, diff);
        const dv = l * Math.min(d * lp, hand(A)) * unitVal(A) - w * (Math.min(k * lp, hand(Dd)) * unitVal(Dd) + lossCost(G, Dd, R(G).dmgByWinner ? k : d));
        if (dv > bdv) { bdv = dv; bd = d; }
      }
      const [w, l] = E.prob(k, bd, diff);
      const ev = w * winGain(G, A, Dd, k, bd) - l * (Math.min(bd * lp, hand(A)) * unitVal(A) + lossCost(G, A, R(G).dmgByWinner ? bd : k));
      if (!best || ev > best.ev) best = { k, d: bd, ev, w, l };
    }
    return best;
  };
  function threat(G, p, h) {
    if (!p.skel || !D(p).threat) return 0; let t = 0;
    for (const o of G.players) if (o !== p && o.alive && hexDist(G, o.pos, h) <= E.speed(G, o) + 1) { const pl = B.planAttack(G, o, p); if (pl.ev > 0) t += pl.w * lossCost(G, p, pl.d); }
    return t * D(p).threat;
  }
  function shopValue(G, p, loc) {
    const r = R(G), dd = D(p);
    if (loc === "pedra") {
      if (G.turn && G.turn.artBought >= r.artPerTurn) return 0;
      if (E.goldPower(G, p) >= E.nextArtTotal(G, p) && G.decks.art.length) return artValue(G, p);
      return 0;
    }
    if (loc === "taverna") {
      let v = 0, rum = p.res.rum, crew = p.crew, pol = p.res.polvora, atk = p.atk;
      if (E.hasX(p, "crew1") && crew < r.maxCrew) { crew++; v += crewVal(G, p); }
      while (rum >= r.crewRum && r.crewRum > 0 && crew < r.maxCrew && crewVal(G, p) > 1.6) { rum -= r.crewRum; crew++; v += crewVal(G, p) - 0.5 * r.crewRum; }
      const want = [0, 1, 3][dd.aggr];
      while (rum > 0 && pol > 0 && atk < Math.min(want, r.maxAtk)) { rum--; pol--; atk++; v += dd.aggr === 2 ? 2.5 : 1.5; }
      return v;
    }
    if (loc === "comercio") {
      const reserve = E.nextArtTotal(G, p);
      let spare = p.res.ouro + Math.floor(p.res.peixe / r.fishPerGold) - reserve, v = 0, crew = p.crew;
      while (spare >= r.crewGold && crew < 6 && crewVal(G, p) > r.crewGold + 0.3) { spare -= r.crewGold; crew++; v += crewVal(G, p) - r.crewGold; }
      if (p.spd < r.maxSpeedBonus && p.res.lona >= 1 && p.res.polvora >= 1 && spare >= r.spdGold) v += 1.2;
      const supGold = SUP.reduce((s, k) => s + (k === "rum" && p.crew < r.maxCrew ? 0 : Math.floor(p.res[k] / 4) * r.sell4), 0);
      if (!r.pedraFish && p.res.peixe >= 2 && E.goldPower(G, p) < reserve) v += 0.5 * Math.min(p.res.peixe, reserve);
      if (supGold > 0 && E.goldPower(G, p) < reserve && E.goldPower(G, p) + supGold >= reserve) v += 0.4 * artValue(G, p);
      if (hand(p) >= r.handLimit - 1 && supGold > 0) v += 1;
      return v;
    }
    if (loc === "ossuario") return 0;
    if (loc === "altar") {
      if (p.skel || p.res.ouro < r.transformCost) return 0;
      let v = 3.5 - r.transformCost + (r.transformGift ? 0 : -3.5) + 0.8 * p.curses.length;
      if (E.islandMarkers(G) <= G.players.length) v += 3; if (r.mareRound && G.round >= r.mareRound - 2) v += 1.5; if (G.round <= 3) v -= 3;
      v -= 0.8 * p.arts.length;
      return v;
    }
    if (loc === "capela") {
      if (p.skel || p.curses.length < 2 || p.res.ouro < r.capelaCost || (r.mareRound && G.round >= r.mareRound - 1)) return 0;
      return p.curses.length * 2.5 - r.capelaCost + 3;
    }
    return 0;
  }
  B.doShop = async function (G, p, loc) {
    const r = R(G), dd = D(p), op = (id, extra) => E.op(G, p, loc, Object.assign({ id }, extra || {}));
    if (loc === "pedra") {
      if (!p.res.concha) await op("concha");
      await op("artefato");
      if (dd.prebuy && !p.res.concha && E.goldPower(G, p) >= r.conchaCost + E.artCost(G, p)) await op("concha");
    } else if (loc === "taverna") {
      if (E.hasX(p, "crew1") && p.crew < r.maxCrew) await op("idolo");
      while (p.res.rum >= r.crewRum && r.crewRum > 0 && p.crew < r.maxCrew && crewVal(G, p) > 1.6) { if (!(await op("trip")).ok) break; }
      const want = Math.min([0, 1, 3][dd.aggr], r.maxAtk);
      while (p.atk < want && p.res.rum >= 1 && p.res.polvora >= 1) { if (!(await op("atq")).ok) break; }
    } else if (loc === "comercio") {
      for (const k of SUP) while (p.res[k] >= 4 && !(k === "rum" && p.crew < r.maxCrew)) { if (!(await op("vende4", { k })).ok) break; }
      if (p.res.peixe >= r.fishPerGold) await op("peixe", { n: "all" });
      const reserve = () => E.nextArtTotal(G, p);
      while (p.res.ouro - reserve() >= r.crewGold && p.crew < 6 && crewVal(G, p) > r.crewGold + 0.3) { if (!(await op("trip")).ok) break; }
      if (p.spd < r.maxSpeedBonus && p.res.lona >= 1 && p.res.polvora >= 1 && p.res.ouro - r.spdGold >= reserve()) await op("vel");
      if (dd.aggr === 2 && p.atk < r.maxAtk && p.res.rum >= 1 && p.res.polvora >= 1 && p.res.ouro - r.atkGold >= reserve()) await op("atq");
    } else if (loc === "altar") await op("virar");
    else if (loc === "capela") await op("limpar");
  };

  // ---------- turno ----------
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
  function bestHere(G, p, h) {
    const save = p.pos; p.pos = h;
    let best = { v: 0 };
    const consider = (v, act, arg) => { if (v > best.v) best = { v, act, arg }; };
    const locs = E.locations(G, p).filter((l) => l.ok);
    for (const l of locs) {
      if (l.loc === "pesca") consider(fishValue(G, p), "pesca");
      else if (l.loc === "bau" || l.loc === "nauf") consider(deckEV(G, p), "bau", E.chestSites(G, p)[0]);
      else if (l.loc === "ataque") { for (const o of G.players) if (E.attackable(G, p, o)) { const pl = B.planAttack(G, p, o); if (pl.ev > D(p).atkThr) consider(pl.ev + (D(p).aggr === 2 ? 1.5 : 0), "ataque", o.id); } }
      else consider(shopValue(G, p, l.loc), l.loc);
    }
    p.pos = save;
    return best;
  }
  async function act(G, p, a, arg) {
    if (a === "pesca") return E.fish(G, p);
    if (a === "bau") return E.openChest(G, p, arg);
    if (a === "ataque") {
      const o = G.players[arg]; let plan = B.planAttack(G, p, o), oneShot = null;
      for (const [id, v] of [["bandeira", 4], ["gancho", 3]]) if (hasArt(p, id)) {
        const p2 = B.planAttack(G, p, o, v);
        if (D(p).aggr > 0 && (p2.w - plan.w >= 0.2 || (o.skel && o.crew === 0 && o.arts.length) || o.arts.length >= R(G).winArts - 1)) { oneShot = id; plan = p2; }
        break;
      }
      return E.attack(G, p, o, { k: plan.k, oneShot });
    }
    return B.doShop(G, p, a);
  }
  async function moveTo(G, p, hex) { if (hex !== p.pos) return E.move(G, p, hex); return { ok: true }; }

  B.playTurn = async function (G, p) {
    const dd = D(p), noise = () => (rnd() - 0.5) * 2 * dd.noise;
    await sleep(G.botDelay ? G.botDelay * 0.6 : 0);
    // artefatos de uso imediato
    if (hasArt(p, "reforcos") && p.crew <= R(G).maxCrew - 2) await E.useArtifact(G, p, "reforcos");
    if (hasArt(p, "bolsa")) await E.useArtifact(G, p, "bolsa", { bundle: B.bolsaPick(G, p) });
    if (hasArt(p, "saque")) { let best = null; for (const o of G.players) if (o !== p && o.alive) for (const k of SUP) if (o.res[k] >= 3 && (!best || o.res[k] > best.n)) best = { o, k, n: o.res[k] }; if (best && (dd.noise < 2 || rnd() < 0.5)) await E.useArtifact(G, p, "saque", { target: best.o.id, k: best.k }); }
    if (G.over) return;
    // proposta de troca ao humano
    if (dd.propose && rnd() < dd.propose) await B.proposeTrade(G, p);
    if (G.over) return;
    const plan = () => planFor(G, p, dd, noise);
    let { cands, P, budget } = plan();
    let C = cands[0];
    // usar bônus de movimento se faltar pouco
    if (C && C.t > 0 && !G.turn.noMove) {
      const extra = (E.hasX(p, "mov1") ? 1 : 0) + (E.hasX(p, "mov2") ? 2 : 0);
      if (extra && C.steps <= budget + extra) { if (E.hasX(p, "mov2")) await E.useExtra(G, p, "mov2"); if (E.hasX(p, "mov1") && C.steps > E.moveBudget(G, p)) await E.useExtra(G, p, "mov1"); ({ cands, P, budget } = plan()); C = cands[0]; }
      else if (hasArt(p, "bussola") && C.steps <= budget + 6 && C.value >= 10) { await E.useArtifact(G, p, "bussola"); ({ cands, P, budget } = plan()); C = cands[0]; }
    }
    await execPlan(G, p, C, P, budget);
    await sleep(G.botDelay ? G.botDelay * 0.4 : 0);
  };

  // Planejamento do turno: lista de destinos candidatos com valor em ouro, ordenada.
  function planFor(G, p, dd, noise) {
      const budget = E.moveBudget(G, p), P = E.reach(G, p, 99), sp = Math.max(1, E.speed(G, p));
      const cands = [];
      const reach = (goal, value) => {
        if (value <= 0) return;
        let bestT = -1, bc = Infinity;
        for (const t of targetsFor(G, p, goal)) { const c = P.steps[t] + P.cursed[t] * 1.5 + (t !== p.pos ? threat(G, p, t) : 0); if (P.steps[t] < Infinity && c < bc) { bc = c; bestT = t; } }
        if (bestT < 0) return;
        const steps = P.steps[bestT], tt = steps <= budget ? 0 : Math.ceil((steps - budget) / sp);
        cands.push({ goal, value, hex: bestT, t: tt, steps, score: value / (1 + 0.6 * tt) + noise() });
      };
      reach("pesca", fishValue(G, p));
      if (E.siteMarkers(G, p.skel ? "cemiterio" : "ilha") > 0) reach("bau", deckEV(G, p));
      for (const g of ["comercio", "pedra", "altar", "taverna", "capela"]) reach(g, shopValue(G, p, g));
      if (dd.aggr > 0) for (const o of G.players) if (o !== p && o.alive && !(o.protect && !o.skel)) {
        const pl = B.planAttack(G, p, o); if (pl.ev <= dd.atkThr) continue;
        let bh = -1; for (const n of G.map[o.pos].nb) if (G.map[n].nav && (n === p.pos || P.steps[n] <= budget) && !E.occupied(G, n, p) && (bh < 0 || P.steps[n] < P.steps[bh])) bh = n;
        if (bh >= 0) cands.push({ goal: "ataque", value: pl.ev, hex: bh, t: 0, steps: P.steps[bh], score: pl.ev + (dd.aggr === 2 ? 1.5 : 0) + noise(), target: o.id });
      }
      cands.sort((a, b) => b.score - a.score);
      return { cands, P, budget, sp };
  }

  // Decide o que fazer com o melhor candidato. Sem "run", só descreve (usado pela Dica).
  function decidePlan(G, p, C, P, budget) {
    if (!C) { const h = bestHere(G, p, p.pos); return h.v > 0 ? { first: "act", act: h.act, arg: h.arg, move: null } : { first: "none", move: null }; }
    if (C.t === 0) return { first: "move", move: C.hex, act: C.goal === "bau" ? "bau" : C.goal, arg: C.target, goal: C };
    const path = E.pathTo(P, C.hex), here = bestHere(G, p, p.pos), lim = Math.min(budget, path.length);
    let bestStop = 0, bestV = -Infinity;
    for (let s = lim; s >= 1; s--) { const h = path[s - 1]; if (E.occupied(G, h, p)) continue; const v = bestHere(G, p, h).v + 0.4 * s - threat(G, p, h) - (G.map[h].t === "maldita" && !p.skel ? 1.5 : 0); if (v > bestV) { bestV = v; bestStop = s; } }
    if (here.v > 0 && here.v + 0.4 * lim >= bestV) { let stop = lim; while (stop > 0 && E.occupied(G, path[stop - 1], p)) stop--; return { first: "act", act: here.act, arg: here.arg, move: stop > 0 ? path[stop - 1] : null, toward: C }; }
    if (bestStop > 0) { const h = path[bestStop - 1]; const save = p.pos; const bh = bestHere(G, p, h); p.pos = save; return { first: "move", move: h, act: bh.v > 0 ? bh.act : null, arg: bh.arg, toward: C, late: true }; }
    return { first: "none", move: null };
  }
  async function execPlan(G, p, C, P, budget) {
    let acted = false;
    const doAct = async (a, arg) => { if (G.over || !a) return; const res = await act(G, p, a, arg); if (res && res.ok !== false) acted = true; };
    const d = decidePlan(G, p, C, P, budget);
    if (d.first === "move") {
      await moveTo(G, p, d.move);
      if (!G.over) {
        if (!d.late && C.goal === "ataque") { const o = G.players[C.target]; if (E.attackable(G, p, o)) await doAct("ataque", o.id); }
        else if (!d.late && C.goal === "bau") await doAct("bau", E.chestSites(G, p)[0]);
        else if (!d.late) await doAct(C.goal);
        else { const h = bestHere(G, p, p.pos); if (h.v > 0) await doAct(h.act, h.arg); }
      }
    } else if (d.first === "act") {
      await doAct(d.act, d.arg);
      if (C && !G.over && !G.turn.moved) { const P2 = E.reach(G, p, 99); const pth = E.pathTo(P2, C.hex); let stop = Math.min(E.moveBudget(G, p), pth.length); while (stop > 0 && E.occupied(G, pth[stop - 1], p)) stop--; if (stop > 0) await moveTo(G, p, pth[stop - 1]); }
    }
    if (!acted && !G.over && !G.turn.act) { const h = bestHere(G, p, p.pos); if (h.v > 0) await doAct(h.act, h.arg); }
  }

  // Dica para o humano: o que o bot difícil faria no lugar dele (sem ruído, sem agir).
  B.suggest = function (G, p) {
    const save = p.diff; p.diff = "dificil";
    try {
      const dd = D(p);
      const canMove = E.canMove(G, p), freeAct = !G.turn.act;
      const { cands, P, budget } = planFor(G, p, dd, () => 0);
      let C = cands[0];
      if (!canMove) { const h = bestHere(G, p, p.pos); return { move: null, act: freeAct && h.v > 0 ? h.act : null, arg: h.arg, value: h.v, alt: cands.slice(0, 3) }; }
      if (!freeAct) return { move: C ? (C.t === 0 ? C.hex : decidePlan(G, p, C, P, budget).move) : null, act: null, toward: C, alt: cands.slice(0, 3) };
      const d = decidePlan(G, p, C, P, budget);
      return Object.assign({ alt: cands.slice(0, 3) }, d);
    } finally { p.diff = save; }
  };

  B.bolsaPick = (G, p) => { const b = { rum: 0, polvora: 0, lona: 0 }; const need = R(G).maxCrew - p.crew; for (let i = 0; i < 3; i++) { if (b.rum < need) b.rum++; else if (b.polvora <= b.lona) b.polvora++; else b.lona++; } return b; };

  const supKeep = (G, p, k) => (k === "rum" && p.crew < R(G).maxCrew ? 3 : 0) - p.res[k] * 0.5;
  // ---------- negociação ----------
  function tradeVal(G, p, k) { let v = VAL[k]; if (k === "rum" && p.crew < R(G).maxCrew) v = 2.2; if ((k === "ouro" || k === "peixe") && E.goldPower(G, p) < E.nextArtTotal(G, p)) v += 0.25; if ((k === "polvora" || k === "lona") && p.res[k] >= 4) v = 0.6; return v; }
  const bval = (G, p, b) => Object.keys(b).reduce((s, k) => s + (b[k] || 0) * tradeVal(G, p, k), 0);
  B.evalTrade = function (G, bot, other, botGets, botGives) {
    const dd = D(bot);
    const gain = bval(G, bot, botGets) - bval(G, bot, botGives);
    if (dd.denial && other.arts.length >= R(G).winArts - 1) return { accept: false, why: `${bot.name} não negocia com quem está a um artefato de vencer.` };
    if (dd.leader && other.arts.length >= R(G).winArts - 2 && other.arts.length > bot.arts.length && gain < dd.margin + 2) return { accept: false, why: `${bot.name} não quer ajudar quem está na frente.` };
    if (gain >= dd.margin) return { accept: true, why: `${bot.name} aceita a troca.` };
    return { accept: false, why: `${bot.name} recusa: a troca não compensa para ${bot.skel ? "o esqueleto" : "o pirata"}.` };
  };
  B.proposeTrade = async function (G, p) {
    const human = G.players.find((o) => o.human && o.alive && !G.autoplay);
    if (!human || human === p || G.turn.tradesProposed >= 1) return;
    G.turn.tradesProposed++;
    const need = E.nextArtTotal(G, p) - E.goldPower(G, p);
    let give = null, get = null;
    // precisa de ouro para o artefato: oferece suprimentos que sobram
    if (need > 0 && need <= 3 && human.res.ouro >= need) {
      const k = SUP.filter((x) => p.res[x] >= 2 && !(x === "rum" && p.crew < R(G).maxCrew)).sort((a, b) => p.res[b] - p.res[a])[0];
      if (k) { give = { [k]: Math.min(p.res[k], need + 1) }; get = { ouro: need }; }
    }
    // precisa de rum para tripulantes
    if (!give && p.res.rum === 0 && p.crew < R(G).maxCrew - 1 && human.res.rum >= 1 && p.res.ouro >= 3) { give = { ouro: 3 }; get = { rum: 1 }; }
    if (!give) return;
    if (E.tradeCheck(G, p, human, give, get)) return;
    const ok = await E.decide(G, human, "tradeOffer", { from: p, give, get });
    if (ok) E.trade(G, p, human, give, get);
    else E.logMsg(G, `${human.name} recusa a proposta de ${p.name}.`, "trade", human.id);
  };

  // ---------- decisões pedidas pelo motor ----------
  B.decide = async function (G, p, kind, ctx) {
    const dd = D(p);
    switch (kind) {
      case "defDice": {
        const A = ctx.A, k = ctx.k, lp = R(G).lootPerDie, diff = E.atkBonus(G, A, p) - E.defBonus(G, p, A);
        if (dd.noise > 2) return 1 + Math.floor(rnd() * E.maxDice(p));
        let bd = 1, bv = -Infinity;
        for (let d = 1; d <= E.maxDice(p); d++) { const [w, l] = E.prob(k, d, diff); const v = l * Math.min(d * lp, hand(A)) * unitVal(A) - w * (Math.min(k * lp, hand(p)) * unitVal(p) + lossCost(G, p, R(G).dmgByWinner ? k : d)); if (v > bv) { bv = v; bd = d; } }
        return bd;
      }
      case "useAncora": { const pl = B.planAttack(G, ctx.A, p); return pl.w * (Math.min(ctx.k, hand(p)) * unitVal(p) + lossCost(G, p, pl.d)) + (E.canSteal(G, ctx.A, p) ? pl.w * 10 : 0) > dd.useAncora; }
      case "reroll": return true;
      case "stealChoice": return "art";
      case "giveArtifact": return B.leastArt(p);
      case "discard": return B.autoDiscard(p, ctx.n);
      case "useAmuleto": return !NT.CURSES[ctx.curse].now || ["peixesPodres", "conchaOcupada", "rumAguado"].includes(ctx.curse);
      case "useVigia": return true;
      case "vigiaPick": return E.cardValue(ctx.cards[1]) > E.cardValue(ctx.cards[0]) ? 1 : 0;
      case "olhoKeep": return E.cardValue(ctx.card) >= deckEV(G, p) - 0.5;
      case "coroaPick": return ctx.keys.slice().sort((a, b) => VAL[b] - VAL[a])[0];
      case "lunetaOrder": return ctx.cards.slice().sort((a, b) => E.cardValue(b) - E.cardValue(a));
      case "bolsaPick": return B.bolsaPick(G, p);
      case "tradeOffer": return false;
      case "respawnHex": { // o início mais longe dos inimigos
        let best = ctx.options[0], bv = -Infinity;
        for (const h of ctx.options) { const v = Math.min(99, ...G.players.filter((o) => o !== p && o.alive).map((o) => hexDist(G, o.pos, h))); if (v > bv) { bv = v; best = h; } }
        return best;
      }
      case "paySup": return ctx.options.slice().sort((a, b) => supKeep(G, p, a) - supKeep(G, p, b))[0];
    }
    return null;
  };
})(window.NT);
