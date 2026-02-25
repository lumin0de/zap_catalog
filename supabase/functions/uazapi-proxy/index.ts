import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const UAZAPI_BASE_URL = "https://luminode.uazapi.com"
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN")!
const MELI_CLIENT_ID = Deno.env.get("MELI_CLIENT_ID")!
const MELI_CLIENT_SECRET = Deno.env.get("MELI_CLIENT_SECRET")!
const MELI_REDIRECT_URI = Deno.env.get("MELI_REDIRECT_URI")!
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? ""

const AUTH_TIMEOUT_MS = 8_000
const RPC_TIMEOUT_MS = 8_000
const EXTRACTION_TIMEOUT_MS = 30_000
const MAX_PROMPT_CHARS = 32_000

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

  // Proactive token refresh: if token expires in < 2h, refresh silently in background
  const meliData = meliRes.data as Record<string, unknown> | null
  if (meliData?.refresh_token && meliData?.token_expires_at) {
    const expiresAt = new Date(meliData.token_expires_at as string)
    const twoHours = 2 * 60 * 60 * 1000
    if (expiresAt.getTime() - Date.now() < twoHours) {
      ensureMeliToken(admin, userId).catch((e: Error) => {
        log(`proactive meli token refresh failed: ${e.message}`)
      })
    }
  }

  // Auto-configure webhook if whatsapp is connected but webhook not set yet
  const whatsappData = whatsappRes.data as Record<string, unknown> | null
  if (whatsappData?.is_connected && !whatsappData?.webhook_url && whatsappData?.instance_token) {
    const webhookUrl = `${SUPABASE_URL}/functions/v1/uazapi-proxy`
    fetch(`${UAZAPI_BASE_URL}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: whatsappData.instance_token as string },
      body: JSON.stringify(buildWebhookBody(webhookUrl)),
    }).then(() => admin.rpc("zc_update_whatsapp_webhook", {
      p_user_id: userId,
      p_webhook_url: webhookUrl,
    })).catch((e: Error) => log(`auto-webhook setup failed: ${e.message}`))
  }

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
      await fetch(`${UAZAPI_BASE_URL}/instance`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          token: existing.instance_token,
        },
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

  // Auto-configure UAZAPI webhook to point back to this edge function
  const webhookUrl = `${SUPABASE_URL}/functions/v1/uazapi-proxy`
  try {
    await fetch(`${UAZAPI_BASE_URL}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify(buildWebhookBody(webhookUrl)),
    })
    await admin.rpc("zc_update_whatsapp_webhook", {
      p_user_id: userId,
      p_webhook_url: webhookUrl,
    })
  } catch {
    // Non-fatal: webhook setup failure doesn't block instance creation
  }

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
      token: whatsapp.instance_token,
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
    headers: { token: whatsapp.instance_token },
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

  // Persist owner phone number for webhook fallback lookup
  const phoneNumber = (data.instance?.owner ?? data.phone_number ?? data.phoneNumber ?? "") as string
  if (phoneNumber) {
    try {
      await admin.rpc("zc_update_whatsapp_phone", {
        p_user_id: userId,
        p_phone_number: phoneNumber,
      })
    } catch {
      // non-fatal
    }
  }

  return jsonResponse({
    connected: isConnected,
    phone_number: phoneNumber,
    name: data.instance?.profileName ?? data.name ?? data.pushName ?? "",
  })
}

// Builds the correct webhook config body for UAZAPI Go
// events and excludeMessages must be arrays ([]string in Go struct)
// Send both habilitado (lowercase) and Habilitado (PascalCase) — Go struct json tag may vary
function buildWebhookBody(webhookUrl: string) {
  return {
    enabled:             true,
    habilitado:          true,
    Habilitado:          true,
    url:                 webhookUrl,
    sendToken:           true,
    events:              ["messages"],
    excludeMessages:     ["wasSentByApi", "isGroupYes"],
    addUrlEvents:        false,
    addUrlTypesMessages: false,
  }
}

