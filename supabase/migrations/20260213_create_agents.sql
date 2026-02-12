-- ============================================================
-- Agents + Training Items tables and RPCs
-- ============================================================

-- Table: agents
CREATE TABLE IF NOT EXISTS zapcatalog.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL CHECK (objective IN ('suporte', 'vendas', 'pessoal')),
  company_description text NOT NULL DEFAULT '',
  transfer_to_human boolean NOT NULL DEFAULT true,
  summary_on_transfer boolean NOT NULL DEFAULT false,
  use_emojis boolean NOT NULL DEFAULT false,
  sign_agent_name boolean NOT NULL DEFAULT false,
  restrict_topics boolean NOT NULL DEFAULT false,
  split_responses boolean NOT NULL DEFAULT false,
  allow_reminders boolean NOT NULL DEFAULT false,
  smart_search boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  response_time text NOT NULL DEFAULT 'instant',
  interaction_limit integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: agent_training_items
CREATE TABLE IF NOT EXISTS zapcatalog.agent_training_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES zapcatalog.agents(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('texto', 'website', 'video', 'documento')),
  content text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON zapcatalog.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_training_agent_id ON zapcatalog.agent_training_items(agent_id);

-- ============================================================
-- RPCs
-- ============================================================

-- List agents for a user
CREATE OR REPLACE FUNCTION public.zc_list_agents(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(a.*) ORDER BY a.created_at DESC)
     FROM zapcatalog.agents a
     WHERE a.user_id = p_user_id),
    '[]'::jsonb
  );
END;
$$;

-- Get single agent
CREATE OR REPLACE FUNCTION public.zc_get_agent(p_user_id uuid, p_agent_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT to_jsonb(a.*)
    FROM zapcatalog.agents a
    WHERE a.id = p_agent_id AND a.user_id = p_user_id
  );
END;
$$;

-- Create agent
CREATE OR REPLACE FUNCTION public.zc_create_agent(
  p_user_id uuid,
  p_name text,
  p_objective text,
  p_company_description text DEFAULT '',
  p_transfer_to_human boolean DEFAULT true,
  p_use_emojis boolean DEFAULT false,
  p_restrict_topics boolean DEFAULT false,
  p_split_responses boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO zapcatalog.agents (
    user_id, name, objective, company_description,
    transfer_to_human, use_emojis, restrict_topics, split_responses
  ) VALUES (
    p_user_id, p_name, p_objective, p_company_description,
    p_transfer_to_human, p_use_emojis, p_restrict_topics, p_split_responses
  )
  RETURNING to_jsonb(zapcatalog.agents.*) INTO result;
  RETURN result;
END;
$$;

-- Update agent
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
  p_interaction_limit integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE zapcatalog.agents SET
    name = COALESCE(p_name, name),
    objective = COALESCE(p_objective, objective),
    company_description = COALESCE(p_company_description, company_description),
    transfer_to_human = COALESCE(p_transfer_to_human, transfer_to_human),
    summary_on_transfer = COALESCE(p_summary_on_transfer, summary_on_transfer),
    use_emojis = COALESCE(p_use_emojis, use_emojis),
    sign_agent_name = COALESCE(p_sign_agent_name, sign_agent_name),
    restrict_topics = COALESCE(p_restrict_topics, restrict_topics),
    split_responses = COALESCE(p_split_responses, split_responses),
    allow_reminders = COALESCE(p_allow_reminders, allow_reminders),
    smart_search = COALESCE(p_smart_search, smart_search),
    timezone = COALESCE(p_timezone, timezone),
    response_time = COALESCE(p_response_time, response_time),
    interaction_limit = COALESCE(p_interaction_limit, interaction_limit),
    updated_at = now()
  WHERE id = p_agent_id AND user_id = p_user_id
  RETURNING to_jsonb(zapcatalog.agents.*) INTO result;
  RETURN result;
END;
$$;

-- Delete agent
CREATE OR REPLACE FUNCTION public.zc_delete_agent(p_user_id uuid, p_agent_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM zapcatalog.agents WHERE id = p_agent_id AND user_id = p_user_id;
END;
$$;

-- List training items
CREATE OR REPLACE FUNCTION public.zc_list_training_items(p_user_id uuid, p_agent_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.created_at DESC)
     FROM zapcatalog.agent_training_items t
     JOIN zapcatalog.agents a ON a.id = t.agent_id
     WHERE t.agent_id = p_agent_id AND a.user_id = p_user_id),
    '[]'::jsonb
  );
END;
$$;

-- Create training item
CREATE OR REPLACE FUNCTION public.zc_create_training_item(
  p_user_id uuid,
  p_agent_id uuid,
  p_type text,
  p_content text,
  p_title text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM zapcatalog.agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agente nao encontrado';
  END IF;

  INSERT INTO zapcatalog.agent_training_items (agent_id, type, content, title)
  VALUES (p_agent_id, p_type, p_content, p_title)
  RETURNING to_jsonb(zapcatalog.agent_training_items.*) INTO result;
  RETURN result;
END;
$$;

-- Delete training item
CREATE OR REPLACE FUNCTION public.zc_delete_training_item(p_user_id uuid, p_training_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM zapcatalog.agent_training_items t
  USING zapcatalog.agents a
  WHERE t.id = p_training_item_id
    AND t.agent_id = a.id
    AND a.user_id = p_user_id;
END;
$$;
