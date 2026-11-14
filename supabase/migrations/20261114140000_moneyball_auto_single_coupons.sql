ALTER TABLE public.coupon_legs DROP CONSTRAINT IF EXISTS coupon_legs_prediction_type_check;
ALTER TABLE public.coupon_legs ADD CONSTRAINT coupon_legs_prediction_type_check
 CHECK (prediction_type = ANY (ARRAY['1X2'::text,'DC'::text,'GOALS'::text]));

ALTER TABLE public.coupon_legs DROP CONSTRAINT IF EXISTS coupon_legs_pick_check;
ALTER TABLE public.coupon_legs ADD CONSTRAINT coupon_legs_pick_check
 CHECK (pick = ANY (ARRAY[
  '1'::text,'X'::text,'2'::text,'1X'::text,'X2'::text,'12'::text,
  'OVER_1.5'::text,'UNDER_1.5'::text,'OVER_2.5'::text,'UNDER_2.5'::text,
  'OVER_3.5'::text,'UNDER_3.5'::text,'BTTS_YES'::text,'BTTS_NO'::text
 ]));

CREATE UNIQUE INDEX IF NOT EXISTS coupons_auto_single_owner_batch_uidx
 ON public.coupons(owner_id,batch_id)
 WHERE coupon_type='SINGLE' AND batch_id LIKE 'AUTO_SINGLE:%';

CREATE OR REPLACE FUNCTION public.moneyball_sync_auto_single_coupon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
 v_owner uuid;
 v_batch text;
 v_coupon_id uuid;
 v_home text;
 v_away text;
 v_prediction_type text;
 v_name text;
BEGIN
 v_owner := COALESCE(NEW.owner_id,NEW.user_id);
 v_batch := 'AUTO_SINGLE:' || NEW.id::text;
 v_prediction_type := CASE
   WHEN NEW.market='GOALS' THEN 'GOALS'
   WHEN NEW.market='DOUBLE_CHANCE' THEN 'DC'
   ELSE '1X2'
 END;
 SELECT home_team,away_team INTO v_home,v_away
 FROM public.matches
 WHERE id=NEW.match_id AND owner_id=v_owner
 LIMIT 1;
 v_name := 'Pojedynczy: ' || COALESCE(v_home,'Mecz') || ' – ' || COALESCE(v_away,'') || ' (' || COALESCE(NEW.selection,'') || ')';

 IF NEW.verdict='WYBRANY'
    AND NEW.settlement_status='pending'
    AND NEW.stake=5
    AND NEW.probability>75
    AND NEW.odds IS NOT NULL
    AND NEW.odds>=1.60
    AND ((NEW.probability/100.0)*NEW.odds-1)>=0.03 THEN

   INSERT INTO public.coupons(
     owner_id,user_id,name,batch_id,stake,total_odds,combined_probability,status,notes,
     scan_run_id,coupon_type,target_legs,combined_odds,potential_return
   ) VALUES (
     v_owner,v_owner,v_name,v_batch,5,NEW.odds,NEW.probability,'pending',
     'AUTO_SINGLE_PREDICTION:' || NEW.id::text,
     NEW.scan_run_id,'SINGLE',1,NEW.odds,ROUND(5*NEW.odds,2)
   )
   ON CONFLICT DO NOTHING
   RETURNING id INTO v_coupon_id;

   IF v_coupon_id IS NULL THEN
     SELECT id INTO v_coupon_id
     FROM public.coupons
     WHERE owner_id=v_owner AND batch_id=v_batch AND coupon_type='SINGLE'
     LIMIT 1
     FOR UPDATE;
   END IF;

   IF v_coupon_id IS NOT NULL THEN
     UPDATE public.coupons
     SET name=v_name,stake=5,total_odds=NEW.odds,combined_odds=NEW.odds,
         combined_probability=NEW.probability,potential_return=ROUND(5*NEW.odds,2),
         status='pending',settled_at=NULL,scan_run_id=NEW.scan_run_id
     WHERE id=v_coupon_id;

     IF NOT EXISTS (
       SELECT 1 FROM public.coupon_legs
       WHERE coupon_id=v_coupon_id AND prediction_id=NEW.id
     ) THEN
       INSERT INTO public.coupon_legs(
         owner_id,user_id,coupon_id,prediction_id,match_id,prediction_type,pick,
         probability,odds,result_status,status,leg_number
       ) VALUES (
         v_owner,v_owner,v_coupon_id,NEW.id,NEW.match_id,v_prediction_type,NEW.selection,
         NEW.probability,NEW.odds,'pending','pending',1
       );
     ELSE
       UPDATE public.coupon_legs
       SET prediction_type=v_prediction_type,pick=NEW.selection,
           probability=NEW.probability,odds=NEW.odds,
           result_status='pending',status='pending'
       WHERE coupon_id=v_coupon_id AND prediction_id=NEW.id;
     END IF;
   END IF;

 ELSIF TG_OP='UPDATE'
   AND OLD.verdict='WYBRANY'
   AND NEW.verdict<>'WYBRANY'
   AND OLD.settlement_status='pending' THEN

   SELECT id INTO v_coupon_id
   FROM public.coupons
   WHERE owner_id=v_owner AND batch_id=v_batch AND coupon_type='SINGLE'
   LIMIT 1;

   IF v_coupon_id IS NOT NULL THEN
     UPDATE public.coupon_legs
     SET status='void',result_status='void'
     WHERE coupon_id=v_coupon_id AND status='pending';
     UPDATE public.coupons
     SET status='void',settled_at=now()
     WHERE id=v_coupon_id AND status='pending';
   END IF;
 END IF;

 RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.moneyball_sync_auto_single_coupon() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moneyball_sync_auto_single_coupon() TO authenticated,service_role;

DROP TRIGGER IF EXISTS moneyball_auto_single_coupon_trigger ON public.predictions;
CREATE TRIGGER moneyball_auto_single_coupon_trigger
AFTER INSERT OR UPDATE OF verdict,selection,odds,probability,stake,settlement_status
ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.moneyball_sync_auto_single_coupon();

COMMENT ON FUNCTION public.moneyball_sync_auto_single_coupon() IS
 'Creates exactly one automatic virtual SINGLE coupon with a fixed EUR 5 stake for each selected prediction; supports 1X2, Double Chance and GOALS.';
