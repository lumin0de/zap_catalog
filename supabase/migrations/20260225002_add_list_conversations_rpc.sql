-- ============================================================
-- List recent agent conversations (for monitoring panel)
-- ============================================================
CREATE OR REPLACE FUNCTION zapcatalog.zc_list_agent_conversations(
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
