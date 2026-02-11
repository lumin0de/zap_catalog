const MELI_AUTH_URL = "https://auth.mercadolivre.com.br/authorization"
const STATE_KEY = "meli_oauth_state"

export function startMeliOAuth(): void {
  const clientId = import.meta.env.VITE_MELI_CLIENT_ID
  const redirectUri = import.meta.env.VITE_MELI_REDIRECT_URI

  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  })

  window.location.href = `${MELI_AUTH_URL}?${params.toString()}`
}

export function validateMeliOAuthState(stateParam: string | null): boolean {
  if (!stateParam) return false
  const stored = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return stored === stateParam
}
