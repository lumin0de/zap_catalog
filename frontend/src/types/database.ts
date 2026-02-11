export interface Profile {
  full_name: string
  company_name: string
}

export interface WhatsAppIntegration {
  id: string
  user_id: string
  instance_name: string | null
  instance_token: string | null
  webhook_url: string | null
  webhook_enabled: boolean
  is_connected: boolean
  last_status_check: string | null
  created_at: string
  updated_at: string
}

export interface MeliIntegration {
  id: string
  user_id: string
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  seller_id: string | null
  nickname: string | null
  is_connected: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  payload: Record<string, unknown>
  created_at: string
}
