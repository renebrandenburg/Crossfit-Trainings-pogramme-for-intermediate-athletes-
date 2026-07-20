alter table public.pr_attempts
  drop constraint if exists pr_attempts_value_positive;

alter table public.pr_attempts
  add constraint pr_attempts_value_positive
  check (value > 0 and value < 'Infinity'::numeric) not valid;

alter table public.pr_attempts
  validate constraint pr_attempts_value_positive;

alter table public.personal_records
  drop constraint if exists personal_records_value_nonnegative;

alter table public.personal_records
  add constraint personal_records_value_nonnegative
  check (value >= 0 and value < 'Infinity'::numeric) not valid;

alter table public.personal_records
  validate constraint personal_records_value_nonnegative;
