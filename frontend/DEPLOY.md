# Deploy do frontend (Easypanel)

## Configuração no Easypanel

- **Fonte**: GitHub; repositório com **Caminho de build** `/frontend`, branch `master`, Buildpacks (ex.: heroku/builder:24).
- Repositório **privado** exige token do GitHub em **Configurações** do Easypanel.

## Variáveis de ambiente (Easypanel)

Configure em **Ambiente** do serviço (nomes exatos):

- `VITE_SUPABASE_URL` – URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` – Chave anônima do Supabase
- `VITE_MELI_CLIENT_ID` – (opcional) App ID do Mercado Livre
- `VITE_MELI_REDIRECT_URI` – (opcional) Ex.: `https://catalog.luminode.com.br/app/meli/callback`

Essas variáveis são injetadas em **runtime**: ao subir o container, o script `scripts/gen-env.js` gera `dist/env.js` e o frontend lê de `window.__ENV__`. Não é preciso redeploy só para alterar env; reiniciar o serviço já aplica.

## Por que existe o script `start`

O frontend é uma SPA (Vite). O build gera arquivos estáticos em `dist/`. Em produção o Easypanel (e buildpacks) rodam `npm start` após o build; sem esse script o serviço não sobe. O `start` usa `serve` para servir `dist/` na porta `PORT`.

## Testar localmente

```bash
npm run build && npm start
```

Sobe na porta 3000 se a variável `PORT` não estiver definida.
