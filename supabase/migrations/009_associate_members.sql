-- ============================================================
-- 009_associate_members.sql
-- KCLMC Platform — Associate Member Custom IDs & SU Status Tracking
-- ============================================================

-- 1. Add optional metadata columns for Associate Members on kclsu_roster
alter table public.kclsu_roster
  add column if not exists is_associate boolean not null default false,
  add column if not exists member_email text,
  add column if not exists university text,
  add column if not exists su_status text not null default 'verified'
    check (su_status in ('verified', 'awaiting_su', 'revoked'));

-- 2. Index for filtering associate members and awaiting_su records
create index if not exists idx_kclsu_roster_is_associate on public.kclsu_roster(is_associate);
create index if not exists idx_kclsu_roster_su_status on public.kclsu_roster(su_status);

-- 3. Update public verification RPC so revoked passes do not validate at wall scanners
create or replace function public.verify_membership_card(card_num text)
returns table (
  is_valid boolean,
  full_name text,
  tier text,
  academic_year text
)
language plpgsql
security definer set search_path = ''
as $$
begin
  return query
  select 
    true as is_valid,
    r.full_name,
    r.tier,
    r.academic_year
  from public.kclsu_roster r
  where upper(r.card_number) = upper(trim(card_num))
    and coalesce(r.su_status, 'verified') != 'revoked'
  limit 1;
end;
$$;

grant execute on function public.verify_membership_card(text) to anon, authenticated;
