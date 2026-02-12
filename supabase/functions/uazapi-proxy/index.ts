import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const UAZAPI_BASE_URL = "https://luminode.uazapi.com"
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN")!
const MELI_CLIENT_ID = Deno.env.get("MELI_CLIENT_ID")!
const MELI_CLIENT_SECRET = Deno.env.get("MELI_CLIENT_SECRET")!
const MELI_REDIRECT_URI = Deno.env.get("MELI_REDIRECT_URI")!

const AUTH_TIMEOUT_MS = 8_000
const RPC_TIMEOUT_MS = 8_000

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  })
}

function errorResponse(
  error: string,
  requestId: string,
  status: number,
) {
  return jsonResponse({ error, request_id: requestId }, status)
}

function now(): number {
  return Date.now()
}

async function withTimeoutServer<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  requestId: string,
): Promise<T> {
  const timer = setTimeout(() => {
    // Timer fires only if promise doesn't settle; we reject below
  }, ms)
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[${label}] timeout after ${ms}ms`)),
          ms,
        ),
      ),
    ])
    clearTimeout(timer)
    return result
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

// --- Handlers (get-profile / get-integrations: RPC only, no external fetch) ---

async function handlePing(requestId: string, startMs: number) {
  const elapsed = now() - startMs
  return jsonResponse({
    ok: true,
    ts: new Date().toISOString(),
    ms: elapsed,
    request_id: requestId,
  })
}

async function handleGetProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
  log: (msg: string, ms?: number) => void,
) {
  const t0 = now()
  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_get_profile", { p_user_id: userId }),
    RPC_TIMEOUT_MS,
    "zc_get_profile",
    requestId,
  )
  log(`rpc zc_get_profile`, now() - t0)
  if (error) {
    log(`rpc zc_get_profile error: ${error.message}`)
    return errorResponse(error.message, requestId, 500)
  }
  return jsonResponse({ profile: data })
}

async function handleUpdateProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_update_profile", {
      p_user_id: userId,
      p_full_name: params.fullName as string,
      p_company_name: (params.companyName as string) ?? "",
    }),
    RPC_TIMEOUT_MS,
    "zc_update_profile",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ profile: data })
}

async function handleGetIntegrations(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
  log: (msg: string, ms?: number) => void,
) {
  const t0 = now()
  const [whatsappRes, meliRes] = await Promise.all([
    withTimeoutServer(
      admin.rpc("zc_get_whatsapp", { p_user_id: userId }),
      RPC_TIMEOUT_MS,
      "zc_get_whatsapp",
      requestId,
    ),
    withTimeoutServer(
      admin.rpc("zc_get_meli", { p_user_id: userId }),
      RPC_TIMEOUT_MS,
      "zc_get_meli",
      requestId,
    ),
  ])
  log(`rpc get-integrations (whatsapp+meli)`, now() - t0)
  if (whatsappRes.error) log(`rpc zc_get_whatsapp error: ${whatsappRes.error.message}`)
  if (meliRes.error) log(`rpc zc_get_meli error: ${meliRes.error.message}`)
  return jsonResponse({
    whatsapp: whatsappRes.data ?? null,
    meli: meliRes.data ?? null,
  })
}

async function handleInit(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: existing } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })
  if (existing?.instance_token) {
    try {
      await fetch(`${UAZAPI_BASE_URL}/instance/delete`, {
        method: "GET",
        headers: { Token: existing.instance_token },
      })
    } catch {
      // Ignore
    }
    await admin.rpc("zc_delete_whatsapp", { p_user_id: userId })
  }

  const instanceName = `zc_${userId.substring(0, 8)}`
  const uazapiRes = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      admintoken: UAZAPI_ADMIN_TOKEN,
    },
    body: JSON.stringify({ Name: instanceName }),
  })

  if (!uazapiRes.ok) {
    const err = await uazapiRes.text()
    return jsonResponse({ error: `Falha ao criar instância UAZAPI: ${err}` }, 502)
  }

  const uazapiData = await uazapiRes.json()
  const instanceToken =
    uazapiData.instance?.token ??
    uazapiData.token ??
    uazapiData.instance_token ??
    ""
  const resolvedName = uazapiData.instance?.name ?? instanceName

  if (!instanceToken) {
    return jsonResponse({ error: "UAZAPI não retornou token da instância" }, 502)
  }

  const { error } = await admin.rpc("zc_upsert_whatsapp", {
    p_user_id: userId,
    p_instance_name: resolvedName,
    p_instance_token: instanceToken,
    p_is_connected: false,
  })

  if (error) return jsonResponse({ error: error.message }, 500)

  return jsonResponse({
    instance_name: resolvedName,
    instance_token: instanceToken,
  })
}

async function handleConnect(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: whatsapp } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })
  if (!whatsapp?.instance_token) {
    return jsonResponse({ error: "Nenhuma instância WhatsApp encontrada. Crie uma primeiro." }, 404)
  }

  const uazapiRes = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Token: whatsapp.instance_token,
    },
    body: JSON.stringify({}),
  })

  if (!uazapiRes.ok) {
    const err = await uazapiRes.text()
    return jsonResponse({ error: `Falha ao gerar QR code: ${err}` }, 502)
  }

  const data = await uazapiRes.json()
  const instanceStatus = data.instance?.status ?? "connecting"
  const isConnected = instanceStatus === "connected"
  const qrcode = data.instance?.qrcode ?? ""
  const pairingCode = data.instance?.paircode ?? ""

  if (isConnected) {
    await admin.rpc("zc_update_whatsapp_status", {
      p_user_id: userId,
      p_is_connected: true,
    })
  }

  return jsonResponse({
    qrcode,
    pairingCode,
    connected: isConnected,
    status: instanceStatus,
  })
}

async function handleStatus(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: whatsapp } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })
  if (!whatsapp?.instance_token) {
    return jsonResponse({ error: "Nenhuma instância WhatsApp" }, 404)
  }

  const uazapiRes = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
    method: "GET",
    headers: { Token: whatsapp.instance_token },
  })

  if (!uazapiRes.ok) {
    const err = await uazapiRes.text()
    return jsonResponse({ error: "Falha ao verificar status" }, 502)
  }

  const data = await uazapiRes.json()
  const isConnected =
    data.status?.connected === true ||
    data.instance?.status === "connected" ||
    data.connected === true

  await admin.rpc("zc_update_whatsapp_status", {
    p_user_id: userId,
    p_is_connected: isConnected,
  })

  return jsonResponse({
    connected: isConnected,
    phone_number: data.instance?.owner ?? data.phone_number ?? data.phoneNumber ?? "",
    name: data.instance?.profileName ?? data.name ?? data.pushName ?? "",
  })
}

async function handleWebhook(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
) {
  const { data: whatsapp } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })
  if (!whatsapp?.instance_token) {
    return jsonResponse({ error: "Nenhuma instância WhatsApp" }, 404)
  }

  const webhookUrl = params.webhookUrl as string
  const uazapiRes = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Token: whatsapp.instance_token,
    },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  })

  if (!uazapiRes.ok) {
    const err = await uazapiRes.text()
    return jsonResponse({ error: `Falha ao configurar webhook: ${err}` }, 502)
  }

  await admin.rpc("zc_update_whatsapp_webhook", {
    p_user_id: userId,
    p_webhook_url: webhookUrl,
  })

  return jsonResponse({ success: true })
}

async function handleDisconnect(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: whatsapp } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })
  if (!whatsapp?.instance_token) {
    return jsonResponse({ error: "Nenhuma instância WhatsApp" }, 404)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    await fetch(`${UAZAPI_BASE_URL}/instance/logout`, {
      method: "GET",
      headers: { Token: whatsapp.instance_token },
      signal: controller.signal,
    })
    clearTimeout(timeout)
  } catch {
    // Ignore
  }

  await admin.rpc("zc_update_whatsapp_status", {
    p_user_id: userId,
    p_is_connected: false,
  })

  return jsonResponse({ success: true })
}

async function handleDelete(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: whatsapp } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })

  if (whatsapp?.instance_token) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      await fetch(`${UAZAPI_BASE_URL}/instance/delete`, {
        method: "GET",
        headers: { Token: whatsapp.instance_token },
        signal: controller.signal,
      })
      clearTimeout(timeout)
    } catch {
      // Ignore
    }
  }

  const { error } = await admin.rpc("zc_delete_whatsapp", { p_user_id: userId })
  if (error) console.error("zc_delete_whatsapp error:", error)

  return jsonResponse({ success: true })
}

async function ensureMeliToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ access_token: string; seller_id: string }> {
  const { data: meli, error } = await admin.rpc("zc_get_meli", { p_user_id: userId })
  if (error || !meli?.refresh_token) {
    throw new Error("Nenhuma integração Mercado Livre encontrada")
  }

  const expiresAt = new Date(meli.token_expires_at)
  const now_ = Date.now()
  const thirtyMinutes = 30 * 60 * 1000

  if (expiresAt.getTime() - now_ > thirtyMinutes) {
    return { access_token: meli.access_token, seller_id: meli.seller_id }
  }

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: MELI_CLIENT_ID,
      client_secret: MELI_CLIENT_SECRET,
      refresh_token: meli.refresh_token,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error("[meli] Token refresh failed:", res.status, errText)
    await admin.rpc("zc_delete_meli", { p_user_id: userId })
    throw new Error("Token do Mercado Livre expirado. Reconecte sua conta.")
  }

  const tokens = await res.json()
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await admin.rpc("zc_update_meli_tokens", {
    p_user_id: userId,
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token,
    p_token_expires_at: newExpiresAt,
  })

  return { access_token: tokens.access_token, seller_id: meli.seller_id }
}

async function handleMeliExchange(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const code = params.code as string
  if (!code) {
    return jsonResponse({ error: "Código de autorização não fornecido" }, 400)
  }

  const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: MELI_CLIENT_ID,
      client_secret: MELI_CLIENT_SECRET,
      code,
      redirect_uri: MELI_REDIRECT_URI,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error("[meli] Token exchange failed:", tokenRes.status, errText)
    return errorResponse("Falha ao trocar código por tokens do Mercado Livre", requestId, 502)
  }

  const tokenData = await tokenRes.json()

  let nickname = ""
  const userRes = await fetch("https://api.mercadolibre.com/users/me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
  })
  if (userRes.ok) {
    const userData = await userRes.json()
    nickname = userData.nickname ?? ""
  }

  const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

  const { error: dbError } = await admin.rpc("zc_upsert_meli", {
    p_user_id: userId,
    p_access_token: tokenData.access_token,
    p_refresh_token: tokenData.refresh_token,
    p_seller_id: String(tokenData.user_id),
    p_nickname: nickname,
    p_token_expires_at: tokenExpiresAt,
    p_is_connected: true,
  })

  if (dbError) {
    console.error("[meli] DB upsert error:", dbError)
    return errorResponse(dbError.message, requestId, 500)
  }

  return jsonResponse({
    success: true,
    nickname,
    seller_id: String(tokenData.user_id),
  })
}

async function handleMeliDisconnect(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { error } = await admin.rpc("zc_delete_meli", { p_user_id: userId })
  if (error) console.error("[meli] delete error:", error)
  return jsonResponse({ success: true })
}

// --- Main handler ---

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()
  const startMs = now()

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  console.log(`[${requestId}] incoming method=${req.method} url=${url.pathname}`)

  const hasServiceRole = !!SUPABASE_SERVICE_ROLE_KEY
  const urlPrefix = SUPABASE_URL ? SUPABASE_URL.substring(0, 40) : "(missing)"
  console.log(`[${requestId}] hasServiceRole=${hasServiceRole} SUPABASE_URL_prefix=${urlPrefix}`)

  try {
    let body: Record<string, unknown>
    const parseStart = now()
    try {
      body = await req.json()
    } catch {
      return errorResponse("Invalid JSON body", requestId, 400)
    }
    console.log(`[${requestId}] parse_json_ms=${now() - parseStart}`)

    const { action, ...params } = body

    if (action === "ping" || action === "health") {
      return await handlePing(requestId, startMs)
    }

    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return errorResponse("Missing authorization", requestId, 401)
    }

    const token = authHeader.replace("Bearer ", "")
    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const authStart = now()
    const {
      data: { user },
      error: authError,
    } = await withTimeoutServer(
      authClient.auth.getUser(token),
      AUTH_TIMEOUT_MS,
      "auth.getUser",
      requestId,
    )
    console.log(`[${requestId}] auth.getUser_ms=${now() - authStart}`)

    if (authError || !user) {
      return errorResponse("Unauthorized", requestId, 401)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const log = (msg: string, ms?: number) => {
      console.log(`[${requestId}] ${msg}${ms !== undefined ? ` ${ms}ms` : ""}`)
    }

    log(`action=${action} user=${user.id.substring(0, 8)}`)

    switch (action) {
      case "get-profile":
        return await handleGetProfile(admin, user.id, requestId, log)
      case "update-profile":
        return await handleUpdateProfile(admin, user.id, params, requestId)
      case "get-integrations":
        return await handleGetIntegrations(admin, user.id, requestId, log)
      case "init":
        return await handleInit(admin, user.id)
      case "connect":
        return await handleConnect(admin, user.id)
      case "status":
        return await handleStatus(admin, user.id)
      case "webhook":
        return await handleWebhook(admin, user.id, params)
      case "disconnect":
        return await handleDisconnect(admin, user.id)
      case "delete":
        return await handleDelete(admin, user.id)
      case "meli-exchange":
        return await handleMeliExchange(admin, user.id, params, requestId)
      case "meli-disconnect":
        return await handleMeliDisconnect(admin, user.id)
      default:
        return errorResponse(`Ação desconhecida: ${action}`, requestId, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno do servidor"
    console.error(`[${requestId}] unhandled error:`, message)
    if (message.includes("timeout")) {
      return errorResponse(message, requestId, 504)
    }
    return errorResponse(message, requestId, 500)
  }
})
