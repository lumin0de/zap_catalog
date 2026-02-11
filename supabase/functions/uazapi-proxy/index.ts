import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const UAZAPI_BASE_URL = "https://luminode.uazapi.com"
const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN")!
const MELI_CLIENT_ID = Deno.env.get("MELI_CLIENT_ID")!
const MELI_CLIENT_SECRET = Deno.env.get("MELI_CLIENT_SECRET")!
const MELI_REDIRECT_URI = Deno.env.get("MELI_REDIRECT_URI")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// --- Handlers ---

async function handleGetProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await admin.rpc("zc_get_profile", {
    p_user_id: userId,
  })
  if (error) {
    console.error("get-profile RPC error:", error)
    return jsonResponse({ error: error.message }, 500)
  }
  return jsonResponse({ profile: data })
}

async function handleUpdateProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc("zc_update_profile", {
    p_user_id: userId,
    p_full_name: params.fullName as string,
    p_company_name: (params.companyName as string) ?? "",
  })
  if (error) {
    console.error("update-profile RPC error:", error)
    return jsonResponse({ error: error.message }, 500)
  }
  return jsonResponse({ profile: data })
}

async function handleGetIntegrations(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  const [whatsappRes, meliRes] = await Promise.all([
    admin.rpc("zc_get_whatsapp", { p_user_id: userId }),
    admin.rpc("zc_get_meli", { p_user_id: userId }),
  ])

  if (whatsappRes.error) {
    console.error("get-whatsapp RPC error:", whatsappRes.error)
  }
  if (meliRes.error) {
    console.error("get-meli RPC error:", meliRes.error)
  }

  let whatsapp = whatsappRes.data ?? null

  // Verify WhatsApp instance still exists in UAZAPI
  if (whatsapp?.instance_token) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const statusRes = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
        method: "GET",
        headers: { Token: whatsapp.instance_token },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!statusRes.ok) {
        // Instance no longer exists in UAZAPI — clean up DB
        console.log(
          `UAZAPI status returned ${statusRes.status} for instance ${whatsapp.instance_name}, cleaning up DB`,
        )
        await admin.rpc("zc_delete_whatsapp", { p_user_id: userId })
        whatsapp = null
      } else {
        // Update connected status from UAZAPI
        const statusData = await statusRes.json()
        const isConnected =
          statusData.status?.connected === true ||
          statusData.instance?.status === "connected" ||
          statusData.connected === true

        if (whatsapp.is_connected !== isConnected) {
          await admin.rpc("zc_update_whatsapp_status", {
            p_user_id: userId,
            p_is_connected: isConnected,
          })
          whatsapp = { ...whatsapp, is_connected: isConnected }
        }
      }
    } catch (err) {
      // Network error or timeout — keep existing DB data, don't block the load
      console.warn("UAZAPI status check during get-integrations failed:", err)
    }
  }

  // Proactively refresh ML token if close to expiry
  let meli = meliRes.data ?? null
  if (meli?.refresh_token && meli?.token_expires_at) {
    const expiresAt = new Date(meli.token_expires_at)
    const now = new Date()
    if (expiresAt.getTime() - now.getTime() < 30 * 60 * 1000) {
      try {
        await ensureMeliToken(admin, userId)
        const refreshed = await admin.rpc("zc_get_meli", { p_user_id: userId })
        meli = refreshed.data ?? meli
      } catch {
        console.warn("[meli] Proactive token refresh failed during get-integrations")
      }
    }
  }

  return jsonResponse({
    whatsapp,
    meli,
  })
}

