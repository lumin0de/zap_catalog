import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
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

  const loadUserData = useCallback(async () => {
    try {
      const [profileRes, integrationsRes] = await Promise.all([
        callEdgeFunction<{ profile: Profile }>("get-profile"),
        callEdgeFunction<{ whatsapp: WhatsAppIntegration | null; meli: MeliIntegration | null }>(
          "get-integrations",
        ),
      ])
      setState((prev) => ({
        ...prev,
        profile: profileRes.profile,
        whatsapp: integrationsRes.whatsapp,
        meli: integrationsRes.meli,
        loading: false,
        initialized: true,
      }))
    } catch (err) {
      console.error("[AuthContext] Failed to load user data:", err)
      setState((prev) => ({ ...prev, loading: false, initialized: true }))
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
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
        await loadUserData()
      } else {
        setState((prev) => ({
          ...prev,
          profile: null,
          whatsapp: null,
          meli: null,
          loading: false,
        }))
      }

      setState((prev) => ({ ...prev, initialized: true }))
    })

    return () => subscription.unsubscribe()
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
