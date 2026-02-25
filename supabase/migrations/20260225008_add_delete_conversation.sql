-- ============================================================
-- RPC: delete a single conversation by ID (owner-scoped)
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_delete_conversation(
  p_user_id       uuid,
  p_conversation_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM zapcatalog.agent_conversations c
  USING zapcatalog.agents a
  WHERE c.id       = p_conversation_id
    AND c.agent_id = a.id
    AND a.user_id  = p_user_id;
END;
$$;