async function handleWebhook(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { data: whatsapp } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })
  if (!whatsapp?.instance_token) {
    return jsonResponse({ error: "Nenhuma instância WhatsApp" }, 404)
  }

  const instanceToken = whatsapp.instance_token as string
  // Webhook URL is always the internal edge function — no user input needed (multi-tenant safe)
  const webhookUrl = `${SUPABASE_URL}/functions/v1/uazapi-proxy`
  const body = buildWebhookBody(webhookUrl)

  // Step 1: GET current webhook config — reveals existing ID and exact schema
  let existingId: string | null = null
  try {
    const getRes = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
      method: "GET",
      headers: { token: instanceToken },
    })
    if (getRes.ok) {
      const current = await getRes.json()
      console.log(`[${requestId}] webhook GET: ${JSON.stringify(current).substring(0, 400)}`)
      // Extract ID — may be array or object, field may be "id" or "Id"
      const first = Array.isArray(current) ? current[0] : current
      existingId = first?.id ?? first?.Id ?? first?.ID ?? null
    } else {
      console.log(`[${requestId}] webhook GET ${getRes.status}: ${await getRes.text()}`)
    }
  } catch (e) {
    console.log(`[${requestId}] webhook GET error: ${e}`)
  }

  // Step 2: PUT existing or POST new
  let uazapiRes: Response
  if (existingId) {
    console.log(`[${requestId}] webhook PUT id=${existingId}`)
    uazapiRes = await fetch(`${UAZAPI_BASE_URL}/webhook/${existingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify(body),
    })
    // Fallback to POST if PUT not supported
    if (!uazapiRes.ok) {
      const putErr = await uazapiRes.text()
      console.log(`[${requestId}] webhook PUT failed ${uazapiRes.status} ${putErr} — trying POST`)
      uazapiRes = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: instanceToken },
        body: JSON.stringify(body),
      })
    }
  } else {
    console.log(`[${requestId}] webhook POST (no existing ID)`)
    uazapiRes = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify(body),
    })
  }

  const resText = await uazapiRes.text()
  console.log(`[${requestId}] webhook set response: ${uazapiRes.status} ${resText.substring(0, 400)}`)

  if (!uazapiRes.ok) {
    return jsonResponse({ error: `Falha ao configurar webhook: ${resText}` }, 502)
  }

  await admin.rpc("zc_update_whatsapp_webhook", {
    p_user_id: userId,
    p_webhook_url: webhookUrl,
  })

  return jsonResponse({ success: true, webhook_url: webhookUrl })
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
    await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        token: whatsapp.instance_token,
      },
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
      await fetch(`${UAZAPI_BASE_URL}/instance`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          token: whatsapp.instance_token,
        },
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
    let detail = ""
    try {
      const errJson = JSON.parse(errText)
      detail = errJson.message ?? errJson.error ?? ""
    } catch { /* ignore */ }
    return errorResponse(
      `Falha ao autenticar com o Mercado Livre${detail ? `: ${detail}` : ""}`,
      requestId,
      502,
    )
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

async function handleMeliItems(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { access_token, seller_id } = await ensureMeliToken(admin, userId)

  const limit = Math.min(Number(params.limit ?? 50), 50)
  const offset = Number(params.offset ?? 0)

  const searchRes = await fetch(
    `https://api.mercadolibre.com/users/${seller_id}/items/search?limit=${limit}&offset=${offset}`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
        "User-Agent": "ZapCatalog/1.0",
      },
    },
  )

  if (!searchRes.ok) {
    const errText = await searchRes.text()
    console.error("[meli] items/search failed:", searchRes.status, errText)
    return errorResponse(`Falha ao buscar itens do Mercado Livre: ${searchRes.status}`, requestId, 502)
  }

  const searchData = await searchRes.json()
  const itemIds: string[] = searchData.results ?? []
  const total: number = searchData.paging?.total ?? 0

  if (itemIds.length === 0) {
    return jsonResponse({ items: [], total, offset, limit })
  }

  // ML batch endpoint: up to 20 IDs per request
  const allItems: unknown[] = []
  const batchSize = 20
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize)
    const detailsRes = await fetch(
      `https://api.mercadolibre.com/items?ids=${batch.join(",")}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
          "User-Agent": "ZapCatalog/1.0",
        },
      },
    )
    if (!detailsRes.ok) continue
    const detailsData = await detailsRes.json()
    for (const entry of detailsData) {
      if (entry.code === 200 && entry.body) {
        const b = entry.body
        allItems.push({
          id: b.id,
          title: b.title,
          price: b.price,
          currency_id: b.currency_id,
          available_quantity: b.available_quantity,
          sold_quantity: b.sold_quantity,
          status: b.status,
          thumbnail: b.thumbnail?.replace("http://", "https://"),
          permalink: b.permalink,
          category_id: b.category_id,
          condition: b.condition,
        })
      }
    }
  }

  return jsonResponse({ items: allItems, total, offset, limit })
}

async function handleMeliSyncCatalog(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const agentId = params.agentId as string
  if (!agentId) return errorResponse("agentId e obrigatorio", requestId, 400)

  const { access_token, seller_id } = await ensureMeliToken(admin, userId)
  console.log(`[${requestId}] meli-sync seller_id=${seller_id}`)

  // Fetch all items (up to 200), filter by status client-side
  interface CatalogVariation {
    id: number
    price: number
    available_quantity: number
    combinations: Array<{ name: string; value: string }>
  }
  interface CatalogItem {
    id: string; title: string; price: number; original_price: number | null
    currency_id: string; available_quantity: number; permalink: string | null
    status: string; condition: string; warranty: string | null
    free_shipping: boolean; attributes: Record<string, string>
    variations: CatalogVariation[]
  }
  const allItems: CatalogItem[] = []
  let fetchOffset = 0
  let fetchTotal = Infinity
  let totalIdsFound = 0
  let searchError: string | null = null

  while (fetchOffset < fetchTotal && fetchOffset < 200) {
    const searchRes = await fetch(
      `https://api.mercadolibre.com/users/${seller_id}/items/search?limit=50&offset=${fetchOffset}`,
      { headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json", "User-Agent": "ZapCatalog/1.0" } },
    )
    if (!searchRes.ok) {
      const errText = await searchRes.text()
      searchError = `ML items/search ${searchRes.status}: ${errText}`
      console.error(`[${requestId}] ${searchError}`)
      break
    }
    const searchData = await searchRes.json()
    fetchTotal = searchData.paging?.total ?? 0
    const ids: string[] = searchData.results ?? []
    console.log(`[${requestId}] meli-sync page offset=${fetchOffset} total=${fetchTotal} ids=${ids.length}`)
    if (ids.length === 0) break
    totalIdsFound += ids.length

    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20)
      const detRes = await fetch(
        `https://api.mercadolibre.com/items?ids=${batch.join(",")}`,
        { headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json", "User-Agent": "ZapCatalog/1.0" } },
      )
      if (!detRes.ok) {
        console.error(`[${requestId}] meli-sync items batch failed: ${detRes.status}`)
        continue
      }
      const detData = await detRes.json()
      for (const entry of detData) {
        if (entry.code === 200 && entry.body) {
          const b = entry.body
          console.log(`[${requestId}] meli-sync item=${b.id} status=${b.status}`)
          // Include all non-deleted items so agent knows full catalog
          if (b.status !== "deleted") {
            // Capture ALL attributes that have a real value
            const attrMap: Record<string, string> = {}
            const SKIP_ATTR_IDS = new Set(["ITEM_CONDITION", "ALPHANUMERIC_MODEL", "MPN", "EAN", "GTIN", "SKU"])
            for (const attr of (b.attributes ?? []) as Array<{ id: string; name: string; value_name: string | null }>) {
              if (
                attr.value_name &&
                attr.value_name !== "Não informado" &&
                attr.value_name !== "Não definido" &&
                attr.value_name !== "Not defined" &&
                !SKIP_ATTR_IDS.has(attr.id)
              ) {
                attrMap[attr.name ?? attr.id] = attr.value_name
              }
            }

            // Capture variations (size/color variants with individual price and stock)
            const variations: CatalogVariation[] = []
            for (const v of (b.variations ?? []) as Array<{
              id: number; price: number; available_quantity: number
              attribute_combinations: Array<{ name: string; value_name: string }>
            }>) {
              variations.push({
                id: v.id,
                price: v.price,
                available_quantity: v.available_quantity,
                combinations: (v.attribute_combinations ?? []).map((c) => ({
                  name: c.name,
                  value: c.value_name,
                })),
              })
            }

            allItems.push({
              id: b.id,
              title: b.title,
              price: b.price,
              original_price: b.original_price ?? null,
              currency_id: b.currency_id,
              available_quantity: b.available_quantity,
              permalink: b.permalink,
              status: b.status,
              condition: b.condition ?? "new",
              warranty: b.warranty ?? null,
              free_shipping: b.shipping?.free_shipping === true,
              attributes: attrMap,
              variations,
            })
          }
        }
      }
    }
    fetchOffset += ids.length
  }

  console.log(`[${requestId}] meli-sync totalIds=${totalIdsFound} synced=${allItems.length}`)

  if (allItems.length === 0) {
    const detail = searchError
      ? `Erro ao buscar itens: ${searchError}`
      : totalIdsFound === 0
        ? "Nenhum item encontrado na sua conta do Mercado Livre."
        : `${totalIdsFound} itens encontrados mas nenhum com status ativo ou pausado.`
    return errorResponse(detail, requestId, 404)
  }

  // Build readable catalog text
  const syncDate = new Date().toLocaleDateString("pt-BR")
  const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
  const conditionLabel = (c: string) => c === "used" ? "Usado" : "Novo"
  let catalogText = `CATALOGO DE PRODUTOS - Atualizado em ${syncDate}\nTotal de produtos: ${allItems.length}\n\n`

  for (const item of allItems) {
    catalogText += `---\nProduto: ${item.title}\n`
    catalogText += `Preco: ${fmtBRL(item.price)}`
    if (item.original_price && item.original_price > item.price) {
      catalogText += ` (de ${fmtBRL(item.original_price)})`
    }
    catalogText += "\n"
    catalogText += `Condicao: ${conditionLabel(item.condition)}\n`
    catalogText += `Frete gratis: ${item.free_shipping ? "Sim" : "Nao"}\n`
    if (item.warranty) catalogText += `Garantia: ${item.warranty}\n`

    // All technical attributes
    if (Object.keys(item.attributes).length > 0) {
      for (const [name, val] of Object.entries(item.attributes)) {
        catalogText += `${name}: ${val}\n`
      }
    }

    // Variations (size/color combos with individual price and stock)
    if (item.variations.length > 0) {
      catalogText += "Variacoes disponíveis:\n"
      for (const v of item.variations) {
        const combos = v.combinations.map((c) => `${c.name}: ${c.value}`).join(", ")
        catalogText += `  - ${combos} | Preco: ${fmtBRL(v.price)} | Estoque: ${v.available_quantity}\n`
      }
    }

    if (item.permalink) catalogText += `Link: ${item.permalink}\n`
    catalogText += "\n"
  }

  const CATALOG_TITLE = "Catalogo Mercado Livre"

  // Remove existing catalog training item (replace strategy)
  const { data: existingItems } = await admin.rpc("zc_list_training_items", {
    p_user_id: userId, p_agent_id: agentId,
  })
  const existing = ((existingItems ?? []) as Array<{ id: string; title: string }>)
    .find((i) => i.title === CATALOG_TITLE)
  if (existing) {
    await admin.rpc("zc_delete_training_item", { p_user_id: userId, p_training_item_id: existing.id })
  }

  // Create new training item
  const { data: newItem, error: createErr } = await admin.rpc("zc_create_training_item", {
    p_user_id: userId, p_agent_id: agentId, p_type: "texto",
    p_content: catalogText, p_title: CATALOG_TITLE, p_processing_status: "processing",
  })
  if (createErr) return errorResponse(createErr.message, requestId, 500)

  // Mark done immediately (plain text, no extraction needed)
  await admin.rpc("zc_update_training_item_content", {
    p_user_id: userId, p_training_item_id: newItem.id,
    p_extracted_content: catalogText, p_processing_status: "done",
    p_processing_error: null, p_char_count: catalogText.length,
  })

  // Generate and store embedding for RAG
  await storeTrainingItemEmbedding(admin, userId, newItem.id, catalogText, requestId)

  // Recompile system prompt with new catalog
  await recompileSystemPrompt(admin, userId, agentId, requestId)

  console.log(`[${requestId}] meli catalog synced: ${allItems.length} items, ${catalogText.length} chars`)
  return jsonResponse({ success: true, items_synced: allItems.length, chars: catalogText.length })
}

