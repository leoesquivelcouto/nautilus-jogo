// Serve a pasta dist/ aplicando as mesmas regras do arquivo _headers do Cloudflare Pages.
// Serve para testar localmente o site publicado com a política de segurança (CSP) de verdade.
// Uso: npm run build && npm run serve:dist  →  http://localhost:8643
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "dist");
const PORT = +(process.env.PORT || 8643);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json" };

// Lê _headers: blocos "padrão de caminho" seguidos de linhas "  Nome: valor".
function parseHeaders() {
  const file = path.join(root, "_headers"); if (!fs.existsSync(file)) return [];
  const rules = []; let cur = null;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) { cur = { pattern: raw.trim(), headers: {} }; rules.push(cur); continue; }
    const m = raw.trim().match(/^([^:]+):\s*(.*)$/); if (m && cur) cur.headers[m[1]] = m[2];
  }
  return rules.map((r) => ({ re: new RegExp("^" + r.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"), headers: r.headers }));
}
const RULES = parseHeaders();

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.normalize(path.join(root, p));
  if (!f.startsWith(root) || p.includes("_headers")) { res.writeHead(404); return res.end("404"); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    const h = { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" };
    for (const r of RULES) if (r.re.test(p)) Object.assign(h, r.headers);
    res.writeHead(200, h); res.end(data);
  });
}).listen(PORT, () => console.log(`dist/ com os cabeçalhos do _headers em http://localhost:${PORT}`));
