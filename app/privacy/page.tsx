"use client";

// /privacy — plain-language privacy notice (PIPEDA-oriented), customer-facing.
// Trilingual EN/FR/中 per DESIGN-PLATFORM (this is a diner/student-facing page,
// not an internal tool). Platform brand. Linked from the menu, campus, and
// landing footers. Not legal advice; written to be readable, not exhaustive.

import Link from "next/link";
import { useLang, LangToggle, type Dict } from "@/app/i18n";
import { BentoMark } from "@/components/BentoMark";

const T: Record<string, Dict> = {
  title: { en: "Privacy", zh: "隐私说明", fr: "Confidentialité" },
  updated: { en: "Last updated July 16, 2026", zh: "最后更新:2026年7月16日", fr: "Dernière mise à jour : 16 juillet 2026" },
  intro: {
    en: "BentoOS runs the ordering menus and back-office for small restaurants and campus food vendors. This note explains, in plain language, what we collect when you use bentoos.io or order from a menu we host, and why.",
    zh: "BentoOS 为小餐馆和校园餐车提供点餐菜单和后台系统。这份说明用大白话讲清楚:你在 bentoos.io 或我们托管的菜单上点餐时,我们会收集什么、为什么收集。",
    fr: "BentoOS fournit les menus de commande et l’arrière-guichet de petits restaurants et de comptoirs sur les campus. Cette note explique simplement ce que nous recueillons lorsque vous utilisez bentoos.io ou commandez depuis un menu que nous hébergeons, et pourquoi.",
  },
  h_collect: { en: "What we collect", zh: "我们收集什么", fr: "Ce que nous recueillons" },
  collect: {
    en: "• When you place an order: your phone number (so the restaurant can confirm or call about it), your order details, and for takeout or delivery, your email and delivery address.\n• Order-ready alerts: if you turn them on, a browser push subscription so we can notify you.\n• Anonymous usage: which pages were viewed or tapped, tied only to a random per-visit token. No name, phone, or email is attached.",
    zh: "• 下单时:你的电话号码(方便餐馆确认或来电),你点的菜品,以及外卖/外送时的邮箱和送餐地址。\n• 取餐提醒:如果你开启,会保存一个浏览器推送订阅,用于通知你。\n• 匿名使用数据:哪些页面被浏览或点击,只关联一个随机的、每次访问生成的标识,不含姓名、电话或邮箱。",
    fr: "• Lorsque vous commandez : votre numéro de téléphone (pour que le restaurant confirme ou vous appelle), le détail de votre commande et, pour l’emporter ou la livraison, votre courriel et votre adresse de livraison.\n• Alertes « commande prête » : si vous les activez, un abonnement push du navigateur pour vous notifier.\n• Usage anonyme : quelles pages ont été vues ou touchées, rattaché uniquement à un jeton aléatoire par visite. Aucun nom, téléphone ni courriel.",
  },
  h_why: { en: "Why we collect it", zh: "为什么收集", fr: "Pourquoi" },
  why: {
    en: "To take and fulfill your order, to let the restaurant reach you about it, to send the alerts you asked for, and to understand which pages people use. That’s it.",
    zh: "用来接单和备餐、方便餐馆就订单联系你、发送你主动开启的提醒,以及了解大家常用哪些页面。仅此而已。",
    fr: "Pour prendre et préparer votre commande, permettre au restaurant de vous joindre à son sujet, envoyer les alertes que vous avez demandées et comprendre quelles pages sont utilisées. Rien de plus.",
  },
  h_payments: { en: "Payments", zh: "付款", fr: "Paiements" },
  payments: {
    en: "Payments go directly to the restaurant or vendor. When online payment is offered, card details are handled by our payment provider (Clover). We never see or store your card number.",
    zh: "付款直接进入餐馆或商家账户。开通在线支付时,银行卡信息由我们的支付服务商(Clover)处理,我们不会看到也不会保存你的卡号。",
    fr: "Les paiements vont directement au restaurant ou au commerçant. Lorsque le paiement en ligne est proposé, les données de carte sont traitées par notre prestataire (Clover) — nous ne voyons ni ne stockons jamais votre numéro de carte.",
  },
  h_share: { en: "Who sees it", zh: "谁能看到", fr: "Qui y a accès" },
  share: {
    en: "Only the restaurant you ordered from sees your order and contact details, so they can fulfill it. We don’t sell your data, and we don’t use it for advertising.",
    zh: "只有你下单的那家餐馆能看到你的订单和联系方式,用于备餐。我们不出售你的数据,也不用于广告。",
    fr: "Seul le restaurant chez qui vous avez commandé voit votre commande et vos coordonnées, afin de la préparer. Nous ne vendons pas vos données et ne les utilisons pas à des fins publicitaires.",
  },
  h_keep: { en: "How long we keep it", zh: "保存多久", fr: "Durée de conservation" },
  keep: {
    en: "Orders are kept as part of the restaurant’s own records for their bookkeeping. Anonymous usage data is kept for about 180 days.",
    zh: "订单作为餐馆自己的经营记录保存,用于记账。匿名使用数据保存约 180 天。",
    fr: "Les commandes sont conservées dans les registres du restaurant pour sa comptabilité. Les données d’usage anonymes sont conservées environ 180 jours.",
  },
  h_students: { en: "Students (campus)", zh: "学生(校园)", fr: "Étudiants (campus)" },
  students: {
    en: "If you give a school email to verify you’re a student, we use it only to confirm that and to send messages about your orders. You can unsubscribe from those any time. BentoOS is independent and not affiliated with any university.",
    zh: "如果你提供校园邮箱来验证学生身份,我们只用它来完成验证并发送与订单相关的消息。你可以随时退订。BentoOS 是独立服务,与任何大学无隶属关系。",
    fr: "Si vous fournissez un courriel scolaire pour vérifier votre statut étudiant, nous l’utilisons uniquement pour cela et pour vous envoyer des messages sur vos commandes. Vous pouvez vous désabonner à tout moment. BentoOS est indépendant et n’est affilié à aucune université.",
  },
  h_choices: { en: "Your choices", zh: "你的权利", fr: "Vos choix" },
  choices: {
    en: "Want to see, correct, or delete the data tied to you? Email us and we’ll take care of it.",
    zh: "想查看、更正或删除与你相关的数据?给我们发邮件,我们会处理。",
    fr: "Vous voulez voir, corriger ou supprimer les données vous concernant ? Écrivez-nous et nous nous en occuperons.",
  },
  h_contact: { en: "Contact", zh: "联系", fr: "Contact" },
  back: { en: "← Back to BentoOS", zh: "← 返回 BentoOS", fr: "← Retour à BentoOS" },
};

