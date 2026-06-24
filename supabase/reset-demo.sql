-- ===========================================================================
--  清理 demo@bentoos.io 名下的商家数据（保留登录账号）
--  跑完后该账号再登录会回到「强制命名」步骤，可重新走一遍流程。
--  Supabase → SQL Editor → Run
-- ===========================================================================
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'demo@bentoos.io';
  if v_uid is null then
    raise notice '没有找到 demo@bentoos.io';
    return;
  end if;

  -- 删除该用户拥有的商家：会级联删掉它的 members / records / menu_items
  delete from public.tenants where owner_id = v_uid;
  -- 顺带清掉该用户在别人店里的成员关系（如果有）
  delete from public.members where member_id = v_uid;

  raise notice '已清理 % 的商家数据，账号保留', v_uid;
end $$;
