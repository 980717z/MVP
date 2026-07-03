# Design System — 富来小厨 / Sang's Seafood (customer menu)

Scope: the customer-facing QR digital menu and storefront for the restaurant
**富来小厨 / Sang's Seafood**. This is the diner-facing brand, distinct from the
BentoOS platform UI (landing/dashboard/demo), which has its own pastel look.

## Product Context
- **What this is:** the mobile QR menu diners scan to browse and order.
- **Who it's for:** Cantonese seafood diners in Toronto Chinatown — older Chinese
  immigrants + locals. Bilingual zh/en; **Chinese is first-class, not a subtitle.**
- **Space/industry:** full-service Cantonese seafood restaurant (343 Spadina Ave).
- **Project type:** mobile-first digital menu / lightweight ordering.
- **Memorable thing:** *clean & effortless* — easy to read, easy to order, quietly premium.

## Aesthetic Direction
- **Direction:** Refined-minimal, dish-first. Type and whitespace do the work.
- **Decoration level:** minimal — warm paper background, hairline dividers, no clutter.
- **Mood:** calm, modern, appetizing; quality seafood without red-gold cliché or cold navy.
- **Deliberate departures (the brand's face):**
  1. **Jade / sea-green accent** instead of the category's red+gold or the old navy —
     fresher, appetite-forward, still culturally apt (jade).
  2. **Chinese-first typographic hierarchy** — the Chinese dish name is the hero line;
     the English sits beneath as elegant, muted secondary.

## Typography
- **Restaurant name / display (CJK):** Noto Serif SC (思源宋体), 600–700 — for 富来小厨.
- **Restaurant name / display (Latin):** General Sans 600 — "Sang's Seafood", uppercase tracked.
- **Dish name (hero, CJK):** Noto Sans SC (思源黑体), 600, ~17px.
- **English secondary + all UI/body (Latin):** General Sans, 400–600.
- **Prices / numerals:** General Sans with `font-variant-numeric: tabular-nums`.
- **Loading:** Noto Sans SC / Noto Serif SC via Google Fonts; General Sans via Fontshare
  (`https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700`).
- **Never:** Inter, Roboto, system-ui as display/body; red-gold festive script faces.
- **Scale (px):** name 24–26 · section 15 (bold) · dish-zh 17 · dish-en 12.5 · price 15 · meta 11.

## Color
- **Approach:** restrained — one jade accent + warm neutrals. Color is meaningful, not decorative.
- **Paper (background):** `#FAF7F2`
- **Ink (primary text):** `#1C1B19`
- **Muted (secondary text):** `#8A857C`
- **Hairline / divider:** `#ECE7DF`
- **Jade (accent — prices, active tab, +/add buttons, cart bar):** `#117A65`
- **Jade wash (secondary button / active surface):** `#E7F1ED`
- **Gold (sparing — "招牌/signature" + "时价/market price" tags only):** `#B8862F`
- **Semantic:** success `#117A65` · warning `#B8862F` · error `#C0392B` · info `#8A857C`
- **Dark mode:** not required for v1 (menu is used in lit dining rooms); if added,
  invert to a warm near-black surface and reduce jade saturation ~15%.

## Spacing
- **Base unit:** 8px.
- **Density:** comfortable — breathing room without burying a 367-dish menu.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48). Row padding 14px; section pad 18px.

## Layout
- **Approach:** grid-disciplined, mobile-first single column.
- **Max content width:** 640px (max-w-2xl), centered.
- **Header:** sticky; 富来小厨 (serif) + Sang's Seafood (tracked) + EN/中 toggle.
- **Category nav:** sticky folding tab bar; active tab filled jade.
- **Dish row:** image (optional) · Chinese-first name block · jade price · round jade `＋` button.
- **Tap targets:** ≥44px. **Border radius:** sm 8px · md 12px · pill/buttons 999px.

## Motion
- **Approach:** minimal-functional.
- **Easing:** enter ease-out · exit ease-in · move ease-in-out.
- **Duration:** micro 80ms (add bump) · short 200ms (tab change) · medium 300ms (sheet).

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-19 | Initial design system created | /design-consultation; "clean & effortless" memorable thing; jade + Chinese-first as the two deliberate risks vs red-gold/navy category defaults |