export default function PrivacyPage() {
  const { t } = useLang();
  const SECTIONS: [Dict, Dict][] = [
    [T.h_collect, T.collect],
    [T.h_why, T.why],
    [T.h_payments, T.payments],
    [T.h_share, T.share],
    [T.h_keep, T.keep],
    [T.h_students, T.students],
    [T.h_choices, T.choices],
  ];
  return (
    <main className="min-h-screen bg-[#FBFAF8] text-ink" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", system-ui, sans-serif' }}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-ink-faint transition hover:text-ink">
            <BentoMark className="h-6 w-6" />
            <span className="text-sm font-semibold">{t(T.back)}</span>
          </Link>
          <LangToggle />
        </header>

        <h1 className="text-2xl font-bold text-ink">{t(T.title)}</h1>
        <p className="mt-1 text-xs text-ink-faint">{t(T.updated)}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">{t(T.intro)}</p>

        <div className="mt-8 space-y-7">
          {SECTIONS.map(([h, body]) => (
            <section key={h.en}>
              <h2 className="text-sm font-bold text-ink">{t(h)}</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{t(body)}</p>
            </section>
          ))}
          <section>
            <h2 className="text-sm font-bold text-ink">{t(T.h_contact)}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              <a href="mailto:allen.zhang@bentoos.io" className="font-medium text-brand-ink underline decoration-dotted underline-offset-2 hover:text-brand">allen.zhang@bentoos.io</a>
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t border-[#EBEAE5] pt-6 text-xs text-ink-faint">© 2026 BentoOS</footer>
      </div>
    </main>
  );
}
