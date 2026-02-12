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
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
  refreshIntegrations: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    whatsapp: null,
    meli: null,
    loading: true,
    initialized: false,
  })

  // Prevent duplicate loadUserData calls (getSession + onAuthStateChange race)
  const loadingRef = useRef(false)

  const loadUserData = useCallback(async () => {
    // Skip if already loading (prevents duplicate calls from getSession + onAuthStateChange)
    if (loadingRef.current) return
    loadingRef.current = true

    try {
      // Use allSettled so partial failures don't discard successful results
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

      if (profileResult.status === "rejected") {
        console.error("[AuthContext] get-profile failed:", profileResult.reason)
      }
      if (integrationsResult.status === "rejected") {
        console.error("[AuthContext] get-integrations failed:", integrationsResult.reason)
      }

      setState((prev) => ({
        ...prev,
        profile: profile ?? prev.profile,
        whatsapp: whatsapp ?? prev.whatsapp,
        meli: meli ?? prev.meli,
        loading: false,
        initialized: true,
      }))
    } catch (err) {
      console.error("[AuthContext] Failed to load user data:", err)
      setState((prev) => ({ ...prev, loading: false, initialized: true }))
    } finally {
      loadingRef.current = false
    }
  }, [])

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
        // Skip if getSession already triggered loadUserData (initial SIGNED_IN event)
        if (!initialLoadDone || !loadingRef.current) {
          await loadUserData()
        }
      } else {
        setState((prev) => ({
          ...prev,
          profile: null,
          whatsapp: null,
          meli: null,
          loading: false,
          initialized: true,
        }))
      }
    })

    // Safety net: if after 20s loading is still true, force initialized
    const safetyTimer = setTimeout(() => {
      setState((prev) => {
        if (prev.loading || !prev.initialized) {
          console.warn("[AuthContext] Safety timeout: forcing initialized state after 20s")
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
