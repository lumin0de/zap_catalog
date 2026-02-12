-- Create profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS zapcatalog.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Drop existing functions with wrong return types
DROP FUNCTION IF EXISTS public.zc_get_profile(uuid);
DROP FUNCTION IF EXISTS public.zc_update_profile(uuid, text, text);

-- RPC: get profile (creates default if not found, using auth metadata)
CREATE OR REPLACE FUNCTION public.zc_get_profile(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
  v_full_name text;
BEGIN
  SELECT to_jsonb(p.*) INTO result
  FROM zapcatalog.profiles p
  WHERE p.user_id = p_user_id;

  IF result IS NULL THEN
    -- Auto-create profile from auth.users metadata
    SELECT COALESCE(raw_user_meta_data->>'full_name', '') INTO v_full_name
    FROM auth.users WHERE id = p_user_id;

    INSERT INTO zapcatalog.profiles (user_id, full_name, company_name)
    VALUES (p_user_id, COALESCE(v_full_name, ''), '')
    ON CONFLICT (user_id) DO NOTHING;

    SELECT to_jsonb(p.*) INTO result
    FROM zapcatalog.profiles p
    WHERE p.user_id = p_user_id;
  END IF;

  RETURN result;
END;
$$;

-- RPC: update profile (upsert)
CREATE OR REPLACE FUNCTION public.zc_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_company_name text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result jsonb;
BEGIN
  INSERT INTO zapcatalog.profiles (user_id, full_name, company_name)
  VALUES (p_user_id, p_full_name, p_company_name)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    company_name = EXCLUDED.company_name,
    updated_at = now();

  SELECT to_jsonb(p.*) INTO result
  FROM zapcatalog.profiles p
  WHERE p.user_id = p_user_id;

  RETURN result;
END;
$$;
