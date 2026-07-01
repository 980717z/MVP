-- Staff invites by email. The owner creates a pending member row (member_id NULL)
-- with the invitee's email; when that person signs up, claim_invites() links the
-- row to their auth account so RLS grants them access to the tenant.
-- Run in Supabase Studio → SQL editor.

alter table public.members add column if not exists email text;
create index if not exists members_email_idx on public.members (lower(email));

-- Link any pending invites (member_id null) whose email matches the caller's
-- verified JWT email to the caller's account. SECURITY DEFINER so it can write
-- past the owner-only members RLS — but it ONLY ever touches rows whose email
-- equals the caller's own auth.email(), so a user can only claim their own invite.
create or replace function public.claim_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if auth.uid() is null or coalesce(auth.email(), '') = '' then
    return 0;
  end if;
  update public.members
     set member_id = auth.uid()
   where member_id is null
     and email is not null
     and lower(email) = lower(auth.email());
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.claim_invites() from public;
grant execute on function public.claim_invites() to authenticated;
