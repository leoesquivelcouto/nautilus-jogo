// Piloto automático de teste: joga no lugar do humano clicando na interface real.
// Uso (no console da página, com uma partida aberta): carregue este arquivo e chame __piloto(segundos).
window.__piloto = async function (seconds = 120) {
  const st = (window.__drv = { running: true, humanTurns: 0, modals: {}, errors: [], games: 0, start: Date.now() });
  window.addEventListener("error", (e) => st.errors.push(e.message));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  async function handleModal() {
    const ov = document.querySelector("#modalRoot .ov:not(.closing)"); if (!ov) return false;
    const title = ov.querySelector("h2")?.innerText || ""; st.modals[title] = (st.modals[title] || 0) + 1;
    if (!ov.querySelector("footer .btn")) { await sleep(50); return true; } // painel de dados: fecha sozinho
    const op = ov.querySelector("[data-op]:not([disabled])"); if (op && Math.random() < 0.85) { op.click(); await sleep(60); }
    const ch = ov.querySelectorAll(".choice"); if (ch.length && Math.random() < 0.7) { rnd([...ch]).click(); await sleep(10); }
    const cards = ov.querySelectorAll("[data-c]"); for (const c of cards) { c.click(); await sleep(5); }
    const footBtns = () => [...ov.querySelectorAll("footer .btn")];
    let primary = footBtns().find((b) => b.classList.contains("gold")) || footBtns().pop();
    // steppers: ajusta até o botão principal liberar
    for (let g = 0; primary && primary.disabled && g < 60; g++) {
      const inc = [...ov.querySelectorAll("[data-inc]")], dec = [...ov.querySelectorAll("[data-dec]")];
      if (!inc.length) break; (g % 7 === 6 ? rnd(dec) : rnd(inc)).click(); await sleep(5);
    }
    const ready = footBtns().filter((b) => !b.disabled);
    const b = ready.find((x) => x.classList.contains("gold")) || ready[ready.length - 1];
    if (b) b.click(); else { st.errors.push("modal travado: " + title); }
    await sleep(25); return true;
  }
  while (Date.now() - st.start < seconds * 1000) {
    await sleep(30);
    if (await handleModal()) continue;
    if (/Fim de jogo/.test(document.querySelector("#turnpill").innerText)) { st.games++; await sleep(200); continue; }
    const end = document.querySelector("#endBtn"); if (!end || end.disabled) continue;
    st.humanTurns++;
    if (Math.random() < 0.3) { document.querySelector("#sugBtn")?.click(); await sleep(20); if (document.querySelector(".sugbox")) st.sugs = (st.sugs || 0) + 1; }
    if (Math.random() < 0.05) { document.querySelector("[data-pid]")?.click(); await sleep(30); while (await handleModal()) await sleep(10); }
    if (Math.random() < 0.1) { document.querySelector("#zIn")?.click(); if (Math.random() < 0.5) document.querySelector("#zFit")?.click(); }
    const reach = [...document.querySelectorAll(".hex-hit.reach")];
    if (reach.length && Math.random() < 0.85) { rnd(reach).dispatchEvent(new MouseEvent("click", { bubbles: true })); await sleep(250); while (await handleModal()) await sleep(20); }
    const art = document.querySelector("[data-art]:not([disabled]),[data-x]:not([disabled])"); if (art && Math.random() < 0.5) { art.click(); await sleep(60); while (await handleModal()) await sleep(20); }
    const acts = [...document.querySelectorAll("[data-loc]:not([disabled])")];
    if (acts.length) { const pick = acts.find((a) => a.dataset.loc === "ataque" && Math.random() < 0.7) || rnd(acts); pick.click(); await sleep(120); for (let i = 0; i < 10; i++) { if (!(await handleModal())) break; await sleep(40); } }
    if (Math.random() < 0.15) { const tb = document.querySelector("#tradeBtn"); if (tb) { tb.click(); await sleep(40); const ov = document.querySelector("#modalRoot .ov:not(.closing)"); if (ov) { const inc = ov.querySelectorAll("[data-inc]"); if (inc.length) { inc[0].click(); inc[inc.length - 1].click(); } ov.querySelector("#propBtn")?.click(); await sleep(40); [...ov.querySelectorAll("footer .btn")][0]?.click(); } } }
    await sleep(30);
    document.querySelector("#endBtn")?.click();
  }
  st.running = false;
  return st;
};
