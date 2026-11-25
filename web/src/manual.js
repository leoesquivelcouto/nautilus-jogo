// Nautilus online — manual do jogo: uma tela cheia com 12 capítulos curtos, cada um com uma ilustração animada.
// Textos diretos; os números vêm das regras ativas (configuração antes da partida, regras da partida durante o jogo).
window.NT = window.NT || {};
(function (NT) {
  const M = (NT.Manual = {});
  const ic = (k) => `<img class="mn-ic" src="assets/icones/${k}.png" alt="">`;
  const hexImg = (img, label, i) => `<figure class="mn-hex" style="--i:${i}"><div class="mn-hexclip"><img src="assets/${img}.webp" alt=""></div><figcaption>${label}</figcaption></figure>`;
  const ladderOf = (r) => (r.ladderArr && r.ladderArr.length ? r.ladderArr : String(r.ladder || "2,3,4,5,6").split(",").map((v) => parseInt(v, 10)).filter((v) => !isNaN(v)));
  const PIPS = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [1, 3], [3, 1], [3, 3]], 5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]], 6: [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]] };
  const die = (v, cls, top, i) => `<div class="mn-die ${cls} ${top ? "top" : ""}" style="--i:${i}">${PIPS[v].map(([r, c]) => `<i style="grid-area:${r}/${c}"></i>`).join("")}</div>`;
  const SHIP = `<svg viewBox="-40 -40 80 80" class="mn-ship" aria-hidden="true"><circle r="34" fill="#c9a24f" stroke="#140c02" stroke-width="2.5"/><circle r="27" fill="#d1453b" stroke="#140c02" stroke-width="1.5"/><path d="M-1 -21 V8" stroke="#140c02" stroke-width="2.4"/><path d="M1.5 -19 Q16 -8 1.5 3 Z" fill="#f4e8c8" stroke="#140c02" stroke-width="1.5"/><path d="M-3.5 -14 Q-15.5 -5 -3.5 2 Z" fill="#e6d4a6" stroke="#140c02" stroke-width="1.5"/><path d="M-19 5 Q0 12 19 5 L14 14 Q0 19.5 -14 14 Z" fill="#4a2c12" stroke="#140c02" stroke-width="1.6"/></svg>`;

  // Cada capítulo: título, frase-resumo, ilustração e pontos-chave (curtos).
  function chapters(r) {
    const L = ladderOf(r), win = r.winArts;
    return [
      { id: "objetivo", n: "Objetivo", k: "Como vencer", lead: `Seja o primeiro a reunir <b>${win} artefatos</b>. A vitória é na hora, até no turno de outro jogador.`,
        art: `<div class="mn-goal">${Array.from({ length: win }, (_, i) => `<div class="mn-slot" style="--i:${i}">${ic("artefato")}</div>`).join("")}<div class="mn-goal-t">Vitória!</div></div>`,
        pts: ["A maioria dos artefatos é comprada na <b>Pedra das Sereias</b>.", "Também saem de baús, naufrágios e de combates contra esqueletos.", "Artefato de uso único já usado <b>ainda conta</b> para a vitória.", `Você joga contra bots. Cada um quer a mesma coisa que você.`] },
      { id: "turno", n: "Seu turno", k: "1 + 1", lead: "Em cada turno: <b>1 navegação</b> e <b>1 atividade</b>, na ordem que quiser.",
        art: `<div class="mn-turn"><div class="mn-step" style="--i:0"><span>1</span><b>Navegar</b><div class="mn-track"><i></i><i></i><i></i>${SHIP}</div><small>até a sua velocidade (começa em ${r.startSpeed})</small></div><div class="mn-step" style="--i:1"><span>2</span><b>Uma atividade</b><div class="mn-cycle">${["peixe", "ouro", "artefato", "ataque"].map((k, i) => `<div style="--j:${i}">${ic(k)}</div>`).join("")}</div><small>pescar, abrir baú, comprar ou atacar</small></div></div>`,
        pts: ["Clique num hexágono destacado para navegar. O número mostra quantas casas custa.", "A navegação não se divide: não dá para andar, agir e andar de novo.", "Num mesmo local (Comércio, Pedra, Taverna) você faz quantas operações quiser.", "Negociar com os bots e usar artefatos é livre. <b>Encerrar turno</b> passa a vez."] },
      { id: "mapa", n: "O mapa", k: "Onde ficar", lead: "O barco só anda no mar. <b>Locais você usa estando ao lado</b> deles.",
        art: `<div class="mn-hexes">${[["mar", "Mar aberto"], ["maldita", "Águas amaldiçoadas"], ["inicio", "Início"], ["ilha", "Ilha (baús)"], ["cemiterio", "Cemitério (naufrágios)"], ["comercio", "Comércio"], ["pedra", "Pedra das Sereias"], ["altar", "Altar"]].map(([a, b], i) => hexImg(a, b, i)).join("")}</div>`,
        pts: ["Navegáveis: mar aberto, águas amaldiçoadas e hexágonos de início.", "Bordas (Taverna, Capela, Comércio + Ossuário, Pedra): pare encostado na <b class='mn-red'>linha vermelha</b>.", "As duas <b>Passagens</b> (topo e base) ligam os lados do mapa por 1 casa.", "Dois barcos nunca dividem o mesmo hexágono, e você não atravessa um barco."] },
      { id: "recursos", n: "Pesca e recursos", k: "A economia", lead: `Pescar rende <b>tripulantes disponíveis + 1</b> peixes. <b>1 peixe = ${r.fishPerGold === 1 ? "1 ouro" : r.fishPerGold + " para 1 ouro"}</b>.`,
        art: `<div class="mn-res">${["ouro", "peixe", "rum", "polvora", "lona", "concha"].map((k, i) => `<div style="--i:${i}">${ic(k)}<small>${{ ouro: "Ouro", peixe: "Peixe", rum: "Rum", polvora: "Pólvora", lona: "Lona", concha: "Concha" }[k]}</small></div>`).join("")}</div><div class="mn-hand"><span>Mão</span><div><i></i></div><b>${r.handLimit}</b></div>`,
        pts: ["Piratas pescam no <b>mar aberto</b>; esqueletos, nas <b>águas amaldiçoadas</b>.", "Suprimentos são só rum, pólvora e lona.", `${r.pedraFish ? "Na Pedra das Sereias, peixe vale como ouro." : "Venda os peixes no Comércio antes de ir à Pedra."}`, `Máximo de <b>${r.handLimit} recursos</b> na mão; o excesso volta ao pote.`] },
      { id: "baus", n: "Baús e naufrágios", k: "Tesouros", lead: "Ao lado de uma ilha (pirata) ou cemitério (esqueleto) com marcador: abra 1 carta.",
        art: `<div class="mn-flip"><div class="mn-fc" style="--i:0"><div class="mn-fb"></div><div class="mn-ff bau"><small>Baú</small><b>O Tributo do Mar</b><span>${ic("concha")} +1 ${ic("ouro")} +5</span></div></div><div class="mn-fc" style="--i:1"><div class="mn-fb nauf"></div><div class="mn-ff nauf"><small>Naufrágio</small><b>O Baú do Kraken</b><span>${ic("ouro")} +5</span><em>Risco: perca 1 tripulante</em></div></div></div>`,
        pts: ["Piratas abrem <b>baús</b>; esqueletos abrem <b>naufrágios</b>. Nunca o contrário.", "Alguns baús trazem <b>maldição</b>; alguns naufrágios trazem <b>risco</b>.", "Cartas com <b>efeito positivo</b> ficam guardadas até você usar.", "Cada ilha e cemitério tem marcadores contados; sem marcador, acabou."] },
      { id: "artefatos", n: "Pedra e artefatos", k: "O caminho da vitória", lead: `Artefato custa <b>1 concha + ouro</b>, e o preço sobe com os artefatos que você já tem.`,
        art: `<div class="mn-ladder">${L.map((v, i) => `<div style="--i:${i};--h:${Math.round(24 + (v / Math.max(...L)) * 100)}px"><i></i><b>${v}</b><small>${i} art.</small></div>`).join("")}</div><div class="mn-eq">${ic("concha")}<span>+</span>${ic("ouro")}<span>=</span>${ic("artefato")}</div>`,
        pts: [`Concha na Pedra: <b>${r.conchaCost} ouros</b>.`, `No máximo <b>${r.artPerTurn} artefato${r.artPerTurn > 1 ? "s" : ""} por turno</b>; conchas, quantas quiser.`, "O preço olha só para os artefatos à sua frente: nada de contar rodadas.", "Permanentes valem sempre; os de uso único você usa e vira."] },
      { id: "lojas", n: "Lojas e preços", k: "Carta de auxílio", lead: "Durante a partida, a <b>carta de auxílio</b> (botão Preços ou tecla C) mostra tudo isto.",
        art: `<div class="mn-aux">${NT.Aux ? NT.Aux.tablesHTML(r) : ""}</div>`, wide: true, pts: [] },
      { id: "combate", n: "Combate", k: "Dados", lead: "Ataque um barco <b>ao seu lado</b>. Vale o <b>maior dado + bônus</b>; quem vence saqueia.",
        art: `<div class="mn-dice"><div class="mn-dset">${die(2, "b", false, 0)}${die(5, "b", true, 1)}${die(3, "b", false, 2)}<b class="mn-tot">5 + 1 = 6</b></div><div class="mn-vs">contra</div><div class="mn-dset">${die(4, "w", true, 3)}${die(1, "w", false, 4)}<b class="mn-tot">4</b></div></div>`,
        pts: ["Atacante escolhe os dados (1 por tripulante disponível, até 3). O defensor responde.", `Quem vence rouba <b>${r.lootPerDie} carta por dado</b> que usou, às cegas.`, "Quem perde sofre dano igual aos <b>dados que usou</b>. Empate: nada acontece.", "Pirata só fica ferido e protegido. Esqueleto perde tripulantes de verdade."] },
      { id: "virada", n: "Esqueletos e a Virada", k: "Segundo ato", lead: `${r.mareRound > 0 ? `Na <b>rodada ${r.mareRound}</b> (Maré Negra), ou quando acabam os baús,` : "Quando acabam os baús,"} todos viram <b>esqueletos</b>.`,
        art: `<div class="mn-mare">${Array.from({ length: Math.max(1, r.mareRound || 8) }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div><div class="mn-morph"><div class="mn-p">${SHIP}</div><span>➜</span><div class="mn-s">${SHIP}<div class="mn-skull">☠</div></div></div>`,
        pts: [`Quer antes? <b>Altar</b>: ${r.transformCost} ouros${r.transformGift ? " e ganha 1 concha" : ""}. Não tem volta.`, "Esqueleto pesca nas águas amaldiçoadas e abre naufrágios.", "Esqueleto é imune a maldições, mas pode ser atacado sempre.", r.artSteal !== "nao" ? `Vencendo um ataque contra ${r.artSteal === "esqueletos" ? "um esqueleto" : "alguém"} com mais artefatos que você, pode <b>tomar 1 artefato</b>.` : "Artefatos não são roubados em combate."] },
      { id: "maldicoes", n: "Maldições e cartas", k: "Cuidado", lead: "Pirata que <b>passa por águas roxas</b> compra 1 maldição (no máximo 1 por turno).",
        art: `<div class="mn-curse"><div class="mn-cc"><small>Maldição · ⚡ imediata</small><b>O Gato Preto</b><span>Pague 2 ouros.</span></div><div class="mn-cc perm"><small>Maldição · ∞ permanente</small><b>O Mapa Rasgado</b><span>−1 de velocidade.</span></div></div>`,
        pts: ["⚡ <b>Imediata</b>: aplica e descarta. ∞ <b>Permanente</b>: fica até sair.", `Livre-se das permanentes na <b>Capela</b> (${r.capelaCost} ouros) ou virando esqueleto.`, "Clique num capitão no painel para ver artefatos, efeitos e maldições dele.", "A Âncora Falsa cancela um ataque, mesmo fora do seu turno."] },
      { id: "fim", n: "Afundar e vencer", k: "Fim de jogo", lead: "Esqueleto <b>sem tripulantes</b> que perde um combate <b>afunda e renasce</b>.",
        art: `<div class="mn-sink"><div class="mn-wave"></div><div class="mn-sk">${SHIP}</div><div class="mn-rs">${SHIP}</div></div>`,
        pts: ["Ao afundar: entrega 1 artefato ao vencedor e perde metade dos recursos.", "Renasce num canto livre com 1 tripulante e segue jogando.", `Vence quem chegar a <b>${win} artefatos</b> primeiro.`, r.maxRounds > 0 ? `Se ninguém chegar até a rodada ${r.maxRounds}, vence quem tiver mais artefatos.` : "Se o baralho de artefatos acabar, vence quem tiver mais."] },
      { id: "dicas", n: "Dicas e atalhos", k: "Para começar bem", lead: "Comece <b>pescando e contratando tripulantes</b>: mais tripulantes, mais peixe e mais dados.",
        art: `<div class="mn-keys">${[["Enter", "Encerrar turno"], ["D", "Dica do imediato"], ["C", "Carta de auxílio"], ["+ −", "Zoom do mapa"], ["0", "Enquadrar o mapa"], ["?", "Este manual"], ["Esc", "Fechar janelas"]].map(([k, t], i) => `<div style="--i:${i}"><kbd>${k}</kbd><span>${t}</span></div>`).join("")}</div>`,
        pts: ["O botão <b>Dica</b> mostra o que o bot difícil faria no seu lugar.", "Passe o mouse num hexágono para ver o que dá para fazer lá.", "Taverna troca rum por tripulante: barato e rápido.", "Antes da Maré, junte conchas: depois da Virada a disputa aperta."] },
    ];
  }

  let root = null, idx = 0, data = [], onKey = null;
  function draw(dir = 1) {
    const c = data[idx];
    root.querySelectorAll(".mn-nav button").forEach((b, i) => { b.classList.toggle("on", i === idx); b.setAttribute("aria-current", i === idx ? "step" : "false"); });
    root.querySelector(".mn-prog i").style.width = `${((idx + 1) / data.length) * 100}%`;
    const body = root.querySelector(".mn-body");
    body.innerHTML = `<article class="mn-ch ${c.wide ? "wide" : ""}" style="--dir:${dir}">
      <div class="mn-kick">Capítulo ${idx + 1} de ${data.length} · ${c.k}</div><h2>${c.n}</h2><p class="mn-lead">${c.lead}</p>
      <div class="mn-grid"><div class="mn-art" aria-hidden="true">${c.art}</div>${c.pts.length ? `<ul class="mn-pts">${c.pts.map((p, i) => `<li style="--i:${i}">${p}</li>`).join("")}</ul>` : ""}</div></article>`;
    root.querySelector(".mn-prev").disabled = idx === 0;
    const nx = root.querySelector(".mn-next"); nx.textContent = idx === data.length - 1 ? "Zarpar!" : "Próximo ›";
    body.scrollTop = 0;
  }
  function go(i) { if (i < 0 || i >= data.length || i === idx) return; const dir = i > idx ? 1 : -1; idx = i; draw(dir); if (NT.SFX) NT.SFX.play("card"); }
  M.isOpen = () => !!root;
  M.open = function ({ rules, start = 0 } = {}) {
    if (root) return;
    data = chapters(rules || NT.defaultRules()); idx = Math.max(0, Math.min(data.length - 1, start));
    root = document.createElement("div"); root.className = "mn"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Manual do jogo");
    root.innerHTML = `<div class="mn-bg"></div><svg class="mn-rose" aria-hidden="true"><use href="#i-compass"/></svg>
      <div class="mn-win">
        <header class="mn-head"><div class="mn-brand"><svg aria-hidden="true"><use href="#i-compass"/></svg><div><small>Nautilus</small><b>Manual do jogo</b></div></div><div class="mn-prog"><i></i></div><button class="mn-x" aria-label="Fechar o manual" title="Fechar (Esc)">×</button></header>
        <nav class="mn-nav" aria-label="Capítulos">${data.map((c, i) => `<button data-i="${i}" style="--i:${i}"><span>${String(i + 1).padStart(2, "0")}</span>${c.n}</button>`).join("")}</nav>
        <main class="mn-body"></main>
        <footer class="mn-foot"><button class="btn mn-prev">‹ Anterior</button><span class="mn-hint">← → para navegar · Esc para fechar</span><button class="btn gold mn-next">Próximo ›</button></footer>
      </div>`;
    document.body.appendChild(root);
    root.querySelector(".mn-x").addEventListener("click", M.close);
    root.querySelector(".mn-bg").addEventListener("click", M.close);
    root.querySelector(".mn-prev").addEventListener("click", () => go(idx - 1));
    root.querySelector(".mn-next").addEventListener("click", () => (idx === data.length - 1 ? M.close() : go(idx + 1)));
    root.querySelectorAll(".mn-nav button").forEach((b) => b.addEventListener("click", () => go(+b.dataset.i)));
    onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); M.close(); } else if (e.key === "ArrowRight") go(idx + 1); else if (e.key === "ArrowLeft") go(idx - 1); };
    document.addEventListener("keydown", onKey, true);
    draw(1);
    if (NT.FX) { NT.FX.anim(root.querySelector(".mn-win"), [{ opacity: 0, transform: "translateY(30px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: NT.FX.EASE.spring }); NT.FX.anim(root.querySelector(".mn-bg"), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); }
    if (NT.SFX) NT.SFX.play("open");
    root.querySelector(".mn-next").focus();
  };
  M.close = function () {
    if (!root) return;
    const r = root; root = null; document.removeEventListener("keydown", onKey, true);
    if (NT.SFX) NT.SFX.play("close");
    if (NT.FX && !NT.FX.reduced()) { NT.FX.anim(r.querySelector(".mn-win"), [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(20px) scale(.97)" }], { duration: 220 }); NT.FX.anim(r, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 }).then(() => r.remove()); }
    else r.remove();
  };
})(window.NT);