// --- Knowledge Base: extraction + prompt compilation ---

function htmlToText(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "")
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "")
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "")
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "")
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "")
  text = text.replace(/<[^>]+>/g, " ")
  text = text.replace(/&nbsp;/g, " ")
  text = text.replace(/&amp;/g, "&")
  text = text.replace(/&lt;/g, "<")
  text = text.replace(/&gt;/g, ">")
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
  text = text.replace(/\s+/g, " ").trim()
  return text
}

async function extractWebsite(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZapCatalogBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status} ao acessar ${url}`)
    const html = await res.text()
    const text = htmlToText(html)
    if (!text || text.length < 20) {
      throw new Error("Conteudo insuficiente extraido da pagina")
    }
    return text
  } catch (e) {
    clearTimeout(timeout)
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Timeout ao acessar ${url} (10s)`)
    }
    throw e
  }
}

async function extractTxtFromStorage(
  admin: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<string> {
  const { data, error } = await admin.storage
    .from("training-documents")
    .download(storagePath)
  if (error || !data) throw new Error(`Falha ao baixar arquivo: ${error?.message ?? "sem dados"}`)
  return await data.text()
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function extractDocumentViaOpenAI(
  admin: ReturnType<typeof createClient>,
  storagePath: string,
  fileName: string,
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("Chave OpenAI nao configurada. Configure OPENAI_API_KEY nos secrets.")
  }

  const { data: fileBlob, error } = await admin.storage
    .from("training-documents")
    .download(storagePath)
  if (error || !fileBlob) throw new Error(`Falha ao baixar arquivo: ${error?.message ?? "sem dados"}`)

  const arrayBuffer = await fileBlob.arrayBuffer()
  const base64 = arrayBufferToBase64(arrayBuffer)

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Voce e um extrator de texto. Extraia TODO o conteudo textual do documento fornecido. Retorne APENAS o texto extraido, preservando a estrutura logica (titulos, paragrafos, listas). Nao adicione comentarios ou resumos.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extraia todo o conteudo textual deste arquivo "${fileName}":`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/octet-stream;base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 16000,
      temperature: 0,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    throw new Error(`OpenAI API erro ${openaiRes.status}: ${errText.substring(0, 200)}`)
  }

  const result = await openaiRes.json()
  const content = result.choices?.[0]?.message?.content?.trim() ?? ""
  if (!content) throw new Error("OpenAI nao retornou conteudo extraido")
  return content
}

async function extractDocument(
  admin: ReturnType<typeof createClient>,
  storagePath: string,
  fileName: string,
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase()

  if (ext === "txt") {
    return extractTxtFromStorage(admin, storagePath)
  }

  // PDF, DOCX, DOC -> OpenAI extraction
  return extractDocumentViaOpenAI(admin, storagePath, fileName)
}

interface TrainingContentItem {
  type: string
  title: string
  extracted_content: string
  char_count: number
}

interface AgentForPrompt {
  name: string
  objective: string
  company_description: string
  use_emojis: boolean
  sign_agent_name: boolean
  restrict_topics: boolean
  transfer_to_human: boolean
  split_responses: boolean
}

function compileSystemPrompt(
  agent: AgentForPrompt,
  trainingItems: TrainingContentItem[],
): string {
  const sections: string[] = []

  const objectiveMap: Record<string, string> = {
    suporte: "atendimento e suporte ao cliente",
    vendas: "vendas e negociacao",
    pessoal: "uso pessoal",
  }

  sections.push(
    `Voce e ${agent.name}, um assistente virtual especializado em ${objectiveMap[agent.objective] ?? agent.objective}.`,
  )

  if (agent.company_description) {
    sections.push(`\n## Sobre a empresa\n${agent.company_description}`)
  }

  // Behavior rules from config flags
  const rules: string[] = []
  if (agent.use_emojis) {
    rules.push("- Use emojis nas suas respostas para tornar a conversa mais amigavel.")
  } else {
    rules.push("- NAO use emojis nas respostas.")
  }
  if (agent.restrict_topics) {
    rules.push(
      "- Responda APENAS sobre temas relacionados a base de conhecimento abaixo. Se o usuario perguntar algo fora do escopo, educadamente informe que so pode ajudar com assuntos da empresa.",
    )
  }
  if (agent.sign_agent_name) {
    rules.push(`- Assine suas mensagens com seu nome: ${agent.name}.`)
  }
  if (agent.transfer_to_human) {
    rules.push("- Se nao conseguir resolver a duvida, oferecer transferencia para um atendente humano.")
  }
  if (agent.split_responses) {
    rules.push("- Quando a resposta for longa, divida em mensagens menores e mais legiveis.")
  }
  rules.push("- Responda sempre em portugues brasileiro.")
  rules.push("- Seja educado, profissional e objetivo.")
  rules.push(
    "- JAMAIS invente, infira ou mencione produtos, servicos, precos, disponibilidade ou qualquer informacao que nao esteja EXPLICITAMENTE listada na Base de Conhecimento abaixo. Se nao estiver la, responda: \"Nao temos essa informacao no momento.\"",
  )
  rules.push(
    "- A Base de Conhecimento abaixo e a UNICA fonte de verdade. Voce nao tem acesso a nenhuma outra informacao sobre produtos ou servicos alem do que esta listado la.",
  )
  rules.push(
    "- FORMATACAO WHATSAPP: Para negrito use *texto* (asterisco simples). NUNCA use **texto** (duplo asterisco). Para links use o formato: Link: URL — NUNCA use markdown [texto](URL).",
  )
  rules.push(
    "- FORMATACAO DE LISTA: Ao mencionar produtos, cite apenas o nome e, quando relevante, o preco. Nao despeje todos os atributos (cor, tamanho, marca etc.) sem o cliente pedir. Exiba esses detalhes somente se o cliente perguntar ou se for essencial para ajuda-lo.",
  )
  rules.push(
    "- Limite de listagem: mostre NO MAXIMO 5 produtos por mensagem. Se houver mais, pergunte o que o cliente busca especificamente antes de listar.",
  )

  sections.push(`\n## Regras de comportamento\n${rules.join("\n")}`)

  // Sales-specific behavior (only when objective is "vendas")
  if (agent.objective === "vendas") {
    sections.push(`\n## Missao e postura de vendas
Voce e um assistente de vendas conectado diretamente ao catalogo atualizado do Mercado Livre do vendedor. Sua missao e ajudar o cliente a encontrar e comprar o produto certo. Voce NAO finaliza compras — ao final, voce encaminha o link do produto para o cliente continuar a compra no Mercado Livre.

RESTRICAO ABSOLUTA: mencione apenas produtos existentes na Base de Conhecimento. Nao invente nem sugira produtos fora do catalogo.

### Como conduzir o atendimento:
1. ENTENDA antes de listar: faca perguntas para descobrir o que o cliente precisa (ex: "Voce tem alguma preferencia de cor ou tamanho?"). Nao despeje o catalogo inteiro de cara.
2. APRESENTE de forma simples: ao sugerir um produto, mencione apenas o nome e o preco. Diga "temos o *[nome]* por R$ XX,XX" — sem listar todos os atributos de uma vez.
3. DETALHE quando perguntado: so informe cor, tamanho, marca, etc. se o cliente perguntar ou se for o criterio de busca dele.
4. VERIFIQUE a disponibilidade: se o cliente pedir algo que nao existe no catalogo, diga claramente que nao temos e ofeca a opcao mais proxima disponivel (se houver).
5. CONVERTA com o link: quando o cliente demonstrar interesse, encaminhe o link do produto assim: "Segue o link para finalizar sua compra: [URL]". Nao use markdown — so a URL pura ou "Link: URL".
6. Seja consultivo, direto e humano. Mensagens curtas funcionam melhor no WhatsApp. Nunca pressione o cliente.`)
  }

  // Knowledge base
  if (trainingItems.length > 0) {
    sections.push("\n## Base de Conhecimento (LISTA OFICIAL COMPLETA)")
    sections.push(
      "ATENCAO: Os itens abaixo representam a TOTALIDADE dos produtos e informacoes disponíveis nesta empresa. NAO EXISTEM outros produtos ou informacoes alem dos listados aqui. Responda SOMENTE com base nestes dados:\n",
    )

    let totalChars = sections.join("\n").length
    for (const item of trainingItems) {
      const typeLabel =
        item.type === "texto" ? "Texto" : item.type === "website" ? "Website" : "Documento"
      const header = item.title ? `### ${item.title} (${typeLabel})` : `### ${typeLabel}`
      const itemBlock = `${header}\n${item.extracted_content}\n`

      if (totalChars + itemBlock.length > MAX_PROMPT_CHARS) {
        const remaining = MAX_PROMPT_CHARS - totalChars - header.length - 50
        if (remaining > 100) {
          sections.push(
            `${header}\n${item.extracted_content.substring(0, remaining)}...[truncado]\n`,
          )
        }
        break
      }

      sections.push(itemBlock)
      totalChars += itemBlock.length
    }
  } else {
    sections.push(
      "\n## Base de Conhecimento\nNENHUM produto ou informacao cadastrado ainda. Informe ao cliente que o catalogo ainda nao foi configurado.",
    )
  }

  return sections.join("\n")
}

