/**
 * Gera dist/env.js com variáveis de ambiente para o frontend em runtime.
 * Usado no Easypanel quando as env vars estão disponíveis só no container, não no build.
 */
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, "..", "dist")
const envPath = join(distDir, "env.js")

const env = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "",
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  VITE_MELI_CLIENT_ID: process.env.VITE_MELI_CLIENT_ID ?? "",
  VITE_MELI_REDIRECT_URI: process.env.VITE_MELI_REDIRECT_URI ?? "",
}

mkdirSync(distDir, { recursive: true })
writeFileSync(
  envPath,
  `window.__ENV__ = ${JSON.stringify(env)};\n`,
  "utf8"
)
