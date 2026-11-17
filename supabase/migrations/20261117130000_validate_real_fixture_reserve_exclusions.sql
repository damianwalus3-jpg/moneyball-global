-- Regression-only validation for actual FootyNomad fixtures on 2026-11-17.
-- Pardubice II and Celtic II are reserve sides and must not enter the senior men's registry.
DO $validation$
BEGIN
  IF public.moneyball_is_eligible_european_match('Czech Republic','3. liga - CFL B','men','Pardubice II','Horní Ředice') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Pardubice II must be excluded as a reserve side';
  END IF;
  IF public.moneyball_is_eligible_european_match('Scotland','Football League - Lowland League','men','Newton Stewart','Celtic II') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Celtic II must be excluded as a reserve side';
  END IF;
  IF public.moneyball_is_eligible_european_match('Scotland','Football League - Lowland League','men','Brechin','Stirling University') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Senior Lowland League fixture must remain eligible';
  END IF;
  IF public.moneyball_is_eligible_european_match('England','Non League Premier - Southern Central','men','Alpha United','Gamma City') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Southern Central senior league must remain eligible';
  END IF;
  IF public.moneyball_is_eligible_european_match('England','Non League Premier - Southern South','men','Alpha United','Gamma City') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Southern South senior league must remain eligible';
  END IF;
END;
$validation$;
