import { supabase } from "@/config/supabase"
import type { EdgeFunctionAction } from "@/types/api"

const DEFAULT_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[${label}] Timeout após ${ms / 1000}s`)),
      ms,
    )
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

export async function callEdgeFunction<T = unknown>(
  action: EdgeFunctionAction,
  payload?: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("uazapi-proxy", {
      body: { action, ...payload },
    }),
    timeoutMs,
    `callEdgeFunction(${action})`,
  )

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
