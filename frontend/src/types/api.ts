export type EdgeFunctionAction =
  | "ping"
  | "get-profile"
  | "update-profile"
  | "get-integrations"
  | "init"
  | "connect"
  | "status"
  | "webhook"
  | "disconnect"
  | "delete"
  | "meli-exchange"
  | "meli-disconnect"
  | "list-agents"
  | "get-agent"
  | "create-agent"
  | "update-agent"
  | "delete-agent"
  | "list-training-items"
  | "create-training-item"
  | "delete-training-item"

export interface ConnectResponse {
  qrcode: string
  pairingCode?: string
  connected: boolean
  status: string
}

export interface StatusResponse {
  connected: boolean
  phone_number?: string
  name?: string
}
