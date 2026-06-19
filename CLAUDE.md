# BentoOS

Next.js 16 + React 19 + Supabase, deployed on Vercel. Multi-tenant back-office for
small merchants, plus per-restaurant customer-facing QR menus.

## Design System
The customer menu for 富来小厨 / Sang's Seafood has a design system in **DESIGN.md**.
Always read DESIGN.md before making visual or UI decisions on the menu/storefront
(`app/menu/[tenant]`). Font choices, colors, spacing, and aesthetic direction are
defined there — do not deviate without explicit user approval. In QA/design review,
flag any menu code that doesn't match DESIGN.md.

The BentoOS platform UI (landing, pricing, demo, dashboard, settings, sidebar) is a
**separate brand** with its own design system in **DESIGN-PLATFORM.md** — calm app UI,
pastel **emerald** accent (`#0E9F6E`, replacing legacy blue `#2563eb`), Plus Jakarta Sans
+ Noto Sans SC, EN/FR/中 i18n. Read DESIGN-PLATFORM.md before visual/UI work on the
back-office or marketing surfaces; read DESIGN.md for the restaurant menu
(`app/menu/[tenant]`). Don't mix them: diner sees jade/paper, owner sees emerald/app-grey.
In QA/design review, flag platform code that doesn't match DESIGN-PLATFORM.md and menu code
that doesn't match DESIGN.md.
