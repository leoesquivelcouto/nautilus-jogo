// Nautilus online — motor de regras (Manual v5). Estado puro em G; decisões via decide(); interface via E.ui.
(function (NT) {
  const E = (NT.E = {});
  const RES = NT.RES, SUP = NT.SUP;
  const rnd = () => Math.random();
  const ri = (n) => Math.floor(rnd() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  E.shuffle = shuffle; E.ri = ri;
  E.VAL = { ouro: 1, peixe: 1, rum: 2, polvora: 1, lona: 1, concha: 3.5 };
  E.TRADE_RES = ["ouro", "peixe", "rum", "polvora", "lona"];

  // UI padrão (substituída pela interface real); permite rodar sem tela
  E.ui = { log() {}, async anim() {}, async ask() { throw new Error("sem interface"); }, update() {} };
  const log = (G, msg, kind = "info", pid = null) => { G.log.push({ r: G.round, msg, kind, pid }); if (G.log.length > 400) G.log.shift(); E.ui.log(G, msg, kind, pid); };
  E.logMsg = log;

  async function decide(G, p, kind, ctx = {}) {
    if (p.human && !G.autoplay) return E.ui.ask(G, p, kind, ctx);
    return NT.Bot.decide(G, p, kind, ctx);
  }
  E.decide = decide;

  // ---------------- MAPA ----------------
  function hexGeom(r, i) {
    const g = NT.GEO, L = NT.ROWS[r], w = Math.sqrt(3) * g.R;
    return { x: g.cx + (i - (L - 1) / 2) * w, y: g.cy + (r - 4) * 1.5 * g.R };
  }
  function baseGrid() {
    const H = [], key = {};
    NT.ROWS.forEach((L, r) => { for (let i = 0; i < L; i++) { const q = -(L - 1) + 2 * i; key[q + "," + r] = H.length; const gm = hexGeom(r, i); H.push({ id: H.length, r, i, q, x: gm.x, y: gm.y, t: "mar", sides: [] }); } });
    for (const h of H) { h.nb = []; for (const [dq, dr] of [[2, 0], [-2, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const k = key[(h.q + dq) + "," + (h.r + dr)]; if (k !== undefined) h.nb.push(k); } }
    const at = (r, i) => H.find((h) => h.r === r && h.i === i);
    for (const side in NT.BORDAS) for (const [r, i] of NT.BORDAS[side].hx) at(r, i).sides.push(side);
    NT.INICIOS.forEach(([r, i], k) => { const h = at(r, i); h.start = k; });
    return { H, at };
  }
  function finishMap(H) {
    for (const h of H) { h.nav = !!NT.HEX_TIPOS[h.t].nav; const imgs = NT.HEX_TIPOS[h.t].img; h.img = imgs[ri(imgs.length)]; }
    const top = H.filter((h) => h.nav && h.sides.includes("top")).map((h) => h.id);
    const bot = H.filter((h) => h.nav && h.sides.includes("bottom")).map((h) => h.id);
    for (const h of H) {
      h.edges = h.nb.filter((n) => H[n].nav).map((n) => ({ to: n, pass: false }));
      if (h.nav && h.sides.includes("top")) for (const b of bot) h.edges.push({ to: b, pass: true });
      if (h.nav && h.sides.includes("bottom")) for (const b of top) h.edges.push({ to: b, pass: true });
    }
    return H;
  }
  function mapValid(H) {
    const nav = H.filter((h) => h.nav); const seen = new Set([nav[0].id]); const q = [nav[0].id];
    const tmp = finishMap(H.map((h) => ({ ...h })));
    while (q.length) { const c = q.pop(); for (const e of tmp[c].edges) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }
    if (seen.size !== nav.length) return false;
    for (const h of H) if (!h.nav && !h.nb.some((n) => H[n].nav)) return false; // todo local alcançável
    for (const side of ["ul", "ur", "lr", "ll"]) if (!H.some((h) => h.sides.includes(side) && h.t === "mar")) return false; // borda com mar limpo
    // Manual v5: cada borda precisa de pelo menos 2 hexágonos navegáveis encostados
    for (const side in NT.BORDAS) { const hs = H.filter((h) => h.sides.includes(side)); if (hs.filter((h) => h.nav).length < Math.min(2, hs.length)) return false; }
    for (const h of H) if (h.start !== undefined && !h.nb.some((n) => H[n].t === "mar" || H[n].t === "maldita")) return false;
    return true;
  }
  E.buildMap = function (mode, rules) {
    if (mode === "impresso") {
      const { H } = baseGrid();
      for (const h of H) h.t = NT.MAPA_IMPRESSO[h.r][h.i];
      return finishMap(H);
    }
    for (let tries = 0; tries < 3000; tries++) {
      const { H } = baseGrid();
      const nCom = Math.max(0, rules.nComercio | 0);
      const tiles = [];
      const add = (t, n) => { for (let k = 0; k < n; k++) tiles.push(t); };
      add("maldita", 13); add("ilha", 4); add("cemiterio", 4); add("comercio", nCom); add("pedra", 2); add("altar", 3);
      add("mar", 64 - tiles.length);
      shuffle(tiles); let k = 0;
      for (const h of H) h.t = h.start !== undefined ? "inicio" : tiles[k++];
      for (const h of H) h.nav = !!NT.HEX_TIPOS[h.t].nav;
      if (mapValid(H)) return finishMap(H);
    }
    throw new Error("Não foi possível montar um mapa válido.");
  };

  // ---------------- JOGO ----------------
  E.newGame = function (cfg) {
    const rules = Object.assign(NT.defaultRules(), cfg.rules || {});
    rules.ladderArr = String(rules.ladder).split(",").map((v) => parseInt(v, 10)).filter((v) => !isNaN(v));
    if (!rules.ladderArr.length) rules.ladderArr = [2, 3, 4, 5, 6];
    const map = E.buildMap(cfg.mapMode || "aleatorio", rules);
    const P = cfg.players.length;
    const deck = (list) => { const o = []; for (const [q, n, r, f] of list) for (let i = 0; i < q; i++) o.push({ n, r, f }); return shuffle(o); };
    const artDeck = []; for (const id in NT.ARTS) for (let i = 0; i < NT.ARTS[id].q; i++) artDeck.push(id);
    const curseDeck = []; for (const id in NT.CURSES) for (let i = 0; i < 2; i++) curseDeck.push(id);
    const G = {
      v: 1, rules, mapMode: cfg.mapMode || "aleatorio", map, round: 1, ti: 0, over: false, winner: null, winType: "",
      virada: false, viradaRound: 0, viradaCause: "", log: [], startedAt: Date.now(),
      decks: { bau: deck(NT.BAUS), nauf: deck(NT.NAUFRAGIOS), art: shuffle(artDeck), curse: shuffle(curseDeck) },
      sites: {}, players: [], order: [], turn: null, artDeckOut: false, hist: [],
      stats: { attacks: 0, attackWins: 0, defWins: 0, ties: 0, cancels: 0, sinks: 0, artSteals: 0, curses: 0, chests: 0, naufs: 0, trades: 0, artFrom: { pedra: 0, bau: 0, naufragio: 0, combate: 0, afundar: 0 } },
    };
    // Variante: carta "Maré Negra" no baralho de artefatos, saindo depois de (mareCard × jogadores) artefatos
    if (rules.mareCard > 0) { const pos = Math.min(G.decks.art.length, rules.mareCard * P); G.decks.art.splice(G.decks.art.length - pos, 0, "mare"); }
    const nMark = rules.markers > 0 ? rules.markers : P;
    for (const h of map) if (h.t === "ilha" || h.t === "cemiterio") G.sites[h.id] = nMark;
    const spread = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }[P];
    const corners = shuffle(spread.slice());
    cfg.players.forEach((pc, k) => {
      const startHex = map.find((h) => h.start === corners[k]);
      G.players.push({
        id: k, name: pc.name, human: !!pc.human, diff: pc.diff || "medio", color: pc.color, pos: startHex.id, home: startHex.id,
        skel: false, alive: true, crew: rules.startCrew, wounded: 0, protect: false, healAtEnd: false,
        spd: 0, atk: 0, res: { ouro: 0, peixe: 0, rum: 0, polvora: 0, lona: 0, concha: 0 }, arts: [], curses: [], extras: [], skipNext: false,
        st: { fish: 0, chests: 0, curses: 0, attacks: 0, attackWins: 0, defenses: 0, defWins: 0, sinks: 0, crewLost: 0, artFrom: {}, stolen: 0, lostLoot: 0, trades: 0 },
      });
    });
    G.order = shuffle(G.players.map((p) => p.id));
    G.hist.push(G.players.map(() => 0));
    if (rules.seatFish) G.order.forEach((pid, k) => { G.players[pid].res.peixe += (NT.SEAT_FISH[P] || [])[k] || 0; });
    log(G, `A partida começa. Ordem dos turnos: ${G.order.map((id) => G.players[id].name).join(", ")}.`, "sys");
    return G;
  };

  // ---------------- AJUDANTES ----------------
  const R = (G) => G.rules;
  E.cur = (G) => G.players[G.order[G.ti]];
  E.hand = (p) => RES.reduce((s, k) => s + p.res[k], 0);
  E.avail = (p) => Math.max(0, p.crew - p.wounded);
  E.permArt = (p, a) => p.arts.some((x) => x.id === a);
  E.hasArt = (p, a) => p.arts.some((x) => x.id === a && !x.used);
  E.hasCurse = (p, c) => p.curses.includes(c);
  E.hasX = (p, e) => p.extras.includes(e);
  const useX = (p, e) => { const i = p.extras.indexOf(e); if (i >= 0) { p.extras.splice(i, 1); return true; } return false; };
  E.useXRaw = useX;
  E.speed = (G, p) => {
    let s = R(G).startSpeed + Math.min(p.spd, R(G).maxSpeedBonus) + p.arts.filter((a) => a.id === "proa").length - (E.hasCurse(p, "mapaRasgado") ? 1 : 0);
    return Math.max(1, s);
  };
  E.maxDice = (p) => { let n = E.avail(p) <= 0 ? 1 : Math.min(3, E.avail(p)); if (E.hasCurse(p, "santelmo")) n = Math.max(1, n - 1); return n; };
  E.artCost = (G, p) => { const L = R(G).ladderArr; return L[Math.min(p.arts.length, L.length - 1)]; };
  E.goldPower = (G, p) => p.res.ouro + (R(G).pedraFish ? p.res.peixe : 0);
  E.nextArtTotal = (G, p) => E.artCost(G, p) + (p.res.concha > 0 ? 0 : R(G).conchaCost);
  E.fishYield = (G, p) => {
    let n = E.avail(p) + (R(G).captainFish ? 1 : 0); if (n < 1) n = 1;
    if (E.hasCurse(p, "albatroz")) n = Math.max(1, n - 1);
    if (E.permArt(p, "rede")) n++;
    return n;
  };
  E.islandMarkers = (G) => Object.keys(G.sites).reduce((s, id) => s + (G.map[id].t === "ilha" ? G.sites[id] : 0), 0);
  E.siteMarkers = (G, t) => Object.keys(G.sites).reduce((s, id) => s + (G.map[id].t === t ? G.sites[id] : 0), 0);
  E.occupied = (G, hid, except) => G.players.some((o) => o.alive && o !== except && o.pos === hid);
  E.adjType = (G, h, t) => G.map[h].nb.some((n) => G.map[n].t === t);
  E.onBorder = (G, h, side) => G.map[h].sides.includes(side);
  E.bundleStr = (b) => RES.filter((k) => b[k]).map((k) => `${b[k]} ${b[k] === 1 ? NT.RES_NOME[k].toLowerCase() : NT.RES_NOME_PL[k]}`).join(", ") || "nada";

  // ---------------- RECURSOS ----------------
  async function enforceLimit(G, p) {
    const over = E.hand(p) - R(G).handLimit;
    if (over <= 0) return;
    let pick = await decide(G, p, "discard", { n: over });
    let total = 0; const ok = pick && RES.every((k) => (pick[k] || 0) <= p.res[k] && (pick[k] || 0) >= 0);
    if (ok) total = RES.reduce((s, k) => s + (pick[k] || 0), 0);
    if (!ok || total !== over) pick = NT.Bot.autoDiscard(p, over);
    for (const k of RES) p.res[k] -= pick[k] || 0;
    log(G, `${p.name} devolve ao pote ${E.bundleStr(pick)} (limite de ${R(G).handLimit}).`, "muted", p.id);
  }
  E.gain = async function (G, p, b) {
    let any = false; for (const k of RES) if (b[k]) { p.res[k] += b[k]; any = true; }
    if (any) await enforceLimit(G, p);
  };
  const canPay = (p, c) => Object.keys(c).every((k) => p.res[k] >= c[k]);
  const pay = (p, c) => { for (const k in c) p.res[k] -= c[k]; };
  // Na Pedra, peixe vale ouro. Paga primeiro com peixe (ouro é mais útil fora da Pedra), salvo escolha contrária.
  function payGold(G, p, n, goldFirst) {
    const [a, b] = R(G).pedraFish && !goldFirst ? ["peixe", "ouro"] : ["ouro", "peixe"];
    const x = Math.min(p.res[a], n); p.res[a] -= x; if (n - x > 0) p.res[b] -= n - x;
  }

  function checkWin(G, p) {
    if (!G.over && p.arts.length >= R(G).winArts) { G.over = true; G.winner = p.id; G.winType = `${R(G).winArts} artefatos`; log(G, `${p.name} reúne ${p.arts.length} artefatos e vence a partida!`, "win", p.id); }
  }
  E.giveArt = async function (G, p, src) {
    if (!G.decks.art.length) { G.artDeckOut = true; log(G, "O baralho de artefatos acabou: a partida termina no fim desta rodada.", "warn"); return false; }
    if (G.decks.art[G.decks.art.length - 1] === "mare") {
      G.decks.art.pop(); log(G, `${p.name} revela a carta Maré Negra no baralho de artefatos.`, "virada", p.id);
      if (!G.virada) await virada(G, "carta");
      if (!G.decks.art.length) { G.artDeckOut = true; return false; }
    }
    const id = G.decks.art.pop(); const a = { id, used: false }; p.arts.push(a);
    G.stats.artFrom[src] = (G.stats.artFrom[src] || 0) + 1; p.st.artFrom[src] = (p.st.artFrom[src] || 0) + 1;
    log(G, `${p.name} obtém o artefato ${NT.ARTS[id].n} (${p.arts.length}/${R(G).winArts}).`, "art", p.id);
    await E.ui.anim(G, "art", { p, id });
    if (id === "reliquia" && p.curses.length) { p.curses = []; log(G, `A Relíquia limpa as maldições de ${p.name}.`, "info", p.id); }
    checkWin(G, p);
    if (!G.decks.art.length) G.artDeckOut = true;
    return true;
  };

  async function drawCurse(G, p, src) {
    if (p.skel || E.permArt(p, "reliquia") || !G.decks.curse.length) return;
    const c = G.decks.curse.pop(); G.stats.curses++; p.st.curses++;
    log(G, `${p.name} recebe a maldição ${NT.CURSES[c].n}${src ? " (" + src + ")" : ""}.`, "curse", p.id);
    await E.ui.anim(G, "curse", { p, id: c });
    if (E.hasX(p, "amuleto") && (await decide(G, p, "useAmuleto", { curse: c }))) { useX(p, "amuleto"); log(G, `${p.name} usa o Amuleto Anti-Maldição e cancela ${NT.CURSES[c].n}.`, "info", p.id); return; }
    const r = p.res;
    const paySup = async () => { const opts = SUP.filter((s) => r[s] > 0); if (!opts.length) return false; let k = opts.length > 1 ? await decide(G, p, "paySup", { options: opts, curse: c }) : opts[0]; if (!opts.includes(k)) k = opts.sort((a, b) => r[b] - r[a])[0]; r[k]--; log(G, `${p.name} paga 1 ${NT.RES_NOME[k].toLowerCase()}.`, "muted", p.id); return true; };
    switch (c) {
      case "banana": if (!(await paySup())) r.ouro = Math.max(0, r.ouro - 1); break;
      case "conchaOcupada": if (r.concha) r.concha--; else r.ouro = Math.max(0, r.ouro - 3); break;
      case "assobio": if (r.lona) r.lona -= Math.min(3, r.lona); else r.ouro = Math.max(0, r.ouro - 2); break;
      case "espelho": if (r.concha) r.concha--; else await paySup(); break;
      case "gatoPreto": r.ouro = Math.max(0, r.ouro - 2); break;
      case "peixesPodres": r.peixe -= Math.ceil(r.peixe / 2); break;
      case "ratos": if (p.crew >= 5) { p.crew--; p.wounded = Math.min(p.wounded, p.crew); } break;
      case "rumAguado": if (r.rum) r.rum -= Math.min(3, r.rum); else r.peixe = Math.max(0, r.peixe - 1); break;
      case "sexta13": p.skipNext = true; break;
      default: p.curses.push(c);
    }
  }
  E.drawCurse = drawCurse;

  function transform(G, p) { p.skel = true; p.wounded = 0; p.protect = false; p.healAtEnd = false; p.curses = []; }
  async function virada(G, cause) {
    if (G.virada) return;
    G.virada = true; G.viradaRound = G.round; G.viradaCause = cause;
    for (const p of G.players) if (p.alive && !p.skel) transform(G, p);
    log(G, cause === "carta" ? "A Maré Negra sobe do baralho: todos os piratas viram esqueletos." : cause === "mare" ? `A Maré Negra chega (rodada ${G.round}): todos os piratas viram esqueletos.` : "O último baú das ilhas foi aberto: todos os piratas viram esqueletos.", "virada");
    await E.ui.anim(G, "virada", { cause });
  }

  // ---------------- MOVIMENTO ----------------
  // Caminhos dentro do alcance; para piratas, prefere caminhos que evitem águas amaldiçoadas.
  E.reach = function (G, p, budget) {
    const M = G.map, N = M.length;
    const steps = new Array(N).fill(Infinity), cursed = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
    const avoid = !p.skel && R(G).cursedWater && !E.permArt(p, "reliquia");
    steps[p.pos] = 0; cursed[p.pos] = 0;
    for (;;) {
      let c = -1;
      for (let i = 0; i < N; i++) if (!done[i] && steps[i] < Infinity && (c < 0 || steps[i] * 100 + cursed[i] < steps[c] * 100 + cursed[c])) c = i;
      if (c < 0) break; done[c] = true;
      if (steps[c] >= budget) continue;
      for (const e of M[c].edges) {
        const n = e.to; if (E.occupied(G, n, p)) continue;
        const s = steps[c] + 1, cu = cursed[c] + (avoid && M[n].t === "maldita" ? 1 : 0);
        if (s * 100 + cu < steps[n] * 100 + cursed[n]) { steps[n] = s; cursed[n] = cu; prev[n] = c; }
      }
    }
    return { steps, cursed, prev };
  };
  E.pathTo = (P, t) => { const path = []; let c = t; while (P.prev[c] !== -1) { path.unshift(c); c = P.prev[c]; } return path; };
  E.moveBudget = (G, p) => (G.turn.noMove ? 0 : E.speed(G, p) + G.turn.moveBonus);
  E.canMove = (G, p) => G.turn && E.cur(G) === p && !G.turn.moved && !G.turn.noMove && !G.over;
  E.move = async function (G, p, target) {
    if (!E.canMove(G, p)) return { ok: false, why: "Você já se moveu neste turno." };
    const P = E.reach(G, p, E.moveBudget(G, p));
    if (target === p.pos || P.steps[target] === Infinity || P.steps[target] > E.moveBudget(G, p)) return { ok: false, why: "Fora do alcance." };
    const path = E.pathTo(P, target);
    G.turn.moved = true;
    await E.ui.anim(G, "move", { p, path });
    p.pos = target;
    const entersCursed = path.some((h) => G.map[h].t === "maldita");
    if (!p.skel && R(G).cursedWater && entersCursed && !G.turn.cursed) { G.turn.cursed = true; await drawCurse(G, p, "águas amaldiçoadas"); }
    E.ui.update(G);
    return { ok: true };
  };

  // ---------------- ATIVIDADES ----------------
  E.LOC_NOME = { pesca: "Pescar", bau: "Abrir baú", nauf: "Abrir naufrágio", comercio: "Comércio", ossuario: "Ossuário", pedra: "Pedra das Sereias", taverna: "Taverna", capela: "Capela", altar: "Altar de Transmutação", ataque: "Atacar" };
  E.attackable = (G, A, D) => D !== A && D.alive && !(D.protect && !D.skel) && G.map[A.pos].nb.includes(D.pos);
  E.chestSites = (G, p) => G.map[p.pos].nb.filter((n) => G.map[n].t === (p.skel ? "cemiterio" : "ilha") && G.sites[n] > 0);
  E.locations = function (G, p) {
    const h = p.pos, M = G.map, out = [];
    const add = (loc, ok, why) => out.push({ loc, ok, why });
    const t = M[h].t;
    if (t === (p.skel ? "maldita" : "mar")) add("pesca", true);
    const sites = E.chestSites(G, p); if (sites.length) add(p.skel ? "nauf" : "bau", true);
    if (E.adjType(G, h, "comercio") || E.onBorder(G, h, "lr") || E.permArt(p, "selo")) add("comercio", true);
    if (E.onBorder(G, h, "lr")) add("ossuario", p.skel, p.skel ? "" : "Só esqueletos usam o Ossuário.");
    if (E.adjType(G, h, "pedra") || E.onBorder(G, h, "ul")) add("pedra", true);
    if (E.onBorder(G, h, "ur")) add("taverna", true);
    if (E.onBorder(G, h, "ll")) add("capela", !p.skel, p.skel ? "Esqueletos são imunes a maldições." : "");
    if (E.adjType(G, h, "altar")) add("altar", !p.skel, p.skel ? "Você já é esqueleto." : "");
    const targets = G.players.filter((o) => E.attackable(G, p, o));
    if (targets.length) add("ataque", true);
    return out;
  };
  E.canAct = (G, p, loc) => G.turn && E.cur(G) === p && !G.over && (!G.turn.act || (G.turn.act === loc && ["comercio", "ossuario", "pedra", "taverna", "capela"].includes(loc)));
  function claim(G, p, loc) { if (!E.canAct(G, p, loc)) return false; G.turn.act = loc; return true; }

  E.fish = async function (G, p) {
    if (G.map[p.pos].t !== (p.skel ? "maldita" : "mar")) return { ok: false, why: p.skel ? "Esqueletos pescam em águas amaldiçoadas." : "Piratas pescam em mar aberto." };
    if (!claim(G, p, "pesca")) return { ok: false, why: "Você já fez sua atividade." };
    const n = E.fishYield(G, p);
    await E.ui.anim(G, "fish", { p, n });
    log(G, `${p.name} pesca ${n} ${n === 1 ? "peixe" : "peixes"}${E.permArt(p, "perola") ? " e 1 ouro (Pérola)" : ""}.`, "info", p.id);
    p.st.fish += n;
    await E.gain(G, p, E.permArt(p, "perola") ? { peixe: n, ouro: 1 } : { peixe: n });
    E.ui.update(G);
    return { ok: true };
  };

  E.cardValue = (card) => { let v = 0; for (const k in card.r) v += k === "art" ? 8 : E.VAL[k] * card.r[k]; if (card.f.curse) v -= 1.5; if (card.f.risk) v -= 2.5; if (card.f.eff || card.f.now) v += 1.5; return v; };
  E.openChest = async function (G, p, site) {
    const sites = E.chestSites(G, p);
    if (site === undefined) site = sites[0];
    if (!sites.includes(site)) return { ok: false, why: "Nenhum local com marcador ao seu lado." };
    if (!claim(G, p, p.skel ? "nauf" : "bau")) return { ok: false, why: "Você já fez sua atividade." };
    const deckK = p.skel ? "nauf" : "bau", deck = G.decks[deckK];
    G.sites[site]--;
    if (!deck.length) { log(G, `O baralho de ${p.skel ? "naufrágios" : "baús"} acabou.`, "warn"); return { ok: true }; }
    let card = deck.pop();
    if (!p.skel && E.hasX(p, "vigia") && deck.length && (await decide(G, p, "useVigia", { card }))) {
      useX(p, "vigia"); const c2 = deck.pop();
      const pick = await decide(G, p, "vigiaPick", { cards: [card, c2] });
      const keep = pick === 1 ? c2 : card, back = pick === 1 ? card : c2; deck.unshift(back); card = keep;
      log(G, `${p.name} usa o Olho do Vigia e escolhe entre 2 cartas.`, "info", p.id);
    }
    if (E.permArt(p, "olho") && deck.length) {
      const keep = await decide(G, p, "olhoKeep", { card });
      if (!keep) { deck.unshift(card); card = deck.pop(); log(G, `${p.name} usa o Olho do Abismo e troca a carta.`, "info", p.id); }
    }
    G.stats[p.skel ? "naufs" : "chests"]++; p.st.chests++;
    await E.ui.anim(G, "card", { p, card, deck: deckK });
    const bundle = {}; for (const k of RES) if (card.r[k]) bundle[k] = card.r[k];
    if (E.permArt(p, "coroa") && Object.keys(bundle).length) { const k = await decide(G, p, "coroaPick", { keys: Object.keys(bundle) }); const kk = bundle[k] !== undefined ? k : Object.keys(bundle)[0]; bundle[kk]++; }
    log(G, `${p.name} abre ${p.skel ? "o naufrágio" : "o baú"} “${card.n}”: ${Object.keys(bundle).length || card.r.art ? E.bundleStr(bundle) + (card.r.art ? (Object.keys(bundle).length ? " e " : "") + "1 artefato" : "") : "sem valor"}.`, "card", p.id);
    await E.gain(G, p, bundle);
    if (card.f.curse) await drawCurse(G, p, "baú");
    if (card.f.eff) { p.extras.push(card.f.eff); log(G, `${p.name} guarda o efeito ${NT.EXTRA[card.f.eff].n}.`, "info", p.id); }
    if (card.f.now === "crew2") { const g = Math.min(2, R(G).maxCrew - p.crew); p.crew += g; log(G, `${p.name} ganha ${g} tripulantes.`, "info", p.id); }
    if (card.f.now === "sino") for (const o of G.players) if (o !== p && o.alive && o.skel && G.map[p.pos].nb.includes(o.pos) && o.crew > 0) { o.crew--; o.wounded = Math.min(o.wounded, o.crew); o.st.crewLost++; log(G, `O Sino dos Afogados tira 1 tripulante de ${o.name}.`, "warn", o.id); }
    if (card.f.now === "luneta") {
      const top = deck.splice(-Math.min(3, deck.length));
      if (top.length) { const order = await decide(G, p, "lunetaOrder", { cards: top.slice().reverse() }); const ord = Array.isArray(order) && order.length === top.length ? order : top.slice().reverse(); for (let i = ord.length - 1; i >= 0; i--) deck.push(ord[i]); log(G, `${p.name} olha e reordena os próximos naufrágios.`, "info", p.id); }
    }
    if (card.f.risk === "kraken" && p.crew > 0) { p.crew--; p.wounded = Math.min(p.wounded, p.crew); p.st.crewLost++; log(G, `O Kraken leva 1 tripulante de ${p.name}.`, "warn", p.id); }
    if (card.f.risk === "correntes") { p.skipNext = true; log(G, `${p.name} fica preso pelas correntes: não se move no próximo turno.`, "warn", p.id); }
    if (card.r.art) await E.giveArt(G, p, p.skel ? "naufragio" : "bau");
    if (!p.skel && E.islandMarkers(G) === 0) await virada(G, "baus");
    E.ui.update(G);
    return { ok: true, card };
  };

  // Operações de loja. op = { id, k? (recurso), n? }
  E.OPS = {
    comercio: ["peixe", "vende4", "compra", "trip", "vel", "atq"],
    ossuario: ["compraConcha", "vendeConcha"], pedra: ["concha", "artefato"], taverna: ["trip", "atq", "idolo"],
    capela: ["limpar"], altar: ["virar"],
  };
  E.opCheck = function (G, p, loc, op) {
    const r = R(G), x = p.res;
    if (!E.locations(G, p).some((l) => l.loc === loc && l.ok)) return "Você não está nesse local.";
    if (!E.canAct(G, p, loc)) return "Você já usou sua atividade neste turno.";
    switch (loc + ":" + op.id) {
      case "comercio:peixe": return x.peixe >= r.fishPerGold ? "" : `Precisa de ${r.fishPerGold} peixe(s).`;
      case "comercio:vende4": return x[op.k] >= 4 ? "" : "Precisa de 4 iguais.";
      case "comercio:compra": return x.ouro >= r.buySup ? "" : `Precisa de ${r.buySup} ouros.`;
      case "comercio:trip": return p.crew >= r.maxCrew ? "Tripulação completa." : x.ouro >= r.crewGold ? "" : `Precisa de ${r.crewGold} ouros.`;
      case "comercio:vel": return p.spd >= r.maxSpeedBonus ? "Limite de velocidade." : canPay(p, { ouro: r.spdGold, lona: 1, polvora: 1 }) ? "" : `Precisa de ${r.spdGold} ouros, 1 lona e 1 pólvora.`;
      case "comercio:atq": return p.atk >= r.maxAtk ? "Limite de ataque." : canPay(p, { ouro: r.atkGold, rum: 1, polvora: 1 }) ? "" : `Precisa de ${r.atkGold} ouros, 1 rum e 1 pólvora.`;
      case "ossuario:compraConcha": return x.ouro >= r.ossConcha ? "" : `Precisa de ${r.ossConcha} ouros.`;
      case "ossuario:vendeConcha": return x.concha >= 1 ? "" : "Precisa de 1 concha.";
      case "pedra:concha": return E.goldPower(G, p) >= r.conchaCost ? "" : `Precisa de ${r.conchaCost} ouros${r.pedraFish ? " (ou peixes)" : ""}.`;
      case "pedra:artefato":
        if (G.turn.artBought >= r.artPerTurn) return "Limite de artefatos por turno.";
        if (!G.decks.art.length) return "Não há mais artefatos.";
        return x.concha >= 1 && E.goldPower(G, p) >= E.artCost(G, p) ? "" : `Precisa de 1 concha e ${E.artCost(G, p)} ouros${r.pedraFish ? " (ou peixes)" : ""}.`;
      case "taverna:trip": return p.crew >= r.maxCrew ? "Tripulação completa." : x.rum >= r.crewRum ? "" : `Precisa de ${r.crewRum} rum.`;
      case "taverna:atq": return p.atk >= r.maxAtk ? "Limite de ataque." : canPay(p, { rum: 1, polvora: 1 }) ? "" : "Precisa de 1 rum e 1 pólvora.";
      case "taverna:idolo": return !E.hasX(p, "crew1") ? "Você não tem o Ídolo." : p.crew >= r.maxCrew ? "Tripulação completa." : "";
      case "capela:limpar": return !p.curses.length ? "Você não tem maldições permanentes." : x.ouro >= r.capelaCost ? "" : `Precisa de ${r.capelaCost} ouros.`;
      case "altar:virar": return p.skel ? "Você já é esqueleto." : x.ouro >= r.transformCost ? "" : `Precisa de ${r.transformCost} ouros.`;
    }
    return "Operação desconhecida.";
  };
  E.op = async function (G, p, loc, op) {
    const why = E.opCheck(G, p, loc, op); if (why) return { ok: false, why };
    claim(G, p, loc);
    const r = R(G), x = p.res; let msg = "";
    switch (loc + ":" + op.id) {
      case "comercio:peixe": { const n = op.n === "all" ? Math.floor(x.peixe / r.fishPerGold) : 1; x.peixe -= n * r.fishPerGold; x.ouro += n; msg = `vende ${n * r.fishPerGold} peixe(s) por ${n} ouro(s)`; break; }
      case "comercio:vende4": x[op.k] -= 4; x.ouro += r.sell4; msg = `vende 4 ${NT.RES_NOME_PL[op.k]} por ${r.sell4} ouros`; break;
      case "comercio:compra": x.ouro -= r.buySup; x[op.k]++; msg = `compra 1 ${NT.RES_NOME[op.k].toLowerCase()}`; break;
      case "comercio:trip": x.ouro -= r.crewGold; p.crew++; msg = "contrata 1 tripulante"; break;
      case "comercio:vel": pay(p, { ouro: r.spdGold, lona: 1, polvora: 1 }); p.spd++; msg = "compra +1 de velocidade"; break;
      case "comercio:atq": pay(p, { ouro: r.atkGold, rum: 1, polvora: 1 }); p.atk++; msg = "compra +1 de ataque"; break;
      case "ossuario:compraConcha": x.ouro -= r.ossConcha; x.concha++; msg = "troca ouro por 1 concha"; break;
      case "ossuario:vendeConcha": x.concha--; x.ouro += r.ossVende; msg = `troca 1 concha por ${r.ossVende} ouros`; break;
      case "pedra:concha": payGold(G, p, r.conchaCost, op.goldFirst); x.concha++; msg = "compra 1 concha"; break;
      case "pedra:artefato": { const c = E.artCost(G, p); x.concha--; payGold(G, p, c, op.goldFirst); G.turn.artBought++; log(G, `${p.name} paga 1 concha e ${c} ouros na Pedra das Sereias.`, "info", p.id); await E.giveArt(G, p, "pedra"); E.ui.update(G); return { ok: true }; }
      case "taverna:trip": x.rum -= r.crewRum; p.crew++; msg = "contrata 1 tripulante"; break;
      case "taverna:atq": pay(p, { rum: 1, polvora: 1 }); p.atk++; msg = "compra +1 de ataque"; break;
      case "taverna:idolo": useX(p, "crew1"); p.crew++; msg = "recruta 1 tripulante grátis (Ídolo)"; break;
      case "capela:limpar": x.ouro -= r.capelaCost; p.curses = []; msg = "remove todas as maldições"; break;
      case "altar:virar": x.ouro -= r.transformCost; transform(G, p); msg = "faz o pacto e vira esqueleto"; log(G, `${p.name} ${msg}${r.transformGift ? " (ganha 1 concha)" : ""}.`, "virada", p.id); await E.ui.anim(G, "transform", { p }); if (r.transformGift) await E.gain(G, p, { concha: 1 }); E.ui.update(G); return { ok: true };
    }
    log(G, `${p.name} ${msg} (${E.LOC_NOME[loc]}).`, "shop", p.id);
    await enforceLimit(G, p);
    E.ui.update(G);
    return { ok: true };
  };

  // ---------------- COMBATE ----------------
  const PMAX = {}; for (let k = 1; k <= 3; k++) PMAX[k] = [0, 1, 2, 3, 4, 5, 6].map((i) => (i === 0 ? 0 : (Math.pow(i, k) - Math.pow(i - 1, k)) / Math.pow(6, k)));
  E.prob = function (a, d, diff) {
    let w = 0, l = 0;
    for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) { const pr = PMAX[a][i] * PMAX[d][j]; if (i + diff > j) w += pr; else if (i + diff < j) l += pr; }
    return [w, l, 1 - w - l];
  };
  E.atkBonus = (G, A, D, extra = 0) => {
    let b = Math.min(R(G).maxAtk, A.atk) + extra;
    if (E.permArt(A, "ultimo") && E.avail(A) <= 2) b += 2;
    if (E.hasCurse(A, "peEsquerdo")) b -= 1;
    if (E.hasCurse(D, "luaSangue")) b += 1;
    if (E.hasX(A, "atk2")) b += 2;
    if (E.hasX(A, "combat2")) b += 2; else if (E.hasX(A, "combat1")) b += 1;
    return b;
  };
  // Defesa permanente: os cascos se somam (cada cópia conta), Relíquia +1 depois da Virada.
  E.artCount = (p, id) => p.arts.filter((x) => x.id === id).length;
  E.defBase = (G, D) => E.artCount(D, "casco1") + 2 * E.artCount(D, "casco2") + (E.permArt(D, "reliquia") && G.virada ? 1 : 0);
  E.defBonus = (G, D, A) => {
    let b = E.defBase(G, D);
    if (E.permArt(D, "ultimo") && E.avail(D) <= 2) b += 1;
    if (E.hasCurse(D, "peEsquerdo")) b -= 1;
    if (E.hasCurse(A, "luaSangue")) b += 1;
    if (E.hasX(D, "def1")) b += 1;
    if (E.hasX(D, "combat2")) b += 2; else if (E.hasX(D, "combat1")) b += 1;
    return b;
  };
  E.canSteal = (G, W, L) => R(G).artSteal !== "nao" && L.arts.length > W.arts.length && (R(G).artSteal === "todos" || L.skel);

  E.attack = async function (G, A, D, opt = {}) {
    if (!E.attackable(G, A, D)) return { ok: false, why: "Esse alvo não pode ser atacado agora." };
    if (!claim(G, A, "ataque")) return { ok: false, why: "Você já fez sua atividade." };
    const k = Math.max(1, Math.min(E.maxDice(A), opt.k || E.maxDice(A)));
    G.stats.attacks++; A.st.attacks++; D.st.defenses++;
    log(G, `${A.name} ataca ${D.name} com ${k} ${k === 1 ? "dado" : "dados"}.`, "combat", A.id);
    if (E.hasArt(D, "ancora") && (await decide(G, D, "useAncora", { A, k }))) {
      D.arts.find((x) => x.id === "ancora" && !x.used).used = true; G.stats.cancels++;
      log(G, `${D.name} revela a Âncora Falsa: o ataque é cancelado.`, "combat", D.id);
      await E.ui.anim(G, "combatEnd", { A, D, result: "ancora" });
      E.ui.update(G); return { ok: true, result: "ancora" };
    }
    let d = await decide(G, D, "defDice", { A, k });
    d = Math.max(1, Math.min(E.maxDice(D), d | 0 || 1));
    let extra = 0;
    if (opt.oneShot && E.hasArt(A, opt.oneShot) && ["bandeira", "gancho"].includes(opt.oneShot)) { A.arts.find((x) => x.id === opt.oneShot && !x.used).used = true; extra = opt.oneShot === "bandeira" ? 4 : 3; log(G, `${A.name} usa ${NT.ARTS[opt.oneShot].n} (+${extra}).`, "combat", A.id); }
    const ba = E.atkBonus(G, A, D, extra), bd = E.defBonus(G, D, A);
    for (const x of [A, D]) { if (!useX(x, "combat2")) useX(x, "combat1"); }
    useX(A, "atk2"); useX(D, "def1");
    const roll = (n) => Array.from({ length: n }, () => 1 + ri(6));
    let da = roll(k), dd = roll(d);
    const tot = () => [Math.max(...da) + ba, Math.max(...dd) + bd];
    await E.ui.anim(G, "dice", { A, D, da, dd, ba, bd, stage: "roll" });
    for (const [side, other, arr, isA] of [[A, D, da, true], [D, A, dd, false]]) {
      const [ta, td] = tot(); const losing = isA ? ta <= td : td <= ta;
      if (losing && E.hasX(side, "reroll") && (await decide(G, side, "reroll", { ta, td, dice: arr.slice() }))) {
        useX(side, "reroll");
        let idx = 0; if (arr.length > 1) { let mn = 7; arr.forEach((v, i) => { if (v < mn) { mn = v; idx = i; } }); }
        arr[idx] = 1 + ri(6);
        log(G, `${side.name} usa o Trevo da Sorte e rejoga um dado.`, "combat", side.id);
        await E.ui.anim(G, "dice", { A, D, da, dd, ba, bd, stage: "reroll" });
      }
    }
    const [ta, td] = tot();
    if (ta === td) { G.stats.ties++; log(G, `Empate (${ta} a ${td}): nada acontece.`, "combat"); await E.ui.anim(G, "combatEnd", { A, D, result: "empate", ta, td }); E.ui.update(G); return { ok: true, result: "empate" }; }
    const aw = ta > td;
    const [W, L, nW, nL] = aw ? [A, D, k, d] : [D, A, d, k];
    if (aw) { G.stats.attackWins++; A.st.attackWins++; } else { G.stats.defWins++; D.st.defWins++; }
    log(G, `${W.name} vence o combate (${Math.max(ta, td)} a ${Math.min(ta, td)}).`, "combat", W.id);
    await E.ui.anim(G, "combatEnd", { A, D, result: aw ? "atacante" : "defensor", ta, td });
    // saque ou artefato
    let tookArt = false;
    if (aw && E.canSteal(G, A, D) && (await decide(G, A, "stealChoice", { L: D })) === "art") {
      const idx = await decide(G, D, "giveArtifact", { to: A, why: "roubo" });
      const i = Number.isInteger(idx) && D.arts[idx] ? idx : NT.Bot.leastArt(D);
      const a = D.arts.splice(i, 1)[0]; A.arts.push(a); tookArt = true;
      G.stats.artSteals++; G.stats.artFrom.combate++; A.st.artFrom.combate = (A.st.artFrom.combate || 0) + 1;
      log(G, `${A.name} toma o artefato ${NT.ARTS[a.id].n} de ${D.name}.`, "art", A.id);
      checkWin(G, A);
    }
    if (!tookArt) {
      const n = nW * R(G).lootPerDie, loot = {};
      for (let i = 0; i < n; i++) { const pool = []; for (const r of RES) for (let j = 0; j < L.res[r]; j++) pool.push(r); if (!pool.length) break; const r = pool[ri(pool.length)]; L.res[r]--; loot[r] = (loot[r] || 0) + 1; }
      const cnt = Object.values(loot).reduce((s, v) => s + v, 0); W.st.stolen += cnt; L.st.lostLoot += cnt;
      log(G, cnt ? `${W.name} saqueia ${E.bundleStr(loot)} de ${L.name}.` : `${L.name} não tinha nada para saquear.`, "combat", W.id);
      await E.gain(G, W, loot);
    }
    if (G.over) { E.ui.update(G); return { ok: true }; }
    // dano
    const dmg = R(G).dmgByWinner ? nW : nL;
    if (!L.skel) {
      const w = Math.min(dmg, E.avail(L));
      if (w > 0) { L.wounded += w; L.protect = true; log(G, `${w} ${w === 1 ? "tripulante" : "tripulantes"} de ${L.name} ${w === 1 ? "fica ferido" : "ficam feridos"}; ${L.name} não pode ser atacado até se recuperar.`, "combat", L.id); }
    } else if (L.crew > 0) {
      const kk = Math.min(dmg, L.crew); L.crew -= kk; L.wounded = Math.min(L.wounded, L.crew); L.st.crewLost += kk;
      log(G, `${L.name} perde ${kk} ${kk === 1 ? "tripulante" : "tripulantes"} para sempre.`, "combat", L.id);
    } else await sink(G, L, W);
    E.ui.update(G);
    return { ok: true, result: aw ? "atacante" : "defensor" };
  };
  async function sink(G, L, W) {
    G.stats.sinks++; L.st.sinks++;
    await E.ui.anim(G, "sink", { p: L });
    if (!R(G).respawn) {
      L.alive = false; for (const a of L.arts) W.arts.push(a); const n = L.arts.length; L.arts = [];
      log(G, `${L.name} é eliminado. ${W.name} recebe ${n} artefato(s).`, "virada", L.id); checkWin(G, W);
      const alive = G.players.filter((p) => p.alive); if (!G.over && alive.length === 1) { G.over = true; G.winner = alive[0].id; G.winType = "último sobrevivente"; }
      return;
    }
    log(G, `O barco de ${L.name} afunda!`, "virada", L.id);
    if (L.arts.length) {
      const idx = await decide(G, L, "giveArtifact", { to: W, why: "afundar" });
      const i = Number.isInteger(idx) && L.arts[idx] ? idx : NT.Bot.leastArt(L);
      const a = L.arts.splice(i, 1)[0]; W.arts.push(a); G.stats.artFrom.afundar++; W.st.artFrom.afundar = (W.st.artFrom.afundar || 0) + 1;
      log(G, `${L.name} entrega ${NT.ARTS[a.id].n} a ${W.name}.`, "art", W.id); checkWin(G, W);
    }
    const lost = {}; for (const r of RES) { const n = Math.ceil(L.res[r] / 2); if (n) lost[r] = n; L.res[r] -= n; }
    L.crew = 1; L.wounded = 0;
    // Manual v5: renasce num hexágono de início livre à escolha dele
    const free = G.map.filter((h) => h.start !== undefined && !E.occupied(G, h.id, L)).map((h) => h.id);
    if (free.length) { const c = await decide(G, L, "respawnHex", { options: free }); L.pos = free.includes(c) ? c : free[ri(free.length)]; }
    log(G, `${L.name} perde ${E.bundleStr(lost)} e renasce num hexágono de início com 1 tripulante.`, "warn", L.id);
  }

  // ---------------- ARTEFATOS DE USO ÚNICO E EFEITOS GUARDADOS ----------------
  E.useArtifact = async function (G, p, id, arg = {}) {
    if (E.cur(G) !== p || G.over) return { ok: false, why: "Só no seu turno." };
    const a = p.arts.find((x) => x.id === id && !x.used); if (!a) return { ok: false, why: "Artefato indisponível." };
    if (id === "reforcos") { if (p.crew >= R(G).maxCrew) return { ok: false, why: "Tripulação completa." }; a.used = true; const g = Math.min(2, R(G).maxCrew - p.crew); p.crew += g; log(G, `${p.name} usa Reforços da Tripulação: +${g} tripulantes.`, "art", p.id); }
    else if (id === "bolsa") { const b = arg.bundle || (await decide(G, p, "bolsaPick", { n: 3 })); const tot = SUP.reduce((s, k) => s + (b[k] || 0), 0); if (tot !== 3) return { ok: false, why: "Escolha 3 suprimentos." }; a.used = true; log(G, `${p.name} abre a Bolsa do Rei Afogado: ${E.bundleStr(b)}.`, "art", p.id); await E.gain(G, p, b); }
    else if (id === "saque") {
      const o = G.players[arg.target], k = arg.k;
      if (!o || o === p || !SUP.includes(k)) return { ok: false, why: "Escolha um jogador e um suprimento." };
      a.used = true; const n = o.res[k]; o.res[k] = 0; log(G, `${p.name} usa o Saque dos Suprimentos e toma ${n} ${NT.RES_NOME_PL[k]} de ${o.name}.`, "art", p.id); await E.gain(G, p, { [k]: n });
    } else if (id === "bussola") { if (G.turn.moved) return { ok: false, why: "Use antes de se mover." }; a.used = true; G.turn.moveBonus += 6; log(G, `${p.name} usa a Bússola de Meia-Noite: +6 de movimento neste turno.`, "art", p.id); }
    else return { ok: false, why: "Esse artefato é usado no combate." };
    E.ui.update(G); return { ok: true };
  };
  E.useExtra = async function (G, p, eff, arg = {}) {
    if (E.cur(G) !== p || G.over || !E.hasX(p, eff)) return { ok: false, why: "Indisponível." };
    if (eff === "mov1" || eff === "mov2") { if (G.turn.moved) return { ok: false, why: "Use antes de se mover." }; useX(p, eff); G.turn.moveBonus += eff === "mov1" ? 1 : 2; log(G, `${p.name} usa ${NT.EXTRA[eff].n}: +${eff === "mov1" ? 1 : 2} de movimento.`, "info", p.id); }
    else if (eff === "crew1") { useX(p, eff); log(G, `${p.name} troca o Ídolo do Saqueador por 3 ouros.`, "info", p.id); await E.gain(G, p, { ouro: 3 }); }
    else if (eff === "amuleto") { if (!p.curses.length) return { ok: false, why: "Sem maldições permanentes." }; const c = p.curses.includes(arg.curse) ? arg.curse : arg0(p); useX(p, eff); p.curses.splice(p.curses.indexOf(c), 1); log(G, `${p.name} usa o Amuleto e remove ${NT.CURSES[c].n}.`, "info", p.id); }
    else return { ok: false, why: "Esse efeito é automático." };
    E.ui.update(G); return { ok: true };
    function arg0(pp) { return pp.curses[0]; }
  };

  // ---------------- NEGOCIAÇÃO ----------------
  E.tradeCheck = function (G, A, B, give, get) {
    for (const k in give) if (!E.TRADE_RES.includes(k) || give[k] < 0 || A.res[k] < give[k]) return `${A.name} não tem ${E.bundleStr({ [k]: give[k] })}.`;
    for (const k in get) if (!E.TRADE_RES.includes(k) || get[k] < 0 || B.res[k] < get[k]) return `${B.name} não tem ${E.bundleStr({ [k]: get[k] })}.`;
    const sum = (b) => Object.values(b).reduce((s, v) => s + (v || 0), 0);
    if (!sum(give) && !sum(get)) return "A troca está vazia.";
    if (E.hand(A) - sum(give) + sum(get) > R(G).handLimit) return `${A.name} passaria do limite de ${R(G).handLimit}.`;
    if (E.hand(B) - sum(get) + sum(give) > R(G).handLimit) return `${B.name} passaria do limite de ${R(G).handLimit}.`;
    return "";
  };
  E.trade = function (G, A, B, give, get) {
    const why = E.tradeCheck(G, A, B, give, get); if (why) return { ok: false, why };
    for (const k in give) { A.res[k] -= give[k]; B.res[k] += give[k]; }
    for (const k in get) { B.res[k] -= get[k]; A.res[k] += get[k]; }
    G.stats.trades++; A.st.trades++; B.st.trades++;
    log(G, `${A.name} troca ${E.bundleStr(give)} com ${B.name} por ${E.bundleStr(get)}.`, "trade", A.id);
    E.ui.update(G); return { ok: true };
  };

  // ---------------- TURNOS ----------------
  E.startTurn = function (G) {
    const p = E.cur(G);
    G.turn = { pid: p.id, moved: false, act: null, artBought: 0, cursed: false, moveBonus: 0, noMove: !!p.skipNext, tradesProposed: 0 };
    p.skipNext = false;
    p.healAtEnd = p.wounded > 0;
    if (G.turn.noMove) log(G, `${p.name} não pode se mover neste turno.`, "warn", p.id);
  };
  E.endTurn = async function (G) {
    const p = E.cur(G);
    if (E.hasCurse(p, "bolsoFurado") && p.res.ouro > 0 && !G.over) { p.res.ouro--; log(G, `O Bolso Furado leva 1 ouro de ${p.name}.`, "muted", p.id); }
    if (p.healAtEnd && p.wounded > 0) { p.wounded = 0; p.protect = false; log(G, `A tripulação de ${p.name} se recupera.`, "muted", p.id); }
    p.healAtEnd = false;
    if (G.over) return;
    // próximo jogador vivo
    let guard = 0;
    do {
      G.ti++;
      if (G.ti >= G.order.length) {
        G.ti = 0;
        if (G.artDeckOut) { finishByCount(G, "o baralho de artefatos acabou"); return; }
        snapHist(G);
        G.round++;
        if (R(G).maxRounds > 0 && G.round > R(G).maxRounds) { G.round--; finishByCount(G, "limite de rodadas"); return; }
        log(G, `Rodada ${G.round}.`, "round");
        if (R(G).mareRound > 0 && G.round >= R(G).mareRound && !G.virada) await virada(G, "mare");
      }
    } while (!E.cur(G).alive && ++guard < 20);
  };
  function snapHist(G) { if (!G.hist) G.hist = []; G.hist[G.round] = G.players.map((p) => p.arts.length); }
  E.snapHist = snapHist;
  function finishByCount(G, why) {
    const s = G.players.filter((p) => p.alive).sort((a, b) => b.arts.length - a.arts.length || E.hand(b) - E.hand(a));
    G.over = true; G.winner = s[0].id; G.winType = `mais artefatos (${why})`;
    log(G, `Fim da partida (${why}): ${s[0].name} vence com ${s[0].arts.length} artefatos.`, "win", s[0].id);
  }

  // Laço principal: humano espera a interface; bots jogam sozinhos.
  E.run = async function (G) {
    G.running = true;
    while (!G.over && !G.aborted) {
      const p = E.cur(G);
      if (!G.turn || G.turn.pid !== p.id || G.turn.done) E.startTurn(G);
      E.ui.update(G);
      await E.ui.turnStart(G, p);
      if (p.human && !G.autoplay) await E.ui.humanTurn(G, p);
      else await NT.Bot.playTurn(G, p);
      if (G.over || G.aborted) break;
      G.turn.done = true;
      await E.endTurn(G);
      E.ui.update(G);
      E.ui.save(G);
    }
    G.running = false;
    if (G.aborted) return;
    snapHist(G);
    E.ui.update(G);
    await E.ui.gameOver(G);
  };
})(window.NT);
