-- ============================================================
-- RAG: pgvector embeddings for semantic knowledge retrieval
-- Adds embedding column to agent_training_items and exposes
-- search + upsert-embedding RPCs in the public schema.
-- ============================================================

-- Enable pgvector extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (text-embedding-3-small = 1536 dims)
ALTER TABLE zapcatalog.agent_training_items
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for fast cosine-similarity search
-- (works well on small-to-medium tables, no minimum row requirement)
CREATE INDEX IF NOT EXISTS agent_training_items_embedding_idx
  ON zapcatalog.agent_training_items
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- RPC: semantic search over training items
-- Returns top p_match_count items above p_min_similarity
-- Falls back gracefully when no embeddings exist yet
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_search_training_content(
  p_user_id         uuid,
  p_agent_id        uuid,
  p_query_embedding vector(1536),
  p_match_count     int   DEFAULT 6,
  p_min_similarity  float DEFAULT 0.25
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(t.*)::jsonb)
      FROM (
        SELECT
          id,
          type,
          title,
          extracted_content,
          char_count,
          ROUND((1 - (embedding <=> p_query_embedding))::numeric, 4) AS similarity
        FROM zapcatalog.agent_training_items
        WHERE agent_id = p_agent_id
          AND agent_id IN (
            SELECT id FROM zapcatalog.agents WHERE user_id = p_user_id
          )
          AND processing_status = 'done'
          AND char_count > 0
          AND embedding IS NOT NULL
          AND (1 - (embedding <=> p_query_embedding)) >= p_min_similarity
        ORDER BY embedding <=> p_query_embedding
        LIMIT p_match_count
      ) t
    ),
    '[]'::jsonb
  );
END;
$$;

-- ============================================================
-- RPC: store embedding for a training item
-- Called from the edge function after content is processed
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_update_training_item_embedding(
  p_user_id          uuid,
  p_training_item_id uuid,
  p_embedding        vector(1536)
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE zapcatalog.agent_training_items t
  SET    embedding = p_embedding
  FROM   zapcatalog.agents a
  WHERE  t.id       = p_training_item_id
    AND  t.agent_id = a.id
    AND  a.user_id  = p_user_id;
END;
$$;
