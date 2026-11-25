// Baralhos FINAIS da v5 (aba "Cartas v5" do catálogo), derivados do arquivo impresso.
const D = require("./data");
const half = (n) => Math.ceil(n / 2);

const BLANK_PRIZE_BAU = {
  "O Tesouro dos Talheres": { ouro: 1 }, "Rei de Lugar Nenhum": { ouro: 1 },
  "Fantasma em Meio Expediente": { peixe: 1 }, "O Último Pedido de Desculpas": { rum: 1 },
};
const BAUS = D.BAUS.map(([q, n, r, fl]) => {
  const r2 = {};
  for (const k in r) r2[k] = ["ouro", "rum", "polvora", "lona"].includes(k) ? half(r[k]) : r[k];
  return [q, n, BLANK_PRIZE_BAU[n] || r2, fl];
});

const DUP_TO_ONE = ["Boxeador em desvantagem", "Casco Rachado", "Galé de Rubis", "Barba feita", "Barril de Rum Boiando", "Só Lodo", "Estojo do Artilheiro"];
const BLANK_PRIZE_NAUF = { "Algas e Tristeza": { peixe: 1 }, "Barco Fantasma Sem Fantasma": { polvora: 1 }, "Esqueleto Educado": { ouro: 1 } };
const NAUFRAGIOS = D.NAUFRAGIOS.map(([q, n, r, fl]) => [DUP_TO_ONE.includes(n) ? 1 : q, n, BLANK_PRIZE_NAUF[n] || r, fl]).concat([
  [1, "Tripulação Fantasma", {}, { eff: "crew2" }],
  [1, "Mapa do Cemitério", { ouro: 2 }, { eff: "mov2" }],
  [1, "Âncora de Ossos", { ouro: 2 }, { eff: "def1" }],
  [1, "Canhão Afundado", { polvora: 2 }, { eff: "atk2" }],
  [1, "Sino dos Afogados", { concha: 1 }, { eff: "sino" }],
  [1, "O Baú do Kraken", { ouro: 5 }, { risk: "kraken" }],
  [1, "Correntes do Fundo", { concha: 1, ouro: 3 }, { risk: "correntes" }],
  [1, "Luneta Sem Lente", { ouro: 1 }, { eff: "luneta" }],
]);

const count = (d) => d.reduce((s, e) => s + e[0], 0);
if (count(BAUS) !== 50 || count(NAUFRAGIOS) !== 50) throw new Error("baralho com tamanho errado: " + count(BAUS) + "/" + count(NAUFRAGIOS));

module.exports = { BAUS, NAUFRAGIOS, ARTEFATOS: D.ARTEFATOS, MALDICOES: D.MALDICOES };
