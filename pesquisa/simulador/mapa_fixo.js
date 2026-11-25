// Mapa impresso (mapa.pdf, 19/11/2026), linha a linha de cima para baixo, da esquerda para a direita.
const M = "mar", X = "maldita", A = "altar", C = "cemiterio", T = "comercio", P = "pedra", I = "ilha";
const LINHAS = [
  [X, M, A, M, M, X],
  [M, M, X, M, M, C, M],
  [M, M, M, M, M, T, M, X],
  [C, M, P, M, M, A, A, I, M],
  [M, P, X, I, T, M, M, M, M, M],
  [X, M, T, T, M, X, M, M, T],
  [I, X, X, M, M, M, M, X],
  [M, X, M, M, M, X, M],
  [M, X, C, M, I, C],
];
// Hexágonos encostados na linha vermelha de cada borda: [linha, posição]
const BORDAS = {
  top: [[0, 1], [0, 2], [0, 3]], bottom: [[8, 1], [8, 2], [8, 3]],
  ul: [[1, 0], [2, 0]], ur: [[1, 6], [2, 7]],
  lr: [[5, 8], [6, 7], [7, 6], [8, 5]], ll: [[5, 0], [6, 0], [7, 0]],
};
// Pontos de partida usados na simulação (o mapa ainda não marca nenhum)
const INICIOS = { NO: [0, 0], NE: [0, 5], O: [4, 0], L: [4, 9], SO: [8, 0], SE: [7, 6] };
module.exports = { LINHAS, BORDAS, INICIOS };