async function handleInit(
  admin: ReturnType<typeof createClient>,
  userId: string,
) {
  // First, clean up any existing instance
  const { data: existing } = await admin.rpc("zc_get_whatsapp", {
    p_user_id: userId,
  })
  if (existing?.instance_token) {
    console.log("Cleaning up existing instance before init:", existing.instance_name)
    try {
      await fetch(`${UAZAPI_BASE_URL}/instance/delete`, {
        method: "GET",
        headers: { Token: existing.instance_token },
      })
    } catch {
      // Ignore cleanup errors
    }
    await admin.rpc("zc_delete_whatsapp", { p_user_id: userId })
  }

  const instanceName = `zc_${userId.substring(0, 8)}`

  console.log("Calling UAZAPI init with instance_name:", instanceName)

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
    console.error("UAZAPI init failed:", uazapiRes.status, err)
    return jsonResponse({ error: `Falha ao criar instância UAZAPI: ${err}` }, 502)
  }

  const uazapiData = await uazapiRes.json()
  console.log("UAZAPI init response keys:", Object.keys(uazapiData))

  // UAZAPI returns token inside instance object
  const instanceToken =
    uazapiData.instance?.token ??
    uazapiData.token ??
    uazapiData.instance_token ??
    ""
  const resolvedName = uazapiData.instance?.name ?? instanceName

  if (!instanceToken) {
    console.error("UAZAPI init response missing token:", JSON.stringify(uazapiData))
    return jsonResponse({ error: "UAZAPI não retornou token da instância" }, 502)
  }

  console.log("Instance created:", resolvedName, "token length:", instanceToken.length)

  const { error } = await admin.rpc("zc_upsert_whatsapp", {
    p_user_id: userId,
    p_instance_name: resolvedName,
    p_instance_token: instanceToken,
    p_is_connected: false,
  })

  if (error) {
    console.error("zc_upsert_whatsapp error:", error)
    return jsonResponse({ error: error.message }, 500)
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

  console.log("Calling UAZAPI connect for instance:", whatsapp.instance_name)

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
    console.error("UAZAPI connect failed:", uazapiRes.status, err)
    return jsonResponse({ error: `Falha ao gerar QR code: ${err}` }, 502)
  }

  const data = await uazapiRes.json()

  // IMPORTANT: data.connected and data.status?.connected from the /instance/connect
  // endpoint do NOT mean WhatsApp is paired. They indicate the instance is active in UAZAPI.
  // The ONLY reliable indicator is data.instance?.status === "connected".
  const instanceStatus = data.instance?.status ?? "connecting"
  const isConnected = instanceStatus === "connected"
  const qrcode = data.instance?.qrcode ?? ""
  const pairingCode = data.instance?.paircode ?? ""

  console.log("UAZAPI connect:", {
    isConnected,
    hasQrcode: !!qrcode,
    instanceStatus,
    rawConnected: data.connected,
    rawStatusConnected: data.status?.connected,
  })

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
    console.error("UAZAPI status failed:", uazapiRes.status, err)
    return jsonResponse({ error: "Falha ao verificar status" }, 502)
  }

  const data = await uazapiRes.json()

  // UAZAPI status response structure:
  // { instance: { status: "connected"|"disconnected"|... }, status: { connected: bool, loggedIn: bool } }
  const isConnected =
    data.status?.connected === true ||
    data.instance?.status === "connected" ||
    data.connected === true

  console.log("Status check:", {
    "data.status?.connected": data.status?.connected,
    "data.instance?.status": data.instance?.status,
    "data.connected": data.connected,
    isConnected,
  })

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

  // Logout from UAZAPI (best-effort, uses GET per UAZAPI API)
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
    // Ignore logout errors
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

  // Delete from UAZAPI (best-effort, uses GET per UAZAPI API)
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
      // Ignore UAZAPI deletion errors
    }
  }

  // Always clean up local DB record
  const { error } = await admin.rpc("zc_delete_whatsapp", { p_user_id: userId })
  if (error) {
    console.error("zc_delete_whatsapp error:", error)
    // Still return success - best-effort cleanup
  }

  return jsonResponse({ success: true })
}

// --- Mercado Livre handlers ---

async function ensureMeliToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ access_token: string; seller_id: string }> {
  const { data: meli, error } = await admin.rpc("zc_get_meli", { p_user_id: userId })
  if (error || !meli?.refresh_token) {
    throw new Error("Nenhuma integração Mercado Livre encontrada")
  }

  const expiresAt = new Date(meli.token_expires_at)
  const now = new Date()
  const thirtyMinutes = 30 * 60 * 1000

  if (expiresAt.getTime() - now.getTime() > thirtyMinutes) {
    return { access_token: meli.access_token, seller_id: meli.seller_id }
  }

  console.log(`[meli] Refreshing token for user ${userId.substring(0, 8)}`)
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
) {
  const code = params.code as string
  if (!code) {
    return jsonResponse({ error: "Código de autorização não fornecido" }, 400)
  }

  console.log(`[meli] Exchanging code for user ${userId.substring(0, 8)}`)

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
    return jsonResponse({ error: "Falha ao trocar código por tokens do Mercado Livre" }, 502)
  }

  const tokenData = await tokenRes.json()
  console.log("[meli] Token exchange success, user_id:", tokenData.user_id)

  const userRes = await fetch("https://api.mercadolibre.com/users/me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/json",
    },
  })

  let nickname = ""
  if (userRes.ok) {
    const userData = await userRes.json()
    nickname = userData.nickname ?? ""
    console.log("[meli] User info:", { nickname, id: userData.id })
  } else {
    console.warn("[meli] Failed to fetch user info:", userRes.status)
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
    return jsonResponse({ error: dbError.message }, 500)
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
  console.log(`[meli] Disconnecting user ${userId.substring(0, 8)}`)
  const { error } = await admin.rpc("zc_delete_meli", { p_user_id: userId })
  if (error) {
    console.error("[meli] delete error:", error)
  }
  return jsonResponse({ success: true })
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401)
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    // Parse request
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400)
    }

    const { action, ...params } = body

    console.log(`[uazapi-proxy] action=${action} user=${user.id.substring(0, 8)}`)

    // Admin client for DB operations
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    switch (action) {
      case "get-profile":
        return await handleGetProfile(admin, user.id)
      case "update-profile":
        return await handleUpdateProfile(admin, user.id, params)
      case "get-integrations":
        return await handleGetIntegrations(admin, user.id)
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
        return await handleMeliExchange(admin, user.id, params)
      case "meli-disconnect":
        return await handleMeliDisconnect(admin, user.id)
      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400)
    }
  } catch (err) {
    console.error("Edge function unhandled error:", err)
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Erro interno do servidor" },
      500,
    )
  }
})
