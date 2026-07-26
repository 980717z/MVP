-- ===========================================================================
--  重置 demo@alpinedd.com 的密码（原密码被改且无法找回——bcrypt 单向哈希）
--  跑完即可用新密码登录。Supabase → SQL Editor → Run（可重复跑）
--  想换别的密码，改下面 v_pass 即可。
-- ===========================================================================
do $$
declare
  v_uid  uuid;
  v_mail text := 'demo@alpinedd.com';
  v_pass text := 'demo123';   -- ← 想要的新密码改这里
begin
  select id into v_uid from auth.users where email = v_mail;
  if v_uid is null then
    raise exception '账号 % 不存在', v_mail;
  end if;

  update auth.users
    set encrypted_password = crypt(v_pass, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = v_uid;

  raise notice '✅ 已重置 % 的密码（id=%）', v_mail, v_uid;
end $$;

select email, email_confirmed_at is not null as confirmed, updated_at
from auth.users where email = 'demo@alpinedd.com';
-- ===========================================================================
--  Done. 现在用 demo@alpinedd.com / demo123 登录。
-- ===========================================================================
