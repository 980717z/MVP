"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { getTenant, myAccess, type Tenant } from "@/lib/store";
import { CATEGORIES, DOMAINS, MODULE_BY_ID } from "@/lib/catalog";
import { useLang, LangToggle } from "@/app/i18n";
import { signOut } from "@/lib/useAuth";
import { BentoMark } from "@/components/BentoMark";

// Back-office shell font (DESIGN-PLATFORM.md): Plus Jakarta Sans + Noto Sans SC,
// scoped here so the jade customer menu and the landing keep their own faces.
const SHELL_FONT = '"Plus Jakarta Sans","Noto Sans SC",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const slug = params.tenant as string;
  const { lang } = useLang();
  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  // staff module access: null = unrestricted (owner / access=[])
  const [allowed, setAllowed] = useState<string[] | null>(null);

  useEffect(() => {
    myAccess(slug).then((a) => setAllowed(a?.allowed ?? null));
  }, [slug]);

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  useEffect(() => {
    let alive = true;
    getTenant(slug).then((t) => {
      if (!alive) return;
      setTenant(t);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [slug, pathname]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (ready && !tenant) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center" style={{ fontFamily: SHELL_FONT }}>
        <div>
          <p className="text-ink-soft">{lang === "zh" ? "找不到这个商家。" : lang === "fr" ? "Commerce introuvable." : "Store not found."}</p>
          <Link href="/" className="btn-primary mt-4">{lang === "zh" ? "返回首页" : lang === "fr" ? "Accueil" : "Home"}</Link>
        </div>
      </div>
    );
  }

  // Label resolver: fr falls back to en when a dict has no fr (e.g. catalog
  // module labels are {zh,en}), so the nav never blanks in French.
  const tl = (b: { zh: string; en: string; fr?: string }) => b[lang] ?? b.en;

  // staff with a restricted access[] only see their allowed modules (owner sees all)
  const visibleModules = (tenant?.enabled ?? []).filter((id) => !allowed || allowed.includes(id));
  const nav = (
    <NavTree slug={slug} pathname={pathname} enabled={visibleModules} tl={tl} lang={lang} />
  );

  return (
    <div className="flex min-h-screen bg-[#FBFAF8]" style={{ fontFamily: SHELL_FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* desktop sidebar */}
      <aside className="hidden w-60 flex-none border-r border-[#EBEAE5] bg-white md:flex md:flex-col">
        <SidebarHead slug={slug} tenant={tenant} tl={tl} />
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">{nav}</nav>
        <div className="border-t border-[#F3F2EE] px-2.5 py-3">
          <NavLink href={`/${slug}/settings`} active={pathname === `/${slug}/settings`} icon="⚙️">
            {tl({ zh: "设置 · 员工 · 功能", en: "Settings", fr: "Réglages" })}
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-px flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition hover:bg-red-50 hover:text-red-600"
          >
            <span className="w-5 flex-none text-center text-[15px] leading-none">⎋</span>
            <span className="min-w-0 truncate">{tl({ zh: "退出登录", en: "Sign out", fr: "Déconnexion" })}</span>
          </button>
        </div>
      </aside>

      {/* mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-white shadow-xl">
            <SidebarHead slug={slug} tenant={tenant} tl={tl} onClose={() => setNavOpen(false)} />
            <nav className="flex-1 overflow-y-auto px-2.5 py-3">{nav}</nav>
            <div className="border-t border-[#F3F2EE] px-2.5 py-3">
              <NavLink href={`/${slug}/settings`} active={pathname === `/${slug}/settings`}>
                ⚙️ {tl({ zh: "设置 · 员工 · 功能", en: "Settings", fr: "Réglages" })}
              </NavLink>
              <button
                onClick={handleLogout}
                className="mt-px flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition hover:bg-red-50 hover:text-red-600"
              >
                <span className="w-5 flex-none text-center text-[15px] leading-none">⎋</span>
                <span className="min-w-0 truncate">{tl({ zh: "退出登录", en: "Sign out", fr: "Déconnexion" })}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* shared top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#EBEAE5] bg-white/90 px-4 py-2.5 backdrop-blur lg:px-7">
          {/* Shop identity here is MOBILE-ONLY — on desktop the sidebar shows it,
              so repeating it would double up. On mobile the sidebar is a drawer,
              so this is the only persistent "whose shop is this". */}
          <div className="flex min-w-0 items-center gap-2.5 md:hidden">
            <button
              onClick={() => setNavOpen(true)}
              className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-[#EBEAE5] text-ink-soft"
              aria-label="open navigation"
            >
              ☰
            </button>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold text-ink" style={{ fontFamily: lang === "zh" ? '"Noto Sans SC",sans-serif' : SHELL_FONT }}>
                {tenant?.name.zh}
                {tenant?.name.en && tenant.name.en !== tenant.name.zh && (
                  <span className="ml-2 text-xs font-medium text-ink-faint">{tenant.name.en}</span>
                )}
              </div>
              {tenant?.address && <div className="truncate text-[11px] text-ink-faint">{tenant.address}</div>}
            </div>
          </div>
          <LangToggle className="flex-none" />
        </header>

        <div className="min-w-0 flex-1 overflow-x-hidden">{children}</div>
      </div>
    </div>
  );
}

function SidebarHead({ slug, tenant, onClose, tl }: { slug: string; tenant?: Tenant; onClose?: () => void; tl: (b: { zh: string; en: string; fr?: string }) => string }) {
  // Shop-first: this is the merchant's OWN back office, so the shop is the
  // identity. BentoOS shrinks to a quiet, still-clickable home affordance.
  const initial = (tenant?.name.zh || tenant?.name.en || slug || "·").trim().charAt(0);
  return (
    <div className="border-b border-[#F3F2EE] px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        {/* shop logo → this shop's Overview */}
        <Link href={`/${slug}`} onClick={onClose} className="flex min-w-0 items-center gap-2.5">
          <div
            className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-brand-wash text-[17px] font-semibold text-brand-ink"
            style={{ fontFamily: '"Noto Sans SC",sans-serif' }}
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold leading-tight text-ink" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{tenant?.name.zh}</div>
            {tenant?.name.en && tenant.name.en !== tenant.name.zh && (
              <div className="truncate text-xs text-ink-soft">{tenant.name.en}</div>
            )}
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="flex-none text-lg leading-none text-ink-faint" aria-label="close navigation">✕</button>
        )}
      </div>
      {/* humble attribution → the BentoOS landing (bentoos.io) */}
      <div className="mt-2.5 flex justify-end">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[10.5px] text-ink-faint transition hover:text-ink" title="BentoOS">
          <BentoMark className="h-3.5 w-3.5" />
          {tl({ zh: "由 BentoOS 提供支持", en: "powered by BentoOS", fr: "propulsé par BentoOS" })}
        </Link>
      </div>
    </div>
  );
}

function NavTree({
  slug,
  pathname,
  enabled,
  tl,
  lang,
}: {
  slug: string;
  pathname: string;
  enabled: string[];
  tl: (b: { zh: string; en: string; fr?: string }) => string;
  lang: string;
}) {
  // category id → domain, so we can group by the two domains only (no per-category
  // sub-headings — they create a staircase when each category holds one module).
  const catDomain = new Map(CATEGORIES.map((c) => [c.id, c.domain]));
  const modsIn = (domId: string) =>
    enabled.map((id) => MODULE_BY_ID[id]).filter((m) => m && catDomain.get(m.category) === domId);

  return (
    <>
      <NavLink href={`/${slug}`} active={pathname === `/${slug}`} icon="▦">
        {tl({ zh: "总览", en: "Overview", fr: "Aperçu" })}
      </NavLink>

      {DOMAINS.map((dom) => {
        const mods = modsIn(dom.id);
        if (mods.length === 0) return null;
        return (
          <div key={dom.id} className="mt-4">
            <div className="px-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              {dom.id === "frontend" ? `🛎️ ${tl({ zh: "前台", en: "Front of house", fr: "Salle" })}` : `🗄️ ${tl({ zh: "后台", en: "Back office", fr: "Back-office" })}`}
            </div>
            {mods.map((m) => (
              <NavLink key={m!.id} href={`/${slug}/m/${m!.id}`} active={pathname === `/${slug}/m/${m!.id}`} icon={m!.icon}>
                {tl(m!.label)}
              </NavLink>
            ))}
          </div>
        );
      })}

      <div className="mt-4 border-t border-[#F3F2EE] pt-3">
        <NavLink href={`/${slug}/settings`} active={false} icon="＋">
          {tl({ zh: "增减功能", en: "Add / remove modules", fr: "Ajouter / retirer des modules" })}
        </NavLink>
      </div>
    </>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`mb-px flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition ${
        active ? "bg-brand-wash font-semibold text-brand-ink" : "text-ink-soft hover:bg-[#F3F2EE]"
      }`}
    >
      {icon && <span className="w-5 flex-none text-center text-[15px] leading-none">{icon}</span>}
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}
