-- Tracker invoker RPCs use fully qualified objects; remove public from search_path.
alter function public.moneyball_tracker_unclassified_page(text, integer, integer) set search_path = '';
alter function public.moneyball_tracker_category_summary() set search_path = '';
