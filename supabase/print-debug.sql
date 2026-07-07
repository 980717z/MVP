-- ===========================================================================
--  临时调试表：捕获打印机 Server Direct Print 回传的 PrintResponseInfo（含错误码）
--  确认打印通了之后可以 drop 掉。Supabase → SQL Editor → Run
-- ===========================================================================
create table if not exists public.print_debug (
  id          bigserial primary key,
  tenant_slug text,
  body        text,
  created_at  timestamptz not null default now()
);
grant all on public.print_debug to service_role;
grant usage, select on all sequences in schema public to service_role;
-- ===========================================================================
--  Done.  之后清理：drop table public.print_debug;
-- ===========================================================================
