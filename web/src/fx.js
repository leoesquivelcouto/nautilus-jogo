// Nautilus online — "game feel": animações (Web Animations API, sem bibliotecas) e áudio sintetizado (Web Audio API).
// Princípios: toda animação comunica algo (origem → destino, ganho/perda, vitória/derrota); só transform/opacity;
// movimento reduzido respeitado; som só em mudanças de estado com significado (nunca em hover), com barramentos,
// volume por categoria, limite de vozes e intervalo mínimo por som.
window.NT = window.NT || {};
(function (NT) {
  const FX = (NT.FX = {});
  const SFX = (NT.SFX = {});

  // ======================= MOVIMENTO =======================
  const RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  FX.pref = "auto"; // "auto" (segue o sistema) | "completo" | "reduzido"
  FX.reduced = () => FX.pref === "reduzido" || (FX.pref === "auto" && RM.matches);
  FX.speed = 1; // multiplicador global (bots instantâneos → animações curtas)
  FX.EASE = {
    out: "cubic-bezier(.22,1,.36,1)", // desacelera com suavidade: entradas
    spring: "cubic-bezier(.34,1.56,.64,1)", // pequeno overshoot: recompensas, cartas pousando
    inOut: "cubic-bezier(.65,0,.35,1)", // deslocamentos (navio entre hexágonos)
    in: "cubic-bezier(.55,0,1,.45)", // saídas
  };
  FX.wait = (ms) => new Promise((r) => setTimeout(r, FX.reduced() ? 0 : ms * FX.speed));
  // Anima um elemento; com movimento reduzido aplica só o estado final (sem deslocamento).
  FX.anim = function (el, kf, opt = {}) {
    if (!el || !el.animate) return Promise.resolve();
    if (FX.reduced()) {
      if (opt.fill === "forwards" || opt.fill === "both") { const last = kf[kf.length - 1]; for (const k in last) if (k !== "offset" && k !== "easing") el.style[k] = last[k]; }
      return Promise.resolve();
    }
    const a = el.animate(kf, Object.assign({ duration: 300, easing: FX.EASE.out }, opt, { duration: (opt.duration || 300) * FX.speed, delay: (opt.delay || 0) * FX.speed }));
    return a.finished.then(() => a, () => a);
  };
  FX.pop = (el, s = 1.12) => FX.anim(el, [{ transform: "scale(1)" }, { transform: `scale(${s})`, offset: 0.35 }, { transform: "scale(1)" }], { duration: 380, easing: FX.EASE.spring });
  FX.shake = (el) => FX.anim(el, [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(2px)" }, { transform: "translateX(0)" }], { duration: 320, easing: "linear" });
  FX.glow = (el, color = "rgba(236,208,138,.75)") => FX.anim(el, [{ boxShadow: `0 0 0 0 ${color}` }, { boxShadow: `0 0 0 6px ${color.replace(/[\d.]+\)$/, "0)")}` }], { duration: 900 });

  function layer() { let l = document.getElementById("fxLayer"); if (!l) { l = document.createElement("div"); l.id = "fxLayer"; l.setAttribute("aria-hidden", "true"); document.body.appendChild(l); } return l; }
  // Texto flutuante (+2 ouro, −1 tripulante...) que sobe e some a partir de um ponto da tela.
  FX.float = function (x, y, html, kind = "gain") {
    if (FX.reduced()) return;
    const el = document.createElement("div"); el.className = "fxfloat " + kind; el.innerHTML = html;
    el.style.left = x + "px"; el.style.top = y + "px"; layer().appendChild(el);
    FX.anim(el, [{ transform: "translate(-50%,-20%) scale(.8)", opacity: 0 }, { transform: "translate(-50%,-90%) scale(1.08)", opacity: 1, offset: 0.25 }, { transform: "translate(-50%,-190%) scale(1)", opacity: 0 }], { duration: 1100, easing: FX.EASE.out }).then(() => el.remove());
  };
  // Ficha voando em arco de um ponto a outro (ex.: do navio no mapa até o painel de recursos).
  FX.fly = function (from, to, html, delay = 0) {
    if (FX.reduced() || !from || !to) return Promise.resolve();
    const el = document.createElement("div"); el.className = "fxchip"; el.innerHTML = html; layer().appendChild(el);
    const dx = to.x - from.x, dy = to.y - from.y, lift = Math.min(160, 60 + Math.hypot(dx, dy) * 0.25);
    el.style.left = from.x + "px"; el.style.top = from.y + "px";
    return FX.anim(el, [
      { transform: "translate(-50%,-50%) scale(.4)", opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - lift}px)) scale(1.15)`, opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.9 },
    ], { duration: 720, delay, easing: "cubic-bezier(.45,.05,.4,1)" }).then(() => el.remove());
  };
  // Faíscas douradas (recompensa) ou roxas (maldição) saindo de um ponto.
  FX.burst = function (x, y, kind = "gold", n = 16) {
    if (FX.reduced()) return;
    const L = layer();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i"); s.className = "fxspark " + kind; s.style.left = x + "px"; s.style.top = y + "px"; L.appendChild(s);
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4, d = 40 + Math.random() * 70;
      FX.anim(s, [{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 20}px)) scale(.2)`, opacity: 0 }], { duration: 650 + Math.random() * 350, easing: FX.EASE.out }).then(() => s.remove());
    }
  };
  // Faixa de evento no centro do tabuleiro ("Sua vez", "A Virada", "Artefato!").
  FX.banner = async function (title, sub = "", kind = "", hold = 1100) {
    const host = document.getElementById("boardwrap"); if (!host) return;
    const live = document.getElementById("live"); if (live) live.textContent = title + (sub ? ". " + sub : "");
    if (FX.reduced() && hold < 900) return;
    host.querySelectorAll(".banner").forEach((b) => b.remove());
    const el = document.createElement("div"); el.className = "banner " + kind; el.innerHTML = `<div class="bn-in"><div class="bn-t">${title}</div>${sub ? `<div class="bn-s">${sub}</div>` : ""}</div>`;
    host.appendChild(el);
    await FX.anim(el, [{ opacity: 0, transform: "translate(-50%,-50%) scaleX(.6)" }, { opacity: 1, transform: "translate(-50%,-50%) scaleX(1)" }], { duration: 380, easing: FX.EASE.spring, fill: "forwards" });
    await new Promise((r) => setTimeout(r, FX.reduced() ? 600 : hold * FX.speed));
    await FX.anim(el, [{ opacity: 1, transform: "translate(-50%,-50%) scale(1)" }, { opacity: 0, transform: "translate(-50%,-56%) scale(.98)" }], { duration: 260, easing: FX.EASE.in, fill: "forwards" });
    el.remove();
  };
  // Clarão sobre o tabuleiro (ataque, maldição, Virada).
  FX.flash = function (kind = "red") {
    const host = document.getElementById("boardwrap"); if (!host || FX.reduced()) return;
    const el = document.createElement("div"); el.className = "flash " + kind; host.appendChild(el);
    FX.anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 700 }).then(() => el.remove());
  };
  // Chuva de moedas da vitória (canvas, ~2,5 s).
  FX.coins = function () {
    if (FX.reduced()) return;
    const c = document.createElement("canvas"); c.className = "fxcanvas"; c.width = innerWidth; c.height = innerHeight; layer().appendChild(c);
    const g = c.getContext("2d"), P = [];
    for (let i = 0; i < 90; i++) P.push({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.6, vy: 2 + Math.random() * 4, vx: -1 + Math.random() * 2, r: 6 + Math.random() * 7, a: Math.random() * 6, va: 0.1 + Math.random() * 0.2 });
    const t0 = performance.now();
    (function frame(t) {
      g.clearRect(0, 0, c.width, c.height);
      const fade = Math.max(0, 1 - (t - t0 - 1800) / 900);
      for (const p of P) {
        p.y += p.vy; p.x += p.vx; p.vy += 0.06; p.a += p.va;
        const w = Math.abs(Math.cos(p.a)) * p.r;
        g.globalAlpha = fade; g.fillStyle = "#c9a24f"; g.beginPath(); g.ellipse(p.x, p.y, w + 0.5, p.r, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#f3dc9a"; g.beginPath(); g.ellipse(p.x - w * 0.25, p.y - p.r * 0.25, Math.max(0.5, w * 0.45), p.r * 0.45, 0, 0, Math.PI * 2); g.fill();
      }
      if (fade > 0) requestAnimationFrame(frame); else c.remove();
    })(t0);
  };
  // Contagem animada de um número (totais de combate).
  FX.count = function (el, to, ms = 500) {
    if (FX.reduced()) { el.textContent = to; return; }
    const from = 0, t0 = performance.now();
    (function f(t) { const k = Math.min(1, (t - t0) / (ms * FX.speed)); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
  };

  // ======================= ÁUDIO =======================
  // Grafo: fontes → barramento (ui | efeitos | ambiente) → mestre → compressor → saída.
  SFX.cfg = { mute: false, master: 0.8, sfx: 0.8, ui: 0.6, amb: 0.45, ambOn: false };
  let ctx = null, master, comp, bus = {}, noiseBuf = null, active = 0, ambNodes = null;
  const last = {}, MAXV = 14;
  const GAP = { click: 40, deny: 120, coin: 45, spend: 60, dice: 140, card: 70, flip: 90, sail: 160, splash: 120, open: 80, close: 80, crew: 90 };
  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.connect(comp);
    for (const b of ["ui", "sfx", "amb"]) { bus[b] = ctx.createGain(); bus[b].connect(master); }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    SFX.apply();
    return ctx;
  }
  // O navegador só libera áudio depois de um gesto do jogador.
  const unlock = () => { if (!SFX.cfg.mute) { ensure(); if (SFX.cfg.ambOn) SFX.ambient(true); } };
  addEventListener("pointerdown", unlock, { once: true }); addEventListener("keydown", unlock, { once: true });
  SFX.apply = function () {
    if (!ctx) return;
    const c = SFX.cfg, t = ctx.currentTime;
    master.gain.setTargetAtTime(c.mute ? 0 : c.master, t, 0.05);
    bus.ui.gain.setTargetAtTime(c.ui * 0.9, t, 0.05); bus.sfx.gain.setTargetAtTime(c.sfx, t, 0.05); bus.amb.gain.setTargetAtTime(c.ambOn ? c.amb * 0.7 : 0, t, 0.3);
    if (c.ambOn && !c.mute) SFX.ambient(true);
  };
  SFX.stopAll = function () { if (ctx) { SFX.ambient(false); master.gain.setTargetAtTime(0, ctx.currentTime, 0.02); setTimeout(SFX.apply, 200); } };

  // --- blocos sonoros ---
  function voice(dur) { active++; setTimeout(() => active--, (dur + 0.1) * 1000); }
  function tone(out, f, at, dur, { type = "sine", vol = 0.5, f2 = 0, attack = 0.006, q = 0, filter = 0 } = {}) {
    const t0 = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o; if (filter) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filter; fl.Q.value = q; o.connect(fl); node = fl; }
    node.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05); voice(at + dur);
  }
  function noise(out, at, dur, { type = "bandpass", f = 1800, f2 = 0, q = 0.8, vol = 0.4, attack = 0.004 } = {}) {
    const t0 = ctx.currentTime + at, n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noiseBuf; n.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(fl); fl.connect(g); g.connect(out); n.start(t0, Math.random() * 1.5); n.stop(t0 + dur + 0.05); voice(at + dur);
  }
  const semis = (n) => Math.pow(2, n / 12);
  let coinStreak = 0, coinT = 0;

  // Receitas. Família por significado: grave/abafado = custo, perda, erro; agudo/brilhante = ganho, recompensa.
  const R = {
    click(u) { noise(u, 0, 0.03, { f: 2600, q: 2, vol: 0.18 }); tone(u, 760, 0, 0.05, { type: "triangle", vol: 0.1, f2: 520 }); },
    open(u) { noise(u, 0, 0.22, { f: 500, f2: 2600, q: 0.7, vol: 0.12, attack: 0.05 }); },
    close(u) { noise(u, 0, 0.14, { f: 2200, f2: 600, q: 0.7, vol: 0.09, attack: 0.02 }); },
    deny(u) { tone(u, 140, 0, 0.2, { vol: 0.55, f2: 52 }); noise(u, 0, 0.04, { f: 900, vol: 0.12 }); },
    card(s) { noise(s, 0, 0.16, { type: "highpass", f: 1400, vol: 0.22, attack: 0.01 }); },
    flip(s) { noise(s, 0, 0.05, { f: 3000, q: 1.5, vol: 0.2 }); noise(s, 0.09, 0.07, { f: 2200, q: 1.2, vol: 0.18 }); },
    dice(s) {
      const n = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) { const at = i * (0.045 + Math.random() * 0.05); tone(s, 1500 + Math.random() * 1400, at, 0.035, { type: "triangle", vol: 0.16 - i * 0.012 }); noise(s, at, 0.03, { f: 3200, q: 3, vol: 0.12 }); }
      noise(s, 0, 0.35, { f: 900, q: 0.6, vol: 0.05 });
    },
    coin(s) { // tom sobe 2 semitons a cada ganho seguido (sensação de sequência)
      const now = performance.now(); coinStreak = now - coinT < 1400 ? Math.min(coinStreak + 1, 7) : 0; coinT = now;
      const k = semis(coinStreak * 2);
      tone(s, 1568 * k, 0, 0.16, { type: "triangle", vol: 0.22 }); tone(s, 2093 * k, 0.05, 0.28, { type: "triangle", vol: 0.18 }); tone(s, 4186 * k, 0.05, 0.12, { vol: 0.05 });
    },
    spend(s) { tone(s, 520, 0, 0.12, { type: "triangle", vol: 0.16, f2: 330 }); noise(s, 0, 0.05, { f: 1200, vol: 0.08 }); },
    chest(s) {
      tone(s, 95, 0, 0.32, { type: "sawtooth", vol: 0.12, f2: 150, filter: 600, q: 6 }); // rangido
      noise(s, 0.3, 0.04, { f: 2400, q: 3, vol: 0.25 }); // trava
      [784, 988, 1319].forEach((f, i) => tone(s, f, 0.36 + i * 0.07, 0.4, { type: "triangle", vol: 0.12 }));
    },
    sail(s, len = 1) { const d = Math.min(1.4, 0.35 + len * 0.22); noise(s, 0, d, { type: "lowpass", f: 300, f2: 1100, q: 0.4, vol: 0.18, attack: d * 0.4 }); noise(s, d * 0.5, d * 0.6, { f: 700, q: 0.6, vol: 0.05, attack: 0.1 }); },
    splash(s) { noise(s, 0, 0.3, { type: "lowpass", f: 2400, f2: 400, vol: 0.25 }); [0.08, 0.15, 0.24].forEach((at) => tone(s, 500 + Math.random() * 500, at, 0.08, { vol: 0.08, f2: 1100 })); },
    crew(s) { [0, 0.11].forEach((at) => { tone(s, 210, at, 0.08, { type: "triangle", vol: 0.25, f2: 160 }); noise(s, at, 0.03, { f: 1400, vol: 0.12 }); }); },
    cannon(s) { tone(s, 90, 0, 0.7, { vol: 0.7, f2: 32 }); noise(s, 0, 0.55, { type: "lowpass", f: 900, f2: 120, vol: 0.5, attack: 0.002 }); noise(s, 0.02, 0.1, { f: 2500, vol: 0.12 }); },
    hit(s) { tone(s, 160, 0, 0.25, { vol: 0.5, f2: 60 }); noise(s, 0, 0.12, { f: 1600, q: 0.8, vol: 0.3 }); },
    reward(s) { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(s, f, i * 0.07, 0.9, { type: "triangle", vol: 0.1 }); tone(s, f * 2.01, i * 0.07 + 0.01, 0.5, { vol: 0.03 }); }); },
    curse(s) { tone(s, 196, 0, 1.0, { type: "sawtooth", vol: 0.1, f2: 147, filter: 700, q: 4 }); tone(s, 277, 0.05, 1.0, { type: "sawtooth", vol: 0.08, f2: 207, filter: 700, q: 4 }); noise(s, 0, 0.9, { f: 600, f2: 3000, q: 4, vol: 0.05, attack: 0.3 }); },
    bell(s) { [[880, 0.22], [2429, 0.08], [4752, 0.04]].forEach(([f, v]) => tone(s, f, 0, 1.4, { vol: v, attack: 0.003 })); tone(s, 880, 0.55, 1.0, { vol: 0.1 }); },
    gong(s) { [[98, 0.4], [148, 0.2], [233, 0.12], [311, 0.06]].forEach(([f, v]) => tone(s, f, 0, 3, { vol: v, attack: 0.02 })); noise(s, 0, 1.5, { type: "lowpass", f: 400, vol: 0.1, attack: 0.05 }); },
    sink(s) { tone(s, 260, 0, 1.2, { vol: 0.4, f2: 50 }); for (let i = 0; i < 6; i++) tone(s, 300 + Math.random() * 400, 0.2 + i * 0.13, 0.08, { vol: 0.08, f2: 900 }); },
    win(s) { [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [784, 0.62], [1047, 0.75]].forEach(([f, at], i) => tone(s, f, at, i === 5 ? 1.2 : 0.4, { type: "sawtooth", vol: 0.1, filter: 2200, q: 1 })); },
    lose(s) { [[392, 0], [349, 0.25], [311, 0.5]].forEach(([f, at], i) => tone(s, f, at, i === 2 ? 1.0 : 0.4, { type: "triangle", vol: 0.18 })); },
    turn(s) { tone(s, 660, 0, 0.35, { vol: 0.14 }); tone(s, 990, 0.12, 0.5, { vol: 0.12 }); },
  };
  const BUS = { click: "ui", open: "ui", close: "ui", deny: "ui" };
  SFX.play = function (name, arg) {
    const c = SFX.cfg; if (c.mute || !R[name]) return;
    if ((name === "click" ? c.ui : c.sfx) <= 0) return;
    if (!ensure()) return;
    const now = performance.now(); if (GAP[name] && now - (last[name] || 0) < GAP[name]) return; last[name] = now;
    if (active > MAXV && !["win", "lose", "reward", "gong", "cannon"].includes(name)) return; // limite de vozes
    try { R[name](bus[BUS[name] || "sfx"], arg); } catch (e) {}
  };
  // Camada de ambiente opcional: mar (ruído filtrado com ondulação lenta) + rangidos ocasionais do casco.
  SFX.ambient = function (on) {
    if (on && (ambNodes || !ensure())) return;
    if (!on) { if (ambNodes) { ambNodes.stop(); ambNodes = null; } return; }
    const out = bus.amb, nodes = [];
    const wave = (f, q, rate, depth, base) => {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = base;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = rate; lg.gain.value = depth; lfo.connect(lg); lg.connect(g.gain);
      n.connect(fl); fl.connect(g); g.connect(out); n.start(); lfo.start(); nodes.push(n, lfo);
    };
    wave(420, 0.5, 0.09, 0.12, 0.16); wave(1300, 0.3, 0.13, 0.04, 0.035);
    let timer = 0;
    const creak = () => { if (!ambNodes) return; tone(out, 70 + Math.random() * 40, 0, 0.6 + Math.random() * 0.5, { type: "sawtooth", vol: 0.035, f2: 110 + Math.random() * 60, filter: 500, q: 8, attack: 0.15 }); timer = setTimeout(creak, 7000 + Math.random() * 12000); };
    timer = setTimeout(creak, 4000);
    ambNodes = { stop() { clearTimeout(timer); nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); } };
  };
})(window.NT);