async function recompileSystemPrompt(
  admin: ReturnType<typeof createClient>,
  userId: string,
  agentId: string,
  requestId: string,
): Promise<void> {
  try {
    const { data: agent } = await admin.rpc("zc_get_agent", {
      p_user_id: userId,
      p_agent_id: agentId,
    })
    if (!agent) return

    const { data: trainingItems } = await admin.rpc("zc_get_all_training_content", {
      p_user_id: userId,
      p_agent_id: agentId,
    })

    const items: TrainingContentItem[] = trainingItems ?? []
    const totalChars = items.reduce(
      (sum: number, i: TrainingContentItem) => sum + (i.char_count ?? 0),
      0,
    )

    const systemPrompt = compileSystemPrompt(agent as AgentForPrompt, items)

    await admin.rpc("zc_update_agent_system_prompt", {
      p_user_id: userId,
      p_agent_id: agentId,
      p_system_prompt: systemPrompt,
      p_total_training_chars: totalChars,
    })

    console.log(
      `[${requestId}] system prompt recompiled: ${systemPrompt.length} chars, ${items.length} items`,
    )
  } catch (err) {
    console.error(`[${requestId}] recompile error:`, err)
  }
}

// --- RAG: embedding helpers ---

async function generateEmbedding(text: string, requestId: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000),
        encoding_format: "float",
      }),
    })
    if (!res.ok) {
      console.error(`[${requestId}] embedding API error: ${res.status} ${await res.text()}`)
      return null
    }
    const data = await res.json()
    return (data.data?.[0]?.embedding ?? null) as number[] | null
  } catch (err) {
    console.error(`[${requestId}] embedding exception:`, err)
    return null
  }
}

