export type AgentObjective = "suporte" | "vendas" | "pessoal"

export type TrainingItemType = "texto" | "website" | "video" | "documento"

export interface Agent {
  id: string
  user_id: string
  name: string
  objective: AgentObjective
  company_description: string
  transfer_to_human: boolean
  summary_on_transfer: boolean
  use_emojis: boolean
  sign_agent_name: boolean
  restrict_topics: boolean
  split_responses: boolean
  allow_reminders: boolean
  smart_search: boolean
  timezone: string
  response_time: string
  interaction_limit: number
  is_active: boolean
  system_prompt: string
  system_prompt_updated_at: string | null
  total_training_chars: number
  created_at: string
  updated_at: string
}

export type ProcessingStatus = "pending" | "processing" | "done" | "error"

export interface AgentTrainingItem {
  id: string
  agent_id: string
  type: TrainingItemType
  content: string
  title: string
  file_name: string | null
  file_size: number | null
  file_type: string | null
  storage_path: string | null
  extracted_content: string
  processing_status: ProcessingStatus
  processing_error: string | null
  char_count: number
  created_at: string
}

export interface AgentWizardData {
  name: string
  objective: AgentObjective | null
  companyDescription: string
  transferToHuman: boolean
  useEmojis: boolean
  restrictTopics: boolean
  splitResponses: boolean
}
