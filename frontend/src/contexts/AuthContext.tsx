import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import { supabase } from "@/config/supabase"
import { callEdgeFunction } from "@/lib/api"
import type { Session, User } from "@supabase/supabase-js"
import type { Profile, WhatsAppIntegration, MeliIntegration } from "@/types/database"

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  whatsapp: WhatsAppIntegration | null
  meli: MeliIntegration | null
  loading: boolean
  initialized: boolean
  /** "unavailable" when edge times out / 504; "unauthorized" after 401 */
  loadError: "unavailable" | "unauthorized" | null
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
  refreshIntegrations: () => Promise<void>
  retryLoadUserData: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MAX_LOAD_ATTEMPTS = 2
const BACKOFF_MS = [2_000, 5_000]

function isTimeoutOr504(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("Timeout") || msg.includes("504")
}

function is401(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("Unauthorized") || msg.includes("401")
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    whatsapp: null,
    meli: null,
    loading: true,
    initialized: false,
    loadError: null,
  })

  const initializingRef = useRef(false)
  const loadAttemptRef = useRef(0)
  const lastLoadFailureRef = useRef<number>(0)
  const FAILURE_COOLDOWN_MS = 10_000

  const loadUserData = useCallback(async () => {
    if (initializingRef.current) return
    initializingRef.current = true
    loadAttemptRef.current += 1
    const attempt = loadAttemptRef.current

    setState((prev) => ({ ...prev, loadError: null }))

    try {
      const [profileResult, integrationsResult] = await Promise.allSettled([
        callEdgeFunction<{ profile: Profile }>("get-profile"),
        callEdgeFunction<{ whatsapp: WhatsAppIntegration | null; meli: MeliIntegration | null }>(
          "get-integrations",
        ),
      ])

      const profile =
        profileResult.status === "fulfilled" ? profileResult.value.profile : null
      const whatsapp =
        integrationsResult.status === "fulfilled" ? integrationsResult.value.whatsapp : null
      const meli =
        integrationsResult.status === "fulfilled" ? integrationsResult.value.meli : null

      const profileRejected = profileResult.status === "rejected"
      const integrationsRejected = integrationsResult.status === "rejected"
      const profileErr = profileRejected ? profileResult.reason : null
      const integrationsErr = integrationsRejected ? integrationsResult.reason : null

      if (profileRejected && profileErr && is401(profileErr)) {
        lastLoadFailureRef.current = Date.now()
        setState((prev) => ({
          ...prev,
          loading: false,
          initialized: true,
          loadError: "unauthorized",
        }))
        initializingRef.current = false
        return
      }
      if (integrationsRejected && integrationsErr && is401(integrationsErr)) {
        lastLoadFailureRef.current = Date.now()
        setState((prev) => ({
          ...prev,
          loading: false,
          initialized: true,
          loadError: "unauthorized",
        }))
        initializingRef.current = false
        return
      }

      if (profileRejected) {
        console.error("[AuthContext] get-profile failed (attempt " + attempt + "):", profileErr)
      }
      if (integrationsRejected) {
        console.error("[AuthContext] get-integrations failed (attempt " + attempt + "):", integrationsErr)
      }

      const anyTimeout = (profileRejected && profileErr && isTimeoutOr504(profileErr)) ||
        (integrationsRejected && integrationsErr && isTimeoutOr504(integrationsErr))

      if (anyTimeout && attempt < MAX_LOAD_ATTEMPTS) {
        const delayMs = BACKOFF_MS[attempt - 1] ?? 2000
        console.warn(`[AuthContext] timeout on attempt ${attempt}, retry in ${delayMs}ms`)
        setState((prev) => ({ ...prev, loading: false, initialized: true }))
        setTimeout(() => loadUserData(), delayMs)
        initializingRef.current = false
        return
      }

      setState((prev) => ({
        ...prev,
        profile: profile ?? prev.profile,
        whatsapp: whatsapp ?? prev.whatsapp,
        meli: meli ?? prev.meli,
        loading: false,
        initialized: true,
        loadError: anyTimeout && attempt >= MAX_LOAD_ATTEMPTS ? "unavailable" : null,
      }))
    } catch (err) {
      console.error("[AuthContext] loadUserData error:", err)
      lastLoadFailureRef.current = Date.now()
      const timeoutOr504 = isTimeoutOr504(err)
      const unauthorized = is401(err)
      setState((prev) => ({
        ...prev,
        loading: false,
        initialized: true,
        loadError: unauthorized ? "unauthorized" : timeoutOr504 && attempt >= MAX_LOAD_ATTEMPTS ? "unavailable" : null,
      }))
    } finally {
      initializingRef.current = false
    }
  }, [])

  const retryLoadUserData = useCallback(() => {
    loadAttemptRef.current = 0
    loadUserData()
  }, [loadUserData])

  useEffect(() => {
    let initialLoadDone = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      initialLoadDone = true
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }))

      if (session?.user) {
        loadAttemptRef.current = 0
        loadUserData()
      } else {
        setState((prev) => ({ ...prev, loading: false, initialized: true }))
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }))

      if (session?.user) {
        const now = Date.now()
        const cooldownPassed = now - lastLoadFailureRef.current > FAILURE_COOLDOWN_MS
        const shouldLoad = !initialLoadDone || cooldownPassed
        if (shouldLoad && !initializingRef.current) {
          loadUserData()
        }
      } else {
        loadAttemptRef.current = 0
        lastLoadFailureRef.current = 0
        setState((prev) => ({
          ...prev,
          profile: null,
          whatsapp: null,
          meli: null,
          loading: false,
          initialized: true,
          loadError: null,
        }))
      }
    })

    const safetyTimer = setTimeout(() => {
      setState((prev) => {
        if (prev.loading || !prev.initialized) {
          console.warn("[AuthContext] Safety timeout: forcing initialized after 20s")
          return { ...prev, loading: false, initialized: true }
        }
        return prev
      })
    }, 20_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
  }, [loadUserData])

  const didUnauthorizedRef = useRef(false)
  useEffect(() => {
    if (state.loadError !== "unauthorized" || didUnauthorizedRef.current) return
    didUnauthorizedRef.current = true
    supabase.auth.signOut().then(() => {
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        profile: null,
        whatsapp: null,
        meli: null,
        loadError: null,
      }))
    })
  }, [state.loadError])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/app/settings`,
    })
    if (error) throw error
  }

  const refreshProfile = useCallback(async () => {
    const res = await callEdgeFunction<{ profile: Profile }>("get-profile")
    setState((prev) => ({ ...prev, profile: res.profile }))
  }, [])

  const refreshIntegrations = useCallback(async () => {
    const res = await callEdgeFunction<{
      whatsapp: WhatsAppIntegration | null
      meli: MeliIntegration | null
    }>("get-integrations")
    setState((prev) => ({
      ...prev,
      whatsapp: res.whatsapp,
      meli: res.meli,
    }))
  }, [])

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshProfile,
        refreshIntegrations,
        retryLoadUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
