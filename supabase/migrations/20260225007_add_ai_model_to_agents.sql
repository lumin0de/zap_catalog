-- ============================================================
-- Add ai_model column to agents + update zc_update_agent RPC
-- ============================================================

ALTER TABLE zapcatalog.agents
  ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'gpt-4o-mini';

-- Recreate zc_update_agent with p_ai_model parameter
CREATE OR REPLACE FUNCTION public.zc_update_agent(
  p_user_id uuid,
  p_agent_id uuid,
  p_name text DEFAULT NULL,
  p_objective text DEFAULT NULL,
  p_company_description text DEFAULT NULL,
  p_transfer_to_human boolean DEFAULT NULL,
  p_summary_on_transfer boolean DEFAULT NULL,
  p_use_emojis boolean DEFAULT NULL,
  p_sign_agent_name boolean DEFAULT NULL,
  p_restrict_topics boolean DEFAULT NULL,
  p_split_responses boolean DEFAULT NULL,
  p_allow_reminders boolean DEFAULT NULL,
  p_smart_search boolean DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_response_time text DEFAULT NULL,
  p_interaction_limit integer DEFAULT NULL,
  p_ai_model text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE zapcatalog.agents SET
    name              = COALESCE(p_name, name),
    objective         = COALESCE(p_objective, objective),
    company_description = COALESCE(p_company_description, company_description),
    transfer_to_human = COALESCE(p_transfer_to_human, transfer_to_human),
    summary_on_transfer = COALESCE(p_summary_on_transfer, summary_on_transfer),
    use_emojis        = COALESCE(p_use_emojis, use_emojis),
    sign_agent_name   = COALESCE(p_sign_agent_name, sign_agent_name),
    restrict_topics   = COALESCE(p_restrict_topics, restrict_topics),
    split_responses   = COALESCE(p_split_responses, split_responses),
    allow_reminders   = COALESCE(p_allow_reminders, allow_reminders),
    smart_search      = COALESCE(p_smart_search, smart_search),
    timezone          = COALESCE(p_timezone, timezone),
    response_time     = COALESCE(p_response_time, response_time),
    interaction_limit = COALESCE(p_interaction_limit, interaction_limit),
    ai_model          = COALESCE(p_ai_model, ai_model),
    updated_at        = now()
  WHERE id = p_agent_id AND user_id = p_user_id
  RETURNING to_jsonb(zapcatalog.agents.*) INTO result;
  RETURN result;
END;
$$;
