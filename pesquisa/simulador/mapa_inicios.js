// Força de largada de cada hexágono navegável da borda do mapa impresso.
const E = require("./engine2"); const F = require("./mapa_fixo");
const ROWS = [6, 7, 8, 9, 10, 9, 8, 7, 6];
const per = [];
ROWS.forEach((L, r) => { for (let i = 0; i < L; i++) { const t = F.LINHAS[r][i]; const edge = r === 0 || r === 8 || i === 0 || i === L - 1; if (edge && (t === "mar" || t === "maldita")) per.push([r, i]); } });
const INICIOS = Object.fromEntries(per.map(([r, i]) => [`${r + 1}.${i + 1}`, [r, i]]));
const fixed = { ...F, INICIOS };
E.RULES.fixedMap = fixed;
const P = +(process.argv[2] || 4), N = +(process.argv[3] || 20000);
const win = {}, pres = {};
for (let g = 0; g < N; g++) { const G = E.play(Array(P).fill(1), 90001 + g * 7919); for (const p of G.players) pres[p.start] = (pres[p.start] || 0) + 1; if (G.winner) win[G.winner.start] = (win[G.winner.start] || 0) + 1; }
E.RULES.fixedMap = null;
const out = Object.keys(pres).map((k) => ({ hex: k, tipo: F.LINHAS[INICIOS[k][0]][INICIOS[k][1]], forca: Math.round(((win[k] || 0) / pres[k]) * P * 100), n: pres[k] })).sort((a, b) => b.forca - a.forca);
console.log(JSON.stringify(out));
require("fs").writeFileSync(`inicios_${P}p.json`, JSON.stringify(out));
