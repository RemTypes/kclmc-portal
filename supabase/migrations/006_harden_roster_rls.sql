-- ============================================================
-- Migration 006: Harden KCLSU Roster Row Level Security (RLS)
-- UK GDPR & Data Protection Act Compliance
-- ============================================================

-- 1. Revoke unrestricted public SELECT on kclsu_roster
drop policy if exists "Anyone can verify membership roster" on public.kclsu_roster;

-- 2. Restrict direct SELECT access strictly to:
--    - The authenticated member claiming/viewing their own record (user_id = auth.uid())
--    - Verified committee officers and superadmins (role >= 1)
drop policy if exists "Members and committee can read roster" on public.kclsu_roster;
create policy "Members and committee can read roster"
  on public.kclsu_roster for select
  using (
    user_id = auth.uid() 
    or (select public.get_user_role()) >= 1
  );

-- 3. Dedicated secure RPC for public pass verification (wall scanners, QR checks)
--    Exposes ONLY validation status, climber name, and membership tier.
--    Does NOT leak transaction IDs, raw purchaser names, or financial metadata.
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
  limit 1;
end;
$$;

grant execute on function public.verify_membership_card(text) to anon, authenticated;
