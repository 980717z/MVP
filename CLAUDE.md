# BentoOS

Next.js 16 + React 19 + Supabase, deployed on Vercel. Multi-tenant back-office for
small merchants, plus per-restaurant customer-facing QR menus.

## ⚠️ Permanent QR contract (do not break)
Table QR codes are printed onto **physical custom signs**. Each encodes
`https://bentoos.io/menu/<slug>?t=<tableLabel>`. These are load-bearing and must
never change once signs are made:
- **Tenant `slug`** (e.g. `fulai`) — never rename; it's in every printed sign's URL.
- **Table labels** in `tenants.tables` (e.g. `1,2,2A,…,12`) — the `?t=` value must
  keep matching a printed sign. Add new tables freely; don't rename/remove existing ones.
- **Route `/menu/[tenant]` + the `?t=` and `?m=togo` params** — keep the URL shape stable.
Changing any of these silently breaks already-printed signs (customers scan → wrong/dead page).

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

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
