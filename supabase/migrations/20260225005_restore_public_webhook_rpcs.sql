-- ============================================================
-- Restore public-schema webhook RPCs
-- (20260225_drop_public_conversation_rpcs.sql ran after 20260225004
--  and accidentally dropped them — this migration restores them)
-- ============================================================

CREATE OR REPLACE FUNCTION public.zc_get_agent_by_instance_token(
  p_instance_token text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_agent   jsonb;
BEGIN
  SELECT w.user_id INTO v_user_id
  FROM zapcatalog.integrations_whatsapp w
  WHERE w.instance_token = p_instance_token
    AND w.is_connected    = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

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

CREATE OR REPLACE FUNCTION public.zc_get_agent_by_owner_phone(
  p_owner_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id        uuid;
  v_instance_token text;
  v_agent          jsonb;
BEGIN
  SELECT w.user_id, w.instance_token
  INTO v_user_id, v_instance_token
  FROM zapcatalog.integrations_whatsapp w
  WHERE regexp_replace(COALESCE(w.phone_number, ''), '[^0-9]', '', 'g')
          = regexp_replace(p_owner_phone, '[^0-9]', '', 'g')
    AND w.is_connected = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(a.*)
    || jsonb_build_object(
         'resolved_user_id', v_user_id,
         'instance_token',   v_instance_token
       )
  INTO v_agent
  FROM zapcatalog.agents a
  WHERE a.user_id   = v_user_id
    AND a.is_active = true
  ORDER BY a.updated_at DESC
  LIMIT 1;

  RETURN v_agent;
END;
$$;

CREATE OR REPLACE FUNCTION public.zc_get_conversation(
  p_user_id       uuid,
  p_agent_id      uuid,
  p_contact_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT to_jsonb(c.*)
    FROM zapcatalog.agent_conversations c
    WHERE c.user_id       = p_user_id
      AND c.agent_id      = p_agent_id
      AND c.contact_phone = p_contact_phone
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.zc_upsert_conversation(
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

CREATE OR REPLACE FUNCTION public.zc_list_agent_conversations(
  p_user_id  uuid,
  p_agent_id uuid,
  p_limit    int DEFAULT 30
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(c.*)::jsonb ORDER BY c.last_interaction_at DESC)
      FROM (
        SELECT
          id,
          contact_phone,
          messages,
          jsonb_array_length(messages) AS message_count,
          last_interaction_at,
          created_at
        FROM zapcatalog.agent_conversations
        WHERE user_id  = p_user_id
          AND agent_id = p_agent_id
        ORDER BY last_interaction_at DESC
        LIMIT p_limit
      ) c
    ),
    '[]'::jsonb
  );
END;
$$;
