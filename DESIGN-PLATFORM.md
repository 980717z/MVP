# Design System — BentoOS platform (back-office)

Scope: the **BentoOS merchant back-office** — dashboard, module pages, settings,
sidebar/nav, and the marketing surfaces (landing, pricing, demo, how-it-works).
This is the operator-facing brand.

This is a **separate brand** from the customer-facing restaurant menu. The menu
(`app/menu/[tenant]`) is governed by **DESIGN.md** (jade on warm paper,
Chinese-first, General Sans + Noto serif). Do not mix the two. When in doubt:
diner sees jade/paper; owner sees emerald/app-grey.

## Product Context
- **What this is:** the back-office a small-merchant owner uses to run the shop —
  glance at today's numbers, handle live orders, manage menu/stock, close the day.
- **Who it's for:** non-technical small-business owners in Canada (Toronto + Quebec).
  Often older, often Chinese-speaking, frequently on a **phone** mid-shift. They
  glance for 3 seconds between tasks, not study a screen.
- **Project type:** multi-tenant operational dashboard / admin app UI (NOT a
  marketing page — calm surface, utility language, minimal chrome).
- **Memorable thing:** *calm and glanceable* — the owner knows the state of the
  shop in one look, and the next action is obvious.

## Aesthetic Direction
- **Direction:** Calm app UI. Strong typography, few colors, generous whitespace,
  hairline dividers. Dense but readable.
- **Decoration level:** minimal. No decorative gradients, blobs, or icon-in-circle
  ornament. Color is meaningful (status, accent), never decorative.
- **Mood:** trustworthy, friendly, professional. Pastel emerald reads fresh and
  reassuring without being corporate-blue or flashy.
- **One accent:** emerald. Everything else is warm neutral grey + semantic status.

## Color
- **Approach:** one emerald accent + warm neutrals + semantic status. Define as
  CSS variables / Tailwind tokens. Never hard-code hex in components.
- **App background:** `#FBFAF8` (warm off-white)
- **Card / surface:** `#FFFFFF`
- **Ink (primary text):** `#1A1D1B`
- **Ink soft (secondary):** `#5B635E`
- **Ink faint (meta / muted):** `#8E948F`
- **Hairline / divider:** `#EBEAE5` · soft fill `#F3F2EE`
- **Brand (emerald — primary buttons, active nav, links, KPI accent):** `#0E9F6E`
- **Brand strong (hover/press):** `#0B8A5E`
- **Brand wash (active surface, secondary button, pill):** `#E9F6F0`
- **Brand ink (emerald text on wash):** `#0A6A49`
- **Semantic:** warning `#C77A12` (wash `#FBF1DE`) · danger `#D14343` (wash
  `#FBE9E9`) · info `#3B7FA6` (wash `#E8F1F6`) · success = brand emerald.
- **Migration note:** replaces the legacy blue brand `#2563eb` (still in
  `tailwind.config.ts` as `brand`). The back-office currently uses blue; the
  landing uses emerald/sky. This unifies on emerald.
- **Contrast:** body text ≥ 4.5:1. Emerald `#0E9F6E` on white passes for large/UI;
  use `brand-ink #0A6A49` for emerald-colored body-size text.

## Typography
- **Latin (display + body + UI):** **Plus Jakarta Sans** (400/500/600/700/800).
  Humanist, friendly, distinct from the menu's General Sans. Load via Google Fonts.
- **Chinese (all CJK):** **Noto Sans SC** (400/500/700).
- **Numerals:** Plus Jakarta Sans with `font-variant-numeric: tabular-nums` for any
  money/count/KPI so columns align and digits don't jitter on refresh.
- **Never:** Inter, Roboto, Arial, or `system-ui`/`-apple-system` as the primary
  display/body face. No serif in the back-office (serif is the menu's voice).
- **Scale (px):** page title 22/800 · KPI hero number 32–40/800 · section label
  11/700 uppercase tracked (faint) · panel header 13/700 · card title 14/600 ·
  body 14/400 · meta 12/600. **Body never below 14px.**

## Spacing & Shape
- **Base unit:** 8px. Scale: 4 · 8 · 12 · 16 · 24 · 32.
- **Density:** comfortable. Row padding 11–14px; panel header 13px; content gutter
  22px desktop / 16px mobile.
- **Radius:** sm 8 · md 12 (cards/panels) · lg 16 (outer shells) · pill 999
  (buttons, status, badges).
- **Depth:** one soft shadow token `0 1px 2px rgba(20,30,25,.04), 0 4px 16px
  rgba(20,30,25,.05)`. Prefer hairline borders over shadows for separation.
- **Tap targets:** ≥ 44px on any control an owner taps on a phone.

## Layout & Information Architecture
- **Shell:** persistent left sidebar (desktop) + slim top bar. Max content width
  not constrained (dense data screens), gutter 22px.
- **Sidebar:** logo → store name (中文 serif-free 700 + EN tracked) → grouped nav
  (🛎️ 前台 Front / 🗄️ 后台 Back) → settings pinned bottom. Active item = brand wash
  + brand-ink + 600. Live counts (e.g. waiting orders) shown as a brand badge.
- **Top bar:** real store name `富来小厨 / Sang's Seafood` + address; EN/FR/中
  toggle right-aligned (shared `LangToggle`).
- **Dashboard hierarchy (what the owner sees 1st → 3rd):**
  1. **Today at a glance** strip — today's revenue as the single largest number
     (with vs-yesterday delta), orders-waiting (links to live order log), low-stock
     alert count. This is the hero; it wins the first glance.
  2. **Live orders** panel — most time-sensitive work, with a "全部 →" to the full log.
  3. **Quick access** — compact list of the owner's modules (NOT a uniform
     3-column card grid; the sidebar already lists them — this is shortcuts + a
     single live stat each).
