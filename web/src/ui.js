// Nautilus online — interface: tabuleiro, painel, modais, configuração.
(function (NT) {
  // Ganchos de teste (#autoteste, NT.debug) só existem no servidor de desenvolvimento, nunca no site publicado.
  const DEV = !!(import.meta.env && import.meta.env.DEV);
  const E = NT.E, Bot = NT.Bot, RES = NT.RES, SUP = NT.SUP;
  const $ = (s) => document.querySelector(s);
  const SVGNS = "http://www.w3.org/2000/svg";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icon = (k, cls = "ico") => `<img class="${cls}" src="assets/icones/${k}.png" alt="${NT.RES_NOME[k] || k}">`;
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const CFG_KEY = "nautilus-cfg-v1", SAVE_KEY = "nautilus-save-v1";

  let G = null, busy = false, endTurnResolve = null, hoverHex = -1, testMode = false;
  let sug = null, dragMoved = false, logFilter = "all", pedraGoldFirst = false;
  let cfg = Object.assign({ name: "Você", color: 0, nBots: 3, diffs: ["medio", "medio", "medio", "medio", "medio"], mapMode: "aleatorio", speed: 650, test: false, sound: true, confirmEnd: true, seenIntro: false, anim: "auto", audio: null, rules: NT.defaultRules() }, store.get(CFG_KEY) || {});
  cfg.audio = Object.assign({ mute: cfg.sound === false, master: 0.8, sfx: 0.8, ui: 0.6, amb: 0.45, ambOn: false }, cfg.audio || {});
  const FX = NT.FX, SFX = NT.SFX, EASE = FX.EASE;
  function applyPrefs() { Object.assign(SFX.cfg, cfg.audio); SFX.apply(); FX.pref = cfg.anim || "auto"; document.documentElement.classList.toggle("rm", FX.reduced()); }
  applyPrefs();
  cfg.rules = Object.assign(NT.defaultRules(), cfg.rules || {});
  testMode = !!cfg.test;
  const human = () => G && G.players.find((p) => p.human);
  const isHumanTurn = () => G && !G.over && !G.autoplay && !!endTurnResolve && !!G.turn && E.cur(G).human && G.turn.pid === E.cur(G).id;
  const speedMs = () => (G ? G.botDelay : cfg.speed);

  // ======================= SOM =======================
  // Nomes antigos → receitas do motor de áudio (js/fx.js).
  const SFX_MAP = { art: "reward" };
  function sfx(kind, arg) { if (G && G.autoplay) return; SFX.play(SFX_MAP[kind] || kind, arg); }
  // clique tátil em botões (barramento de interface; nunca em hover)
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest(".btn, .choice, .seg button, .pl"); if (b && !b.disabled) sfx("click"); }, true);

  // ======================= TABULEIRO =======================
  const svg = $("#board");
  const S = (tag, a = {}) => { const el = document.createElementNS(SVGNS, tag); for (const k in a) el.setAttribute(k, a[k]); return el; };
  const hexPts = (R) => [0, 1, 2, 3, 4, 5].map((i) => { const ang = (Math.PI / 180) * (60 * i - 90); return `${(R * Math.cos(ang)).toFixed(2)},${(R * Math.sin(ang)).toFixed(2)}`; }).join(" ");
  let layers = {};
  const VB0 = { x: 0, y: 0, w: NT.GEO.W, h: NT.GEO.H }; let vb = { ...VB0 };
  function applyVB() {
    const minW = VB0.w / 4; vb.w = Math.max(minW, Math.min(VB0.w, vb.w)); vb.h = (vb.w * VB0.h) / VB0.w;
    vb.x = Math.max(0, Math.min(VB0.w - vb.w, vb.x)); vb.y = Math.max(0, Math.min(VB0.h - vb.h, vb.y));
    svg.setAttribute("viewBox", `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`);
    svg.classList.toggle("zoomed", vb.w < VB0.w - 1);
  }
  function toSvg(cx, cy) { const m = svg.getScreenCTM(); if (!m) return { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }; const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse()); return { x: pt.x, y: pt.y }; }
  function zoomAt(f, cx, cy) { const nw = Math.max(VB0.w / 4, Math.min(VB0.w, vb.w * f)), k = nw / vb.w; vb.x = cx - (cx - vb.x) * k; vb.y = cy - (cy - vb.y) * k; vb.w = nw; applyVB(); }
  function zoomCenter(f) { zoomAt(f, vb.x + vb.w / 2, vb.y + vb.h / 2); }
  function resetZoom() { vb = { ...VB0 }; applyVB(); }
  (function wireZoom() {
    svg.addEventListener("wheel", (e) => { e.preventDefault(); const p = toSvg(e.clientX, e.clientY); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y); }, { passive: false });
    const ptrs = new Map(); let start = null, pinch = null;
    svg.addEventListener("pointerdown", (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = false; start = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: vb.w }; } });
    window.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const c = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2); zoomAt((pinch.w * (pinch.d / Math.max(1, d))) / vb.w, c.x, c.y); dragMoved = true; return; }
      if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragMoved && Math.hypot(dx, dy) < 6) return;
      if (vb.w >= VB0.w - 1) return; // sem zoom não há o que arrastar
      dragMoved = true; const m = svg.getScreenCTM(); const sc = m ? m.a : 1; vb.x = start.vx - dx / sc; vb.y = start.vy - dy / sc; applyVB();
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) start = null; };
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  })();
  function buildBoard() {
    svg.innerHTML = ""; resetZoom();
    const g = NT.GEO, R = g.R;
    const defs = S("defs"); const cp = S("clipPath", { id: "hc" }); cp.appendChild(S("polygon", { points: hexPts(R * 1.0) })); defs.appendChild(cp);
    const flt = S("filter", { id: "sh", x: "-30%", y: "-30%", width: "160%", height: "160%" }); flt.appendChild(S("feDropShadow", { dx: 0, dy: 4, stdDeviation: 4, "flood-color": "#000", "flood-opacity": 0.6 })); defs.appendChild(flt);
    const grad = (tag, id, attrs, stops) => { const gEl = S(tag, Object.assign({ id }, attrs)); for (const [o, c, op] of stops) gEl.appendChild(S("stop", { offset: o, "stop-color": c, "stop-opacity": op ?? 1 })); defs.appendChild(gEl); };
    grad("linearGradient", "rim", { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, "#f6e2a6"], [0.45, "#c9973f"], [0.55, "#8a5f22"], [1, "#d3a552"]]);
    grad("radialGradient", "gloss", { cx: 0.35, cy: 0.28, r: 0.8 }, [[0, "#fff", 0.5], [0.42, "#fff", 0], [1, "#000", 0.45]]);
    grad("radialGradient", "coin", { cx: 0.35, cy: 0.3, r: 0.8 }, [[0, "#fff3c8"], [0.5, "#e2b85e"], [1, "#8a6222"]]);
    grad("radialGradient", "vig", { cx: 0.5, cy: 0.5, r: 0.72 }, [[0.62, "#000", 0], [1, "#02090c", 0.55]]);
    grad("radialGradient", "gemR", { cx: 0.35, cy: 0.3, r: 0.8 }, [[0, "#ff9a86"], [0.5, "#c8392d"], [1, "#5e130c"]]);
    grad("radialGradient", "gemB", { cx: 0.35, cy: 0.3, r: 0.8 }, [[0, "#9cc8ff"], [0.5, "#2f6fc2"], [1, "#0f2a55"]]);
    svg.appendChild(defs);
    svg.appendChild(S("image", { href: "assets/tabuleiro.jpg", x: 0, y: 0, width: g.W, height: g.H, preserveAspectRatio: "none" }));
    const tiles = S("g");
    const SZ = 196; layers.tileEls = [];
    for (const h of G.map) {
      const t = S("g", { transform: `translate(${h.x.toFixed(2)},${h.y.toFixed(2)})` });
      const inner = S("g", { class: "tile" }); inner.style.transformBox = "fill-box"; inner.style.transformOrigin = "center";
      inner.appendChild(S("image", { href: `assets/${h.img}.webp`, x: -SZ / 2, y: -SZ / 2, width: SZ, height: SZ, "clip-path": "url(#hc)" }));
      inner.appendChild(S("polygon", { points: hexPts(R), fill: "none", stroke: "#06121580", "stroke-width": 2 }));
      t.appendChild(inner); tiles.appendChild(t); layers.tileEls.push({ el: inner, h });
    }
    svg.appendChild(tiles);
    // linhas vermelhas das bordas, redesenhadas sobre os hexágonos
    const V = [0, 1, 2, 3, 4, 5].map((i) => { const a = (Math.PI / 180) * (60 * i - 90); return [R * Math.cos(a), R * Math.sin(a)]; });
    const EDGE = { NE: [0, 1], E: [1, 2], SE: [2, 3], SW: [3, 4], W: [4, 5], NW: [5, 0] };
    const red = S("g", { stroke: "#b3261e", "stroke-width": 5, "stroke-linecap": "round", fill: "none" });
    for (const side in NT.BORDAS) for (const [r, i, dirs] of NT.BORDAS[side].hx) {
      const h = G.map.find((x) => x.r === r && x.i === i);
      for (const d of dirs.split(" ")) { const [a, b] = EDGE[d]; red.appendChild(S("line", { x1: h.x + V[a][0], y1: h.y + V[a][1], x2: h.x + V[b][0], y2: h.y + V[b][1] })); }
    }
    svg.appendChild(red);
    // vinheta e moldura de latão em volta da carta náutica
    svg.appendChild(S("rect", { x: 0, y: 0, width: g.W, height: g.H, fill: "url(#vig)", "pointer-events": "none" }));
    svg.appendChild(S("rect", { x: 4, y: 4, width: g.W - 8, height: g.H - 8, rx: 16, fill: "none", stroke: "#c9a24f", "stroke-width": 5, opacity: 0.85, "pointer-events": "none" }));
    svg.appendChild(S("rect", { x: 14, y: 14, width: g.W - 28, height: g.H - 28, rx: 10, fill: "none", stroke: "#7d5c24", "stroke-width": 1.5, opacity: 0.9, "pointer-events": "none" }));
    layers.hl = S("g"); layers.mk = S("g"); layers.trail = S("g", { class: "trails" }); layers.pw = S("g", { filter: "url(#sh)" }); layers.hit = S("g");
    svg.append(layers.hl, layers.mk, layers.trail, layers.pw, layers.hit);
    layers.hlEls = {}; layers.numEls = {};
    for (const h of G.map) {
      const hl = S("polygon", { points: hexPts(R * 0.93), class: "hl", transform: `translate(${h.x},${h.y})` }); layers.hl.appendChild(hl); layers.hlEls[h.id] = hl;
      const num = S("text", { x: h.x + R * 0.42, y: h.y - R * 0.45, class: "stepnum", "text-anchor": "middle" }); layers.hl.appendChild(num); layers.numEls[h.id] = num;
      const hit = S("polygon", { points: hexPts(R), class: "hex-hit", transform: `translate(${h.x},${h.y})`, fill: "transparent" });
      hit.addEventListener("mouseenter", (ev) => { hoverHex = h.id; showTip(h, ev); renderHL(); });
      hit.addEventListener("mousemove", (ev) => placeTip(ev));
      hit.addEventListener("mouseleave", () => { hoverHex = -1; $("#tip").hidden = true; renderHL(); });
      hit.addEventListener("click", () => onHexClick(h.id));
      layers.hit.appendChild(hit);
    }
    layers.pawns = {};
    for (const p of G.players) {
      const gp = S("g", { class: "pawn" });
      gp.appendChild(S("circle", { r: 40, class: "halo", fill: "none", stroke: p.color, "stroke-width": 6 }));
      gp.appendChild(S("ellipse", { cx: 3, cy: 31, rx: 27, ry: 8, fill: "#000", opacity: 0.38 }));
      const tok = S("g", { class: "tok" });
      tok.appendChild(S("circle", { r: 34, fill: "url(#rim)", stroke: "#140c02", "stroke-width": 2.5 }));
      tok.appendChild(S("circle", { r: 27.5, fill: p.color, stroke: "#140c02", "stroke-width": 1.5 }));
      tok.appendChild(S("circle", { r: 27.5, fill: "url(#gloss)" }));
      const ship = S("g", { class: "ship" });
      ship.appendChild(S("path", { d: "M-1 -21 V8", stroke: "#140c02", "stroke-width": 2.4 }));
      ship.appendChild(S("path", { d: "M1.5 -19 Q16 -8 1.5 3 Z", class: "sail", fill: "#f4e8c8", stroke: "#140c02", "stroke-width": 1.5, "stroke-linejoin": "round" }));
      ship.appendChild(S("path", { d: "M-3.5 -14 Q-15.5 -5 -3.5 2 Z", class: "sail", fill: "#e6d4a6", stroke: "#140c02", "stroke-width": 1.5, "stroke-linejoin": "round" }));
      ship.appendChild(S("path", { d: "M-19 5 Q0 12 19 5 L14 14 Q0 19.5 -14 14 Z", fill: "#4a2c12", stroke: "#140c02", "stroke-width": 1.6, "stroke-linejoin": "round" }));
      ship.appendChild(S("path", { d: "M-1 -21 l10 2.6 -10 2.6 Z", fill: "#111", stroke: "#140c02", "stroke-width": 1 }));
      tok.appendChild(ship);
      tok.appendChild(S("circle", { r: 38, class: "prot", fill: "none", stroke: "#7cc69a", "stroke-width": 3.5, "stroke-dasharray": "7 6" }));
      gp.appendChild(tok);
      const sk = S("g", { class: "skull" }); sk.appendChild(S("circle", { cx: 24, cy: -24, r: 13, fill: "#e9e0c8", stroke: "#140c02", "stroke-width": 2 }));
      const su = S("use", { href: "#i-skull", x: 15, y: -33, width: 18, height: 18 }); su.style.color = "#1b1408"; sk.appendChild(su);
      gp.appendChild(sk);
      const bd = S("g", { class: "abadge" }); bd.appendChild(S("circle", { cx: -25, cy: -24, r: 13.5, fill: "url(#coin)", stroke: "#140c02", "stroke-width": 2 })); bd.appendChild(S("text", { x: -25, y: -18, "text-anchor": "middle", style: "font:800 16px var(--display);fill:#2a1906" }));
      gp.appendChild(bd);
      layers.pw.appendChild(gp); layers.pawns[p.id] = gp;
      setPawn(p, p.pos);
    }
    renderBoard();
    if (introPending) { introPending = false; boardIntro(); }
  }
  let introPending = false;
  // Abertura: os hexágonos "assentam" do centro para fora, como montar o mapa na mesa; depois os navios descem.
  function boardIntro() {
    if (FX.reduced()) return;
    const g = NT.GEO;
    for (const { el, h } of layers.tileEls) { const dl = Math.hypot(h.x - g.cx, h.y - g.cy) * 0.55; FX.anim(el, [{ opacity: 0, transform: "scale(.55) rotate(-8deg)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: dl, easing: EASE.spring, fill: "backwards" }); }
    G.players.forEach((p, i) => { const tok = layers.pawns[p.id].querySelector(".tok"); FX.anim(tok, [{ opacity: 0, transform: "translateY(-70px) scale(1.25)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 650 + i * 110, easing: EASE.spring, fill: "backwards" }); });
    setTimeout(() => sfx("sail", 3), 600);
  }
  function pawnXY(p) { const el = layers.pawns && layers.pawns[p.id]; if (!el) return null; const r = el.querySelector(".tok").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function tweenPawn(p, a, b, ms) {
    return new Promise((res) => {
      const el = layers.pawns[p.id], t0 = performance.now(), e = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      (function f(t) { const k = Math.min(1, (t - t0) / ms), q = e(k); el.setAttribute("transform", `translate(${(a.x + (b.x - a.x) * q).toFixed(1)},${(a.y + (b.y - a.y) * q).toFixed(1)})`); if (k < 1) requestAnimationFrame(f); else res(); })(t0);
    });
  }
  function ripple(h) { if (FX.reduced() || !layers.trail) return; const c = S("circle", { cx: h.x, cy: h.y + 6, r: 34, class: "ripple" }); layers.trail.appendChild(c); setTimeout(() => c.remove(), 1100); }    renderBoard();
  function setPawn(p, hid) { const h = G.map[hid]; layers.pawns[p.id].setAttribute("transform", `translate(${h.x.toFixed(1)},${h.y.toFixed(1)})`); }
  let reachCache = null;
  function renderHL() {
    if (!G || !layers.hlEls) return;
    const p = human(); reachCache = null;
    if (p && isHumanTurn() && E.canMove(G, p) && !busy) reachCache = E.reach(G, p, E.moveBudget(G, p));
    for (const h of G.map) {
      const el = layers.hlEls[h.id], num = layers.numEls[h.id], hit = layers.hit.children[h.id];
      let cls = "hl"; num.textContent = "";
      const r = reachCache && h.id !== p.pos && reachCache.steps[h.id] <= E.moveBudget(G, p);
      if (r) { cls += " reach"; if (reachCache.cursed[h.id] > 0 && !p.skel && G.rules.cursedWater) cls += " cursed"; num.textContent = reachCache.steps[h.id]; }
      if (p && h.id === p.pos && isHumanTurn()) cls += " here";
      if (h.id === hoverHex) cls += " hover";
      if (sug && isHumanTurn() && sug.move === h.id) cls += " sug";
      el.setAttribute("class", cls); hit.setAttribute("class", "hex-hit" + (r ? " reach" : ""));
    }
  }
  function renderBoard() {
    if (!G || !layers.mk) return;
    layers.mk.innerHTML = "";
    for (const id in G.sites) {
      const h = G.map[id], n = G.sites[id], col = h.t === "ilha" ? "#c8392d" : "#2f6fc2";
      const g = S("g", { class: "marker", transform: `translate(${h.x},${h.y + 46})` });
      const w = Math.max(1, n) * 14;
      for (let i = 0; i < n; i++) g.appendChild(S("circle", { cx: -w / 2 + 7 + i * 14, cy: 0, r: 7, fill: h.t === "ilha" ? "url(#gemR)" : "url(#gemB)", stroke: "#e7c578", "stroke-width": 1.6 }));
      if (!n) { const t = S("text", { x: 0, y: 6, "text-anchor": "middle" }); t.textContent = "vazio"; g.appendChild(t); }
      layers.mk.appendChild(g);
    }
    for (const p of G.players) {
      const gp = layers.pawns[p.id]; if (!gp) continue;
      gp.style.display = p.alive ? "" : "none";
      gp.querySelector(".skull").style.display = p.skel ? "" : "none";
      const bd = gp.querySelector(".abadge"); bd.style.display = p.arts.length ? "" : "none"; bd.querySelector("text").textContent = p.arts.length;
      gp.querySelector(".prot").style.display = p.protect && !p.skel ? "" : "none";
      gp.setAttribute("class", "pawn" + (!G.over && E.cur(G) === p ? " cur" : "") + (p.skel ? " skel" : ""));
      if (!animating.has(p.id)) setPawn(p, p.pos);
    }
    renderHL();
  }
  const animating = new Set();
  function showTip(h, ev) {
    const tip = $("#tip"); const t = NT.HEX_TIPOS[h.t];
    const lines = [`<b>${t.n}</b>`];
    if (G.sites[h.id] !== undefined) lines.push(`${G.sites[h.id]} ${h.t === "ilha" ? "baú(s)" : "naufrágio(s)"} restante(s) — ${h.t === "ilha" ? "só piratas" : "só esqueletos"}`);
    if (h.start !== undefined) lines.push("Ponto de partida e de renascimento.");
    for (const s of h.sides) lines.push(`Encostado em: ${NT.BORDAS[s].n}`);
    const near = [...new Set(h.nb.map((n) => G.map[n].t).filter((x) => ["comercio", "pedra", "altar", "ilha", "cemiterio"].includes(x)))];
    if (h.nav && near.length) lines.push(`Ao lado de: ${near.map((x) => NT.HEX_TIPOS[x].n).join(", ")}`);
    const who = G.players.filter((p) => p.alive && p.pos === h.id); if (who.length) lines.push(`Navio: ${who.map((p) => esc(p.name)).join(", ")}`);
    const p = human();
    if (h.nav && p && isHumanTurn() && reachCache && (h.id === p.pos || reachCache.steps[h.id] <= E.moveBudget(G, p))) {
      const save = p.pos; p.pos = h.id; let ls; try { ls = E.locations(G, p).filter((l) => l.ok).map((l) => E.LOC_NOME[l.loc]); } finally { p.pos = save; }
      lines.push(ls.length ? `Daqui: ${ls.join(", ")}` : "Daqui: nenhuma atividade");
    }
    if (reachCache && p && reachCache.steps[h.id] <= E.moveBudget(G, p) && h.id !== p.pos) lines.push(`<span style="color:var(--brass2)">Clique para navegar (${reachCache.steps[h.id]} casa${reachCache.steps[h.id] > 1 ? "s" : ""})${reachCache.cursed[h.id] && !p.skel && G.rules.cursedWater ? " — passa por águas amaldiçoadas!" : ""}</span>`);
    tip.innerHTML = lines.join("<br>"); tip.hidden = false; placeTip(ev);
  }
  function placeTip(ev) { const tip = $("#tip"), r = $("#boardwrap").getBoundingClientRect(); let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14; if (x + 270 > r.width) x -= 290; if (y + 160 > r.height) y -= 170; tip.style.left = x + "px"; tip.style.top = y + "px"; }
  async function onHexClick(hid) {
    if (dragMoved) { dragMoved = false; return; }
    const p = human(); if (!p || !isHumanTurn() || busy) return;
    if (!reachCache || hid === p.pos || reachCache.steps[hid] > E.moveBudget(G, p)) { if (reachCache && hid !== p.pos && G.map[hid].nav) sfx("deny"); return; }
    await act(() => E.move(G, p, hid));
  }

  // ======================= PAINEL =======================
  const DIFF_N = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
  function crewHTML(p) { let s = ""; for (let i = 0; i < G.rules.maxCrew; i++) s += `<i class="${i < p.crew - p.wounded ? "on" : i < p.crew ? "w" : ""}"></i>`; return `<span class="crew" title="${p.crew} tripulantes${p.wounded ? ", " + p.wounded + " feridos" : ""}">${s}</span>`; }
  function playersHTML() {
    return G.order.map((pid) => {
      const p = G.players[pid], cur = !G.over && E.cur(G) === p;
      const chips = [p.human ? "" : `<span class="chip diff">${DIFF_N[p.diff]}</span>`, p.skel ? '<span class="chip esq">esqueleto</span>' : "", p.wounded ? `<span class="chip fer">${p.wounded} ferido${p.wounded > 1 ? "s" : ""}${p.protect && !p.skel ? " · protegido" : ""}</span>` : "", !p.alive ? '<span class="chip">eliminado</span>' : ""].join("");
      const showRes = p.human || testMode;
      const res = showRes ? RES.map((k) => `<span class="tab">${icon(k)} ${p.res[k]}</span>`).join(" ") : `<span>Mão: <b class="tab">${E.hand(p)}</b> cartas</span>`;
      const curses = p.curses.length ? `<span title="${p.curses.map((c) => NT.CURSES[c].n).join(", ")}" style="color:var(--curse)">${p.curses.length} maldição(ões)</span>` : "";
      const dfs = E.defBase(G, p);
      return `<div class="pl ${cur ? "cur" : ""} ${p.alive ? "" : "dead"}" data-pid="${p.id}" role="button" tabindex="0" title="Ver o que ${esc(p.name)} tem à mostra"><span class="stripe" style="background:${p.color}"></span>
        <div style="min-width:0"><div class="nm">${esc(p.name)} ${chips}</div><div class="meta">${crewHTML(p)}<span>vel ${E.speed(G, p)}</span>${p.atk ? `<span>ataque +${Math.min(p.atk, G.rules.maxAtk)}</span>` : ""}${dfs ? `<span>defesa +${dfs}</span>` : ""}${p.extras.length ? `<span>${p.extras.length} efeito(s)</span>` : ""}${curses}</div><div class="meta">${res}</div></div>
        <div class="arts tab">${p.arts.length}<small>de ${G.rules.winArts}</small></div></div>`;
    }).join("");
  }
  function myShipHTML(p) {
    const hl = E.hand(p), lim = G.rules.handLimit;
    const res = RES.map((k) => `<div class="rc" data-k="${k}">${icon(k, "")}<b class="tab">${p.res[k]}</b><span>${NT.RES_NOME[k]}</span></div>`).join("");
    const def = E.defBase(G, p);
    const myTurn = isHumanTurn() && !busy;
    const arts = p.arts.map((a, i) => {
      const A = NT.ARTS[a.id]; let btn = "";
      if (!a.used && myTurn) {
        if (a.id === "reforcos") btn = `<button class="btn small" data-art="reforcos" ${p.crew >= G.rules.maxCrew ? "disabled" : ""}>Usar</button>`;
        else if (a.id === "bolsa" || a.id === "saque") btn = `<button class="btn small" data-art="${a.id}">Usar</button>`;
        else if (a.id === "bussola") btn = `<button class="btn small" data-art="bussola" ${G.turn.moved ? "disabled" : ""}>Usar</button>`;
      }
      const note = a.used ? "usado · conta para a vitória" : A.uso ? (a.id === "bandeira" || a.id === "gancho" ? "uso único · escolha ao atacar" : a.id === "ancora" ? "uso único · reação automática" : "uso único") : "permanente";
      return `<div class="item art ${a.used ? "used" : ""}"><div class="t"><b>${A.n}</b><small>${A.t} <i>(${note})</i></small></div>${btn}</div>`;
    }).join("") || '<div class="empty">Nenhum artefato ainda. Compre na Pedra das Sereias.</div>';
    const extras = p.extras.map((e) => {
      let btn = "";
      if (myTurn) { if ((e === "mov1" || e === "mov2") && !G.turn.moved) btn = `<button class="btn small" data-x="${e}">Usar</button>`; if (e === "crew1") btn = `<button class="btn small" data-x="crew1">3 ouros</button>`; if (e === "amuleto" && p.curses.length) btn = `<button class="btn small" data-x="amuleto">Usar</button>`; }
      return `<div class="item extra"><div class="t"><b>${NT.EXTRA[e].n}</b><small>${NT.EXTRA[e].t}</small></div>${btn}</div>`;
    }).join("");
    const curses = p.curses.map((c) => `<div class="item curse"><div class="t"><b>${NT.CURSES[c].n}</b><small>${NT.CURSES[c].t}</small></div></div>`).join("");
    return `<div class="sec"><h3>Seu navio · ${esc(p.name)} ${p.skel ? "· esqueleto" : "· pirata"}</h3>
      <div class="res">${res}</div>
      <div class="handbar"><span>Recursos na mão</span><span class="meter ${hl >= lim ? "full" : ""}"><i style="width:${Math.min(100, (hl / lim) * 100)}%"></i></span><span class="tab ${hl >= lim ? "full" : ""}">${hl} / ${lim}</span></div>
      <div class="statrow" id="myStats">${crewHTML(p)}<span>${p.crew} tripulante${p.crew !== 1 ? "s" : ""}</span><span>Velocidade <b>${E.speed(G, p)}</b></span><span>Ataque <b>+${Math.min(p.atk, G.rules.maxAtk)}</b></span><span>Defesa <b>+${def}</b></span></div>
      <div class="items">${arts}${extras}${curses}</div></div>`;
  }
  const LOC_ICON = { pesca: "peixe", bau: "ouro", nauf: "concha", comercio: "ouro", ossuario: "concha", pedra: "artefato", taverna: "rum", ataque: "ataque" };
  function actionsHTML(p) {
    if (G.over) return "";
    const cur = E.cur(G);
    if (!isHumanTurn()) return `<div class="sec"><h3>Turno</h3><div class="waiting"><span class="spin"></span>${esc(cur.name)} está jogando…</div></div>`;
    const t = G.turn, budget = E.moveBudget(G, p);
    const mv = t.noMove ? "preso: não pode se mover neste turno" : t.moved ? "já navegou" : `clique num hexágono destacado (até ${budget} casa${budget > 1 ? "s" : ""})`;
    const at = t.act ? `usada em ${E.LOC_NOME[t.act]}` + (["comercio", "ossuario", "pedra", "taverna", "capela"].includes(t.act) ? " (pode continuar operando lá)" : "") : "livre";
    const locs = E.locations(G, p);
    const btns = locs.map((l) => {
      const can = l.ok && E.canAct(G, p, l.loc) && !busy;
      let sub = "";
      if (l.loc === "pesca") sub = `+${E.fishYield(G, p)} peixe(s)${E.permArt(p, "perola") ? " +1 ouro" : ""}`;
      else if (l.loc === "bau" || l.loc === "nauf") sub = `${E.chestSites(G, p).reduce((s, n) => s + G.sites[n], 0)} marcador(es) ao lado`;
      else if (l.loc === "ataque") sub = G.players.filter((o) => E.attackable(G, p, o)).map((o) => o.name).join(", ");
      else if (l.loc === "pedra") sub = `artefato: 1 concha + ${E.artCost(G, p)}`;
      else sub = l.why || "abrir";
      if (!l.ok) sub = l.why;
      const ic = LOC_ICON[l.loc] ? `<img src="assets/icones/${LOC_ICON[l.loc]}.png" alt="">` : `<span class="gl"><svg aria-hidden="true"><use href="#i-${l.loc === "capela" ? "cross" : "skull"}"/></svg></span>`;
      return `<button class="btn ${can && l.loc === "pedra" ? "gold" : can && l.loc === "ataque" ? "copper" : ""}" data-loc="${l.loc}" ${can ? "" : "disabled"}>${ic}<span>${E.LOC_NOME[l.loc]}</span><small>${esc(sub)}</small></button>`;
    }).join("");
    const hint = locs.length ? "" : `<div class="empty">Nada para fazer aqui. Piratas pescam no mar aberto e abrem baús ao lado das ilhas; locais de borda pedem que você encoste na linha vermelha.</div>`;
    return `<div class="sec acts"><h3>Seu turno</h3>
      <div class="status"><span>Navegação: <b>${mv}</b></span><span>Atividade: <b>${at}</b></span></div>
      ${hint}<div class="actgrid">${btns}</div>
      <div class="row"><button class="btn" id="tradeBtn" ${busy ? "disabled" : ""}>Negociar</button><button class="btn" id="sugBtn" ${busy ? "disabled" : ""} title="O que o bot difícil faria no seu lugar (tecla D)">Dica</button></div>
      ${sug ? `<div class="sugbox">${sug.html}</div>` : ""}
      <button class="btn gold endturn" id="endBtn" ${busy ? "disabled" : ""}>Encerrar turno <kbd>Enter</kbd></button></div>`;
  }
  let logShown = 0;
  const LOG_F = { all: "Tudo", combat: "Combate", art: "Artefatos", me: "Você" };
  function logPass(l) {
    if (logFilter === "all") return true;
    if (l.kind === "round") return true;
    if (logFilter === "combat") return l.kind === "combat";
    if (logFilter === "art") return ["art", "win", "virada", "curse"].includes(l.kind);
    if (logFilter === "me") { const h = human(); return h && l.pid === h.id; }
    return true;
  }
  function logHTML() { const L = G.log.filter(logPass).slice(-160); return L.map((l, i) => (l.kind === "round" && L[i + 1] && L[i + 1].kind === "round") ? "" : `<div class="${l.kind}">${esc(l.msg)}</div>`).join(""); }
  function renderSide() {
    if (!G) return;
    const p = human();
    const side = $("#side"), lg = side.querySelector(".log"), atBottom = !lg || lg.scrollHeight - lg.scrollTop - lg.clientHeight < 30;
    side.innerHTML = `<div class="sec"><h3>Capitães · ordem dos turnos</h3><div class="players">${playersHTML()}</div>
      <div class="mini" style="margin-top:6px">Baús ${G.decks.bau.length} · Naufrágios ${G.decks.nauf.length} · Artefatos ${G.decks.art.length} · Maldições ${G.decks.curse.length}</div></div>
      ${actionsHTML(p)}${p ? myShipHTML(p) : ""}
      <div class="sec"><h3>Diário de bordo</h3><div class="seg logf">${Object.entries(LOG_F).map(([k, v]) => `<button data-lf="${k}" class="${k === logFilter ? "on" : ""}">${v}</button>`).join("")}</div><div class="log">${logHTML()}</div></div>`;
    const nl = side.querySelector(".log"); if (atBottom) nl.scrollTop = nl.scrollHeight;
    side.querySelectorAll("[data-loc]").forEach((b) => b.addEventListener("click", () => onLoc(b.dataset.loc)));
    side.querySelectorAll("[data-art]").forEach((b) => b.addEventListener("click", () => onArt(b.dataset.art)));
    side.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => onExtra(b.dataset.x)));
    const eb = $("#endBtn"); if (eb) eb.addEventListener("click", tryEndTurn);
    const tb = $("#tradeBtn"); if (tb) tb.addEventListener("click", openTrade);
    const sb = $("#sugBtn"); if (sb) sb.addEventListener("click", showSuggestion);
    side.querySelectorAll("[data-lf]").forEach((b) => b.addEventListener("click", () => { logFilter = b.dataset.lf; renderSide(); const l = side.querySelector(".log"); l.scrollTop = l.scrollHeight; }));
    animateDiffs(side);
    side.querySelectorAll("[data-pid]").forEach((b) => { const go = () => showPlayer(+b.dataset.pid); b.addEventListener("click", go); b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }); });
  }
  let prevSnap = null;
  function snap() { const p = human(); return { gid: G.startedAt, res: p ? { ...p.res } : {}, crew: p ? p.crew : 0, arts: G.players.map((o) => o.arts.length) }; }
  function animateDiffs(side) {
    const now = snap(), old = prevSnap; prevSnap = now;
    if (!old || old.gid !== now.gid || G.autoplay) return;
    const p = human(); if (!p) return;
    let gain = 0, loss = 0, k2 = 0;
    for (const k of RES) {
      const d = now.res[k] - old.res[k]; if (!d) continue;
      const el = side.querySelector(`.rc[data-k="${k}"]`); if (!el) continue;
      el.classList.add(d > 0 ? "up" : "down"); FX.pop(el.querySelector("b"), d > 0 ? 1.3 : 1.15);
      const r = el.getBoundingClientRect();
      FX.float(r.left + r.width / 2, r.top + 4, `${d > 0 ? "+" : "−"}${Math.abs(d)} ${icon(k, "")}`, d > 0 ? "gain" : "loss");
      if (d > 0 && G.turn && G.turn.pid === p.id) { const from = pawnXY(p); if (from) FX.fly(from, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, icon(k, ""), k2++ * 70); }
      if (d > 0) gain += d; else loss -= d;
    }
    if (gain) sfx("coin"); else if (loss) sfx("spend");
    if (now.crew !== old.crew) { const st = side.querySelector("#myStats .crew"); if (st) FX.pop(st, 1.15); if (now.crew > old.crew) sfx("crew"); }
    now.arts.forEach((n, i) => { if (n > (old.arts[i] || 0)) { const row = side.querySelector(`.pl[data-pid="${i}"]`); if (row) { FX.glow(row); FX.pop(row.querySelector(".arts"), 1.4); } } });
  }
  let lastRound = 0, lastTurnPid = -1;
  function renderTop() {
    if (!G) return;
    $("#roundN").textContent = G.round;
    const m = G.rules.mareRound;
    $("#mare").innerHTML = m > 0 ? Array.from({ length: m }, (_, i) => `<i class="${i < G.round ? "on" : ""} ${i === m - 1 ? "last" : ""}"></i>`).join("") + `<span>${G.virada ? "Virada na rodada " + G.viradaRound : "Maré Negra"}</span>` : "";
    const era = $("#era"); era.textContent = G.virada ? "Era dos Naufrágios" : "Era das Ilhas"; era.className = "era " + (G.virada ? "esq" : "pir");
    const c = E.cur(G);
    $("#turnpill").innerHTML = G.over ? `<b>Fim de jogo</b>` : `<span class="dot" style="background:${c.color}"></span><span>Vez de <b>${esc(c.name)}</b></span>`;
    $("#testBtn").classList.toggle("gold", testMode);
    if (G.round !== lastRound) { if (lastRound) FX.pop($("#roundN"), 1.5); lastRound = G.round; }
    if (!G.over && c.id !== lastTurnPid) { lastTurnPid = c.id; const d = $("#turnpill .dot"); if (d) FX.pop(d, 1.35); }
  }
  function update() {
    // vitória no meio do próprio turno: libera o laço para mostrar o fim de jogo
    if (G && G.over && endTurnResolve) { const r = endTurnResolve; endTurnResolve = null; setTimeout(r, 0); }
    renderTop(); renderBoard(); renderSide();
  }

  // ======================= ENCERRAR TURNO, DICA, FICHA =======================
  async function tryEndTurn() {
    if (busy || !endTurnResolve || !isHumanTurn()) return;
    const p = human();
    if (cfg.confirmEnd && !G.turn.act) {
      const can = E.locations(G, p).filter((l) => l.ok && E.canAct(G, p, l.loc));
      const moveLeft = E.canMove(G, p);
      if (can.length || moveLeft) {
        const what = [moveLeft ? "ainda não navegou" : "", "ainda não usou sua atividade" + (can.length ? ` (aqui dá para: ${can.map((l) => E.LOC_NOME[l.loc]).join(", ")})` : "")].filter(Boolean).join(" e ");
        const r = await modal({ title: "Encerrar o turno?", sub: `Você ${what}.`, body: `<label class="row mini"><input type="checkbox" id="noAsk"> Não perguntar de novo</label>`, closeValue: false,
          buttons: [{ label: "Voltar", value: false, kind: "ghost" }, { label: "Encerrar mesmo assim", kind: "gold", get: (api) => { if (api.body.querySelector("#noAsk").checked) { cfg.confirmEnd = false; saveCfg(); } return true; } }] });
        if (!r || !endTurnResolve) return;
      }
    }
    sug = null;
    const r = endTurnResolve; endTurnResolve = null; r();
  }
  const hexName = (hid) => { const h = G.map[hid]; const near = [...new Set(h.nb.map((n) => G.map[n].t).filter((x) => !["mar", "maldita", "inicio"].includes(x)))].map((x) => NT.HEX_TIPOS[x].n); const bord = h.sides.map((s) => NT.BORDAS[s].n); const all = bord.concat(near); return `${NT.HEX_TIPOS[h.t].n.toLowerCase()}${all.length ? " ao lado de " + all.join(", ") : ""}`; };
  function showSuggestion() {
    const p = human(); if (!p || !isHumanTurn() || busy) return;
    let d; try { d = Bot.suggest(G, p); } catch (e) { console.error(e); return toast("Não consegui calcular uma dica agora.", "combat"); }
    const actTxt = (a, arg) => !a ? "" : a === "ataque" ? `atacar ${esc(G.players[arg] ? G.players[arg].name : "o navio ao lado")}` : a === "bau" ? (p.skel ? "abrir um naufrágio" : "abrir um baú") : a === "pesca" ? "pescar" : `usar ${E.LOC_NOME[a]}`;
    const goalTxt = (C) => C ? (C.goal === "ataque" ? `atacar ${esc(G.players[C.target].name)}` : C.goal === "bau" ? (p.skel ? "os naufrágios" : "os baús") : C.goal === "pesca" ? "pescar" : E.LOC_NOME[C.goal]) : "";
    const parts = [];
    if (d.first === "act" && d.act) { parts.push(`<b>1.</b> ${actTxt(d.act, d.arg)} aqui`); if (d.move != null && E.canMove(G, p)) parts.push(`<b>2.</b> depois navegue para o hexágono marcado, rumo a ${goalTxt(d.toward)}`); }
    else if (d.move != null && d.move !== p.pos) { parts.push(`<b>1.</b> navegue para o hexágono marcado (${hexName(d.move)})`); if (d.act) parts.push(`<b>2.</b> ${actTxt(d.act, d.arg)}`); else if (d.toward) parts.push(`ainda é caminho para ${goalTxt(d.toward)}`); }
    else if (d.act) parts.push(actTxt(d.act, d.arg) + " aqui");
    if (!parts.length) parts.push("Nada que valha a pena agora: encerre o turno.");
    const alt = (d.alt || []).slice(0, 3).map((c) => `${goalTxt(c)} (${c.t ? "a " + (c.t + 1) + " turnos" : "neste turno"}, vale ~${c.value.toFixed(1)})`).join(" · ");
    sug = { move: d.move != null && d.move !== p.pos && E.canMove(G, p) ? d.move : null, html: `<div class="mini"><b style="color:var(--brass2)">Dica do imediato</b> (como o bot difícil jogaria)</div><div>${parts.join("<br>")}</div>${alt ? `<div class="mini">Objetivos avaliados: ${alt}</div>` : ""}` };
    update();
  }
  function showPlayer(pid) {
    const p = G.players[pid], me = human() === p, show = me || testMode;
    const arts = p.arts.map((a) => `<div class="item art ${a.used ? "used" : ""}"><div class="t"><b>${NT.ARTS[a.id].n}${a.used ? " (usado)" : ""}</b><small>${NT.ARTS[a.id].t}</small></div></div>`).join("") || '<div class="empty">Nenhum artefato.</div>';
    const ex = p.extras.map((e) => `<div class="item extra"><div class="t"><b>${NT.EXTRA[e].n}</b><small>${NT.EXTRA[e].t}</small></div></div>`).join("");
    const cs = p.curses.map((c) => `<div class="item curse"><div class="t"><b>${NT.CURSES[c].n}</b><small>${NT.CURSES[c].t}</small></div></div>`).join("");
    const res = show ? RES.map((k) => `${icon(k)} <b class="tab">${p.res[k]}</b>`).join("  ") : `${E.hand(p)} recursos na mão (escondidos)`;
    const atkB = E.atkBonus(G, p, p) - (E.hasCurse(p, "luaSangue") ? 1 : 0);
    modal({ title: esc(p.name), sub: `${p.human ? "Você" : "Bot " + DIFF_N[p.diff]} · ${p.skel ? "esqueleto" : "pirata"} · ${p.arts.length} de ${G.rules.winArts} artefatos`, closeValue: null, wide: false,
      body: `<div class="statrow">${crewHTML(p)}<span>${p.crew} tripulante(s)${p.wounded ? `, ${p.wounded} ferido(s)` : ""}</span><span>Velocidade <b>${E.speed(G, p)}</b></span><span>Ataque <b>${atkB >= 0 ? "+" : ""}${atkB}</b></span><span>Defesa <b>+${E.defBase(G, p)}</b></span><span>Dados <b>${E.maxDice(p)}</b></span></div>
        <div class="mini">${res}</div><div class="items">${arts}${ex}${cs}</div>
        <div class="mini">Artefatos, efeitos guardados, maldições permanentes e bônus ficam à mostra na mesa. Os recursos ficam escondidos${testMode && !me ? " (modo teste ligado: você está vendo)" : ""}.</div>`,
      buttons: [{ label: "Fechar", value: null, kind: "gold" }] });
  }

  // ======================= AÇÕES DO JOGADOR =======================
  async function act(fn) {
    if (busy) return; busy = true; sug = null; renderSide(); renderHL();
    try { const r = await fn(); if (r && r.ok === false && r.why) { toast(r.why, "combat"); sfx("deny"); } }
    catch (e) { console.error(e); toast("Erro: " + e.message, "combat"); }
    busy = false; update();
  }
  function onLoc(loc) {
    const p = human();
    if (loc === "pesca") return act(() => E.fish(G, p));
    if (loc === "bau" || loc === "nauf") return act(() => E.openChest(G, p));
    if (loc === "ataque") return openAttack();
    openShop(loc);
  }
  function onArt(id) {
    const p = human();
    if (id === "saque") return openSaque();
    act(() => E.useArtifact(G, p, id));
  }
  async function onExtra(e) {
    const p = human();
    if (e === "amuleto") {
      const c = await modal({ title: "Amuleto Anti-Maldição", sub: "Escolha a maldição que o amuleto vai remover.", buttons: p.curses.map((c) => ({ label: NT.CURSES[c].n, value: c })).concat([{ label: "Cancelar", value: null, kind: "ghost" }]) });
      if (c) act(() => E.useExtra(G, p, "amuleto", { curse: c }));
      return;
    }
    act(() => E.useExtra(G, p, e));
  }

  // ---------- modais ----------
  let modalStack = 0;
  function modal({ title, sub = "", body = "", buttons = [], wide = false, onMount = null, closeValue, quiet = false }) {
    return new Promise((resolve) => {
      const ov = document.createElement("div"); ov.className = "ov";
      ov.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><header><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</header><div class="body"></div><footer></footer></div>`;
      const bodyEl = ov.querySelector(".body"); if (typeof body === "string") bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
      if (!body && !onMount) bodyEl.remove();
      const foot = ov.querySelector("footer");
      let closed = false;
      const done = (v) => {
        if (closed) return; closed = true; modalStack--; resolve(v);
        ov.classList.add("closing"); sfx("close");
        FX.anim(ov.querySelector(".modal"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(10px) scale(.97)" }], { duration: 150, easing: EASE.in, fill: "forwards" });
        FX.anim(ov, [{ opacity: 1 }, { opacity: 0 }], { duration: 170, fill: "forwards" }).then(() => ov.remove());
      };
      const api = { done, body: bodyEl, foot, ov };
      for (const b of buttons) { const el = document.createElement("button"); el.className = "btn " + (b.kind || ""); el.textContent = b.label; if (b.disabled) el.disabled = true; el.addEventListener("click", () => { if (b.get) done(b.get(api)); else done(b.value); }); if (b.id) el.id = b.id; foot.appendChild(el); }
      if (!buttons.length) foot.remove();
      if (closeValue !== undefined) { ov.addEventListener("click", (e) => { if (e.target === ov) done(closeValue); }); ov.__close = () => done(closeValue); }
      $("#modalRoot").appendChild(ov); modalStack++;
      FX.anim(ov, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
      FX.anim(ov.querySelector(".modal"), [{ opacity: 0, transform: "translateY(22px) scale(.95)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: EASE.spring });
      if (!quiet) sfx("open");
      if (onMount) onMount(api);
      const first = foot.querySelector(".btn.gold") || foot.querySelector(".btn"); if (first) first.focus();
    });
  }
  function stepperHTML(id, val) { return `<span class="stepper"><button class="btn" data-dec="${id}" aria-label="menos">−</button><b class="tab" id="v-${id}">${val}</b><button class="btn" data-inc="${id}" aria-label="mais">+</button></span>`; }
  function wireSteppers(root, state, limits, onChange) {
    root.querySelectorAll("[data-inc],[data-dec]").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.inc || b.dataset.dec, d = b.dataset.inc ? 1 : -1;
      const nv = Math.max(0, Math.min(limits[id] ?? 99, (state[id] || 0) + d)); state[id] = nv; root.querySelector("#v-" + id).textContent = nv; if (onChange) onChange();
    }));
  }
  function cardHTML(card, deck) {
    const lines = []; for (const k of RES) if (card.r[k]) lines.push(`<span class="line">${icon(k, "")} +${card.r[k]} ${card.r[k] === 1 ? NT.RES_NOME[k] : NT.RES_NOME_PL[k]}</span>`);
    if (card.r.art) lines.push(`<span class="line"><img src="assets/icones/artefato.png" alt=""> +1 Artefato</span>`);
    const bands = [];
    if (card.f.curse) bands.push(`<div class="band mal">Contém maldição: pegue uma carta de maldição.</div>`);
    if (card.f.eff) bands.push(`<div class="band pos">Efeito positivo (guarde): ${NT.EXTRA[card.f.eff].t}</div>`);
    if (card.f.now) bands.push(`<div class="band eff">Efeito: ${NT.NOW_TEXT[card.f.now]}</div>`);
    if (card.f.risk) bands.push(`<div class="band risk">${NT.RISK_TEXT[card.f.risk]}</div>`);
    return wrap3d(`<div class="card ${deck}"><div class="cf"><div class="kind">${deck === "bau" ? "Baú" : "Naufrágio"}</div><div class="nm">${esc(card.n)}</div><div class="orn"></div><div class="result">${lines.join("") || "<span>Sem valor</span>"}</div>${bands.join("")}</div></div>`, deck);
  }
  const backHTML = (deck) => `<div class="card back ${deck}" aria-hidden="true"><div class="cf"><svg><use href="#i-compass"/></svg></div></div>`;
  const wrap3d = (front, deck) => `<div class="c3d"><div class="cin">${front}${backHTML(deck)}</div></div>`;
  const artCardHTML = (id) => wrap3d(`<div class="card art"><div class="cf"><div class="kind">Artefato${NT.ARTS[id].uso ? " · uso único" : " · permanente"}</div><div class="nm">${NT.ARTS[id].n}</div><div class="orn"></div><div class="txt">${NT.ARTS[id].t}</div></div></div>`, "art");
  const curseCardHTML = (id) => wrap3d(`<div class="card curse"><div class="cf"><div class="kind">Maldição · ${NT.CURSES[id].now ? "⚡ imediata" : "∞ permanente"}</div><div class="nm">${NT.CURSES[id].n}</div><div class="orn"></div><div class="txt">${NT.CURSES[id].t}</div></div></div>`, "curse");
  // Revela a carta: sobe do baralho virada e gira até mostrar a face.
  function revealCard(root, kind) {
    const cin = root.querySelector(".cin"); if (!cin) return;
    sfx("flip");
    FX.anim(cin, [{ transform: "translateY(60px) rotateY(180deg) scale(.82)" }, { transform: "translateY(-10px) rotateY(-12deg) scale(1.04)", offset: 0.62 }, { transform: "none" }], { duration: 780, easing: EASE.out }).then(() => {
      const r = cin.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (kind === "art") { FX.burst(x, y, "gold", 22); sfx("reward"); }
      else if (kind === "curse") { FX.burst(x, y, "violet", 18); }
      else if (kind === "gold") FX.burst(x, y - 40, "gold", 10);
    });
  }
  const costHTML = (pay, get) => `<span class="cost">${pay}<span class="arrow">➜</span>${get}</span>`;
  const n = (k, q = 1) => `${q > 1 ? q + "×" : ""}${icon(k)}`;

  // ---------- lojas ----------
  function shopRows(p, loc) {
    const r = G.rules, rows = [];
    const add = (op, pay, get) => rows.push({ op, html: costHTML(pay, get), why: E.opCheck(G, p, loc, op) });
    if (loc === "comercio") {
      add({ id: "peixe" }, n("peixe", r.fishPerGold), n("ouro"));
      add({ id: "peixe", n: "all" }, `todos os ${icon("peixe")}`, `${icon("ouro")} (1 por ${r.fishPerGold})`);
      for (const k of SUP) add({ id: "vende4", k }, n(k, 4), n("ouro", r.sell4));
      for (const k of SUP) add({ id: "compra", k }, n("ouro", r.buySup), n(k));
      add({ id: "trip" }, n("ouro", r.crewGold), `${icon("tripulante")} tripulante`);
      add({ id: "vel" }, `${n("ouro", r.spdGold)} + ${icon("lona")} + ${icon("polvora")}`, `${icon("velocidade")} +1 velocidade`);
      add({ id: "atq" }, `${n("ouro", r.atkGold)} + ${icon("rum")} + ${icon("polvora")}`, `${icon("ataque")} +1 ataque`);
    } else if (loc === "ossuario") {
      add({ id: "compraConcha" }, n("ouro", r.ossConcha), n("concha"));
      add({ id: "vendeConcha" }, n("concha"), n("ouro", r.ossVende));
    } else if (loc === "pedra") {
      add({ id: "concha", goldFirst: pedraGoldFirst }, `${n("ouro", r.conchaCost)}${r.pedraFish ? " (ou peixes)" : ""}`, n("concha"));
      add({ id: "artefato", goldFirst: pedraGoldFirst }, `${icon("concha")} + ${n("ouro", E.artCost(G, p))}${r.pedraFish ? " (ou peixes)" : ""}`, `${icon("artefato")} artefato`);
    } else if (loc === "taverna") {
      add({ id: "trip" }, n("rum", r.crewRum), `${icon("tripulante")} tripulante`);
      add({ id: "atq" }, `${icon("rum")} + ${icon("polvora")}`, `${icon("ataque")} +1 ataque`);
      if (E.hasX(p, "crew1")) add({ id: "idolo" }, "Ídolo do Saqueador", `${icon("tripulante")} grátis`);
    } else if (loc === "capela") add({ id: "limpar" }, n("ouro", r.capelaCost), "remove todas as suas maldições");
    else if (loc === "altar") add({ id: "virar" }, n("ouro", r.transformCost), `vira esqueleto${r.transformGift ? " + " + icon("concha") : ""} (sem volta)`);
    return rows;
  }
  const SHOP_SUB = {
    comercio: "Quantas operações quiser neste turno. Só a primeira operação gasta sua atividade.",
    ossuario: "Só esqueletos. Quantas operações quiser.",
    pedra: "Compre conchas à vontade. Artefato: no máximo 1 por turno, preço pela escada.",
    taverna: "Tripulantes e bônus de ataque baratos, pagos com suprimentos.",
    capela: "Para piratas amaldiçoados.",
    altar: "O pacto é irreversível: você vira esqueleto agora, troca ilhas por naufrágios e passa a poder afundar em combate.",
  };
  async function openShop(loc) {
    const p = human();
    await modal({
      title: E.LOC_NOME[loc], sub: SHOP_SUB[loc], wide: false, closeValue: null,
      buttons: [{ label: "Fechar", value: null, kind: "gold" }],
      onMount: (api) => {
        const draw = () => {
          const rows = shopRows(p, loc);
          const payOpt = loc === "pedra" && G.rules.pedraFish ? `<div class="row mini">Pagar primeiro com <div class="seg" id="paySeg"><button data-g="0" class="${pedraGoldFirst ? "" : "on"}">peixes</button><button data-g="1" class="${pedraGoldFirst ? "on" : ""}">ouro</button></div></div>` : "";
          const ladder = loc === "pedra" ? payOpt + `<div class="mini">Escada: ${G.rules.ladderArr.map((v, i) => `${i} artefato(s) → ${v}`).join(" · ")}. Você tem ${p.arts.length}. ${G.turn.artBought ? "Já comprou um artefato neste turno." : ""}</div>` : "";
          api.body.innerHTML = `<div class="mini">Você tem: ${RES.map((k) => `${icon(k)} <b class="tab">${p.res[k]}</b>`).join("  ")} · ${p.crew} tripulante(s)</div>${ladder}` +
            rows.map((r, i) => `<div class="oprow"><div>${r.html}${r.why ? `<div class="why">${esc(r.why)}</div>` : ""}</div><button class="btn ${r.why ? "" : "gold"} small" data-op="${i}" ${r.why || busy ? "disabled" : ""}>${loc === "altar" ? "Fazer o pacto" : "Trocar"}</button></div>`).join("");
          api.body.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => { pedraGoldFirst = b.dataset.g === "1"; draw(); }));
          api.body.querySelectorAll("[data-op]").forEach((b) => b.addEventListener("click", async () => {
            const row = rows[+b.dataset.op];
            await act(() => E.op(G, p, loc, row.op));
            if (G.over || loc === "altar") return api.done(null);
            draw();
          }));
        };
        draw();
      },
    });
  }

  // ---------- combate ----------
  function probBars(w, l, t) { return `<div class="bar"><i class="w" style="width:${w * 100}%"></i><i class="t" style="width:${t * 100}%"></i><i class="l" style="width:${l * 100}%"></i></div><div class="mini">vence ${Math.round(w * 100)}% · empata ${Math.round(t * 100)}% · perde ${Math.round(l * 100)}%</div>`; }
  async function openAttack() {
    const p = human();
    const targets = G.players.filter((o) => E.attackable(G, p, o));
    if (!targets.length) return toast("Não há alvo ao seu lado.", "combat");
    const st = { target: targets[0].id, k: E.maxDice(p), shot: null };
    const res = await modal({
      title: "Atacar", sub: "Só o maior dado de cada lado conta, somado aos bônus. Quem vence saqueia; quem perde sofre dano igual aos dados que usou.", wide: true, closeValue: null,
      buttons: [{ label: "Cancelar", value: null, kind: "ghost" }, { label: "Atacar!", kind: "gold", get: () => st }],
      onMount: (api) => {
        const draw = () => {
          const D = G.players[st.target], extra = st.shot === "bandeira" ? 4 : st.shot === "gancho" ? 3 : 0;
          const diff = E.atkBonus(G, p, D, extra) - E.defBonus(G, D, p);
          const tgt = targets.map((o) => `<button class="choice ${o.id === st.target ? "sel" : ""}" data-t="${o.id}"><b>${esc(o.name)}</b><span class="mini">${o.skel ? "esqueleto" : "pirata"} · ${o.crew} tripulante(s) · ${o.arts.length} artefato(s) · mão ${E.hand(o)}</span></button>`).join("");
          const ks = Array.from({ length: E.maxDice(p) }, (_, i) => i + 1).map((k) => `<button class="choice ${k === st.k ? "sel" : ""}" data-k="${k}"><b>${k} dado${k > 1 ? "s" : ""}</b><span class="mini">se perder: ${p.skel ? (p.crew ? `perde ${Math.min(k, p.crew)} tripulante(s)` : "seu barco afunda") : `${Math.min(k, E.avail(p))} ferido(s)`}</span></button>`).join("");
          const vs = Array.from({ length: E.maxDice(D) }, (_, i) => i + 1).map((d) => { const [w, l, t] = E.prob(st.k, d, diff); return `<div><span class="mini">se ele usar ${d} dado${d > 1 ? "s" : ""}</span>${probBars(w, l, t)}</div>`; }).join("");
          const shots = ["bandeira", "gancho"].filter((a) => E.hasArt(p, a)).map((a) => `<label class="row mini"><input type="checkbox" data-s="${a}" ${st.shot === a ? "checked" : ""}> Usar ${NT.ARTS[a].n} (+${a === "bandeira" ? 4 : 3})</label>`).join("");
          const steal = E.canSteal(G, p, D) ? `<div class="mini" style="color:var(--brass2)">Se vencer, você pode tomar 1 artefato de ${esc(D.name)} no lugar do saque.</div>` : "";
          const anc = E.hasArt(D, "ancora") ? `<div class="mini" style="color:#ffb3a6">${esc(D.name)} tem uma Âncora Falsa e pode cancelar o ataque.</div>` : "";
          api.body.innerHTML = `<div class="probs" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${tgt}</div>
            <div class="mini">Seu bônus: <b>${E.atkBonus(G, p, D, extra) >= 0 ? "+" : ""}${E.atkBonus(G, p, D, extra)}</b> · defesa dele: <b>${E.defBonus(G, D, p) >= 0 ? "+" : ""}${E.defBonus(G, D, p)}</b></div>
            <div class="probs">${ks}</div>${shots}<div class="probs">${vs}</div>${steal}${anc}`;
          api.body.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { st.target = +b.dataset.t; draw(); }));
          api.body.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { st.k = +b.dataset.k; draw(); }));
          api.body.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("change", () => { st.shot = b.checked ? b.dataset.s : null; draw(); }));
        };
        draw();
      },
    });
    if (!res) return;
    act(() => E.attack(G, p, G.players[res.target], { k: res.k, oneShot: res.shot }));
  }
  let combatOv = null;
  const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]], 5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]] };
  const dieFace = (v) => PIPS[v].map(([r, c]) => `<i style="grid-area:${r}/${c}"></i>`).join("");
  async function rollDice(root, ms) {
    const dice = [...root.querySelectorAll(".die")]; if (!dice.length) return;
    if (FX.reduced() || ms < 120) { dice.forEach((el) => { if (el.dataset.top) el.classList.add("top"); }); return; }
    dice.forEach((el, i) => FX.anim(el, [{ transform: "translateY(-30px) rotate(-220deg) scale(.75)", opacity: 0.2 }, { transform: "translateY(5px) rotate(12deg) scale(1.06)", opacity: 1, offset: 0.72 }, { transform: "none" }], { duration: ms, delay: i * 45, easing: EASE.out }));
    const end = performance.now() + ms * 0.7;
    while (performance.now() < end) { dice.forEach((el) => (el.innerHTML = dieFace(1 + Math.floor(Math.random() * 6)))); await sleep(65); }
    dice.forEach((el) => (el.innerHTML = dieFace(+el.dataset.v)));
    await sleep(ms * 0.32);
    dice.forEach((el) => { if (el.dataset.top) { el.classList.add("top"); FX.pop(el, 1.12); } else el.classList.add("dim"); });
  }
  function combatShell(d) {
    if (combatOv) return combatOv;
    combatOv = document.createElement("div"); combatOv.className = "ov";
    combatOv.innerHTML = `<div class="modal wide"><header><h2>Combate</h2><p></p></header><div class="body"></div><footer></footer></div>`;
    $("#modalRoot").appendChild(combatOv);
    FX.anim(combatOv, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    FX.anim(combatOv.querySelector(".modal"), [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: EASE.spring });
    return combatOv;
  }
  function closeCombat() {
    const ov = combatOv; combatOv = null; if (!ov) return;
    ov.classList.add("closing");
    FX.anim(ov, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" }).then(() => ov.remove());
  }
  async function combatAnim(type, d) {
    const involved = (d.A && d.A.human) || (d.D && d.D.human);
    const sp = speedMs();
    if (!involved && sp === 0) return;
    const fresh = !combatOv;
    const ov = combatShell(d);
    const body = ov.querySelector(".body"), foot = ov.querySelector("footer");
    ov.querySelector("header p").textContent = `${d.A.name} ataca ${d.D.name}`;
    if (type === "dice") {
      if (fresh) { sfx("cannon"); FX.flash("red"); }
      sfx("dice");
      const side = (pl, dice, bon, cls, role) => { const mx = Math.max(...dice); let marked = false; return `<div class="side-d" data-role="${role}"><div class="who"><span class="swatch" style="background:${pl.color}"></span>${esc(pl.name)}</div><div class="mini">${role === "a" ? "ataca" : "defende"}</div><div class="dset">${dice.map((v) => { const top = v === mx && !marked; if (top) marked = true; return `<div class="die ${cls}" data-v="${v}" ${top ? 'data-top="1"' : ""}>${dieFace(v)}</div>`; }).join("")}</div><div class="mini">maior dado ${mx} ${bon >= 0 ? "+" : "−"} ${Math.abs(bon)} de bônus</div><div class="total tab" data-t="${mx + bon}">${mx + bon}</div></div>`; };
      body.innerHTML = `<div class="dice">${side(d.A, d.da, d.ba, "b", "a")}<div class="vs"><svg aria-hidden="true"><use href="#i-swords"/></svg>contra</div>${side(d.D, d.dd, d.bd, "w", "d")}</div>${d.stage === "reroll" ? '<div class="verdict">Trevo da Sorte: um dado foi rejogado.</div>' : ""}`;
      foot.innerHTML = "";
      const ms = involved ? 760 : Math.max(240, Math.min(700, sp));
      body.querySelectorAll(".total").forEach((t) => (t.style.visibility = "hidden"));
      await rollDice(body, ms);
      body.querySelectorAll(".total").forEach((t) => { t.style.visibility = ""; FX.count(t, +t.dataset.t, 380); });
      await sleep(involved ? 450 : Math.max(120, sp * 0.4));
    } else if (type === "combatEnd") {
      const hum = human();
      const winnerIsA = d.result === "atacante", winnerIsD = d.result === "defensor";
      const humanLost = hum && ((winnerIsA && d.D === hum) || (winnerIsD && d.A === hum));
      const txt = d.result === "ancora" ? `${d.D.name} cancela o ataque com a Âncora Falsa.` : d.result === "empate" ? "Empate: nada acontece." : `${winnerIsA ? d.A.name : d.D.name} vence!`;
      if (d.result === "ancora") body.innerHTML = "";
      body.insertAdjacentHTML("beforeend", `<div class="verdict ${humanLost ? "bad" : ""}">${esc(txt)}</div>`);
      const va = body.querySelector(".verdict:last-child"); FX.anim(va, [{ opacity: 0, transform: "scale(.7)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: EASE.spring });
      if (winnerIsA || winnerIsD) {
        const w = body.querySelector(`.side-d[data-role="${winnerIsA ? "a" : "d"}"]`), l = body.querySelector(`.side-d[data-role="${winnerIsA ? "d" : "a"}"]`);
        if (w) { w.classList.add("won"); FX.pop(w, 1.04); } if (l) { l.classList.add("lost"); FX.shake(l); }
        sfx("hit"); if (humanLost) FX.flash("red"); else if (involved) sfx("coin");
      }
      if (involved) await new Promise((res) => { foot.innerHTML = `<button class="btn gold">Continuar</button>`; const b = foot.querySelector("button"); b.focus(); b.addEventListener("click", res); });
      else await sleep(Math.max(300, sp * 1.4));
      closeCombat();
    }
  }

  // ---------- trocas ----------
  async function openTrade() {
    const p = human(), bots = G.players.filter((o) => !o.human && o.alive);
    if (!bots.length) return;
    const st = { to: bots[0].id, give: {}, get: {} };
    await modal({
      title: "Negociar", sub: "Troque ouro, peixe, rum, pólvora e lona. O bot aceita se a troca valer a pena para ele. Conchas, tripulantes, bônus e artefatos não são negociáveis.", wide: true, closeValue: null,
      buttons: [{ label: "Fechar", value: null, kind: "ghost" }, { label: "Propor troca", kind: "gold", id: "propBtn", get: () => "x" }],
      onMount: (api) => {
        const draw = () => {
          const o = G.players[st.to];
          const opts = bots.map((b) => `<option value="${b.id}" ${b.id === st.to ? "selected" : ""}>${esc(b.name)} (${DIFF_N[b.diff]})</option>`).join("");
          const col = (key, who) => E.TRADE_RES.map((k) => `<div class="oprow" style="grid-template-columns:1fr auto"><span>${icon(k)} ${NT.RES_NOME[k]} ${who === "me" ? `<span class="mini">(você tem ${p.res[k]})</span>` : testMode ? `<span class="mini">(tem ${o.res[k]})</span>` : ""}</span>${stepperHTML(key + k, (st[key][k] || 0))}</div>`).join("");
          api.body.innerHTML = `<label class="field">Com quem<select class="inp" id="tradeTo">${opts}</select></label>
            <div class="mini">${esc(o.name)} tem ${E.hand(o)} cartas na mão${testMode ? "" : " (o conteúdo é segredo)"}.</div>
            <div class="grid2"><div><h3 style="font-size:13px;color:var(--muted);margin-bottom:6px">VOCÊ DÁ</h3>${col("give", "me")}</div><div><h3 style="font-size:13px;color:var(--muted);margin-bottom:6px">VOCÊ RECEBE</h3>${col("get", "o")}</div></div><div id="tradeMsg" class="mini"></div>`;
          api.body.querySelector("#tradeTo").addEventListener("change", (e) => { st.to = +e.target.value; draw(); });
          const lim = {}; for (const k of E.TRADE_RES) { lim["give" + k] = p.res[k]; lim["get" + k] = 12; }
          const state = {}; for (const k of E.TRADE_RES) { state["give" + k] = st.give[k] || 0; state["get" + k] = st.get[k] || 0; }
          wireSteppers(api.body, state, lim, () => { for (const k of E.TRADE_RES) { st.give[k] = state["give" + k]; st.get[k] = state["get" + k]; } });
        };
        draw();
        const btn = api.foot.querySelector("#propBtn");
        const clone = btn.cloneNode(true); btn.replaceWith(clone);
        clone.addEventListener("click", async () => {
          const o = G.players[st.to]; const give = {}, get = {};
          for (const k of E.TRADE_RES) { if (st.give[k]) give[k] = st.give[k]; if (st.get[k]) get[k] = st.get[k]; }
          const msg = api.body.querySelector("#tradeMsg");
          const lack = Object.keys(get).filter((k) => o.res[k] < get[k]);
          if (lack.length) { msg.innerHTML = `<span style="color:#ffb3a6">${esc(o.name)} diz que não tem ${lack.map((k) => NT.RES_NOME_PL[k]).join(", ")} suficiente.</span>`; return; }
          const why = E.tradeCheck(G, p, o, give, get); if (why) { msg.innerHTML = `<span style="color:#ffb3a6">${esc(why)}</span>`; return; }
          const ev = Bot.evalTrade(G, o, p, give, get);
          if (!ev.accept) { msg.innerHTML = `<span style="color:#ffb3a6">${esc(ev.why)}</span>`; E.logMsg(G, `${o.name} recusa a proposta de ${p.name}.`, "trade", o.id); renderSide(); return; }
          E.trade(G, p, o, give, get); st.give = {}; st.get = {}; draw();
          api.body.querySelector("#tradeMsg").innerHTML = `<span style="color:var(--good)">${esc(ev.why)}</span>`;
        });
      },
    });
    update();
  }
  async function openSaque() {
    const p = human(), others = G.players.filter((o) => o !== p && o.alive);
    const st = { target: others[0].id, k: "rum" };
    const r = await modal({
      title: "Saque dos Suprimentos", sub: "Escolha um jogador e um suprimento: você toma todas as cartas desse tipo dele.", closeValue: null,
      buttons: [{ label: "Cancelar", value: null, kind: "ghost" }, { label: "Saquear", kind: "gold", get: () => st }],
      onMount: (api) => {
        api.body.innerHTML = `<label class="field">Jogador<select class="inp" id="sqT">${others.map((o) => `<option value="${o.id}">${esc(o.name)}${testMode ? ` (rum ${o.res.rum} · pólvora ${o.res.polvora} · lona ${o.res.lona})` : ""}</option>`).join("")}</select></label>
          <label class="field">Suprimento<select class="inp" id="sqK">${SUP.map((k) => `<option value="${k}">${NT.RES_NOME[k]}</option>`).join("")}</select></label>`;
        api.body.querySelector("#sqT").addEventListener("change", (e) => (st.target = +e.target.value));
        api.body.querySelector("#sqK").addEventListener("change", (e) => (st.k = e.target.value));
      },
    });
    if (r) act(() => E.useArtifact(G, p, "saque", r));
  }

  // ======================= PERGUNTAS DO MOTOR AO HUMANO =======================
  async function ask(g, p, kind, ctx) {
    if (g !== G) return Bot.decide(g, p, kind, ctx);
    switch (kind) {
      case "defDice": {
        const A = ctx.A, diff = E.atkBonus(G, A, p) - E.defBonus(G, p, A), lp = G.rules.lootPerDie;
        let choice = E.maxDice(p);
        return modal({
          title: `${esc(A.name)} ataca você`, sub: `Ele usa ${ctx.k} dado${ctx.k > 1 ? "s" : ""}. Bônus dele ${E.atkBonus(G, A, p) >= 0 ? "+" : ""}${E.atkBonus(G, A, p)}, sua defesa ${E.defBonus(G, p, A) >= 0 ? "+" : ""}${E.defBonus(G, p, A)}. Quantos dados você usa?`,
          wide: true, buttons: [{ label: "Defender", kind: "gold", get: () => choice }],
          onMount: (api) => {
            const draw = () => {
              api.body.innerHTML = `<div class="probs">${Array.from({ length: E.maxDice(p) }, (_, i) => i + 1).map((d) => {
                const [w, l, t] = E.prob(ctx.k, d, diff); const dmg = G.rules.dmgByWinner ? ctx.k : d;
                const lose = p.skel ? (p.crew ? `perde ${Math.min(dmg, p.crew)} tripulante(s) para sempre` : "seu barco afunda") : `${Math.min(dmg, E.avail(p))} tripulante(s) ferido(s)`;
                return `<button class="choice ${d === choice ? "sel" : ""}" data-d="${d}"><b>${d} dado${d > 1 ? "s" : ""}</b>${probBars(l, w, t)}<span class="mini">se perder: ${lose}${E.canSteal(G, A, p) ? " e pode perder 1 artefato" : ""}<br>se vencer: você saqueia ${d * lp} carta(s)</span></button>`;
              }).join("")}</div>`;
              api.body.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => { choice = +b.dataset.d; draw(); }));
            };
            draw();
          },
        });
      }
      case "useAncora": return modal({ title: "Âncora Falsa", sub: `${esc(ctx.A.name)} declarou um ataque contra você com ${ctx.k} dado(s). Revelar a Âncora Falsa e cancelar o ataque? Ela é de uso único.`, buttons: [{ label: "Não, vou me defender", value: false, kind: "ghost" }, { label: "Cancelar o ataque", value: true, kind: "gold" }] });
      case "reroll": return modal({ title: "Trevo da Sorte", sub: `O placar está ${ctx.ta} a ${ctx.td}${ctx.ta === ctx.td ? " (empate)" : ""} e você não está vencendo. Rejogar um dado seu?`, buttons: [{ label: "Não", value: false, kind: "ghost" }, { label: "Rejogar", value: true, kind: "gold" }] });
      case "stealChoice": return modal({ title: "Vitória!", sub: `${esc(ctx.L.name)} tem mais artefatos que você. O que você leva?`, buttons: [{ label: `Saquear cartas`, value: "loot" }, { label: "Tomar 1 artefato", value: "art", kind: "gold" }] });
      case "giveArtifact": return modal({ title: ctx.why === "afundar" ? "Seu barco afundou" : "Você perdeu um artefato", sub: `Escolha qual artefato entregar a ${esc(ctx.to.name)}.`, buttons: p.arts.map((a, i) => ({ label: `${NT.ARTS[a.id].n}${a.used ? " (usado)" : ""}`, value: i })) });
      case "discard": {
        const st = {}; const lim = {}; for (const k of RES) { st[k] = 0; lim[k] = p.res[k]; }
        return modal({
          title: "Mão cheia", sub: `Você passou do limite de ${G.rules.handLimit} recursos. Devolva ${ctx.n} ao pote.`,
          buttons: [{ label: "Devolver", kind: "gold", id: "dBtn", get: () => st }],
          onMount: (api) => {
            api.body.innerHTML = RES.filter((k) => p.res[k]).map((k) => `<div class="oprow"><span>${icon(k)} ${NT.RES_NOME[k]} <span class="mini">(tem ${p.res[k]})</span></span>${stepperHTML(k, 0)}</div>`).join("") + `<div class="mini" id="dLeft"></div>`;
            const btn = api.foot.querySelector("#dBtn");
            const chk = () => { const t = RES.reduce((s, k) => s + st[k], 0); api.body.querySelector("#dLeft").textContent = `Escolhidos ${t} de ${ctx.n}.`; btn.disabled = t !== ctx.n; };
            wireSteppers(api.body, st, lim, chk); chk();
          },
        });
      }
      case "useAmuleto": return modal({ title: "Amuleto Anti-Maldição", sub: "Você recebeu esta maldição. Usar o amuleto para cancelá-la?", body: curseCardHTML(ctx.curse), buttons: [{ label: "Guardar o amuleto", value: false, kind: "ghost" }, { label: "Cancelar a maldição", value: true, kind: "gold" }] });
      case "useVigia": return modal({ title: "Olho do Vigia", sub: "Usar o Olho do Vigia neste baú (compre 2 e fique com 1)?", buttons: [{ label: "Não", value: false, kind: "ghost" }, { label: "Usar", value: true, kind: "gold" }] });
      case "vigiaPick": return pickCard("Olho do Vigia", "Escolha a carta que fica com você; a outra vai para o fundo do baralho.", ctx.cards, "bau");
      case "olhoKeep": return modal({ title: "Olho do Abismo", sub: "Esta é a carta que você vai abrir. Ficar com ela ou mandá-la ao fundo e pegar a próxima às cegas?", body: `<div class="cardrow">${cardHTML(ctx.card, p.skel ? "nauf" : "bau")}</div>`, buttons: [{ label: "Mandar ao fundo", value: false, kind: "ghost" }, { label: "Ficar com ela", value: true, kind: "gold" }] });
      case "coroaPick": return modal({ title: "Coroa do Rei Naufragado", sub: "Escolha um recurso para ganhar +1.", buttons: ctx.keys.map((k) => ({ label: NT.RES_NOME[k], value: k })) });
      case "lunetaOrder": {
        const order = [];
        return modal({
          title: "Luneta Sem Lente", sub: "Clique nas cartas na ordem em que devem sair (a primeira clicada fica no topo).", wide: true,
          buttons: [{ label: "Confirmar", kind: "gold", id: "lBtn", get: () => order.map((i) => ctx.cards[i]) }],
          onMount: (api) => {
            const draw = () => {
              api.body.innerHTML = `<div class="cardrow">${ctx.cards.map((c, i) => `<div data-c="${i}" style="position:relative">${cardHTML(c, "nauf")}${order.includes(i) ? `<div class="total" style="position:absolute;top:-10px;left:-6px">${order.indexOf(i) + 1}º</div>` : ""}</div>`).join("")}</div>`;
              api.body.querySelectorAll("[data-c]").forEach((el) => el.addEventListener("click", () => { const i = +el.dataset.c; if (!order.includes(i)) order.push(i); else order.splice(order.indexOf(i), 1); draw(); }));
              api.foot.querySelector("#lBtn").disabled = order.length !== ctx.cards.length;
            };
            draw();
          },
        });
      }
      case "bolsaPick": {
        const st = { rum: 0, polvora: 0, lona: 0 };
        return modal({
          title: "Bolsa do Rei Afogado", sub: "Escolha 3 suprimentos.", buttons: [{ label: "Receber", kind: "gold", id: "bBtn", get: () => st }],
          onMount: (api) => { api.body.innerHTML = SUP.map((k) => `<div class="oprow"><span>${icon(k)} ${NT.RES_NOME[k]}</span>${stepperHTML(k, 0)}</div>`).join(""); const b = api.foot.querySelector("#bBtn"); const chk = () => (b.disabled = st.rum + st.polvora + st.lona !== 3); wireSteppers(api.body, st, { rum: 3, polvora: 3, lona: 3 }, chk); chk(); },
        });
      }
      case "respawnHex": {
        const CANTO = ["superior esquerdo", "superior direito", "direito", "inferior direito", "inferior esquerdo", "esquerdo"];
        const near = (h) => Math.min(99, ...G.players.filter((o) => o !== p && o.alive).map((o) => { const A = G.map[o.pos], B = G.map[h]; const dr = Math.abs(A.r - B.r), dq = Math.abs(A.q - B.q); return Math.max(dr, (dq + dr) / 2); }));
        return modal({ title: "Seu barco afundou", sub: "Escolha o hexágono de início livre onde você renasce, com 1 tripulante.", buttons: ctx.options.map((h) => ({ label: `Canto ${CANTO[G.map[h].start]} (inimigo mais perto a ${near(h)} casas)`, value: h })) });
      }
      case "paySup": return modal({ title: NT.CURSES[ctx.curse].n, sub: "Escolha qual suprimento pagar.", buttons: ctx.options.map((k) => ({ label: `1 ${NT.RES_NOME[k]} (tem ${p.res[k]})`, value: k })) });
      case "tradeOffer": return modal({ title: `Proposta de ${esc(ctx.from.name)}`, sub: `${esc(ctx.from.name)} oferece ${E.bundleStr(ctx.give)} em troca de ${E.bundleStr(ctx.get)}.`, buttons: [{ label: "Recusar", value: false, kind: "ghost" }, { label: "Aceitar", value: true, kind: "gold" }] });
    }
    return Bot.decide(g, p, kind, ctx);
  }
  function pickCard(title, sub, cards, deck) {
    let sel = 0;
    return modal({
      title, sub, wide: true, buttons: [{ label: "Escolher", kind: "gold", get: () => sel }],
      onMount: (api) => { const draw = () => { api.body.innerHTML = `<div class="cardrow">${cards.map((c, i) => `<div data-c="${i}" class="${i === sel ? "sel" : ""}">${cardHTML(c, deck).replace('class="card', `class="card${i === sel ? " sel" : ""}`)}</div>`).join("")}</div>`; api.body.querySelectorAll("[data-c]").forEach((el) => el.addEventListener("click", () => { sel = +el.dataset.c; draw(); })); }; draw(); },
    });
  }

  // ======================= ANIMAÇÕES E AVISOS =======================
  function toast(msg, kind = "") {
    const box = $("#toasts"); const el = document.createElement("div"); el.className = "toast " + kind; el.textContent = msg; box.appendChild(el);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => el.remove(), 4200);
  }
  async function anim(g, type, d) {
    if (g !== G || (G.autoplay && speedMs() === 0)) return;
    const sp = speedMs();
    const humanAct = d.p && d.p.human;
    const quickBots = !humanAct && sp === 0;
    switch (type) {
      case "move": {
        const p = d.p; animating.add(p.id);
        const per = humanAct ? 230 : Math.min(260, sp * 0.35);
        if (!humanAct && d.path.length && layers.trail && sp > 0) {
          const pts = [p.pos].concat(d.path).map((h) => `${G.map[h].x.toFixed(0)},${G.map[h].y.toFixed(0)}`).join(" ");
          const line = S("polyline", { points: pts, class: "trail", stroke: p.color }); layers.trail.appendChild(line);
          setTimeout(() => line.remove(), Math.max(2500, sp * 5));
        }
        if (per >= 40) sfx("sail", d.path.length);
        const tok = layers.pawns[p.id].querySelector(".tok");
        let from = G.map[p.pos];
        for (const hid of d.path) {
          const to = G.map[hid];
          if (FX.reduced() || per < 40) { setPawn(p, hid); from = to; continue; }
          if (Math.hypot(to.x - from.x, to.y - from.y) > NT.GEO.R * 2.4) { // Passagem: some numa borda e surge na outra
            await FX.anim(tok, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.3) rotate(90deg)" }], { duration: per * 0.7, easing: EASE.in, fill: "forwards" });
            setPawn(p, hid); ripple(to);
            await FX.anim(tok, [{ opacity: 0, transform: "scale(.3) rotate(-90deg)" }, { opacity: 1, transform: "none" }], { duration: per, easing: EASE.spring, fill: "forwards" });
          } else {
            const dir = Math.sign(to.x - from.x) || 0.4;
            FX.anim(tok, [{ transform: "rotate(0deg)" }, { transform: `rotate(${dir * 9}deg) translateY(-3px)`, offset: 0.5 }, { transform: "rotate(0deg)" }], { duration: per, easing: EASE.inOut });
            await tweenPawn(p, from, to, per);
          }
          ripple(to); from = to;
        }
        if (!FX.reduced() && per >= 40) FX.anim(tok, [{ transform: "scale(1.12,.88)" }, { transform: "none" }], { duration: 260, easing: EASE.spring }); // assentar
        animating.delete(p.id); break;
      }
      case "card":
        if (humanAct) {
          sfx(d.deck === "bau" ? "chest" : "splash");
          await modal({ title: d.deck === "bau" ? "Você abre um baú" : "Você abre um naufrágio", body: `<div class="cardrow">${cardHTML(d.card, d.deck)}</div>`, quiet: true, onMount: (api) => revealCard(api.body, d.card.r.art ? "art" : "gold"), buttons: [{ label: "Pegar", value: 1, kind: "gold" }] });
        } else { toast(`${d.p.name} abre “${d.card.n}”`, ""); if (sp) { sfx("card"); await sleep(sp * 0.8); } }
        break;
      case "curse":
        if (humanAct) { sfx("curse"); FX.flash("violet"); await modal({ title: "Maldição!", body: `<div class="cardrow">${curseCardHTML(d.id)}</div>`, quiet: true, onMount: (api) => revealCard(api.body, "curse"), buttons: [{ label: "Aceitar o destino", value: 1, kind: "gold" }] }); }
        else { toast(`${d.p.name} recebe ${NT.CURSES[d.id].n}`, "curse"); if (sp) await sleep(sp * 0.5); }
        break;
      case "art":
        update();
        if (humanAct) { FX.flash("gold"); await modal({ title: "Novo artefato", sub: `Você tem ${d.p.arts.length} de ${G.rules.winArts}.`, body: `<div class="cardrow">${artCardHTML(d.id)}</div>`, quiet: true, onMount: (api) => revealCard(api.body, "art"), buttons: [{ label: "Guardar", value: 1, kind: "gold" }] }); }
        else if (!quickBots) { sfx("coin"); FX.banner(`${esc(d.p.name)} obtém um artefato`, `${NT.ARTS[d.id].n} · ${d.p.arts.length} de ${G.rules.winArts}`, d.p.arts.length >= G.rules.winArts - 1 ? "danger" : "", 1000); await sleep(sp); }
        else toast(`${d.p.name} obtém ${NT.ARTS[d.id].n} (${d.p.arts.length}/${G.rules.winArts})`, "art");
        break;
      case "fish": {
        if (humanAct) { sfx("splash"); const xy = pawnXY(d.p); if (xy) FX.burst(xy.x, xy.y, "gold", 8); }
        else { toast(`${d.p.name} pesca ${d.n} peixe(s)`, ""); if (sp) await sleep(sp * 0.3); }
        break;
      }
      case "dice": case "combatEnd": await combatAnim(type, d); break;
      case "sink": {
        sfx("sink"); FX.flash("red");
        const tok = layers.pawns[d.p.id] && layers.pawns[d.p.id].querySelector(".tok");
        if (tok && !quickBots) await FX.anim(tok, [{ transform: "none", opacity: 1 }, { transform: "rotate(25deg) scale(.9)", offset: 0.3 }, { transform: "rotate(540deg) scale(0)", opacity: 0 }], { duration: 900, easing: EASE.in });
        if (!quickBots) FX.banner("Naufrágio!", `O barco de ${esc(d.p.name)} afunda e renasce num canto`, "danger", 1100);
        else toast(`O barco de ${d.p.name} afunda!`, "combat");
        break;
      }
      case "transform": { sfx("curse"); const xy = pawnXY(d.p); if (xy) FX.burst(xy.x, xy.y, "violet", 16); toast(`${d.p.name} vira esqueleto`, "curse"); break; }
      case "virada":
        update();
        if (human() && !G.autoplay) {
          sfx("gong"); FX.flash("violet");
          G.players.forEach((p) => { const xy = pawnXY(p); if (xy) FX.burst(xy.x, xy.y, "violet", 10); });
          await FX.banner("A Virada", d.cause === "mare" ? "A Maré Negra chegou" : "O último baú foi aberto", "virada", 1500);
          await modal({ title: "A Virada", sub: d.cause === "mare" ? "A Maré Negra chegou. Todos os piratas viram esqueletos: agora vocês saqueiam cemitérios de navios, pescam em águas amaldiçoadas e, sem tripulantes, podem afundar." : "O último baú das ilhas foi aberto. Todos os piratas viram esqueletos.", buttons: [{ label: "Para os naufrágios", value: 1, kind: "gold" }] });
        }
        break;
    }
  }

  // ======================= LAÇO, SALVAR, FIM =======================
  E.ui = {
    log(g) { if (g === G) { renderSide(); } },
    anim, ask, update(g) { if (!g || g === G) update(); },
    async turnStart(g, p) { if (g !== G) return; sug = null; update(); if (p.human && !G.autoplay) { sfx("bell"); FX.banner("Sua vez", `Rodada ${G.round}${G.turn && G.turn.noMove ? " · preso: sem navegação" : ""}`, "", 750); } },
    humanTurn(g, p) { return new Promise((res) => { endTurnResolve = res; update(); }); },
    save(g) { if (g === G && !G.autoplay && !G.over) store.set(SAVE_KEY, G); },
    async gameOver(g) { if (g !== G) return; store.del(SAVE_KEY); if ((DEV && location.hash === "#autoteste")) { document.title = `FIM rodadas=${G.round} vencedor=${G.players[G.winner].name} (${G.winType})`; return; } await showEnd(); },
  };
  async function showEnd() {
    const w = G.players[G.winner];
    const rows = G.order.map((id) => { const p = G.players[id]; const from = Object.entries(p.st.artFrom).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(", ") || "—"; return `<tr class="${p.id === G.winner ? "win" : ""}"><td><span class="swatch" style="display:inline-block;vertical-align:-5px;background:${p.color}"></span> ${esc(p.name)}${p.human ? "" : ` <span class="mini">(${DIFF_N[p.diff]})</span>`}</td><td class="tab">${p.arts.length}</td><td>${from}</td><td class="tab">${p.st.fish}</td><td class="tab">${p.st.chests}</td><td class="tab">${p.st.curses}</td><td class="tab">${p.st.attackWins}/${p.st.attacks}</td><td class="tab">${p.st.defWins}/${p.st.defenses}</td><td class="tab">${p.st.sinks}</td><td class="tab">${p.st.trades}</td></tr>`; }).join("");
    const s = G.stats, mins = Math.round((Date.now() - G.startedAt) / 60000);
    sfx(w.human ? "win" : "lose"); if (w.human) FX.coins();
    const chart = histChart();
    const r = await modal({
      title: w.human ? "Vitória!" : `${esc(w.name)} vence`, sub: `Por ${G.winType}, na rodada ${G.round}. ${G.virada ? `Virada na rodada ${G.viradaRound} (${G.viradaCause === "mare" ? "Maré Negra" : "fim dos baús"}).` : "A partida terminou antes da Virada."}`, wide: true,
      body: `<div class="end tblwrap"><table><thead><tr><th>Capitão</th><th>Artef.</th><th>De onde</th><th>Peixes</th><th>Baús/naufr.</th><th>Maldições</th><th>Ataques venc.</th><th>Defesas venc.</th><th>Afundou</th><th>Trocas</th></tr></thead><tbody>${rows}</tbody></table></div>${chart}
        <div class="mini">Partida: ${G.round} rodadas · ${mins} min reais · ${s.attacks} ataques (${s.attackWins} vencidos pelo atacante, ${s.defWins} pelo defensor, ${s.ties} empates, ${s.cancels} cancelados) · ${s.sinks} afundamentos · ${s.artSteals} artefatos tomados em combate · ${s.curses} maldições · ${s.chests} baús e ${s.naufs} naufrágios abertos · ${s.trades} trocas.</div>`,
      buttons: [{ label: "Configurar", value: "cfg", kind: "ghost" }, { label: "Jogar de novo", value: "again", kind: "gold" }],
    });
    if (r === "again") startGame(); else showSetup();
  }

  function histChart() {
    const H = (G.hist || []).map((r, i) => r && { i, r }).filter(Boolean); if (H.length < 2) return "";
    const W = 640, Hh = 200, pad = 30, maxR = H[H.length - 1].i, maxA = Math.max(G.rules.winArts, ...H.flatMap((x) => x.r));
    const X = (i) => pad + ((i - H[0].i) / Math.max(1, maxR - H[0].i)) * (W - pad - 10), Y = (a) => Hh - pad - (a / maxA) * (Hh - pad - 10);
    let g = "";
    for (let a = 0; a <= maxA; a++) g += `<line x1="${pad}" x2="${W - 10}" y1="${Y(a)}" y2="${Y(a)}" stroke="#2a454e" stroke-width="1"/><text x="${pad - 8}" y="${Y(a) + 4}" text-anchor="end" fill="#9fb3ae" font-size="11">${a}</text>`;
    if (G.virada) g += `<line x1="${X(G.viradaRound)}" x2="${X(G.viradaRound)}" y1="10" y2="${Hh - pad}" stroke="#a970d2" stroke-dasharray="4 4"/><text x="${X(G.viradaRound) + 4}" y="20" fill="#d9c2ee" font-size="11">Virada</text>`;
    for (const x of H) if (x.i % 2 === 0 || x.i === maxR) g += `<text x="${X(x.i)}" y="${Hh - pad + 16}" text-anchor="middle" fill="#9fb3ae" font-size="11">${x.i}</text>`;
    G.players.forEach((p, k) => { const pts = H.map((x) => `${X(x.i).toFixed(1)},${(Y(x.r[k] || 0) - (k - 2) * 1.2).toFixed(1)}`).join(" "); g += `<polyline points="${pts}" fill="none" stroke="${p.color}" stroke-width="${p.human ? 3.5 : 2.2}" stroke-linejoin="round"/>`; });
    return `<div class="mini" style="margin-top:4px">Artefatos de cada capitão por rodada</div><svg viewBox="0 0 ${W} ${Hh}" style="width:100%;height:auto;max-height:220px" role="img" aria-label="Gráfico de artefatos por rodada">${g}</svg>`;
  }

  // ======================= CONFIGURAÇÃO =======================
  function saveCfg() { store.set(CFG_KEY, cfg); }
  function showSetup() {
    const el = $("#setup"); el.hidden = false;
    const saved = store.get(SAVE_KEY);
    const colorOpts = NT.CORES.map((c, i) => `<option value="${i}" ${i === cfg.color ? "selected" : ""}>${c.n}</option>`).join("");
    const groups = {}; for (const d of NT.RULE_DEFS) (groups[d.g] = groups[d.g] || []).push(d);
    const def = NT.defaultRules();
    const ruleInput = (d) => {
      const v = cfg.rules[d.k], chg = String(v) !== String(def[d.k]) ? "chg" : "";
      let inp;
      if (d.t === "bool") inp = `<input type="checkbox" id="r-${d.k}" ${v ? "checked" : ""}>`;
      else if (d.t === "sel") inp = `<select class="inp" id="r-${d.k}">${d.o.map(([val, lab]) => `<option value="${val}" ${val === v ? "selected" : ""}>${lab}</option>`).join("")}</select>`;
      else if (d.t === "text") inp = `<input class="inp" type="text" id="r-${d.k}" value="${esc(v)}">`;
      else inp = `<input class="inp" type="number" id="r-${d.k}" min="${d.min}" max="${d.max}" value="${v}">`;
      return `<label class="rule ${chg}" for="r-${d.k}"><span>${d.n}</span>${inp}</label>`;
    };
    el.innerHTML = `<div class="bgimg"></div><div class="bgshade"></div><svg class="rose" aria-hidden="true"><use href="#i-compass"/></svg><div class="inner">
      <div class="hero"><h1>NAUTILUS</h1><svg class="orn" aria-hidden="true"><use href="#i-orn"/></svg>
        <p>Comande um capitão pirata contra bots: pesque, saqueie baús, compre artefatos na Pedra das Sereias e sobreviva à Maré Negra. Quem reunir ${cfg.rules.winArts} artefatos primeiro vence.</p>
        <div class="row">${saved ? `<button class="btn" id="contBtn">Continuar partida salva (rodada ${saved.round})</button>` : ""}<button class="btn gold cta" id="startBtn">Zarpar</button></div></div>
      <div class="cols">
        <div class="sec"><h3>Você</h3><div class="row"><label class="field" style="flex:1">Nome do capitão<input type="text" id="cfgName" value="${esc(cfg.name)}" maxlength="24"></label><label class="field">Cor<select class="inp" id="cfgColor">${colorOpts}</select></label></div></div>
        <div class="sec"><h3>Mesa</h3>
          <div class="field">Mapa<div class="seg" id="mapSeg"><button data-v="aleatorio" class="${cfg.mapMode === "aleatorio" ? "on" : ""}">Embaralhado</button><button data-v="impresso" class="${cfg.mapMode === "impresso" ? "on" : ""}">Mapa impresso</button></div></div>
          <div class="mini" style="margin-top:6px">Embaralhado: os 6 inícios ficam nos cantos e os outros 64 hexágonos são sorteados, refazendo o sorteio se algum local ficar bloqueado.</div>
          <div class="row" style="margin-top:10px"><label class="field">Velocidade dos bots<select class="inp" id="cfgSpeed"><option value="1200">Lentos</option><option value="650">Normais</option><option value="250">Rápidos</option><option value="0">Instantâneos</option></select></label>
          <label class="row" style="margin-top:18px"><input type="checkbox" id="cfgTest" ${cfg.test ? "checked" : ""}> Modo teste (ver mãos dos bots)</label></div></div>
      </div>
      <div class="sec"><h3>Adversários</h3>
        <div class="row" style="margin-bottom:10px"><span class="mini">Quantos bots</span><div class="seg" id="nSeg">${[1, 2, 3, 4, 5].map((k) => `<button data-v="${k}" class="${k === cfg.nBots ? "on" : ""}">${k}</button>`).join("")}</div>
          <span class="mini" style="margin-left:12px">Todos</span><div class="seg" id="allSeg"><button data-v="facil">Fácil</button><button data-v="medio">Médio</button><button data-v="dificil">Difícil</button></div></div>
        <div id="botRows" style="display:grid;gap:6px"></div>
        <div class="mini" style="margin-top:8px">Fácil erra cálculos e quase não ataca. Médio joga bem e ataca quando compensa. Difícil ataca mais, mira em quem lidera, tenta bloquear quem está perto de vencer e é duro nas trocas. Nenhum bot vê suas cartas.</div></div>
      <details class="rules"><summary>Regras da partida (padrão: Manual v5) — valores alterados aparecem em dourado</summary>
        <div class="rgroups">${Object.entries(groups).map(([g, ds]) => `<div class="rgroup"><h4>${g}</h4>${ds.map(ruleInput).join("")}</div>`).join("")}</div>
        <div class="row" style="padding:0 14px 14px"><button class="btn" id="resetRules">Restaurar regras do Manual v5</button></div></details>
    </div>`;
    $("#cfgSpeed").value = String(cfg.speed);
    if (!FX.reduced()) { FX.anim(el.querySelector(".hero"), [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: EASE.out }); [...el.querySelectorAll(".inner > :not(.hero)")].forEach((x, i) => FX.anim(x, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 160 + i * 70, easing: EASE.out, fill: "backwards" })); }
    const drawBots = () => {
      const used = new Set([cfg.color]); const cols = NT.CORES.map((_, i) => i).filter((i) => !used.has(i));
      $("#botRows").innerHTML = Array.from({ length: cfg.nBots }, (_, i) => `<div class="botrow"><span class="swatch" style="background:${NT.CORES[cols[i]].c}"></span><span>${botNames()[i]}</span><select class="inp" data-b="${i}">${["facil", "medio", "dificil"].map((d) => `<option value="${d}" ${cfg.diffs[i] === d ? "selected" : ""}>${DIFF_N[d]}</option>`).join("")}</select></div>`).join("");
      $("#botRows").querySelectorAll("[data-b]").forEach((s) => s.addEventListener("change", () => { cfg.diffs[+s.dataset.b] = s.value; saveCfg(); }));
    };
    drawBots();
    $("#nSeg").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { cfg.nBots = +b.dataset.v; $("#nSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); drawBots(); saveCfg(); }));
    $("#allSeg").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { cfg.diffs = cfg.diffs.map(() => b.dataset.v); drawBots(); saveCfg(); }));
    $("#mapSeg").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { cfg.mapMode = b.dataset.v; $("#mapSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); saveCfg(); }));
    $("#cfgName").addEventListener("input", (e) => { cfg.name = e.target.value.trim() || "Você"; saveCfg(); drawBots(); });
    $("#cfgColor").addEventListener("change", (e) => { cfg.color = +e.target.value; saveCfg(); drawBots(); });
    $("#cfgSpeed").addEventListener("change", (e) => { cfg.speed = +e.target.value; saveCfg(); });
    $("#cfgTest").addEventListener("change", (e) => { cfg.test = e.target.checked; saveCfg(); });
    for (const d of NT.RULE_DEFS) {
      const inp = $("#r-" + d.k);
      inp.addEventListener("change", () => {
        let v = d.t === "bool" ? inp.checked : d.t === "num" ? Math.max(d.min, Math.min(d.max, parseInt(inp.value, 10) || 0)) : inp.value;
        if (d.t === "num") inp.value = v;
        cfg.rules[d.k] = v; saveCfg(); inp.closest(".rule").classList.toggle("chg", String(v) !== String(def[d.k]));
      });
    }
    $("#resetRules").addEventListener("click", () => { cfg.rules = NT.defaultRules(); saveCfg(); showSetup(); $("details.rules").open = true; });
    $("#startBtn").addEventListener("click", startGame);
    const cb = $("#contBtn"); if (cb) cb.addEventListener("click", () => continueGame(saved));
  }
  function botNames() { return NT.CAPITAES.filter((n) => n !== cfg.name).slice(0, 5); }
  function abortCurrent() {
    if (G) { G.aborted = true; G.over = true; }
    combatOv = null;
    if (endTurnResolve) { const r = endTurnResolve; endTurnResolve = null; r(); }
    $("#modalRoot").innerHTML = ""; combatOv = null; modalStack = 0;
  }
  function launch(g) {
    abortCurrent();
    G = g; G.botDelay = cfg.speed; testMode = !!cfg.test; $("#speedSel").value = String(cfg.speed);
    const st = $("#setup");
    if (!st.hidden) FX.anim(st, [{ opacity: 1 }, { opacity: 0, transform: "scale(1.03)" }], { duration: 380, easing: EASE.in }).then(() => { st.hidden = true; });
    busy = false; prevSnap = null; lastRound = 0; lastTurnPid = -1;
    introPending = !g.autoplay && g.round === 1 && g.ti === 0;
    buildBoard(); update();
    if (!cfg.seenIntro && !G.autoplay) { cfg.seenIntro = true; saveCfg(); setTimeout(showIntro, 300); }
    E.run(G).catch((e) => { console.error(e); toast("Erro no jogo: " + e.message, "combat"); if ((DEV && location.hash === "#autoteste")) document.title = "ERRO " + e.message; });
  }
  function showIntro() {
    modal({ title: "Bem-vindo a bordo", closeValue: null, wide: true, buttons: [{ label: "Zarpar", value: null, kind: "gold" }],
      body: `<div class="help"><ul>
        <li><b>Seu turno:</b> 1 navegação (clique num hexágono destacado) e 1 atividade (botões do painel), na ordem que quiser.</li>
        <li><b>Meta:</b> ${G.rules.winArts} artefatos. Eles vêm quase sempre da Pedra das Sereias: 1 concha + ouro (peixe vale ouro lá).</li>
        <li><b>Começo:</b> pesque no mar aberto, abra baús ao lado das ilhas e contrate tripulantes (mais tripulantes = mais peixe e mais dados).</li>
        <li><b>Cuidado:</b> passar por águas roxas dá maldição a piratas. Na rodada ${G.rules.mareRound || "—"} todos viram esqueletos.</li>
        <li><b>Ajuda:</b> o botão <b>Dica</b> (tecla D) sugere uma jogada, e clicar num capitão mostra o que ele tem à mostra.</li></ul></div>` });
  }
  function startGame() {
    const used = new Set([cfg.color]); const cols = NT.CORES.map((_, i) => i).filter((i) => !used.has(i));
    const players = [{ name: cfg.name || "Você", human: true, color: NT.CORES[cfg.color].c }];
    for (let i = 0; i < cfg.nBots; i++) players.push({ name: botNames()[i], human: false, diff: cfg.diffs[i] || "medio", color: NT.CORES[cols[i]].c });
    const g = E.newGame({ players, mapMode: cfg.mapMode, rules: cfg.rules });
    store.del(SAVE_KEY);
    launch(g);
  }
  function continueGame(saved) { if (!saved) return startGame(); saved.aborted = false; launch(saved); }

  // ======================= TOPO =======================
  $("#speedSel").addEventListener("change", (e) => { cfg.speed = +e.target.value; if (G) G.botDelay = cfg.speed; saveCfg(); });
  $("#testBtn").addEventListener("click", () => { testMode = !testMode; cfg.test = testMode; if (G) G.testMode = testMode; saveCfg(); update(); });
  $("#menuBtn").addEventListener("click", async () => {
    if (G && !G.over) { const ok = await modal({ title: "Nova partida", sub: "A partida atual fica salva e pode ser continuada pela tela inicial.", buttons: [{ label: "Voltar ao jogo", value: false, kind: "ghost" }, { label: "Ir para a tela inicial", value: true, kind: "gold" }] }); if (!ok) return; if (!G.over) store.set(SAVE_KEY, G); }
    abortCurrent(); showSetup();
  });
  const soundBtn = $("#soundBtn"), soundPop = $("#soundPop");
  function drawSound() {
    const a = cfg.audio, pct = (v) => Math.round(v * 100);
    soundBtn.textContent = a.mute ? "Som: mudo" : "Som";
    const sl = (id, label, v) => `<label for="${id}">${label}<input type="range" id="${id}" min="0" max="100" value="${pct(v)}"><output>${pct(v)}</output></label>`;
    soundPop.innerHTML = `<h4>Som</h4><label class="chk"><input type="checkbox" id="aMute" ${a.mute ? "checked" : ""}><span>Silenciar tudo</span></label>
      ${sl("aMaster", "Geral", a.master)}${sl("aSfx", "Efeitos", a.sfx)}${sl("aUi", "Interface", a.ui)}
      <label class="chk"><input type="checkbox" id="aAmb" ${a.ambOn ? "checked" : ""}><span>Ambiente do mar (ondas e casco)</span></label>${sl("aAmbV", "Ambiente", a.amb)}
      <h4>Animações</h4><div class="seg" id="animSeg">${[["auto", "Do sistema"], ["completo", "Completas"], ["reduzido", "Reduzidas"]].map(([v, l]) => `<button data-v="${v}" class="${(cfg.anim || "auto") === v ? "on" : ""}">${l}</button>`).join("")}</div>`;
    const bind = (id, key) => { const i = soundPop.querySelector("#" + id); i.addEventListener("input", () => { a[key] = i.value / 100; i.nextElementSibling.textContent = i.value; applyPrefs(); saveCfg(); }); i.addEventListener("change", () => sfx(key === "ui" ? "click" : "coin")); };
    bind("aMaster", "master"); bind("aSfx", "sfx"); bind("aUi", "ui"); bind("aAmbV", "amb");
    soundPop.querySelector("#aMute").addEventListener("change", (e) => { a.mute = e.target.checked; applyPrefs(); saveCfg(); soundBtn.textContent = a.mute ? "Som: mudo" : "Som"; if (a.mute) SFX.stopAll(); });
    soundPop.querySelector("#aAmb").addEventListener("change", (e) => { a.ambOn = e.target.checked; SFX.ambient(a.ambOn && !a.mute); applyPrefs(); saveCfg(); });
    soundPop.querySelectorAll("#animSeg button").forEach((b) => b.addEventListener("click", () => { cfg.anim = b.dataset.v; applyPrefs(); saveCfg(); drawSound(); }));
  }
  drawSound();
  soundBtn.addEventListener("click", (e) => { e.stopPropagation(); soundPop.hidden = !soundPop.hidden; soundBtn.setAttribute("aria-expanded", String(!soundPop.hidden)); if (!soundPop.hidden) FX.anim(soundPop, [{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 220 }); });
  document.addEventListener("click", (e) => { if (!soundPop.hidden && !e.target.closest(".popwrap")) { soundPop.hidden = true; soundBtn.setAttribute("aria-expanded", "false"); } });
  $("#zIn").addEventListener("click", () => zoomCenter(1 / 1.3));
  $("#zOut").addEventListener("click", () => zoomCenter(1.3));
  $("#zFit").addEventListener("click", resetZoom);
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,select,textarea")) return;
    const ovs = document.querySelectorAll("#modalRoot .ov:not(.closing)"), ov = ovs[ovs.length - 1];
    if (e.key === "Escape" && !soundPop.hidden) { soundPop.hidden = true; return; }
    if (ov) { if (e.key === "Escape" && ov.__close) ov.__close(); return; }
    if (!G || !$("#setup").hidden) return;
    if (e.key === "Enter" && isHumanTurn() && !(e.target.closest && e.target.closest("button"))) { e.preventDefault(); tryEndTurn(); }
    else if ((e.key === "d" || e.key === "D") && isHumanTurn()) showSuggestion();
    else if (e.key === "?" ) $("#helpBtn").click();
    else if (e.key === "+" || e.key === "=") zoomCenter(1 / 1.3);
    else if (e.key === "-") zoomCenter(1.3);
    else if (e.key === "0") resetZoom();
  });
  $("#helpBtn").addEventListener("click", () => {
    const r = G ? G.rules : cfg.rules;
    modal({
      title: "Como jogar", wide: true, closeValue: null, buttons: [{ label: "Fechar", value: null, kind: "gold" }],
      body: `<div class="help"><ul>
        <li><b>Objetivo:</b> ser o primeiro a ter ${r.winArts} artefatos. A maioria é comprada na Pedra das Sereias: 1 concha + ouros pela escada (${r.ladder}), no máximo ${r.artPerTurn} por turno. Lá, peixe ${r.pedraFish ? "vale" : "não vale"} como ouro.</li>
        <li><b>Turno:</b> 1 navegação (até sua velocidade, clique num hexágono destacado) e 1 atividade, em qualquer ordem. Negociar e usar artefatos de uso único é livre.</li>
        <li><b>Atividades:</b> pescar (piratas no mar aberto, esqueletos nas águas amaldiçoadas), abrir baú ao lado de uma ilha (piratas) ou naufrágio ao lado de um cemitério (esqueletos), operar num local (Comércio, Pedra, Taverna, Ossuário, Capela, Altar) ou atacar um navio ao seu lado.</li>
        <li><b>Bordas:</b> Taverna, Capela, Comércio/Ossuário, Pedra das Sereias e as Passagens são usadas encostando o navio na linha vermelha. Atravessar uma Passagem custa 1 casa.</li>
        <li><b>Águas amaldiçoadas:</b> um pirata que entra nelas recebe uma maldição (no máximo 1 por turno). Esqueletos são imunes.</li>
        <li><b>Virada:</b> na rodada ${r.mareRound || "—"} (Maré Negra) ou quando acabam os baús, todos viram esqueletos. Antes disso, o Altar transforma por ${r.transformCost} ouros${r.transformGift ? " e dá 1 concha" : ""}.</li>
        <li><b>Combate:</b> o atacante escolhe os dados (até 3, um por tripulante disponível), o defensor responde. Vale o maior dado + bônus. Quem vence saqueia ${r.lootPerDie} carta por dado que usou; quem perde sofre dano igual aos dados que usou. Pirata só fica ferido (e protegido); esqueleto perde tripulantes e, sem eles, afunda e entrega 1 artefato.${r.artSteal !== "nao" ? " Ao vencer um ataque contra " + (r.artSteal === "esqueletos" ? "um esqueleto" : "alguém") + " com mais artefatos que você, pode tomar 1 artefato no lugar do saque." : ""}</li>
        <li><b>Limite:</b> no máximo ${r.handLimit} recursos na mão.</li>
        <li><b>Mesa:</b> clique num capitão no painel para ver os artefatos, efeitos e maldições dele. Passe o mouse num hexágono destacado para ver o que dá para fazer lá. A Dica mostra o que o bot difícil faria no seu lugar.</li>
        <li><b>Atalhos:</b> Enter encerra o turno · D pede uma dica · + e − dão zoom (ou a roda do mouse; arraste para mover) · 0 enquadra o mapa · Esc fecha janelas · ? abre esta ajuda.</li></ul></div>`,
    });
  });
  window.addEventListener("error", (e) => toast("Erro: " + e.message, "combat"));
  if (DEV) NT.debug = { get G() { return G; }, ask, modal };

  // ======================= INÍCIO =======================
  if ((DEV && location.hash === "#autoteste")) {
    const players = [0, 1, 2, 3].map((i) => ({ name: NT.CAPITAES[i], human: i === 0, diff: ["dificil", "medio", "facil", "dificil"][i], color: NT.CORES[i].c }));
    const g = E.newGame({ players, mapMode: "aleatorio" }); g.autoplay = true; cfg.speed = 0; launch(g); G.botDelay = 0;
  } else showSetup();
})(window.NT);
