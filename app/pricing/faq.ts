import type { Dict } from "@/app/i18n";

// Single source of truth for the pricing FAQ — rendered by the client page AND
// used to generate FAQPage JSON-LD in the server layout (EN), so the structured
// data can never drift from the visible copy.
export type FaqItem = { q: Dict; a: Dict };

export const PRICING_FAQ: FaqItem[] = [
  {
    q: { zh: "报价是怎么定的？", en: "How is the price decided?", fr: "Comment le tarif est-il fixé ?" },
    a: {
      zh: "看两件事：你需要哪些模块，以及店的规模。给出的是一个简单的固定月费——不按订单抽成，没有隐藏费用。一次对话就能给你确切数字。",
      en: "Two things: which modules you need, and the size of your shop. You get one simple flat monthly price — no per-order commission, no hidden fees. One conversation gets you an exact number.",
      fr: "Deux choses : les modules dont vous avez besoin et la taille de votre commerce. Vous obtenez un tarif mensuel fixe et simple — sans commission par commande, sans frais cachés. Une conversation suffit pour un chiffre exact.",
    },
  },
  {
    q: { zh: "需要用你们的 POS 或专用设备吗？", en: "Do I need your POS or special hardware?", fr: "Faut-il votre caisse ou du matériel spécial ?" },
    a: {
      zh: "不需要。不像那些捆绑式 POS 系统，我们不会逼你买一整套 POS 或专用机器。手机、平板、电脑——你现在有的设备就能用。如果你想要硬件（比如厨房打印机），我们按成本价帮你采购市面最好的，不加价。",
      en: "No. Unlike the big bundled POS systems, we don't make you buy a bundled POS or proprietary hardware. It runs on the phones, tablets, and computers you already have. If you do want hardware (like a kitchen printer), we source the best on the market at cost — no markup.",
      fr: "Non. Contrairement aux gros systèmes de caisse tout-en-un, nous ne vous obligeons pas à acheter une caisse ou du matériel propriétaire. Ça fonctionne sur les téléphones, tablettes et ordinateurs que vous avez déjà. Si vous voulez du matériel (comme une imprimante de cuisine), nous le procurons au prix coûtant — sans marge.",
    },
  },
  {
    q: { zh: "能帮我做网站 / 网上下单吗？", en: "Can you build my website / online store?", fr: "Pouvez-vous créer mon site / boutique en ligne ?" },
    a: {
      zh: "可以。我们按你的店定制网站和网上下单，通常只要主流建站平台一半左右的价钱——而且完全按你的需要来做。",
      en: "Yes. We build custom websites and online ordering tailored to your shop — typically about half the cost of a hosted store platform, and built to fit how you actually run.",
      fr: "Oui. Nous créons des sites et de la commande en ligne sur mesure — généralement environ la moitié du coût d'une plateforme de boutique hébergée, adaptés à votre façon de travailler.",
    },
  },
  {
    q: { zh: "现在有什么优惠？", en: "What's the launch offer?", fr: "Quelle est l'offre de lancement ?" },
    a: {
      zh: "现阶段：免费上门配置 + 首月免费。名额有限，标准配置，硬件另计。",
      en: "Right now: free setup + your first month free. Limited launch cohort, standard setup, hardware not included.",
      fr: "En ce moment : installation gratuite + premier mois offert. Cohorte de lancement limitée, installation standard, matériel non inclus.",
    },
  },
  {
    q: { zh: "需要签合同吗？", en: "Is there a contract?", fr: "Y a-t-il un contrat ?" },
    a: {
      zh: "不需要。随时可以停用，你的数据随时可以导出带走。",
      en: "No. Leave anytime, and export your data whenever you want.",
      fr: "Non. Partez quand vous voulez, et exportez vos données à tout moment.",
    },
  },
];