async function storeTrainingItemEmbedding(
  admin: ReturnType<typeof createClient>,
  userId: string,
  trainingItemId: string,
  content: string,
  requestId: string,
): Promise<void> {
  const embedding = await generateEmbedding(content, requestId)
  if (!embedding) return
  const vectorStr = `[${embedding.join(",")}]`
  const { error } = await admin.rpc("zc_update_training_item_embedding", {
    p_user_id:          userId,
    p_training_item_id: trainingItemId,
    p_embedding:        vectorStr,
  })
  if (error) {
    console.error(`[${requestId}] store embedding error:`, error.message)
  } else {
    console.log(`[${requestId}] embedding stored for item ${trainingItemId.substring(0, 8)}`)
  }
}

// --- Agent handlers ---

async function handleListConversations(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const agentId = params.agentId as string
  if (!agentId) return errorResponse("agentId obrigatorio", requestId, 400)
  const { data, error } = await admin.rpc("zc_list_agent_conversations", {
    p_user_id: userId,
    p_agent_id: agentId,
    p_limit: 50,
  })
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ conversations: data ?? [] })
}

async function handleDeleteConversation(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const conversationId = params.conversationId as string
  if (!conversationId) return errorResponse("conversationId obrigatorio", requestId, 400)
  const { error } = await admin.rpc("zc_delete_conversation", {
    p_user_id:         userId,
    p_conversation_id: conversationId,
  })
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ success: true })
}

async function handleDashboardStats(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
) {
  const { data, error } = await admin.rpc("zc_get_dashboard_stats", { p_user_id: userId })
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse(data ?? { conversation_count: 0, catalog_count: 0 })
}

async function handleListAgents(
  admin: ReturnType<typeof createClient>,
  userId: string,
  requestId: string,
  log: (msg: string, ms?: number) => void,
) {
  const t0 = now()
  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_list_agents", { p_user_id: userId }),
    RPC_TIMEOUT_MS,
    "zc_list_agents",
    requestId,
  )
  log("rpc zc_list_agents", now() - t0)
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ agents: data ?? [] })
}

async function handleGetAgent(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_get_agent", {
      p_user_id: userId,
      p_agent_id: params.agentId as string,
    }),
    RPC_TIMEOUT_MS,
    "zc_get_agent",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)
  if (!data) return errorResponse("Agente não encontrado", requestId, 404)
  return jsonResponse({ agent: data })
}

async function handleCreateAgent(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_create_agent", {
      p_user_id: userId,
      p_name: params.name as string,
      p_objective: params.objective as string,
      p_company_description: (params.companyDescription as string) ?? "",
      p_transfer_to_human: (params.transferToHuman as boolean) ?? true,
      p_use_emojis: (params.useEmojis as boolean) ?? false,
      p_restrict_topics: (params.restrictTopics as boolean) ?? false,
      p_split_responses: (params.splitResponses as boolean) ?? false,
    }),
    RPC_TIMEOUT_MS,
    "zc_create_agent",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ agent: data })
}

async function handleUpdateAgent(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const rpcParams: Record<string, unknown> = {
    p_user_id: userId,
    p_agent_id: params.agentId as string,
  }
  if (params.name !== undefined) rpcParams.p_name = params.name
  if (params.objective !== undefined) rpcParams.p_objective = params.objective
  if (params.companyDescription !== undefined) rpcParams.p_company_description = params.companyDescription
  if (params.transferToHuman !== undefined) rpcParams.p_transfer_to_human = params.transferToHuman
  if (params.summaryOnTransfer !== undefined) rpcParams.p_summary_on_transfer = params.summaryOnTransfer
  if (params.useEmojis !== undefined) rpcParams.p_use_emojis = params.useEmojis
  if (params.signAgentName !== undefined) rpcParams.p_sign_agent_name = params.signAgentName
  if (params.restrictTopics !== undefined) rpcParams.p_restrict_topics = params.restrictTopics
  if (params.splitResponses !== undefined) rpcParams.p_split_responses = params.splitResponses
  if (params.allowReminders !== undefined) rpcParams.p_allow_reminders = params.allowReminders
  if (params.smartSearch !== undefined) rpcParams.p_smart_search = params.smartSearch
  if (params.timezone !== undefined) rpcParams.p_timezone = params.timezone
  if (params.responseTime !== undefined) rpcParams.p_response_time = params.responseTime
  if (params.interactionLimit !== undefined) rpcParams.p_interaction_limit = params.interactionLimit
  if (params.aiModel !== undefined) rpcParams.p_ai_model = params.aiModel

  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_update_agent", rpcParams),
    RPC_TIMEOUT_MS,
    "zc_update_agent",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ agent: data })
}

async function handleDeleteAgent(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { error } = await withTimeoutServer(
    admin.rpc("zc_delete_agent", {
      p_user_id: userId,
      p_agent_id: params.agentId as string,
    }),
    RPC_TIMEOUT_MS,
    "zc_delete_agent",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ success: true })
}

async function handleListTrainingItems(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_list_training_items", {
      p_user_id: userId,
      p_agent_id: params.agentId as string,
    }),
    RPC_TIMEOUT_MS,
    "zc_list_training_items",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)
  return jsonResponse({ items: data ?? [] })
}

