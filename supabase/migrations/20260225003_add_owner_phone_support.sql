-- ============================================================
-- Add phone_number to integrations_whatsapp
-- Enables instance lookup by owner phone (uazapiGO webhook fallback)
-- ============================================================

ALTER TABLE zapcatalog.integrations_whatsapp
  ADD COLUMN IF NOT EXISTS phone_number text;

CREATE INDEX IF NOT EXISTS idx_integrations_whatsapp_phone
  ON zapcatalog.integrations_whatsapp(phone_number)
  WHERE phone_number IS NOT NULL;

-- ============================================================
-- RPC: update whatsapp phone number
-- Called when UAZAPI status returns the instance owner phone
-- ============================================================
CREATE OR REPLACE FUNCTION public.zc_update_whatsapp_phone(
  p_user_id     uuid,
  p_phone_number text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE zapcatalog.integrations_whatsapp
  SET phone_number = p_phone_number,
      updated_at   = now()
  WHERE user_id = p_user_id;
END;
$$;

-- ============================================================
-- RPC: get active agent by instance owner phone
-- Used as fallback in the unauthenticated webhook handler
-- when the instance token is not present in the payload
-- ============================================================
CREATE OR REPLACE FUNCTION zapcatalog.zc_get_agent_by_owner_phone(
  p_owner_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id        uuid;
  v_instance_token text;
  v_agent          jsonb;
BEGIN
  -- Normalize: strip all non-digit chars before comparing
  SELECT w.user_id, w.instance_token
  INTO v_user_id, v_instance_token
  FROM zapcatalog.integrations_whatsapp w
  WHERE regexp_replace(COALESCE(w.phone_number, ''), '[^0-9]', '', 'g')
          = regexp_replace(p_owner_phone, '[^0-9]', '', 'g')
    AND w.is_connected = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(a.*)
    || jsonb_build_object(
         'resolved_user_id', v_user_id,
         'instance_token',   v_instance_token
       )
  INTO v_agent
  FROM zapcatalog.agents a
  WHERE a.user_id   = v_user_id
    AND a.is_active = true
  ORDER BY a.updated_at DESC
  LIMIT 1;

  RETURN v_agent;
END;
$$;
