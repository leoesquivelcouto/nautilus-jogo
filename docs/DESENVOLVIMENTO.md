# Desenvolvimento

Notas técnicas do protótipo digital.

## Estrutura do código

| Pasta | Conteúdo |
|---|---|
| `web/index.html` | Página do jogo |
| `web/src/` | `data.js` (regras e cartas), `engine.js` (motor), `bots.js`, `fx.js` (animação e som), `ui.js` (interface), `manual.js`, `auxilio.js`, estilos e fontes |
| `web/public/` | Copiado sem mudança para o site: imagens (`assets/`), ferramentas (`ferramentas/`), `favicon.svg`, `_headers` |
| `tests/` | Partidas automáticas do motor (`*.cjs`), servidor local com os cabeçalhos de produção, piloto automático da interface |
| `ferramentas/` | Explicação das ferramentas de produção; `extensao-fila-de-imagens/` é um submódulo (`git submodule update --init`) |
| `dist/` | Site gerado pelo build (fora do git) |

## Comandos

```bash
npm ci              # dependências exatas do package-lock
npm run dev         # http://localhost:5173 (com os ganchos de teste #autoteste e NT.debug)
npm test            # 60 partidas só com bots; falha se alguma quebrar
npm run build       # gera dist/
npm run serve:dist  # serve dist/ com os mesmos cabeçalhos do Cloudflare em http://localhost:8643
```

Testes do motor mais longos: `node tests/dificuldade.cjs 150`, `node tests/diagnostico.cjs 200`.

## Publicação

O Cloudflare Pages está ligado a este repositório: cada envio para `main` publica uma nova versão.

- Comando de build `npm run build`, pasta de saída `dist`, Node lido do `.nvmrc` (22)
- O app do Cloudflare no GitHub tem acesso só a este repositório

## Segurança

- Nenhum segredo vai para o repositório. Chaves privadas ficam nos painéis dos serviços ou em `.env` local, bloqueado pelo `.gitignore`.
- `web/public/_headers` define a política de segurança de conteúdo do jogo: só scripts do próprio site, sem `eval` e sem script inline.
- As ferramentas em `/ferramentas/*` têm uma política própria, que libera script inline e as fontes do Google só nessas páginas. Elas não acessam conta nem servidor.
- Os ganchos de teste existem só em `npm run dev`; o CI confere que não foram para o site.
