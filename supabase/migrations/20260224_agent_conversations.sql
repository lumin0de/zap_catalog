-- ============================================================
-- Agent conversation history (WhatsApp context per contact)
-- ============================================================

CREATE TABLE IF NOT EXISTS zapcatalog.agent_conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id             uuid NOT NULL REFERENCES zapcatalog.agents(id) ON DELETE CASCADE,
  contact_phone        text NOT NULL,
  -- Array of {role: "user"|"assistant", content: string}
  messages             jsonb NOT NULL DEFAULT '[]',
  last_interaction_at  timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agent_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_lookup
  ON zapcatalog.agent_conversations(user_id, agent_id, contact_phone);

-- ============================================================
-- Get conversation history (returns null if not found)
-- ============================================================
CREATE OR REPLACE FUNCTION zapcatalog.zc_get_conversation(
  p_user_id     uuid,
  p_agent_id    uuid,
  p_contact_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT to_jsonb(c.*)
    FROM zapcatalog.agent_conversations c
    WHERE c.user_id      = p_user_id
      AND c.agent_id     = p_agent_id
      AND c.contact_phone = p_contact_phone
  );
END;
$$;

-- ============================================================
-- Upsert conversation messages
-- ============================================================
CREATE OR REPLACE FUNCTION zapcatalog.zc_upsert_conversation(
  p_user_id       uuid,
  p_agent_id      uuid,
  p_contact_phone text,
  p_messages      jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO zapcatalog.agent_conversations
    (user_id, agent_id, contact_phone, messages, last_interaction_at)
  VALUES
    (p_user_id, p_agent_id, p_contact_phone, p_messages, now())
  ON CONFLICT (user_id, agent_id, contact_phone) DO UPDATE SET
    messages            = p_messages,
    last_interaction_at = now(),
    updated_at          = now();
END;
$$;

-- ============================================================
-- Get active agent by WhatsApp instance token (no auth needed —
-- used by the unauthenticated UAZAPI webhook handler)
-- Returns agent row + user_id as "resolved_user_id"
-- ============================================================
CREATE OR REPLACE FUNCTION zapcatalog.zc_get_agent_by_instance_token(
  p_instance_token text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_agent   jsonb;
BEGIN
  -- Identify user from connected WhatsApp integration
  SELECT w.user_id INTO v_user_id
  FROM zapcatalog.integrations_whatsapp w
  WHERE w.instance_token = p_instance_token
    AND w.is_connected    = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get most recently updated active agent for that user
  SELECT to_jsonb(a.*) || jsonb_build_object('resolved_user_id', v_user_id)
  INTO v_agent
  FROM zapcatalog.agents a
  WHERE a.user_id   = v_user_id
    AND a.is_active = true
  ORDER BY a.updated_at DESC
  LIMIT 1;

  RETURN v_agent;
END;
$$;
