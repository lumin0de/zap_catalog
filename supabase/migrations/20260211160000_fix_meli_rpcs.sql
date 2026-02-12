-- Fix: correct table name is integrations_meli (not meli_integrations)

-- Drop incorrectly-named functions if they exist
DROP FUNCTION IF EXISTS public.zc_upsert_meli(uuid, text, text, text, text, timestamptz, boolean);
DROP FUNCTION IF EXISTS public.zc_delete_meli(uuid);
DROP FUNCTION IF EXISTS public.zc_update_meli_tokens(uuid, text, text, timestamptz);

-- Recreate with correct table name: zapcatalog.integrations_meli

CREATE OR REPLACE FUNCTION public.zc_upsert_meli(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_seller_id text,
  p_nickname text,
  p_token_expires_at timestamptz,
  p_is_connected boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO zapcatalog.integrations_meli (
    user_id, access_token, refresh_token, seller_id,
    nickname, token_expires_at, is_connected, updated_at
  ) VALUES (
    p_user_id, p_access_token, p_refresh_token, p_seller_id,
    p_nickname, p_token_expires_at, p_is_connected, now()
  ) ON CONFLICT (user_id) DO UPDATE SET
    access_token = EXCLUDED.access_token,
    refresh_token = EXCLUDED.refresh_token,
    seller_id = EXCLUDED.seller_id,
    nickname = EXCLUDED.nickname,
    token_expires_at = EXCLUDED.token_expires_at,
    is_connected = EXCLUDED.is_connected,
    updated_at = now();

  SELECT to_jsonb(m.*) INTO result
  FROM zapcatalog.integrations_meli m
  WHERE m.user_id = p_user_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.zc_delete_meli(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM zapcatalog.integrations_meli WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.zc_update_meli_tokens(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_token_expires_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE zapcatalog.integrations_meli SET
    access_token = p_access_token,
    refresh_token = p_refresh_token,
    token_expires_at = p_token_expires_at,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;
