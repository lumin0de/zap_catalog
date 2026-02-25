-- ============================================================
-- Ensure conversation RPCs exist only in zapcatalog schema
-- (Drop any accidental public.* definitions)
-- ============================================================

DROP FUNCTION IF EXISTS public.zc_get_conversation(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.zc_upsert_conversation(uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.zc_get_agent_by_instance_token(text);
