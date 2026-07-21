-- ─────────────────────────────────────────────────────────────────────────
--  Customer contact on orders: name + email. Campus pickup requires both
--  (plus phone) so the truck can reach a student about a no-show / ready order.
--  RUN THIS BEFORE deploying the checkout change — customer pickup orders
--  always send name+email, so a pre-migration insert would be rejected on the
--  missing columns.
--
--  Nullable at the DB level on purpose: the "required" rule is per-flow
--  (customer pickup), enforced in the app + the pickup route. Dine-in and
--  staff-placed orders legitimately have neither.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists email text;

-- Cheap format guard at the DB edge: if an email is present it must look like
-- one (mirrors lib/contact.isValidEmail). Empty/NULL allowed.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_email_chk'
  ) then
    alter table public.orders
      add constraint orders_email_chk
      check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
  end if;
end $$;

comment on column public.orders.customer_name is 'Customer-entered name (campus pickup). PII — order fulfillment + no-show contact.';
comment on column public.orders.email is 'Customer-entered email (campus pickup). PII — order updates + no-show contact.';