async function handleCreateTrainingItem(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const agentId = params.agentId as string
  const itemType = params.type as string
  const content = (params.content as string) ?? ""

  // 1) Create DB record with processing status
  const rpcParams: Record<string, unknown> = {
    p_user_id: userId,
    p_agent_id: agentId,
    p_type: itemType,
    p_content: content,
    p_title: (params.title as string) ?? "",
    p_processing_status: "processing",
  }
  if (params.fileName) rpcParams.p_file_name = params.fileName
  if (params.fileSize) rpcParams.p_file_size = params.fileSize
  if (params.fileType) rpcParams.p_file_type = params.fileType
  if (params.storagePath) rpcParams.p_storage_path = params.storagePath

  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_create_training_item", rpcParams),
    RPC_TIMEOUT_MS,
    "zc_create_training_item",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)

  // 2) Extract content based on type
  let extractedContent = ""
  let processingStatus = "done"
  let processingError: string | null = null

  try {
    switch (itemType) {
      case "texto":
        extractedContent = content.trim()
        break
      case "website":
        extractedContent = await extractWebsite(content)
        break
      case "documento":
        extractedContent = await extractDocument(
          admin,
          params.storagePath as string,
          (params.fileName as string) ?? "document",
        )
        break
      case "video":
        processingStatus = "pending"
        processingError = "Extracao de conteudo de video sera suportada em breve."
        break
      default:
        processingStatus = "error"
        processingError = `Tipo desconhecido: ${itemType}`
    }
  } catch (err) {
    processingStatus = "error"
    processingError = err instanceof Error ? err.message : "Erro ao processar conteudo"
    console.error(`[${requestId}] extraction error for ${itemType}:`, processingError)
  }

  // 3) Update training item with extracted content
  const charCount = extractedContent.length
  const { data: updatedItem } = await admin.rpc("zc_update_training_item_content", {
    p_user_id: userId,
    p_training_item_id: data.id,
    p_extracted_content: extractedContent,
    p_processing_status: processingStatus,
    p_processing_error: processingError,
    p_char_count: charCount,
  })

  // 4) Generate embedding + recompile system prompt if extraction succeeded
  if (processingStatus === "done") {
    await storeTrainingItemEmbedding(admin, userId, data.id, extractedContent, requestId)
    await recompileSystemPrompt(admin, userId, agentId, requestId)
  }

  return jsonResponse({ item: updatedItem ?? { ...data, extracted_content: extractedContent, processing_status: processingStatus, processing_error: processingError, char_count: charCount } })
}

async function handleDeleteTrainingItem(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const { data, error } = await withTimeoutServer(
    admin.rpc("zc_delete_training_item", {
      p_user_id: userId,
      p_training_item_id: params.trainingItemId as string,
    }),
    RPC_TIMEOUT_MS,
    "zc_delete_training_item",
    requestId,
  )
  if (error) return errorResponse(error.message, requestId, 500)

  // Clean up storage file if this was a document with a stored file
  if (data?.storage_path) {
    try {
      await admin.storage
        .from("training-documents")
        .remove([data.storage_path])
    } catch (storageErr) {
      console.error(`[${requestId}] storage cleanup error:`, storageErr)
    }
  }

  // Recompile system prompt after deletion
  if (data?.agent_id) {
    await recompileSystemPrompt(admin, userId, data.agent_id, requestId)
  }

  return jsonResponse({ success: true })
}

async function handleReprocessTrainingItem(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const agentId = params.agentId as string
  const trainingItemId = params.trainingItemId as string

  // Fetch the specific item from the list
  const { data: items } = await admin.rpc("zc_list_training_items", {
    p_user_id: userId,
    p_agent_id: agentId,
  })

  // deno-lint-ignore no-explicit-any
  const item = (items ?? []).find((i: any) => i.id === trainingItemId)
  if (!item) return errorResponse("Item nao encontrado", requestId, 404)

  let extractedContent = ""
  let processingStatus = "done"
  let processingError: string | null = null

  try {
    switch (item.type) {
      case "texto":
        extractedContent = (item.content ?? "").trim()
        break
      case "website":
        extractedContent = await extractWebsite(item.content)
        break
      case "documento":
        extractedContent = await extractDocument(
          admin,
          item.storage_path,
          item.file_name ?? "document",
        )
        break
      default:
        processingStatus = "error"
        processingError = "Tipo nao suportado para reprocessamento"
    }
  } catch (err) {
    processingStatus = "error"
    processingError = err instanceof Error ? err.message : "Erro ao reprocessar"
    console.error(`[${requestId}] reprocess error:`, processingError)
  }

  const charCount = extractedContent.length
  const { data: updatedItem } = await admin.rpc("zc_update_training_item_content", {
    p_user_id: userId,
    p_training_item_id: trainingItemId,
    p_extracted_content: extractedContent,
    p_processing_status: processingStatus,
    p_processing_error: processingError,
    p_char_count: charCount,
  })

  if (processingStatus === "done") {
    await storeTrainingItemEmbedding(admin, userId, trainingItemId, extractedContent, requestId)
    await recompileSystemPrompt(admin, userId, agentId, requestId)
  }

  return jsonResponse({
    item: updatedItem,
    processing_status: processingStatus,
  })
}

async function handleCompilePrompt(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  const agentId = params.agentId as string
  await recompileSystemPrompt(admin, userId, agentId, requestId)
  return jsonResponse({ success: true })
}

// --- WhatsApp incoming message handler (called without user auth) ---

function parseResponseTimeMs(val: string | undefined): number {
  if (!val || val === "instant") return 0
  const match = val.match(/^(\d+)s?$/)
  return match ? parseInt(match[1], 10) * 1000 : 0
}

async function sendWhatsAppText(
  instanceToken: string,
  to: string,
  text: string,
  requestId: string,
) {
  // Strip WhatsApp suffix — uazapiGO /send/text expects plain number
  const number = to.replace(/@s\.whatsapp\.net$/, "").replace(/@c\.us$/, "").replace(/@lid$/, "")
  console.log(`[${requestId}] sendWhatsAppText to=${number} chars=${text.length}`)
  try {
    const res = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": instanceToken },
      body: JSON.stringify({ number, text }),
    })
    const resBody = await res.text()
    if (!res.ok) {
      console.error(`[${requestId}] sendWhatsAppText failed: ${res.status} ${resBody}`)
    } else {
      console.log(`[${requestId}] sendWhatsAppText ok: ${resBody.substring(0, 120)}`)
    }
  } catch (err) {
    console.error(`[${requestId}] sendWhatsAppText error:`, err)
  }
}

