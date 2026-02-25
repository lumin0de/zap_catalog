-- ============================================================
-- RPC: dashboard stats (conversation count + catalog count)
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_get_dashboard_stats(
  p_user_id uuid
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conversation_count bigint;
  v_catalog_count      bigint;
BEGIN
  -- Unique contacts attended across all user's agents
  SELECT COUNT(DISTINCT ac.contact_phone)
  INTO v_conversation_count
  FROM zapcatalog.agent_conversations ac
  JOIN zapcatalog.agents a ON a.id = ac.agent_id
  WHERE a.user_id = p_user_id;

  -- Products synced to agent (training items with status done)
  SELECT COUNT(*)
  INTO v_catalog_count
  FROM zapcatalog.training_items ti
  JOIN zapcatalog.agents a ON a.id = ti.agent_id
  WHERE a.user_id = p_user_id
    AND ti.processing_status = 'done';

  RETURN json_build_object(
    'conversation_count', v_conversation_count,
    'catalog_count',      v_catalog_count
  );
END;
$$;
