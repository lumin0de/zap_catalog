import { supabase } from "@/config/supabase"
import type { EdgeFunctionAction } from "@/types/api"

const DEFAULT_TIMEOUT_MS = 15_000

/** Single-flight: one in-flight request per action at a time */
const inflight = new Map<string, Promise<{ data: unknown; error: unknown }>>()

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[${label}] Timeout após ${ms / 1000}s`)),
      ms,
    )
    promise.then(
      (val) => {
        clearTimeout(timer)
        resolve(val)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export interface CallEdgeFunctionError extends Error {
  status?: number
  request_id?: string
}

export async function callEdgeFunction<T = unknown>(
  action: EdgeFunctionAction,
  payload?: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const key = action + (payload ? JSON.stringify(payload) : "")
  let promise = inflight.get(key)
  if (!promise) {
    promise = (async () => {
      const start = Date.now()
      if (typeof window !== "undefined") {
        const { data: sessionData } = await supabase.auth.getSession()
        console.log(`[callEdgeFunction] action=${action} hasSession=${!!sessionData?.session}`)
      }
      const result = await withTimeout(
        supabase.functions.invoke("uazapi-proxy", {
          body: { action, ...payload },
        }),
        timeoutMs,
        `callEdgeFunction(${action})`,
      )
      const duration = Date.now() - start
      console.log(`[callEdgeFunction] action=${action} duration=${duration}ms`)
      return result
    })()
    inflight.set(key, promise)
    promise.finally(() => inflight.delete(key))
  }

  const { data, error } = await promise

  if (error) {
    let message = (error as { message?: string }).message ?? "Edge function call failed"
    let requestId: string | undefined
    try {
      const ctx = (error as Record<string, unknown>).context
      if (ctx && typeof ctx === "object") {
        const obj = ctx as Record<string, unknown>
        if ("error" in obj && typeof obj.error === "string") message = obj.error
        if ("request_id" in obj && typeof obj.request_id === "string") requestId = obj.request_id
      }
    } catch {
      // ignore
    }
    if (data && typeof data === "object" && "request_id" in data) {
      requestId = (data as Record<string, string>).request_id
    }
    console.error(`[callEdgeFunction] action=${action} error=`, message, requestId ? `request_id=${requestId}` : "")
    const err = new Error(message) as CallEdgeFunctionError
    if (requestId) err.request_id = requestId
    throw err
  }

  if (data && typeof data === "object" && "error" in data && (data as Record<string, unknown>).error) {
    const msg = (data as Record<string, string>).error ?? "Unknown error"
    const requestId = (data as Record<string, string>).request_id
    console.error(`[callEdgeFunction] action=${action} data.error=`, msg, requestId ? `request_id=${requestId}` : "")
    const err = new Error(msg) as CallEdgeFunctionError
    if (requestId) err.request_id = requestId
    throw err
  }

  return data as T
}
