-- Worker-only tables must not be directly accessible to browser roles.
-- RLS remains enabled with no client policies; service_role is used by Edge Functions
-- and internal maintenance workflows.
REVOKE ALL PRIVILEGES ON TABLE
  public.match_result_sources,
  public.moneyball_password_recovery,
  public.moneyball_prediction_scan_state,
  public.moneyball_reschedule_sync_state,
  public.project_work_log
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.match_result_sources,
  public.moneyball_password_recovery,
  public.moneyball_prediction_scan_state,
  public.moneyball_reschedule_sync_state,
  public.project_work_log
TO service_role;
