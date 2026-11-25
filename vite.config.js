import { defineConfig } from "vite";

// O código do jogo fica em web/; o site pronto sai em dist/ (é essa pasta que o Cloudflare Pages publica).
export default defineConfig({
  root: "web",
  publicDir: "public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsDir: "static", // arquivos com hash vão para /static (cache longo); as imagens do jogo ficam em /assets
    target: "es2020",
    sourcemap: false,
    assetsInlineLimit: 0, // nada vira data: URI; tudo sai como arquivo com hash (cache longo e CSP simples)
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
