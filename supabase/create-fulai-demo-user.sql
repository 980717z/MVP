-- ===========================================================================
--  创建演示账号 fulai@bentoos.io / demo123，并关联到 fulai（富来小厨）
--  登录后看到的数据 = demo@alpinedd.com 看到的数据（同一个 tenant=fulai）。
--  Supabase → SQL Editor → Run（可重复跑：已存在则只刷新密码 + 补成员行）
--
--  原理：数据按 tenant_slug 隔离。把这个账号加为 fulai 的成员(access=[] 全功能)，
--  它和 fulai 的 owner(demo@alpinedd.com) 就看到完全相同的数据。
--  注：邮箱在 Supabase 内一律小写存储；登录时大小写不敏感（用 fulai@bentoos.io）。
-- ===========================================================================
do $$
declare
  v_uid  uuid;
  v_mail text := 'fulai@bentoos.io';
  v_pass text := 'demo123';
begin
  if not exists (select 1 from public.tenants where slug = 'fulai') then
    raise exception 'fulai 不存在，请先确认该店已创建';
  end if;

  select id into v_uid from auth.users where email = v_mail;

  if v_uid is null then
    -- ── 新建 auth 用户（邮箱+密码，且标记邮箱已确认，可直接登录）──
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_mail, crypt(v_pass, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );
    -- 邮箱登录需要一条 identities 记录
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_uid::text, v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_mail, 'email_verified', true),
      'email', now(), now(), now()
    );
    raise notice '✅ 已创建用户 % (id=%)', v_mail, v_uid;
  else
    -- ── 已存在：把密码刷新为 demo123，并确保邮箱已确认 ──
    update auth.users
      set encrypted_password = crypt(v_pass, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_uid;
    raise notice 'ℹ️ 用户已存在，已重置密码：% (id=%)', v_mail, v_uid;
  end if;

  -- ── 关联到 fulai：加为成员，access=[] 表示可见全部已启用模块 ──
  if not exists (
    select 1 from public.members where tenant_slug = 'fulai' and member_id = v_uid
  ) then
    insert into public.members (tenant_slug, member_id, name, role, access)
    values ('fulai', v_uid, 'fulai@bentoos.io', 'owner', '[]'::jsonb);
    raise notice '✅ 已把 % 关联为 fulai 成员', v_mail;
  else
    raise notice 'ℹ️ % 已是 fulai 成员，跳过', v_mail;
  end if;
end $$;

-- 验证：应看到该账号 + 它在 fulai 的成员行
select u.email, u.email_confirmed_at is not null as confirmed, m.tenant_slug, m.role
from auth.users u
left join public.members m on m.member_id = u.id and m.tenant_slug = 'fulai'
where u.email = 'fulai@bentoos.io';
-- ===========================================================================
--  Done.
-- ===========================================================================
