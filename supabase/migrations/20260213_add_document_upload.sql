-- ============================================================
-- Add file metadata to training items + Storage bucket
-- ============================================================

-- Add file columns to training items
ALTER TABLE zapcatalog.agent_training_items
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS storage_path text;

-- Create storage bucket for training documents (100MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-documents',
  'training-documents',
  false,
  104857600,  -- 100MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: users can manage their own folder ({user_id}/...)
CREATE POLICY "Users upload own training docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'training-documents'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users read own training docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'training-documents'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "Users delete own training docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'training-documents'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Update create RPC to accept file metadata
CREATE OR REPLACE FUNCTION public.zc_create_training_item(
  p_user_id uuid,
  p_agent_id uuid,
  p_type text,
  p_content text,
  p_title text DEFAULT '',
  p_file_name text DEFAULT NULL,
  p_file_size bigint DEFAULT NULL,
  p_file_type text DEFAULT NULL,
  p_storage_path text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM zapcatalog.agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agente nao encontrado';
  END IF;

  INSERT INTO zapcatalog.agent_training_items (agent_id, type, content, title, file_name, file_size, file_type, storage_path)
  VALUES (p_agent_id, p_type, p_content, p_title, p_file_name, p_file_size, p_file_type, p_storage_path)
  RETURNING to_jsonb(zapcatalog.agent_training_items.*) INTO result;
  RETURN result;
END;
$$;

-- Update delete RPC to return the item before deleting (so we can cleanup storage)
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
