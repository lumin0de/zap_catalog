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
