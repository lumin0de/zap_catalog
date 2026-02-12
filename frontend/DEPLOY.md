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

---

## Checklist de validação (Edge Function + Frontend)

### DevTools > Network

1. **Ping**: `POST .../functions/v1/uazapi-proxy` com body `{ "action": "ping" }` deve retornar **200** em **&lt;200ms** (cold start pode ser maior na primeira vez).
2. **get-profile**: request com `action: "get-profile"` deve retornar **200** com JSON `{ profile: {...} }` ou **4xx/5xx** com JSON `{ error: string, request_id: string }`. Nunca deve ficar em **pending** até timeout.
3. Se houver 504: o body da resposta deve ter `request_id` para rastrear nos logs do Supabase.

### Supabase Dashboard > Edge Functions > uazapi-proxy > Logs

- Cada request deve mostrar `[request_id] incoming method=POST url=...`
- Logs de timing: `auth.getUser_ms=...`, `rpc zc_get_profile ...ms`, `rpc get-integrations ...ms`
- Se travar, o último log indica a etapa (ex.: timeout em `auth.getUser` ou em `zc_get_profile`).

### Secrets no Supabase (Edge Function)

Em **Edge Functions** > **uazapi-proxy** > **Secrets**, conferir:

- `SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = definido (não logar valor)
- `UAZAPI_ADMIN_TOKEN` = para ações WhatsApp
- `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`, `MELI_REDIRECT_URI` = para Mercado Livre
