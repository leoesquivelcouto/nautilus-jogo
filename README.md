# Nautilus

Jogo de tabuleiro pirata no navegador: 1 jogador contra bots (fácil, médio, difícil), com as regras do Manual v5.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `web/index.html` | Página do jogo |
| `web/src/` | Código: `data.js` (regras e cartas), `engine.js` (motor), `bots.js`, `fx.js` (animação e som), `ui.js` (interface), `style.css`, `fonts.js` |
| `web/public/` | Arquivos copiados sem mudança: imagens (`assets/`), `favicon.svg`, `_headers` (segurança e cache no Cloudflare) |
| `tests/` | Simuladores do motor em Node (`*.cjs`), servidor local com os cabeçalhos de produção e o piloto automático da interface |
| `dist/` | Site gerado pelo build (não vai para o git) |

## Comandos

```bash
npm ci              # instala as dependências exatas do package-lock
npm run dev         # servidor de desenvolvimento em http://localhost:5173 (com #autoteste e NT.debug)
npm test            # 60 partidas só com bots; falha se alguma quebrar
npm run build       # gera dist/
npm run serve:dist  # serve dist/ com os mesmos cabeçalhos do Cloudflare em http://localhost:8643
```

Testes do motor mais longos: `node tests/dificuldade.cjs 150`, `node tests/diagnostico.cjs 200`.

## Publicação (Cloudflare Pages)

O site é publicado pelo Cloudflare Pages ligado a este repositório: cada envio para `main` gera uma nova versão.

- Comando de build: `npm run build`
- Pasta de saída: `dist`
- Variável de ambiente: `NODE_VERSION = 22`

## Segurança

- Nenhum segredo vai para o repositório. Chaves privadas ficam só nos painéis dos serviços (Cloudflare, Supabase) ou em `.env` local, que o `.gitignore` bloqueia.
- `web/public/_headers` define a política de segurança de conteúdo (CSP): só scripts do próprio site, sem `eval`, sem inline. Ao adicionar um serviço externo, libere só o domínio necessário ali.
- Ganchos de teste (`#autoteste`, `NT.debug`) existem só no `npm run dev`.
- As fontes são servidas pelo próprio site (sem Google Fonts).
