CREATE OR REPLACE FUNCTION public.moneyball_app_compat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  p record;
BEGIN
  IF TG_TABLE_NAME = 'scan_runs' THEN
    NEW.source := COALESCE(NEW.source, 'FootyNomad');
    IF TG_OP = 'UPDATE' AND NEW.matches_found IS DISTINCT FROM OLD.matches_found THEN
      NEW.matches_count := NEW.matches_found;
    ELSIF TG_OP = 'UPDATE' AND NEW.matches_count IS DISTINCT FROM OLD.matches_count THEN
      NEW.matches_found := COALESCE(NEW.matches_count, 0);
    ELSE
      NEW.matches_found := COALESCE(NEW.matches_found, NEW.matches_count, 0);
      NEW.matches_count := NEW.matches_found;
    END IF;
  ELSIF TG_TABLE_NAME = 'matches' THEN
    IF TG_OP = 'UPDATE' AND NEW.competition IS DISTINCT FROM OLD.competition THEN
      NEW.league := NEW.competition;
    ELSIF TG_OP = 'UPDATE' AND NEW.league IS DISTINCT FROM OLD.league THEN
      NEW.competition := NEW.league;
    ELSE
      NEW.competition := COALESCE(NEW.competition, NEW.league);
      NEW.league := COALESCE(NEW.league, NEW.competition);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.kickoff_at IS DISTINCT FROM OLD.kickoff_at THEN
      IF NEW.kickoff_at IS NOT NULL THEN
        NEW.kickoff_date := timezone('Europe/Brussels', NEW.kickoff_at)::date;
      END IF;
    ELSIF TG_OP = 'UPDATE' AND NEW.kickoff_date IS DISTINCT FROM OLD.kickoff_date THEN
      IF NEW.kickoff_at IS NOT NULL
         AND timezone('Europe/Brussels', NEW.kickoff_at)::date IS DISTINCT FROM NEW.kickoff_date THEN
        NEW.kickoff_at := NULL;
      END IF;
    ELSIF NEW.kickoff_at IS NOT NULL THEN
      NEW.kickoff_date := timezone('Europe/Brussels', NEW.kickoff_at)::date;
    END IF;
  ELSIF TG_TABLE_NAME = 'predictions' THEN
    IF TG_OP = 'UPDATE' AND NEW.market IS DISTINCT FROM OLD.market THEN
      NEW.prediction_type := CASE WHEN NEW.market = 'DOUBLE_CHANCE' THEN 'DC' ELSE NEW.market END;
    ELSIF TG_OP = 'UPDATE' AND NEW.prediction_type IS DISTINCT FROM OLD.prediction_type THEN
      NEW.market := CASE WHEN NEW.prediction_type = 'DC' THEN 'DOUBLE_CHANCE' ELSE NEW.prediction_type END;
    ELSE
      NEW.market := COALESCE(NEW.market, CASE WHEN NEW.prediction_type = 'DC' THEN 'DOUBLE_CHANCE' ELSE NEW.prediction_type END);
      NEW.prediction_type := COALESCE(NEW.prediction_type, CASE WHEN NEW.market = 'DOUBLE_CHANCE' THEN 'DC' ELSE NEW.market END);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.selection IS DISTINCT FROM OLD.selection THEN
      NEW.pick := NEW.selection;
    ELSIF TG_OP = 'UPDATE' AND NEW.pick IS DISTINCT FROM OLD.pick THEN
      NEW.selection := NEW.pick;
    ELSE
      NEW.selection := COALESCE(NEW.selection, NEW.pick);
      NEW.pick := COALESCE(NEW.pick, NEW.selection);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.verdict IS DISTINCT FROM OLD.verdict THEN
      NEW.selection_status := NEW.verdict;
    ELSIF TG_OP = 'UPDATE' AND NEW.selection_status IS DISTINCT FROM OLD.selection_status THEN
      NEW.verdict := NEW.selection_status;
    ELSE
      NEW.verdict := COALESCE(NEW.verdict, NEW.selection_status, 'ODRZUCONY');
      NEW.selection_status := COALESCE(NEW.selection_status, NEW.verdict);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.settlement_status IS DISTINCT FROM OLD.settlement_status THEN
      NEW.result_status := NEW.settlement_status;
    ELSIF TG_OP = 'UPDATE' AND NEW.result_status IS DISTINCT FROM OLD.result_status THEN
      NEW.settlement_status := NEW.result_status;
    ELSE
      NEW.settlement_status := COALESCE(NEW.settlement_status, NEW.result_status, 'pending');
      NEW.result_status := COALESCE(NEW.result_status, NEW.settlement_status);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.rationale IS DISTINCT FROM OLD.rationale THEN
      NEW.rejection_reason := NEW.rationale;
    ELSIF TG_OP = 'UPDATE' AND NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      NEW.rationale := NEW.rejection_reason;
    ELSE
      NEW.rationale := COALESCE(NEW.rationale, NEW.rejection_reason);
      NEW.rejection_reason := COALESCE(NEW.rejection_reason, NEW.rationale);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.note IS DISTINCT FROM OLD.note THEN
      NEW.notes := NEW.note;
    ELSIF TG_OP = 'UPDATE' AND NEW.notes IS DISTINCT FROM OLD.notes THEN
      NEW.note := NEW.notes;
    ELSE
      NEW.note := COALESCE(NEW.note, NEW.notes);
      NEW.notes := COALESCE(NEW.notes, NEW.note);
    END IF;
    IF NEW.data_source IN ('NO_VERIFIED_SOURCE', 'BASELINE_FALLBACK') THEN
      NEW.probability := NULL;
      NEW.confidence := NULL;
      NEW.verdict := 'ODRZUCONY';
      NEW.selection_status := 'ODRZUCONY';
      NEW.rationale := 'Brak potwierdzonych danych rynkowych lub Elo. Prawdopodobieństwo pozostaje puste; wpis zachowany wyłącznie w rejestrze jako ODRZUCONY.';
      NEW.rejection_reason := NEW.rationale;
    END IF;
  ELSIF TG_TABLE_NAME = 'coupons' THEN
    NEW.name := COALESCE(NULLIF(NEW.name, ''), 'Kupon');
    IF TG_OP = 'UPDATE' AND NEW.combined_odds IS DISTINCT FROM OLD.combined_odds THEN
      NEW.total_odds := NEW.combined_odds;
    ELSIF TG_OP = 'UPDATE' AND NEW.total_odds IS DISTINCT FROM OLD.total_odds THEN
      NEW.combined_odds := NEW.total_odds;
    ELSE
      NEW.combined_odds := COALESCE(NEW.combined_odds, NEW.total_odds);
      NEW.total_odds := COALESCE(NEW.total_odds, NEW.combined_odds);
    END IF;
  ELSIF TG_TABLE_NAME = 'coupon_legs' THEN
    IF NEW.leg_number IS NULL THEN
      SELECT COALESCE(MAX(leg_number), 0) + 1 INTO NEW.leg_number
      FROM public.coupon_legs WHERE coupon_id = NEW.coupon_id;
    END IF;
    IF NEW.prediction_id IS NOT NULL
       AND (NEW.match_id IS NULL OR NEW.prediction_type IS NULL OR NEW.pick IS NULL OR NEW.probability IS NULL OR NEW.odds IS NULL) THEN
      SELECT match_id, prediction_type, pick, probability, odds INTO p
      FROM public.predictions WHERE id = NEW.prediction_id;
      IF FOUND THEN
        NEW.match_id := COALESCE(NEW.match_id, p.match_id);
        NEW.prediction_type := COALESCE(NEW.prediction_type, p.prediction_type);
        NEW.pick := COALESCE(NEW.pick, p.pick);
        NEW.probability := COALESCE(NEW.probability, p.probability);
        NEW.odds := COALESCE(NEW.odds, p.odds);
      END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.result_status := NEW.status;
    ELSIF TG_OP = 'UPDATE' AND NEW.result_status IS DISTINCT FROM OLD.result_status THEN
      NEW.status := NEW.result_status;
    ELSE
      NEW.status := COALESCE(NEW.status, NEW.result_status, 'pending');
      NEW.result_status := COALESCE(NEW.result_status, NEW.status);
    END IF;
  ELSIF TG_TABLE_NAME = 'bankroll_transactions' THEN
    IF TG_OP = 'UPDATE' AND NEW.transaction_type IS DISTINCT FROM OLD.transaction_type THEN
      NEW.type := CASE WHEN NEW.transaction_type = 'return' THEN 'payout' ELSE NEW.transaction_type END;
    ELSIF TG_OP = 'UPDATE' AND NEW.type IS DISTINCT FROM OLD.type THEN
      NEW.transaction_type := CASE WHEN NEW.type = 'payout' THEN 'return' ELSE NEW.type END;
    ELSE
      NEW.transaction_type := COALESCE(NEW.transaction_type, CASE WHEN NEW.type = 'payout' THEN 'return' ELSE NEW.type END, 'adjustment');
      NEW.type := COALESCE(NEW.type, CASE WHEN NEW.transaction_type = 'return' THEN 'payout' ELSE NEW.transaction_type END);
    END IF;
  ELSIF TG_TABLE_NAME = 'match_results' THEN
    IF TG_OP = 'UPDATE' AND NEW.home_score IS DISTINCT FROM OLD.home_score THEN
      NEW.home_goals := NEW.home_score;
    ELSIF TG_OP = 'UPDATE' AND NEW.home_goals IS DISTINCT FROM OLD.home_goals THEN
      NEW.home_score := NEW.home_goals;
    ELSE
      NEW.home_score := COALESCE(NEW.home_score, NEW.home_goals);
      NEW.home_goals := COALESCE(NEW.home_goals, NEW.home_score);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.away_score IS DISTINCT FROM OLD.away_score THEN
      NEW.away_goals := NEW.away_score;
    ELSIF TG_OP = 'UPDATE' AND NEW.away_goals IS DISTINCT FROM OLD.away_goals THEN
      NEW.away_score := NEW.away_goals;
    ELSE
      NEW.away_score := COALESCE(NEW.away_score, NEW.away_goals);
      NEW.away_goals := COALESCE(NEW.away_goals, NEW.away_score);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS moneyball_app_compat ON public.matches;
CREATE TRIGGER moneyball_app_compat
BEFORE INSERT OR UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.moneyball_app_compat();
