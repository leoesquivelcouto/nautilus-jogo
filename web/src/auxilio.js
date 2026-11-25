// Nautilus online — carta de auxílio: os preços de todos os locais, como a carta física (frente: Comércio; verso: os outros locais).
// Os valores vêm das regras da partida (ou da configuração, antes de começar), então batem com o editor de regras.
window.NT = window.NT || {};
(function (NT) {
  const A = (NT.Aux = {});
  const ic = (k, t = "") => `<img class="ax-ic" src="assets/icones/${k}.png" alt="${t || k}" title="${t || k}">`;
  const q = (n, k, t) => `<span class="ax-q">${n > 1 ? `<b>${n}</b>` : ""}${ic(k, t)}</span>`;
  const ladderOf = (r) => (r.ladderArr && r.ladderArr.length ? r.ladderArr : String(r.ladder || "2,3,4,5,6").split(",").map((v) => parseInt(v, 10)).filter((v) => !isNaN(v)));

  // Linhas de preço por local. ctx (opcional): { arts, here: Set de locais usáveis agora, skel }
  A.sections = function (r, ctx = {}) {
    const L = ladderOf(r), here = ctx.here || new Set(), sup = `${ic("rum", "rum")}${ic("polvora", "pólvora")}${ic("lona", "lona")}`;
    const row = (pay, get, note = "") => ({ pay, get, note });
    return [
      { id: "comercio", face: 0, n: "Comércio", where: "Ao lado de um Comércio ou na borda inferior direita", here: here.has("comercio"), rows: [
        row(q(r.fishPerGold, "peixe", "peixe"), q(1, "ouro", "ouro")),
        row(`<b>4</b> iguais ${sup}`, q(r.sell4, "ouro", "ouro")),
        row(q(r.buySup, "ouro", "ouro"), `1 de ${sup}`),
        row(q(r.crewGold, "ouro", "ouro"), q(1, "tripulante", "tripulante")),
        row(`${q(r.spdGold, "ouro", "ouro")} + ${ic("lona", "lona")} + ${ic("polvora", "pólvora")}`, `${ic("velocidade", "velocidade")} +1`, `máx. +${r.maxSpeedBonus}`),
        row(`${q(r.atkGold, "ouro", "ouro")} + ${ic("rum", "rum")} + ${ic("polvora", "pólvora")}`, `${ic("ataque", "ataque")} +1`, `máx. +${r.maxAtk}`),
      ] },
      { id: "trocas", face: 0, n: "Negociação", where: "Livre no seu turno, com qualquer jogador", here: false, rows: [
        row(`${ic("ouro", "ouro")}${ic("peixe", "peixe")}${ic("rum", "rum")}${ic("polvora", "pólvora")}${ic("lona", "lona")}`, "troca livre"),
        row(`${ic("concha", "concha")}${ic("tripulante", "tripulante")}${ic("artefato", "artefato")}`, "não se negociam"),
        row(`${ic("peixe", "peixe")} na Pedra`, r.pedraFish ? "vale como ouro" : "não vale ouro"),
      ] },
      { id: "pedra", face: 1, n: "Pedra das Sereias", where: "Ao lado da Pedra ou na borda superior esquerda", here: here.has("pedra"), rows: [
        row(q(r.conchaCost, "ouro", "ouro"), q(1, "concha", "concha"), r.pedraFish ? "peixe vale ouro" : ""),
        row(`${ic("concha", "concha")} + ouro pela escada`, `${ic("artefato", "artefato")} 1`, `${r.artPerTurn} por turno`),
      ], ladder: L },
      { id: "taverna", face: 1, n: "Taverna", where: "Borda superior direita", here: here.has("taverna"), rows: [
        row(q(r.crewRum, "rum", "rum"), q(1, "tripulante", "tripulante")),
        row(`${ic("rum", "rum")} + ${ic("polvora", "pólvora")}`, `${ic("ataque", "ataque")} +1`),
      ] },
      { id: "ossuario", face: 1, n: "Ossuário", where: "Borda inferior direita · só esqueletos", here: here.has("ossuario"), rows: [
        row(q(r.ossConcha, "ouro", "ouro"), q(1, "concha", "concha")),
        row(q(1, "concha", "concha"), q(r.ossVende, "ouro", "ouro")),
      ] },
      { id: "capela", face: 1, n: "Capela", where: "Borda inferior esquerda · piratas", here: here.has("capela"), rows: [row(q(r.capelaCost, "ouro", "ouro"), "remove todas as maldições")] },
      { id: "altar", face: 1, n: "Altar de Transmutação", where: "Ao lado de um Altar · piratas", here: here.has("altar"), rows: [row(q(r.transformCost, "ouro", "ouro"), `vira esqueleto${r.transformGift ? ` + ${ic("concha", "concha")}` : ""}`)] },
    ];
  };

  function sectionHTML(s, ctx) {
    const lad = s.ladder ? `<div class="ax-lad" aria-label="Escada de preço do artefato">${s.ladder.map((v, i) => `<div class="${ctx.arts === i || (ctx.arts >= s.ladder.length - 1 && i === s.ladder.length - 1 && ctx.arts !== undefined) ? "on" : ""}" style="--h:${Math.round(8 + (v / Math.max(...s.ladder)) * 36)}px"><i></i><b>${v}</b><small>${i} art.</small></div>`).join("")}</div>
      <div class="ax-note">Preço do artefato pelo que você <b>já tem</b>${ctx.arts !== undefined ? ` · você tem <b>${ctx.arts}</b>` : ""}</div>` : "";
    return `<section class="ax-sec ${s.here ? "here" : ""}" data-sec="${s.id}"><header><h4>${s.n}</h4>${s.here ? `<span class="ax-here">você está aqui</span>` : ""}</header><p class="ax-where">${s.where}</p>
      ${s.rows.map((r) => `<div class="ax-row"><span class="ax-pay">${r.pay}</span><span class="ax-arrow">➜</span><span class="ax-get">${r.get}</span>${r.note ? `<em>${r.note}</em>` : ""}</div>`).join("")}${lad}</section>`;
  }

  // HTML só das tabelas (o manual reaproveita)
  A.tablesHTML = (r) => A.sections(r).map((s) => sectionHTML(s, {})).join("");

  let panel = null, face = 0, lastCtx = null;
  function render(ctx) {
    lastCtx = ctx; const secs = A.sections(ctx.rules, ctx);
    const front = secs.filter((s) => s.face === 0), back = secs.filter((s) => s.face === 1);
    const ex = `<div class="ax-limits">Limites: ${ctx.rules.maxCrew} tripulantes · +${ctx.rules.maxAtk} ataque · +${ctx.rules.maxSpeedBonus} velocidade · ${ctx.rules.handLimit} recursos na mão</div>`;
    panel.querySelector(".ax-in").innerHTML = `
      <div class="ax-face ax-front"><div class="ax-title"><span>Carta de auxílio</span><b>Comércio</b></div>${front.map((s) => sectionHTML(s, ctx)).join("")}${ex}</div>
      <div class="ax-face ax-back"><div class="ax-title"><span>Carta de auxílio · verso</span><b>Outros locais</b></div>${back.map((s) => sectionHTML(s, ctx)).join("")}</div>`;
    panel.querySelector(".ax-in").classList.toggle("flipped", face === 1);
    panel.querySelectorAll(".ax-tab").forEach((b) => b.classList.toggle("on", +b.dataset.f === face));
  }
  A.isOpen = () => !!panel && !panel.hidden;
  A.open = function (ctx) {
    const host = document.getElementById("boardwrap") || document.body;
    if (!panel) {
      panel = document.createElement("aside"); panel.id = "auxPanel"; panel.className = "ax"; panel.setAttribute("aria-label", "Carta de auxílio");
      panel.innerHTML = `<div class="ax-bar"><div class="ax-tabs" role="tablist"><button class="ax-tab" data-f="0" role="tab">Frente</button><button class="ax-tab" data-f="1" role="tab">Verso</button></div><button class="ax-x" aria-label="Fechar a carta de auxílio" title="Fechar (C)">×</button></div><div class="ax-card"><div class="ax-in"></div></div>`;
      host.appendChild(panel);
      panel.querySelector(".ax-x").addEventListener("click", A.close);
      panel.querySelectorAll(".ax-tab").forEach((b) => b.addEventListener("click", () => A.flip(+b.dataset.f)));
    }
    // abre na face do local onde você está, se houver
    const sec = A.sections(ctx.rules, ctx).find((s) => s.here); if (sec) face = sec.face;
    panel.hidden = false; render(ctx);
    if (NT.FX) NT.FX.anim(panel, [{ opacity: 0, transform: "translateX(24px) rotate(2deg)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: NT.FX.EASE.spring });
    if (NT.SFX) NT.SFX.play("card");
  };
  A.flip = function (f) {
    if (!panel) return; face = f === undefined ? 1 - face : f;
    panel.querySelector(".ax-in").classList.toggle("flipped", face === 1);
    panel.querySelectorAll(".ax-tab").forEach((b) => b.classList.toggle("on", +b.dataset.f === face));
    if (NT.SFX) NT.SFX.play("flip");
  };
  A.refresh = (ctx) => { if (A.isOpen()) render(ctx || lastCtx); };
  A.close = function () {
    if (!A.isOpen()) return;
    const p = panel;
    if (NT.FX && !NT.FX.reduced()) NT.FX.anim(p, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }], { duration: 180 }).then(() => (p.hidden = true));
    else p.hidden = true;
  };
  A.toggle = (ctx) => (A.isOpen() ? A.close() : A.open(ctx));
})(window.NT);