async function handleIncomingWhatsApp(
  admin: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  requestId: string,
): Promise<Response> {
  console.log(`[${requestId}] WH keys=${Object.keys(payload).join(",")} type=${payload.type ?? payload.EventType ?? payload.event ?? "(none)"}`)

  // ── Step 1: Parse payload ──────────────────────────────────────────────────
  // uazapiGO flat format (actual): { token, owner, instanceName, EventType, chat, chatSource, BaseUrl, message: { messageType, text, fromMe, sender, chatid, owner, ... } }
  // uazapiGO nested format (old):  { Token, type, body: { message: { ... } } }
  // Legacy format:                 { token, event, data: { key: { fromMe, remoteJid }, message: { conversation } } }

  let chatid = ""         // the JID to reply to (e.g. 5511999@s.whatsapp.net)
  let messageText = ""    // extracted plain text
  let ownerPhone = ""     // instance owner phone for fallback lookup
  let senderName = ""     // display name of the contact
  let instanceToken = (payload.token ?? payload.Token ?? payload.instance_token) as string | undefined

  // Accept owner phone from root level (flat format)
  const rootOwner = String(payload.owner ?? "").replace(/\D/g, "")

  // Resolve message object: flat root > nested body.message
  const bodyObj  = payload.body as Record<string, unknown> | undefined
  const uazMsg   = (payload.message as Record<string, unknown> | undefined)
                ?? (bodyObj?.message as Record<string, unknown> | undefined)

  if (uazMsg) {
    // ── uazapiGO format (flat or nested body) ──
    console.log(`[${requestId}] WH msg keys=${Object.keys(uazMsg).join(",")}`)
    const msgType = String(uazMsg.messageType ?? uazMsg.type ?? "")

    if (uazMsg.fromMe === true) {
      console.log(`[${requestId}] WH fromMe=true, skip`)
      return jsonResponse({ ok: true })
    }

    // Skip known non-text types; allow empty/unknown msgType (proceed and extract text)
    const TEXT_TYPES = ["Conversation", "ExtendedTextMessage", "conversation", "extendedTextMessage", "text", ""]
    if (msgType && !TEXT_TYPES.includes(msgType)) {
      console.log(`[${requestId}] WH msgType="${msgType}" not text, skip`)
      return jsonResponse({ ok: true })
    }

    // chatid: try message fields first, then root payload.chat
    chatid      = String(uazMsg.chatid ?? uazMsg.sender ?? payload.chat ?? "")
    // text: may be in message.text, message.body, or message.content
    messageText = String(uazMsg.text ?? uazMsg.body ?? uazMsg.content ?? "").trim()
    // ownerPhone: prefer message.owner, fallback to root payload.owner
    ownerPhone  = String(uazMsg.owner ?? "").replace(/\D/g, "") || rootOwner
    // senderName: display name of the contact who sent the message
    senderName  = String(uazMsg.senderName ?? uazMsg.pushName ?? "").trim()

    if (chatid.includes("@g.us")) {
      console.log(`[${requestId}] WH group message, skip`)
      return jsonResponse({ ok: true })
    }
    if (!messageText) {
      console.log(`[${requestId}] WH empty text (msgType="${msgType}"), skip`)
      return jsonResponse({ ok: true })
    }

  } else {
    // ── Legacy UAZAPI format ──
    const dataItem = (payload.data ?? (payload.messages as unknown[])?.[0]) as Record<string, unknown> | undefined
    if (!dataItem) {
      console.log(`[${requestId}] WH unknown payload — no message, body.message, or data field`)
      return jsonResponse({ ok: true })
    }

    const key = (dataItem.key ?? {}) as Record<string, unknown>
    if (key.fromMe === true) {
      console.log(`[${requestId}] WH fromMe=true (legacy), skip`)
      return jsonResponse({ ok: true })
    }

    chatid = String(key.remoteJid ?? "")
    if (!chatid || chatid.includes("@g.us")) {
      console.log(`[${requestId}] WH remoteJid=${chatid} (group/empty), skip`)
      return jsonResponse({ ok: true })
    }

    const msgObj  = (dataItem.message ?? {}) as Record<string, unknown>
    const extText = (msgObj.extendedTextMessage as Record<string, unknown> | undefined)?.text as string | undefined
    messageText   = ((msgObj.conversation as string | undefined) ?? extText ?? "").trim()

    if (!messageText) {
      console.log(`[${requestId}] WH empty text (legacy), skip`)
      return jsonResponse({ ok: true })
    }
  }

  console.log(`[${requestId}] WH chatid=${chatid} text="${messageText.substring(0, 50)}" token=${instanceToken?.substring(0, 8) ?? "MISSING"} owner=${ownerPhone || "(none)"}`)

  // ── Step 2: Identify the WhatsApp instance + active agent ─────────────────
  // Primary:  token from payload (requires sendToken: true in webhook config)
  // Fallback: owner phone stored in integrations_whatsapp.phone_number

  let agentRow: Record<string, unknown> | null = null
  let resolvedInstanceToken: string | undefined = instanceToken

  if (instanceToken) {
    const { data, error } = await admin.rpc("zc_get_agent_by_instance_token", {
      p_instance_token: instanceToken,
    })
    if (!error && data) {
      agentRow = data as Record<string, unknown>
    } else {
      console.log(`[${requestId}] WH token lookup miss: ${error?.message ?? "no data"}`)
    }
  }

  if (!agentRow && ownerPhone) {
    console.log(`[${requestId}] WH fallback — owner phone lookup: ${ownerPhone}`)
    const { data, error } = await admin.rpc("zc_get_agent_by_owner_phone", {
      p_owner_phone: ownerPhone,
    })
    if (!error && data) {
      agentRow = data as Record<string, unknown>
      resolvedInstanceToken = (agentRow.instance_token as string | undefined) ?? resolvedInstanceToken
    } else {
      console.log(`[${requestId}] WH owner lookup miss: ${error?.message ?? "no data"}`)
    }
  }

  if (!agentRow) {
    console.log(`[${requestId}] WH no agent found — giving up`)
    return jsonResponse({ ok: true })
  }

  const resolvedUserId = agentRow.resolved_user_id as string
  const agentId        = agentRow.id as string

  console.log(`[${requestId}] WH agent=${agentId.substring(0, 8)} user=${resolvedUserId?.substring(0, 8)}`)

  if (!resolvedInstanceToken) {
    console.log(`[${requestId}] WH no instance token to reply with, skip`)
    return jsonResponse({ ok: true })
  }

  // ── Step 3: RAG — embed query + retrieve relevant context ─────────────────
  let contextItems: TrainingContentItem[] = []

  const queryEmbedding = await generateEmbedding(messageText, requestId)
  if (queryEmbedding) {
    const { data: ragItems } = await admin.rpc("zc_search_training_content", {
      p_user_id:         resolvedUserId,
      p_agent_id:        agentId,
      p_query_embedding: `[${queryEmbedding.join(",")}]`,
      p_match_count:     6,
      p_min_similarity:  0.25,
    })
    if (ragItems && (ragItems as TrainingContentItem[]).length > 0) {
      contextItems = ragItems as TrainingContentItem[]
      console.log(`[${requestId}] RAG: ${contextItems.length} relevant chunks (top sim=${(contextItems[0] as unknown as Record<string,unknown>).similarity ?? "?"})`)
    }
  }

  // Fallback: use all training items when embeddings not yet generated
  if (contextItems.length === 0) {
    const { data: allItems } = await admin.rpc("zc_get_all_training_content", {
      p_user_id:  resolvedUserId,
      p_agent_id: agentId,
    })
    contextItems = (allItems ?? []) as TrainingContentItem[]
    console.log(`[${requestId}] RAG fallback: using all ${contextItems.length} training items`)
  }

  const systemPrompt = compileSystemPrompt(
    agentRow as unknown as AgentForPrompt,
    contextItems,
  )
  console.log(`[${requestId}] WH prompt compiled: ${systemPrompt.length} chars, ${contextItems.length} context items`)

  // ── Step 4: Conversation history ──────────────────────────────────────────
  const contactPhone = chatid
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@c\.us$/, "")
    .replace(/@lid$/, "")

  const { data: convData } = await admin.rpc("zc_get_conversation", {
    p_user_id: resolvedUserId,
    p_agent_id: agentId,
    p_contact_phone: contactPhone,
  })
  const history = ((convData?.messages ?? []) as Array<{ role: string; content: string }>).slice(-10)

  // Inject contact name as context if available
  const contactCtx = senderName
    ? `\n\n## Contato atual\nNome: ${senderName}`
    : ""
  const finalSystemPrompt = systemPrompt + contactCtx

  // ── Step 5: Apply response_time delay ─────────────────────────────────────
  const delayMs = parseResponseTimeMs(agentRow.response_time as string | undefined)
  if (delayMs > 0) {
    console.log(`[${requestId}] WH response_time delay: ${delayMs}ms`)
    await new Promise((r) => setTimeout(r, delayMs))
  }

  // ── Step 6: OpenAI ────────────────────────────────────────────────────────
  const aiModel = (agentRow.ai_model as string | undefined) || "gpt-4o-mini"
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: aiModel,
      messages: [
        { role: "system", content: finalSystemPrompt },
        ...history,
        { role: "user", content: messageText },
      ],
      max_tokens: 800,
      temperature: 0.65,
    }),
  })

  if (!aiRes.ok) {
    console.error(`[${requestId}] OpenAI error: ${aiRes.status} ${await aiRes.text()}`)
    return jsonResponse({ ok: true })
  }

  const aiData    = await aiRes.json()
  const replyText = (aiData.choices?.[0]?.message?.content as string | undefined)?.trim() ?? ""
  console.log(`[${requestId}] AI reply (${replyText.length} chars): "${replyText.substring(0, 80)}"`)
  if (!replyText) return jsonResponse({ ok: true })

  // ── Step 7: Send reply (split into parts if split_responses is on) ─────────
  const splitResponses = agentRow.split_responses as boolean | undefined
  if (splitResponses && replyText.includes("\n\n")) {
    const parts = replyText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    console.log(`[${requestId}] WH split_responses: ${parts.length} parts`)
    for (let i = 0; i < parts.length; i++) {
      await sendWhatsAppText(resolvedInstanceToken, chatid, parts[i], requestId)
      if (i < parts.length - 1) {
        await new Promise((r) => setTimeout(r, 600))
      }
    }
  } else {
    await sendWhatsAppText(resolvedInstanceToken, chatid, replyText, requestId)
  }

  // ── Step 8: Persist conversation history ──────────────────────────────────
  const updatedHistory = [
    ...history,
    { role: "user",      content: messageText },
    { role: "assistant", content: replyText   },
  ]
  await admin.rpc("zc_upsert_conversation", {
    p_user_id:       resolvedUserId,
    p_agent_id:      agentId,
    p_contact_phone: contactPhone,
    p_messages:      updatedHistory,
  })

  console.log(`[${requestId}] replied to ${contactPhone} via agent ${agentId.substring(0, 8)} (${replyText.length} chars, split=${!!splitResponses})`)
  return jsonResponse({ ok: true })
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

    // ── UAZAPI incoming webhook (unauthenticated) ──
    // Primary signal: no Authorization header + no action = webhook
    // (Authenticated calls always send Authorization; UAZAPI webhooks never do)
    const userAgent = req.headers.get("user-agent") ?? ""
    const hasAuthHeader = !!req.headers.get("authorization")
    const isWebhook = !action && (
      !hasAuthHeader ||
      userAgent.toLowerCase().includes("webhook") ||
      userAgent.toLowerCase().includes("uazapi") ||
      !!body.event ||
      !!body.type
    )
    if (isWebhook) {
      console.log(`[${requestId}] webhook detected ua="${userAgent}" hasAuth=${hasAuthHeader} type=${body.type ?? body.event ?? "(none)"}`)
      const webhookAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      return await handleIncomingWhatsApp(webhookAdmin, body, requestId)
    }

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
        return await handleWebhook(admin, user.id, params, requestId)
      case "disconnect":
        return await handleDisconnect(admin, user.id)
      case "delete":
        return await handleDelete(admin, user.id)
      case "meli-exchange":
        return await handleMeliExchange(admin, user.id, params, requestId)
      case "meli-disconnect":
        return await handleMeliDisconnect(admin, user.id)
      case "meli-items":
        return await handleMeliItems(admin, user.id, params, requestId)
      case "meli-sync-catalog":
        return await handleMeliSyncCatalog(admin, user.id, params, requestId)
      case "list-conversations":
        return await handleListConversations(admin, user.id, params, requestId)
      case "delete-conversation":
        return await handleDeleteConversation(admin, user.id, params, requestId)
      case "dashboard-stats":
        return await handleDashboardStats(admin, user.id, requestId)
      case "list-agents":
        return await handleListAgents(admin, user.id, requestId, log)
      case "get-agent":
        return await handleGetAgent(admin, user.id, params, requestId)
      case "create-agent":
        return await handleCreateAgent(admin, user.id, params, requestId)
      case "update-agent":
        return await handleUpdateAgent(admin, user.id, params, requestId)
      case "delete-agent":
        return await handleDeleteAgent(admin, user.id, params, requestId)
      case "list-training-items":
        return await handleListTrainingItems(admin, user.id, params, requestId)
      case "create-training-item":
        return await handleCreateTrainingItem(admin, user.id, params, requestId)
      case "delete-training-item":
        return await handleDeleteTrainingItem(admin, user.id, params, requestId)
      case "reprocess-training-item":
        return await handleReprocessTrainingItem(admin, user.id, params, requestId)
      case "compile-prompt":
        return await handleCompilePrompt(admin, user.id, params, requestId)
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