- **Anti-pattern (current dashboard):** three `$0` KPI cards + a module-card grid
  that duplicates the sidebar. Kill the duplication; lead with one real number.

## States (every screen specifies all five)
- **Empty is a feature.** Warmth + context + one primary action. Never "No items."
  e.g. orders empty → "还没有订单 No orders yet · 顾客扫码下单后会实时出现在这里" +
  "打开二维码 Open QR code" button.
- **Loading:** skeleton rows matching final layout (not a spinner on blank).
- **Error:** keep last-good data on screen if possible; inline message + retry.
  (Kitchen/order screens must never blank on a transient fetch error.)
- **Success:** brief, quiet confirmation (toast/inline), no modal walls.
- **Partial:** show what loaded; mark the rest loading. Don't block the whole view.

## Responsive (mobile is the owner's real device)
- **Critical gap to fix:** the current sidebar is `hidden md:flex` — phones get
  **no navigation**. Every screen must have mobile nav: a top bar with a hamburger
  → slide-over drawer of the same nav, OR a bottom tab bar for the 3–4 hottest
  destinations (Overview · Orders · Menu · more).
- **Dashboard on mobile:** the "today at a glance" strip stacks to one column,
  revenue still first; live-orders panel full width; quick-access below.
- Touch targets ≥ 44px; no hover-only affordances (mobile has no hover).

## Internationalization (standing rule)
- **All back-office UI supports EN / FR / 中** (see memory: i18n-three-languages,
  the shared `LangProvider` + `LangToggle`, key `bento_lang`). The dashboard,
  sidebar, module pages, and settings are currently zh-only and must be made
  trilingual when touched. Store/dish names stay in their own language; chrome and
  labels translate.

## Components (vocabulary)
- **Buttons:** primary = brand fill, pill, 700; secondary = brand wash + brand-ink;
  ghost = white + hairline border. Min height 40px (44px on mobile).
- **Status pills:** 新单/New = amber wash · 备餐/Preparing = info wash · 已完成/Done =
  brand wash · 已取消/Cancelled = neutral.
- **Panel:** white, hairline border, radius 12, 13/700 header with optional
  right-aligned "全部 →" link in brand-ink.
- **KPI / today strip:** segmented cells split by hairlines; hero cell carries the
  largest number; supporting cells carry counts + their own CTA/alert.
- **Cards earn existence:** only when the card *is* the interaction (a tappable
  shortcut, an order). No decorative card grids.

## Motion
- Minimal-functional. micro 80ms (press) · short 200ms (tab/drawer) · medium 300ms
  (slide-over). Easing: enter ease-out, exit ease-in. No decorative motion.

## Accessibility
- Contrast ≥ 4.5:1 body. Visible focus ring (brand) on every interactive element.
- Full keyboard nav; nav drawer trap-focuses and closes on Esc.
- ARIA landmarks: `nav`, `main`. Status changes (new order arrived) announced via
  `aria-live="polite"`.
- Don't encode meaning in color alone — status pills carry text labels too.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-19 | Platform design system created (system-first) | /plan-design-review; owner chose to establish the system before redesigning screens |
| 2026-06-19 | Accent = Emerald `#0E9F6E` | Owner pick from live board (Emerald vs Sage vs Deep); fresh/confident, unifies with emerald/sky landing, replaces legacy blue `#2563eb` |
| 2026-06-19 | Latin face = Plus Jakarta Sans; CJK = Noto Sans SC | Friendly humanist; deliberately distinct from the menu's General Sans + Noto Serif so the two brands don't blur |
| 2026-06-19 | Dashboard leads with one "today at a glance" number, not a $0 card grid | Owner glances 3s mid-shift; one real number + next action beats a wall of zeros and sidebar-duplicating cards |
| 2026-06-19 | Mobile nav is required (drawer or bottom tabs) | Current `hidden md:flex` sidebar leaves phones with zero navigation; owners are on phones |
| 2026-07-16 | Platform-internal admin surfaces (`/admin`) are EN-only | /plan-design-review 5-1A: trilingual rule scoped to merchant/customer-facing UI; internal allowlist-gated tools skip the 3× string tax. Merchant + diner surfaces remain EN/FR/中 |

## Reference
Approved visual board: `~/.gstack/projects/980717z-MVP/designs/platform-system-20260619/design-board.html`
