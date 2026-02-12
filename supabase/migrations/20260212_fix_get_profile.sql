-- Fix zc_get_profile: profiles table uses 'id' as PK (not 'user_id')
-- Also fix zc_update_profile for same reason
-- Applied via Management API on 2026-02-12

-- Fix zc_get_profile
CREATE OR REPLACE FUNCTION public.zc_get_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result jsonb;
  v_full_name text;
  v_email text;
BEGIN
  SELECT to_jsonb(p.*) INTO result
  FROM zapcatalog.profiles p
  WHERE p.id = p_user_id;

  IF result IS NULL THEN
    SELECT COALESCE(raw_user_meta_data->>'full_name', ''),
           COALESCE(email, '')
    INTO v_full_name, v_email
    FROM auth.users WHERE id = p_user_id;

    INSERT INTO zapcatalog.profiles (id, full_name, email, company_name)
    VALUES (p_user_id, COALESCE(v_full_name, ''), COALESCE(v_email, ''), '')
    ON CONFLICT (id) DO NOTHING;

    SELECT to_jsonb(p.*) INTO result
    FROM zapcatalog.profiles p
    WHERE p.id = p_user_id;
  END IF;

  RETURN result;
END;
$function$;

-- Fix zc_update_profile
CREATE OR REPLACE FUNCTION public.zc_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_company_name text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result jsonb;
  v_email text;
BEGIN
  SELECT COALESCE(email, '') INTO v_email FROM auth.users WHERE id = p_user_id;

  INSERT INTO zapcatalog.profiles (id, full_name, email, company_name)
  VALUES (p_user_id, p_full_name, COALESCE(v_email, ''), p_company_name)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    company_name = EXCLUDED.company_name,
    updated_at = now();

  SELECT to_jsonb(p.*) INTO result
  FROM zapcatalog.profiles p
  WHERE p.id = p_user_id;

  RETURN result;
END;
$function$;
