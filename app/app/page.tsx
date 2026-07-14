"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTenant, loadTenants } from "@/lib/store";
import { useAuth, signOut } from "@/lib/useAuth";
import { isValidSlug } from "@/lib/qrContract";
import { useLang, type Dict } from "@/app/i18n";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 店型 → 预选模块（templates/*.json 的浅层镜像；完整 provision 走
// scripts/provision-sql.ts，向导深化见 TODOS「建店向导打磨」）
const SHOP_TYPES: { id: string; icon: string; label: Dict; hint: Dict; modules: string[] }[] = [
  { id: "chinese-restaurant", icon: "🍲", label: { zh: "中餐馆", en: "Restaurant", fr: "Restaurant" }, hint: { zh: "堂食桌码 + 外卖", en: "Dine-in QR + takeout", fr: "Sur place + à emporter" }, modules: ["menu-generator", "qr-menu", "online-orders"] },
  { id: "counter-service", icon: "🥡", label: { zh: "自取小店", en: "Counter service", fr: "Comptoir" }, hint: { zh: "无桌码 · 重会员", en: "No tables · members", fr: "Sans tables · membres" }, modules: ["menu-generator", "qr-menu", "online-orders", "members"] },
  { id: "custom", icon: "⚙️", label: { zh: "自定义", en: "Custom", fr: "Personnalisé" }, hint: { zh: "创建后再选模块", en: "Pick modules after", fr: "Choisir les modules après" }, modules: [] as string[] },
];

const T = {
  title: { en: "First, name your shop", zh: "先给你的店铺起个名字", fr: "D'abord, nommez votre boutique" },
  intro: { en: "This is the door to your back office. Once named, you and your staff sign in through this address.", zh: "这是你专属后台的入口。命名后,你和你的员工都通过这个网址进入。", fr: "C'est la porte de votre arrière-boutique. Une fois nommée, vous et votre personnel y accédez par cette adresse." },
  shopName: { en: "Shop name", zh: "店铺名称", fr: "Nom de la boutique" },
  shopNamePh: { en: "e.g. Golden Wok / 老王面馆", zh: "如:老王面馆 / Golden Wok", fr: "ex. Golden Wok / 老王面馆" },
  handle: { en: "Your address", zh: "专属网址", fr: "Votre adresse" },
  handleNote: { en: "Letters and numbers only (pinyin or English recommended). ⚠️ The address can't change once physical signs are made.", zh: "只能用字母、数字(建议用拼音或英文)。⚠️ 做实体牌子后网址不可更改。", fr: "Lettres et chiffres seulement (pinyin ou anglais recommandé). ⚠️ L'adresse ne peut changer une fois les enseignes imprimées." },
  shopType: { en: "Shop type", zh: "店铺类型", fr: "Type de boutique" },
  creating: { en: "Creating…", zh: "创建中…", fr: "Création…" },
  createCta: { en: "Create my back office →", zh: "创建我的后台 →", fr: "Créer mon arrière-boutique →" },
  signOut: { en: "Sign out", zh: "退出", fr: "Se déconnecter" },
  loading: { en: "Loading…", zh: "载入中…", fr: "Chargement…" },
  errName: { en: "Please enter a shop name", zh: "请填写店铺名称", fr: "Veuillez saisir un nom de boutique" },
  errSlug: { en: "The address needs letters or numbers — enter an English handle below (e.g. fulai)", zh: "专属网址需要字母或数字,请在下方填一个英文名(如 fulai)", fr: "L'adresse a besoin de lettres ou chiffres — saisissez un identifiant ci-dessous (ex. fulai)" },
  errReserved: { en: "” is a reserved word (it would clash with a page route) — pick another", zh: "」是系统保留字(会和页面路由冲突),请换一个", fr: " » est un mot réservé (conflit de route) — choisissez-en un autre" },
  errFormat: { en: "The address needs 3–30 lowercase letters, numbers or hyphens", zh: "专属网址需要 3-30 位小写字母、数字或短横线", fr: "L'adresse doit contenir 3 à 30 lettres minuscules, chiffres ou tirets" },
  errCreate: { en: "Creation failed, please retry", zh: "创建失败,请重试", fr: "Échec de la création, réessayez" },
} satisfies Record<string, Dict>;

export default function AppGate() {
  const router = useRouter();
  const { t } = useLang();
  const { session, loading, email } = useAuth();
  const [checking, setChecking] = useState(true);

  // store-naming form state
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // gate: not logged in → login; already has a store → go straight to it
  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    loadTenants().then((tenants) => {
      if (tenants.length > 0) {
        router.replace(`/${tenants[0].slug}`);
      } else {
        setChecking(false);
      }
    });
  }, [session, loading, router]);

  const slug = slugify(handleTouched ? handle : name);
  const [shopType, setShopType] = useState(SHOP_TYPES[0].id);

  const create = async () => {
    if (!name.trim()) {
      setErr(t(T.errName));
      return;
    }
    if (!slug) {
      setErr(t(T.errSlug));
      return;
    }
    // QR 合约 gate（lib/qrContract.ts）：格式 + 路由保留字，DB CHECK 同步兜底
    const sv = isValidSlug(slug);
    if (!sv.ok) {
      setErr(sv.reason === "reserved"
        ? `“${slug}${t(T.errReserved)}`
        : t(T.errFormat));
      return;
    }
    setBusy(true);
    setErr(null);
    const enabled = SHOP_TYPES.find((t) => t.id === shopType)?.modules ?? [];
    const res = await createTenant({ name: name.trim(), slug, enabled });
    if (res.slug) {
      router.replace(`/${res.slug}`);
    } else {
      setBusy(false);
      setErr(res.error ?? t(T.errCreate));
    }
  };

  if (loading || !session || checking) {
    return <main className="grid min-h-screen place-items-center text-ink-faint">{t(T.loading)}</main>;
  }

  // ── forced store-naming step (no other buttons) ──────────────────────────
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-2xl">🍱</span>
          <span className="text-lg font-bold tracking-tight">BentoOS</span>
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold text-ink">{t(T.title)}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t(T.intro)}
          </p>

          <label className="label mt-5">{t(T.shopName)}</label>
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder={t(T.shopNamePh)}
          />

          <label className="label mt-4">{t(T.handle)}</label>
          <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 focus-within:border-brand">
            <span className="select-none text-sm text-ink-faint">bentoos.io/</span>
            <input
              className="w-full bg-transparent py-2 text-sm outline-none"
              value={handleTouched ? handle : slug}
              onChange={(e) => {
                setHandleTouched(true);
                setHandle(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="fulai"
            />
          </div>
          <p className="mt-1 text-xs text-ink-faint">{t(T.handleNote)}</p>

          <label className="label mt-4">{t(T.shopType)}</label>
          <div className="grid grid-cols-3 gap-2">
            {SHOP_TYPES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setShopType(st.id)}
                className={`rounded-xl border-2 px-2 py-2.5 text-center transition ${
                  shopType === st.id ? "border-brand bg-brand-wash" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="text-lg">{st.icon}</div>
                <div className={`mt-0.5 text-xs font-semibold ${shopType === st.id ? "text-brand" : "text-ink"}`}>{t(st.label)}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-ink-faint">{t(st.hint)}</div>
              </button>
            ))}
          </div>

          {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <button className="btn-primary mt-5 w-full disabled:opacity-50" onClick={create} disabled={busy}>
            {busy ? t(T.creating) : t(T.createCta)}
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-ink-faint">
          {email} · <button onClick={() => signOut().then(() => router.replace("/login"))} className="hover:text-ink">{t(T.signOut)}</button>
        </div>
      </div>
    </main>
  );
}
