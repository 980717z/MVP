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
- **Approach:** grid-disciplined, mobile-first single column — with a responsive
  desktop/iPad layout on top (see "Two views" below).
- **Max content width (phone):** 440px (`max-w-[440px]`), centered. The phone view
  (QR-scanned) caps to a phone-width column.
- **Two views (phone ⇄ desktop/iPad):** at **≥768px** the menu becomes a 3-pane POS —
  wider category rail (labels + counts) · multi-column dish grid (2 → 3 cols) ·
  persistent right **order panel** (live order, per-line qty, submit). Bottom sheets
  (选规格 / 火锅配菜 / staff ✎ / cart) become **centered dialogs**. A header top-right
  toggle (📱/🖥) switches views manually and persists per device (`localStorage`);
  with no manual choice, viewport width decides. The auto layout is pure CSS `md:`
  breakpoints (no hydration flash); the manual override is `main[data-view]` rules in
  globals.css. Phone view (<768) is unchanged. Permanent QR contract untouched
  (same route, no new param). Detection precedence lives in `lib/menuView.ts` (tested).
- **Header:** sticky; cart pill (top-left, jade, shows subtotal) + 富来小厨 (serif) +
  Sang's Seafood (tracked) + EN/中 toggle.
- **Category nav:** sticky **left rail** (美团/大众点评 style) — all categories visible,
  active = jade bar + jade wash; dish list renders every category as a section and
  scrolling syncs the rail (tap to jump). NOT a folding tab bar.
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
| 2026-06-29 | Category nav → left rail w/ scroll-sync; content capped to 440px (phone width) | Folding tab bar hid 14 of 19 categories; left rail (美团 pattern) shows all + diners know it. Phone-width cap makes desktop preview as the phone view. |
| 2026-07-03 | Re-applied left rail + 440px after a cross-branch merge reverted them | A parallel `testing`-branch merge clobbered the menu page + this doc back to folding-tabs/640px; restored on top of the 扫码配送 changes. |
| 2026-07-03 | 多规格 (multi-size) dishes: bottom-sheet size selector | /plan-design-review. Dishes may carry sizes (全/半, 位/小/中/大/特大). Single-price dishes unchanged (bare ＋). Multi-size show "起 $min" + 选规格 button → slide-up sheet lists each size+price with steppers; each size is its own cart line. Sheet chosen over inline chips because it scales to 5-size soups on a 440px phone. |
| 2026-07-13 | Desktop/iPad 3-pane view + phone⇄desktop toggle (supersedes 440px-on-desktop cap for ≥768) | /plan-design-review + /plan-eng-review. The 440px cap made desktop/iPad (esp. staff iPad ordering) waste ~65% of the screen. At ≥768px the menu is now a 3-pane POS (rail · dish grid · persistent order panel); sheets → centered dialogs. Toggle (📱/🖥) top-right, localStorage-persisted, manual beats auto. CSS-single-tree (one dish list, responsive grid) so no double-DOM + no hydration flash; manual override via `main[data-view]`. Phone view unchanged (baseline). |
