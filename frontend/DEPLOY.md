# Deploy do frontend (Easypanel)

## Configuração no Easypanel

- **Fonte**: GitHub; repositório com **Caminho de build** `/frontend`, branch `master`, Buildpacks (ex.: heroku/builder:24).
- Repositório **privado** exige token do GitHub em **Configurações** do Easypanel.

## Por que existe o script `start`

O frontend é uma SPA (Vite). O build gera arquivos estáticos em `dist/`. Em produção o Easypanel (e buildpacks) rodam `npm start` após o build; sem esse script o serviço não sobe. O `start` usa `serve` para servir `dist/` na porta `PORT`.

## Testar localmente

```bash
npm run build && npm start
```

Sobe na porta 3000 se a variável `PORT` não estiver definida.
