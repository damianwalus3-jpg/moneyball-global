-- This is a trigger-only SECURITY DEFINER function. It must not be exposed as an RPC
-- to anon or authenticated clients; the existing trigger remains attached to coupon_legs.
REVOKE ALL ON FUNCTION public.moneyball_guard_coupon_leg_scope() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moneyball_guard_coupon_leg_scope() TO service_role;

-- Rollback-only regression: verify the existing trigger still invokes the function
-- after the RPC privileges are revoked. No row change is committed.
DO $guard_privilege_regression$
DECLARE
  v_leg_id uuid;
  v_error text := '';
BEGIN
  SELECT id INTO v_leg_id FROM public.coupon_legs LIMIT 1;
  IF v_leg_id IS NOT NULL THEN
    BEGIN
      UPDATE public.coupon_legs SET match_id = match_id WHERE id = v_leg_id;
      RAISE EXCEPTION 'ROLLBACK_TRIGGER_PRIVILEGE_TEST';
    EXCEPTION WHEN others THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    END;

    IF v_error ILIKE '%permission denied%' THEN
      RAISE EXCEPTION 'Coupon-leg trigger lost execute permission after RPC revoke: %', v_error;
    END IF;
  END IF;
END;
$guard_privilege_regression$;
