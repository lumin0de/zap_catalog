-- ============================================================
-- Knowledge Base: extracted content + system prompt compilation
-- ============================================================

-- Add extraction columns to training items
ALTER TABLE zapcatalog.agent_training_items
  ADD COLUMN IF NOT EXISTS extracted_content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'done', 'error')),
  ADD COLUMN IF NOT EXISTS processing_error text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS char_count integer DEFAULT 0;

-- Add system prompt columns to agents
ALTER TABLE zapcatalog.agents
  ADD COLUMN IF NOT EXISTS system_prompt text DEFAULT '',
  ADD COLUMN IF NOT EXISTS system_prompt_updated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_training_chars integer DEFAULT 0;

-- ============================================================
-- Update create training item RPC to accept processing_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_create_training_item(
  p_user_id uuid,
  p_agent_id uuid,
  p_type text,
  p_content text,
  p_title text DEFAULT '',
  p_file_name text DEFAULT NULL,
  p_file_size bigint DEFAULT NULL,
  p_file_type text DEFAULT NULL,
  p_storage_path text DEFAULT NULL,
  p_processing_status text DEFAULT 'pending'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM zapcatalog.agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agente nao encontrado';
  END IF;

  INSERT INTO zapcatalog.agent_training_items (
    agent_id, type, content, title,
    file_name, file_size, file_type, storage_path,
    processing_status
  ) VALUES (
    p_agent_id, p_type, p_content, p_title,
    p_file_name, p_file_size, p_file_type, p_storage_path,
    p_processing_status
  )
  RETURNING to_jsonb(zapcatalog.agent_training_items.*) INTO result;
  RETURN result;
END;
$$;

-- ============================================================
-- Update training item content after extraction
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_update_training_item_content(
  p_user_id uuid,
  p_training_item_id uuid,
  p_extracted_content text,
  p_processing_status text,
  p_processing_error text DEFAULT NULL,
  p_char_count integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE zapcatalog.agent_training_items SET
    extracted_content = p_extracted_content,
    processing_status = p_processing_status,
    processing_error = p_processing_error,
    char_count = p_char_count
  WHERE id = p_training_item_id
    AND agent_id IN (SELECT id FROM zapcatalog.agents WHERE user_id = p_user_id)
  RETURNING to_jsonb(zapcatalog.agent_training_items.*) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Item nao encontrado ou sem permissao';
  END IF;

  RETURN result;
END;
$$;

-- ============================================================
-- Update agent system prompt
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_update_agent_system_prompt(
  p_user_id uuid,
  p_agent_id uuid,
  p_system_prompt text,
  p_total_training_chars integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE zapcatalog.agents SET
    system_prompt = p_system_prompt,
    system_prompt_updated_at = now(),
    total_training_chars = p_total_training_chars,
    updated_at = now()
  WHERE id = p_agent_id AND user_id = p_user_id
  RETURNING to_jsonb(zapcatalog.agents.*) INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Agente nao encontrado ou sem permissao';
  END IF;

  RETURN result;
END;
$$;

-- ============================================================
-- Get all processed training content for prompt compilation
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_get_all_training_content(
  p_user_id uuid,
  p_agent_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(t.*) ORDER BY t.created_at ASC)
     FROM (
       SELECT id, type, title, extracted_content, char_count
       FROM zapcatalog.agent_training_items
       WHERE agent_id = p_agent_id
         AND agent_id IN (SELECT id FROM zapcatalog.agents WHERE user_id = p_user_id)
         AND processing_status = 'done'
         AND char_count > 0
     ) t),
    '[]'::jsonb
  );
END;
$$;

-- ============================================================
-- Update delete training item to also return agent_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_delete_training_item(p_user_id uuid, p_training_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT to_jsonb(t.*) INTO result
  FROM zapcatalog.agent_training_items t
  JOIN zapcatalog.agents a ON a.id = t.agent_id
  WHERE t.id = p_training_item_id AND a.user_id = p_user_id;

  DELETE FROM zapcatalog.agent_training_items t
  USING zapcatalog.agents a
  WHERE t.id = p_training_item_id
    AND t.agent_id = a.id
    AND a.user_id = p_user_id;

  RETURN result;
END;
$$;
