alter table public.coupon_legs alter column match_id set not null;

create unique index coupon_legs_unique_coupon_match_idx
  on public.coupon_legs (coupon_id, match_id);

comment on index public.coupon_legs_unique_coupon_match_idx is
  'Prevents a coupon from containing more than one leg for the same match; each leg must resolve to a match.';
