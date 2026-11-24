-- Employee accounts are deactivated, never physically deleted.
-- This guard applies to both the application profile and the Supabase Auth identity.

create or replace function private.reject_employee_account_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Physical deletion is forbidden for employee accounts (%). Disable the account instead.',
    tg_table_schema || '.' || tg_table_name
    using errcode = '55000';
end;
$$;

revoke all on function private.reject_employee_account_delete() from public, anon, authenticated;

drop trigger if exists profiles_prevent_physical_delete on public.profiles;
create trigger profiles_prevent_physical_delete
before delete on public.profiles
for each row execute function private.reject_employee_account_delete();

drop trigger if exists auth_users_prevent_physical_delete on auth.users;
create trigger auth_users_prevent_physical_delete
before delete on auth.users
for each row execute function private.reject_employee_account_delete();

revoke delete on table public.profiles from public, anon, authenticated, service_role;

comment on function private.reject_employee_account_delete() is
  'Blocks physical deletion of employee accounts. Use status disabled instead.';
