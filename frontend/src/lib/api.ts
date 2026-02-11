import { supabase } from "@/config/supabase"
import type { EdgeFunctionAction } from "@/types/api"

export async function callEdgeFunction<T = unknown>(
  action: EdgeFunctionAction,
  payload?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
    body: { action, ...payload },
  })

  if (error) {
    // error.context contains the parsed JSON body from the edge function
    let message = error.message || "Edge function call failed"
    try {
      const ctx = (error as Record<string, unknown>).context
      if (ctx && typeof ctx === "object" && "error" in (ctx as Record<string, unknown>)) {
        message = (ctx as Record<string, string>).error
      }
    } catch {
      // Could not extract context, use default message
    }
    console.error(`[callEdgeFunction] action=${action} error:`, message)
    throw new Error(message)
  }

  if (data?.error) {
    console.error(`[callEdgeFunction] action=${action} data.error:`, data.error)
    throw new Error(data.error)
  }

  return data as T
}
