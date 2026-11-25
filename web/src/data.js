// Nautilus online — dados: regras configuráveis, cartas e mapa (Manual v5, cartas v5).
window.NT = window.NT || {};
(function (NT) {
  NT.RES = ["ouro", "peixe", "rum", "polvora", "lona", "concha"];
  NT.SUP = ["rum", "polvora", "lona"];
  NT.RES_NOME = { ouro: "Ouro", peixe: "Peixe", rum: "Rum", polvora: "Pólvora", lona: "Lona", concha: "Concha" };
  NT.RES_NOME_PL = { ouro: "ouros", peixe: "peixes", rum: "rum", polvora: "pólvoras", lona: "lonas", concha: "conchas" };

  // ---------- REGRAS (todas editáveis na tela de configurações) ----------
  NT.RULE_DEFS = [
    { g: "Partida", k: "winArts", n: "Artefatos para vencer", t: "num", v: 5, min: 2, max: 10 },
    { g: "Partida", k: "mareRound", n: "Maré Negra: rodada da Virada (0 = desligada)", t: "num", v: 8, min: 0, max: 30 },
    { g: "Partida", k: "mareCard", n: "Carta Maré Negra no baralho de artefatos: sai depois de N artefatos por jogador (0 = sem carta)", t: "num", v: 0, min: 0, max: 5 },
    { g: "Partida", k: "seatFish", n: "Peixes de compensação pela ordem de turno", t: "bool", v: true },
    { g: "Partida", k: "respawn", n: "Esqueleto derrotado afunda e renasce (desligado = eliminado)", t: "bool", v: true },
    { g: "Partida", k: "maxRounds", n: "Limite de rodadas (0 = sem limite)", t: "num", v: 40, min: 0, max: 99 },
    { g: "Jogador", k: "startCrew", n: "Tripulantes iniciais", t: "num", v: 1, min: 0, max: 7 },
    { g: "Jogador", k: "maxCrew", n: "Máximo de tripulantes", t: "num", v: 7, min: 1, max: 12 },
    { g: "Jogador", k: "startSpeed", n: "Velocidade inicial", t: "num", v: 2, min: 1, max: 6 },
    { g: "Jogador", k: "maxSpeedBonus", n: "Máximo de bônus de velocidade", t: "num", v: 2, min: 0, max: 5 },
    { g: "Jogador", k: "maxAtk", n: "Máximo de bônus de ataque permanente", t: "num", v: 3, min: 0, max: 6 },
    { g: "Jogador", k: "handLimit", n: "Limite de recursos na mão", t: "num", v: 12, min: 4, max: 40 },
    { g: "Pesca e comércio", k: "captainFish", n: "Capitão também pesca (+1 peixe)", t: "bool", v: true },
    { g: "Pesca e comércio", k: "fishPerGold", n: "Peixes para 1 ouro no Comércio", t: "num", v: 1, min: 1, max: 4 },
    { g: "Pesca e comércio", k: "pedraFish", n: "Pedra das Sereias aceita peixe como ouro", t: "bool", v: true },
    { g: "Pesca e comércio", k: "crewGold", n: "Tripulante no Comércio (ouros)", t: "num", v: 3, min: 0, max: 15 },
    { g: "Pesca e comércio", k: "crewRum", n: "Tripulante na Taverna (rum)", t: "num", v: 1, min: 0, max: 5 },
    { g: "Pesca e comércio", k: "atkGold", n: "Bônus de ataque no Comércio (ouros, + rum + pólvora)", t: "num", v: 5, min: 0, max: 15 },
    { g: "Pesca e comércio", k: "spdGold", n: "Bônus de velocidade no Comércio (ouros, + lona + pólvora)", t: "num", v: 3, min: 0, max: 15 },
    { g: "Pesca e comércio", k: "sell4", n: "4 suprimentos iguais valem (ouros)", t: "num", v: 3, min: 0, max: 10 },
    { g: "Pesca e comércio", k: "buySup", n: "Comprar 1 suprimento (ouros)", t: "num", v: 3, min: 0, max: 10 },
    { g: "Artefatos", k: "conchaCost", n: "Concha na Pedra (ouros)", t: "num", v: 3, min: 0, max: 10 },
    { g: "Artefatos", k: "ladder", n: "Escada de preço do artefato (ouros, separados por vírgula)", t: "text", v: "2,3,4,5,6" },
    { g: "Artefatos", k: "artPerTurn", n: "Artefatos comprados por turno", t: "num", v: 1, min: 1, max: 9 },
    { g: "Artefatos", k: "ossConcha", n: "Ossuário: ouros por 1 concha", t: "num", v: 4, min: 0, max: 10 },
    { g: "Artefatos", k: "ossVende", n: "Ossuário: 1 concha vale (ouros)", t: "num", v: 2, min: 0, max: 10 },
    { g: "Esqueletos e maldições", k: "transformCost", n: "Altar: custo para virar esqueleto (ouros)", t: "num", v: 3, min: 0, max: 15 },
    { g: "Esqueletos e maldições", k: "transformGift", n: "Altar dá 1 concha (pacto)", t: "bool", v: true },
    { g: "Esqueletos e maldições", k: "capelaCost", n: "Capela: custo para remover maldições (ouros)", t: "num", v: 7, min: 0, max: 20 },
    { g: "Esqueletos e maldições", k: "cursedWater", n: "Águas amaldiçoadas dão maldição a piratas", t: "bool", v: true },
    { g: "Combate", k: "artSteal", n: "Roubo de artefato em combate", t: "sel", v: "esqueletos", o: [["esqueletos", "Só de esqueletos (v5)"], ["todos", "De qualquer jogador"], ["nao", "Desligado"]] },
    { g: "Combate", k: "dmgByWinner", n: "Dano igual aos dados do vencedor (em vez dos do perdedor)", t: "bool", v: false },
    { g: "Combate", k: "lootPerDie", n: "Cartas roubadas por dado do vencedor", t: "num", v: 1, min: 0, max: 4 },
    { g: "Mapa", k: "markers", n: "Marcadores por ilha e cemitério (0 = nº de jogadores)", t: "num", v: 0, min: 0, max: 10 },
    { g: "Mapa", k: "nComercio", n: "Hexágonos de Comércio (mapa aleatório)", t: "num", v: 5, min: 0, max: 10 },
  ];
  NT.defaultRules = () => Object.fromEntries(NT.RULE_DEFS.map((d) => [d.k, d.v]));
  NT.SEAT_FISH = { 1: [0], 2: [0, 1], 3: [0, 1, 3], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 3, 4] };

  // ---------- EFEITOS GUARDADOS (cartas de baú/naufrágio que ficam à sua frente) ----------
  NT.EXTRA = {
    mov1: { n: "Bússola do Contrabandista", t: "+1 de movimento em um turno seu (use antes de mover)." },
    mov2: { n: "Mapa do Cemitério", t: "+2 de movimento em um turno seu (use antes de mover)." },
    combat2: { n: "Canhão de Bolso", t: "+2 no resultado do seu próximo combate." },
    combat1: { n: "Casco reforçado", t: "+1 no resultado do seu próximo combate." },
    atk2: { n: "Canhão Afundado", t: "+2 no resultado do seu próximo ataque." },
    def1: { n: "Âncora de Ossos", t: "+1 na defesa no seu próximo combate como defensor." },
    reroll: { n: "Trevo da Sorte", t: "Rejogue um dado seu num combate e fique com o novo resultado." },
    amuleto: { n: "Amuleto Anti-Maldição", t: "Cancela uma maldição sua (ao recebê-la ou depois)." },
    crew1: { n: "Ídolo do Saqueador", t: "1 tripulante grátis na Taverna, ou troque por 3 ouros." },
    vigia: { n: "Olho do Vigia", t: "Ao abrir um baú, compre 2 cartas, fique com 1 e devolva a outra ao fundo." },
  };

  // ---------- BAÚS (v5) ----------
  const B = (q, n, r, f) => [q, n, r || {}, f || {}];
  NT.BAUS = [
    B(1, "A Bússola do Contrabandista", { ouro: 5 }, { eff: "mov1" }), B(1, "A Bússola Penhorada", { ouro: 3 }, { curse: 1 }),
    B(1, "A Meia do Almirante"), B(1, "A Peça que Faltava"), B(1, "A Relíquia das Profundezas", { ouro: 2, art: 1 }),
    B(1, "Barril de Rum Barato", { rum: 3 }), B(1, "Joias de Segunda Mão", { ouro: 3 }), B(1, "Anel do Marujo Perdido", { concha: 1 }, { curse: 1 }),
    B(1, "Uma Pedra Bonita", { ouro: 3 }), B(1, "Cálice Cravejado", { concha: 1 }), B(1, "Cantil do Cozinheiro Bêbado", { rum: 3 }),
    B(1, "A Concha da Maré Antiga", { concha: 1, ouro: 4 }, { curse: 1 }), B(3, "Barril de Pólvora Seca", { polvora: 3 }),
    B(1, "A Concha que Cantava", { concha: 1, ouro: 2 }), B(1, "O Canhão de Bolso", { ouro: 3 }, { eff: "combat2" }),
    B(1, "Paiol do Capitão", { polvora: 4 }), B(1, "O Rum que Ninguém Ousa Beber", { rum: 4 }, { curse: 1 }),
    B(1, "O Trevo do Pirata Azarado", { ouro: 4 }, { eff: "reroll" }), B(1, "Toldo do Navio Mercante", { lona: 3 }),
    B(1, "Velas Remendadas", { lona: 3 }), B(1, "Rolo de Lona Encerada", { lona: 3 }), B(1, "O Tributo do Mar", { concha: 1, ouro: 5 }),
    B(1, "Vela Mestra Esquecida", { lona: 4 }), B(1, "Colar Afogado", { concha: 1 }, { curse: 1 }), B(1, "O Cofre do Capitão", { ouro: 5 }, { curse: 1 }),
    B(1, "O Pagamento Atrasado", { ouro: 3 }), B(1, "Rei de Lugar Nenhum", { ouro: 1 }), B(1, "Olho de Estátua", { concha: 1 }, { curse: 1 }),
    B(1, "Adega do Navio Fantasma", { rum: 4 }, { curse: 1 }), B(1, "Ouro de Madeira"), B(1, "Cartuchos do Artilheiro Aposentado", { polvora: 3 }),
    B(1, "Coroa de Cacos", { concha: 1 }), B(1, "Fantasma em Meio Expediente", { peixe: 1 }), B(1, "Garrafões do Taberneiro", { rum: 4 }),
    B(1, "O Amuleto do Padre Exorcista", { ouro: 4 }, { eff: "amuleto" }), B(1, "O Banquete do Capitão"),
    B(2, "O Chamado das Sereias", { concha: 1, ouro: 2 }), B(1, "O Cinto do Capitão", { ouro: 3 }), B(1, "O Espólio do Almirante", { ouro: 3, art: 1 }),
    B(1, "O Ídolo do Saqueador", { ouro: 5 }, { eff: "crew1" }), B(1, "O Kit do Carpinteiro Fantasma", { ouro: 4 }, { eff: "combat1" }),
    B(1, "O Legado Impossível", { ouro: 2, art: 1 }, { curse: 1 }), B(1, "O Olho do Vigia", { ouro: 4 }, { eff: "vigia" }),
    B(1, "O Saque de Três Navios", { ouro: 5 }, { curse: 1 }), B(1, "O Tesouro dos Talheres", { ouro: 1 }), B(1, "O Último Pedido de Desculpas", { rum: 1 }),
    B(1, "Tenda do Acampamento Naufragado", { lona: 3 }),
  ];
  // ---------- NAUFRÁGIOS (v5) ----------
  NT.NAUFRAGIOS = [
    B(1, "A Dentadura do Artilheiro", { polvora: 3, ouro: 2 }), B(1, "Adega Arrombada", { rum: 2, ouro: 1 }), B(1, "Águas Turvas"),
    B(1, "Algas e Tristeza", { peixe: 1 }), B(1, "Armário do Cozinheiro", { rum: 1, polvora: 1, ouro: 1 }), B(1, "O Baú das Pérolas… de Suor", { ouro: 6 }),
    B(1, "Baú de Bordo", { concha: 1, rum: 1 }), B(1, "Boxeador em desvantagem", { concha: 1, ouro: 3 }), B(1, "Caixa de Ferramentas", { concha: 1, lona: 1 }),
    B(1, "Caixa-Forte Enferrujada", { ouro: 4 }), B(1, "Caravela dos Rubis Envergonhados", { concha: 1, ouro: 4 }), B(1, "Velame da Fragata Orgulhosa", { lona: 3, ouro: 2 }),
    B(1, "Galeão Sem Nome", { concha: 1 }), B(1, "Casco Rachado", { concha: 1 }), B(1, "O Grande Naufrágio", { concha: 1, ouro: 3 }),
    B(1, "Galé de Rubis", { concha: 1, ouro: 3 }), B(1, "Barba feita", { concha: 1, ouro: 3 }), B(1, "Pouca visão", { rum: 2, ouro: 1 }),
    B(1, "Barco Fantasma Sem Fantasma", { polvora: 1 }), B(1, "Barril de Rum Boiando", { rum: 3, ouro: 2 }), B(1, "Só Lodo"),
    B(1, "Mastro Cravejado", { concha: 1 }), B(1, "Velame Encalhado", { lona: 2, ouro: 1 }), B(1, "Encontro romântico", { concha: 1 }),
    B(1, "Esqueleto Educado", { ouro: 1 }), B(1, "Soldado Perdido da Marinha", { ouro: 6 }), B(1, "Cinzas"),
    B(1, "Depósito do Contramestre", { lona: 1, polvora: 1, ouro: 1 }), B(1, "Estojo do Artilheiro", { concha: 1, polvora: 1 }), B(1, "Fantasia de emergência", { concha: 1 }),
    B(1, "Nau dos Afogados", { concha: 1, ouro: 3 }), B(1, "Navio do Joalheiro Maluco", { concha: 1, ouro: 5 }), B(1, "O Baú do Rei Derrubado", { concha: 1, ouro: 4 }),
    B(1, "O Cofre do Mercador", { ouro: 5 }), B(1, "O Cofre Submerso", { concha: 1, ouro: 3 }), B(1, "O Espólio Perdido", { art: 1 }),
    B(1, "O Porão Esquecido", { concha: 1 }), B(1, "O Tesouro da Vergonha", { ouro: 5 }), B(1, "O Tesouro do Capitão Sovina", { ouro: 7 }),
    B(1, "O Tesouro do Motim", { concha: 1 }), B(1, "Paiol do Artilheiro Teimoso", { polvora: 3, ouro: 2 }), B(1, "Pegadas Antigas"),
    B(1, "Tripulação Fantasma", {}, { now: "crew2" }), B(1, "Mapa do Cemitério", { ouro: 2 }, { eff: "mov2" }),
    B(1, "Âncora de Ossos", { ouro: 2 }, { eff: "def1" }), B(1, "Canhão Afundado", { polvora: 2 }, { eff: "atk2" }),
    B(1, "Sino dos Afogados", { concha: 1 }, { now: "sino" }), B(1, "O Baú do Kraken", { ouro: 5 }, { risk: "kraken" }),
    B(1, "Correntes do Fundo", { concha: 1, ouro: 3 }, { risk: "correntes" }), B(1, "Luneta Sem Lente", { ouro: 1 }, { now: "luneta" }),
  ];
  NT.NOW_TEXT = { crew2: "Ganhe 2 tripulantes (máx. 7).", sino: "Todo esqueleto ao seu lado perde 1 tripulante.", luneta: "Olhe as 3 próximas cartas de naufrágio e devolva-as na ordem que quiser." };
  NT.RISK_TEXT = { kraken: "Risco: perca 1 tripulante.", correntes: "Risco: no seu próximo turno você não se move." };

  // ---------- ARTEFATOS (v5) ----------
  NT.ARTS = {
    ancora: { q: 1, n: "Âncora Falsa", uso: true, t: "Reação: quando outro jogador declarar um ataque contra você, cancele o ataque." },
    bandeira: { q: 1, n: "Bandeira Negra", uso: true, t: "+4 no resultado de um ataque seu, mesmo passando do limite." },
    bolsa: { q: 3, n: "Bolsa do Rei Afogado", uso: true, t: "Receba 3 suprimentos à sua escolha." },
    bussola: { q: 1, n: "Bússola de Meia-Noite", uso: true, t: "Mova até 6 hexágonos além da sua movimentação normal." },
    gancho: { q: 1, n: "Gancho do Saqueador", uso: true, t: "+3 no resultado de um ataque seu, mesmo passando do limite." },
    saque: { q: 3, n: "Saque dos Suprimentos", uso: true, t: "Escolha um jogador e um suprimento (rum, pólvora ou lona): tome todas as cartas desse tipo dele." },
    reforcos: { q: 3, n: "Reforços da Tripulação", uso: true, t: "Ganhe 2 tripulantes (máx. 7)." },
    casco1: { q: 3, n: "Casco de Ferro", t: "+1 na defesa." },
    casco2: { q: 3, n: "Casco muito reforçado", t: "+2 na defesa." },
    coroa: { q: 1, n: "Coroa do Rei Naufragado", t: "Ao ganhar recursos de baú ou naufrágio, +1 em um deles." },
    proa: { q: 2, n: "Figura de Proa dos Ventos", t: "+1 de velocidade, que pode passar do limite." },
    olho: { q: 1, n: "Olho do Abismo", t: "Ao abrir baú ou naufrágio, veja a carta: fique com ela ou mande ao fundo e pegue a próxima." },
    perola: { q: 1, n: "Pérola da Fortuna", t: "Sempre que pescar, receba também 1 ouro." },
    rede: { q: 1, n: "Rede Dourada", t: "+1 peixe sempre que pescar." },
    reliquia: { q: 2, n: "Relíquia do Imaculado", t: "Imune a maldições; ao recebê-la, descarte as suas. Depois da Virada: +1 na defesa." },
    selo: { q: 1, n: "Selo do Mercador Errante", t: "Use as operações do Comércio em qualquer lugar do mapa." },
    ultimo: { q: 2, n: "Último Sobrevivente", t: "Com 2 ou menos tripulantes disponíveis: +2 no ataque e +1 na defesa." },
  };

  // ---------- MALDIÇÕES (v5) ----------
  NT.CURSES = {
    banana: { n: "A Banana a Bordo", now: true, t: "Pague 1 suprimento; se não tiver, pague 1 ouro." },
    conchaOcupada: { n: "A Concha Ocupada", now: true, t: "Perca 1 concha; se não tiver, pague 3 ouros (ou todo o seu ouro)." },
    luaSangue: { n: "A Lua de Sangue", t: "Quem enfrentar você em combate ganha +1 no resultado." },
    albatroz: { n: "A Praga do Albatroz", t: "Pescar rende 1 peixe a menos (mín. 1)." },
    santelmo: { n: "Fogo-de-Santelmo", t: "Role 1 dado a menos no combate (mín. 1)." },
    assobio: { n: "O Assobio no Convés", now: true, t: "Perca até 3 lonas; se não tiver lona, pague 2 ouros." },
    bolsoFurado: { n: "O Bolso Furado", t: "No fim de cada turno seu, perca 1 ouro." },
    espelho: { n: "O Espelho Rachado", now: true, t: "Perca 1 concha; se não tiver, pague 1 suprimento." },
    gatoPreto: { n: "O Gato Preto", now: true, t: "Pague 2 ouros." },
    mapaRasgado: { n: "O Mapa Rasgado", t: "Sua velocidade diminui em 1 (mín. 1)." },
    peEsquerdo: { n: "O Pé Esquerdo Primeiro", t: "−1 no resultado dos seus combates." },
    peixesPodres: { n: "Peixes Podres no Porão", now: true, t: "Perca metade dos seus peixes (arredondando a perda para cima)." },
    ratos: { n: "Ratos Abandonam o Navio", now: true, t: "Se tiver 5 ou mais tripulantes, perca 1." },
    rumAguado: { n: "Rum Aguado", now: true, t: "Perca até 3 rum; se não tiver rum, perca 1 peixe." },
    sexta13: { n: "Sexta-Feira 13", now: true, t: "No seu próximo turno, você faz a atividade, mas não se move." },
  };

  // ---------- MAPA ----------
  NT.ROWS = [6, 7, 8, 9, 10, 9, 8, 7, 6];
  NT.HEX_TIPOS = {
    mar: { n: "Mar aberto", nav: true, img: ["mar"] }, maldita: { n: "Águas amaldiçoadas", nav: true, img: ["maldita", "maldita2"] },
    inicio: { n: "Hexágono de início", nav: true, img: ["inicio"] }, ilha: { n: "Ilha tropical", img: ["ilha"] },
    cemiterio: { n: "Cemitério de navios", img: ["cemiterio"] }, comercio: { n: "Comércio", img: ["comercio"] },
    pedra: { n: "Pedra das Sereias", img: ["pedra"] }, altar: { n: "Altar de Transmutação", img: ["altar"] },
  };
  // Hexágonos encostados na linha vermelha de cada borda [linha, posição, arestas com linha vermelha]
  NT.BORDAS = {
    top: { n: "Passagem norte", hx: [[0, 1, "NW NE"], [0, 2, "NW NE"], [0, 3, "NW NE"]] },
    bottom: { n: "Passagem sul", hx: [[8, 1, "SW SE"], [8, 2, "SW SE"], [8, 3, "SW SE"], [8, 4, "SW"]] },
    ul: { n: "Pedra das Sereias (borda)", hx: [[1, 0, "W"], [2, 0, "NW W"], [3, 0, "NW"]] },
    ur: { n: "Taverna", hx: [[1, 6, "E"], [2, 7, "NE E"]] },
    lr: { n: "Comércio e Ossuário (borda)", hx: [[4, 9, "SE"], [5, 8, "E SE"], [6, 7, "E SE"], [7, 6, "E SE"], [8, 5, "E"]] },
    ll: { n: "Capela", hx: [[5, 0, "SW"], [6, 0, "W SW"], [7, 0, "W"]] },
  };
  NT.INICIOS = [[0, 0], [0, 5], [4, 9], [8, 5], [8, 0], [4, 0]]; // em sentido horário a partir do noroeste
  // Mapa impresso (mapa.pdf, versão 2)
  const m = "mar", x = "maldita", a = "altar", c = "cemiterio", t = "comercio", p = "pedra", i = "ilha", s = "inicio";
  NT.MAPA_IMPRESSO = [
    [s, m, m, m, m, s],
    [c, m, m, m, m, m, m],
    [x, m, c, m, x, m, m, x],
    [t, a, m, p, i, a, x, x, x],
    [s, a, m, m, t, m, p, i, x, s],
    [t, m, m, x, i, m, t, i, x],
    [m, m, m, x, m, x, m, c],
    [m, m, m, m, m, m, c],
    [s, t, x, m, x, s],
  ];
  // Geometria sobre a imagem do tabuleiro (pontos do PDF, 1701 × 1370)
  NT.GEO = { W: 1700.79, H: 1370.43, cx: 849.6, cy: 684.6, R: 77.95 };
  NT.CORES = [
    { n: "Escarlate", c: "#d1453b" }, { n: "Âmbar", c: "#e0a330" }, { n: "Turquesa", c: "#38b2a4" },
    { n: "Violeta", c: "#9b6bd6" }, { n: "Marfim", c: "#e8dcc0" }, { n: "Cobalto", c: "#4c86d9" },
  ];
  NT.CAPITAES = ["Roche Cavendish", "Jeanne de Clisson", "Mary Read", "William Kidd", "Calico Jack", "Grace O'Malley"];
})(window.NT);
