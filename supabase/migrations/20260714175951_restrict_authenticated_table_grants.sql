revoke all on table public.workout_logs from authenticated;
revoke all on table public.pr_attempts from authenticated;
revoke all on table public.personal_records from authenticated;

grant select, insert, update, delete on table public.workout_logs to authenticated;
grant select, insert, update, delete on table public.pr_attempts to authenticated;
grant select, insert, update, delete on table public.personal_records to authenticated;
