-- ─────────────────────────────────────────────────────────────────────────
--  Fill in English names for the 6 fulai dishes that had none. Non-destructive
--  (only sets name_en; name_zh unchanged, so search_initials stays valid).
--  Review the translations, then run. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────

update public.menu_items set name_en = 'Steamed Fresh Oysters with Minced Garlic'
  where tenant_slug = 'fulai' and name_zh = '蒜蓉蒸生蚝';

update public.menu_items set name_en = 'Steamed Fresh Oysters with Black Bean Sauce'
  where tenant_slug = 'fulai' and name_zh = '豉汁蒸生蚝';

update public.menu_items set name_en = 'Sautéed Water Spinach with Fermented Bean Curd & Chili'
  where tenant_slug = 'fulai' and name_zh = '椒丝腐乳通心菜';

update public.menu_items set name_en = 'Grouper Belly & Tofu Clay Pot'
  where tenant_slug = 'fulai' and name_zh = '斑腩豆腐煲';

update public.menu_items set name_en = 'Marinated Duck Tongues in Master Sauce'
  where tenant_slug = 'fulai' and name_zh = '卤水鸭舌';

update public.menu_items set name_en = 'Salt and Pepper Duck Tongues'
  where tenant_slug = 'fulai' and name_zh = '椒盐鸭舌';

-- VERIFY — all 6 should now have an English name:
select name_zh, name_en from public.menu_items
  where tenant_slug = 'fulai'
    and name_zh in ('蒜蓉蒸生蚝','豉汁蒸生蚝','椒丝腐乳通心菜','斑腩豆腐煲','卤水鸭舌','椒盐鸭舌');
