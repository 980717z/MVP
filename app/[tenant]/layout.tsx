"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { getTenant, myAccess, type Tenant } from "@/lib/store";
import { CATEGORIES, DOMAINS, MODULE_BY_ID } from "@/lib/catalog";
import { useLang, LangToggle } from "@/app/i18n";
import { signOut } from "@/lib/useAuth";

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

  const tl = (b: { zh: string; en: string }) => (lang === "zh" ? b.zh : b.en);

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
        <SidebarHead slug={slug} tenant={tenant} />
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">{nav}</nav>
        <div className="border-t border-[#F3F2EE] px-2.5 py-3">
          <NavLink href={`/${slug}/settings`} active={pathname === `/${slug}/settings`} icon="⚙️">
            {tl({ zh: "设置 · 员工 · 功能", en: "Settings" })}
          </NavLink>
          <button
            onClick={handleLogout}
            className="mt-px flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition hover:bg-red-50 hover:text-red-600"
          >
            <span className="w-5 flex-none text-center text-[15px] leading-none">⎋</span>
            <span className="min-w-0 truncate">{tl({ zh: "退出登录", en: "Sign out" })}</span>
          </button>
        </div>
      </aside>

      {/* mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-white shadow-xl">
            <SidebarHead slug={slug} tenant={tenant} onClose={() => setNavOpen(false)} />
            <nav className="flex-1 overflow-y-auto px-2.5 py-3">{nav}</nav>
            <div className="border-t border-[#F3F2EE] px-2.5 py-3">
              <NavLink href={`/${slug}/settings`} active={pathname === `/${slug}/settings`}>
                ⚙️ {tl({ zh: "设置 · 员工 · 功能", en: "Settings" })}
              </NavLink>
              <button
                onClick={handleLogout}
                className="mt-px flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-soft transition hover:bg-red-50 hover:text-red-600"
              >
                <span className="w-5 flex-none text-center text-[15px] leading-none">⎋</span>
                <span className="min-w-0 truncate">{tl({ zh: "退出登录", en: "Sign out" })}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* shared top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#EBEAE5] bg-white/90 px-4 py-2.5 backdrop-blur lg:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={() => setNavOpen(true)}
              className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-[#EBEAE5] text-ink-soft md:hidden"
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

function SidebarHead({ slug, tenant, onClose }: { slug: string; tenant?: Tenant; onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-[#F3F2EE] px-4 py-4">
      <div>
        <Link href="/app" className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-[7px] bg-brand text-[13px] text-white">🍱</span>
          <span className="text-sm font-extrabold tracking-tight">BentoOS</span>
        </Link>
        <div className="mt-3">
          <div className="text-sm font-bold text-ink" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>{tenant?.name.zh}</div>
          {tenant?.name.en && tenant.name.en !== tenant.name.zh && (
            <div className="text-[11px] uppercase tracking-wide text-ink-faint">{tenant.name.en}</div>
          )}
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-lg leading-none text-ink-faint" aria-label="close navigation">✕</button>
      )}
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
  tl: (b: { zh: string; en: string }) => string;
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
        {tl({ zh: "总览", en: "Overview" })}
      </NavLink>

      {DOMAINS.map((dom) => {
        const mods = modsIn(dom.id);
        if (mods.length === 0) return null;
        return (
          <div key={dom.id} className="mt-4">
            <div className="px-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              {dom.id === "frontend" ? `🛎️ ${tl({ zh: "前台", en: "Front of house" })}` : `🗄️ ${tl({ zh: "后台", en: "Back office" })}`}
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
          {tl({ zh: "增减功能", en: "Add / remove modules" })}
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
