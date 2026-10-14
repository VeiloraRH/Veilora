import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, History, Laptop, Server, Fingerprint } from "lucide-react";
import { Logo } from "@/components/ui";
import { Orbits, SectionTitle, SiteFooter } from "@/components/site/chrome";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { t, type Locale } from "@/lib/locale";

const group: Variants = {
  hidden: {},
  visible: (reduce: boolean) => ({
    transition: { delayChildren: reduce ? 0 : 0.04, staggerChildren: reduce ? 0 : 0.09 },
  }),
};
const item: Variants = {
  hidden: (reduce: boolean) => ({ opacity: reduce ? 1 : 0, y: reduce ? 0 : 20 }),
  visible: (reduce: boolean) => ({ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] } }),
};
const features = [
  { icon: ArrowUpRight, title: "Send", text: "Review the recipient and amount before authorizing a transfer." },
  { icon: ArrowDownLeft, title: "Receive", text: "Copy your account address or share its QR code." },
  { icon: ArrowLeftRight, title: "Swap", text: "Compare available Uniswap v3 and v4 routes before trading." },
  { icon: History, title: "Activity", text: "Search and filter your on-chain transaction history." },
];
const shards = [
  { icon: Laptop, title: "Shard A · Device", text: "Encrypted on this device and unlocked with your passphrase." },
  { icon: Server, title: "Shard B · Co-signer", text: "Backend co-signing requires your device signature for the exact transaction." },
  { icon: Fingerprint, title: "Shard C · Recovery", text: "Keep your offline recovery key somewhere safe." },
];

export function Landing({ locale = "en" }: { locale?: Locale }) {
  const reduceMotion = Boolean(useReducedMotion());
  const copy = (value: string) => t(locale, value);
  return (
    <div className="site relative isolate overflow-hidden bg-ink-900 text-cream" lang={locale === "zh" ? "zh-CN" : "en"}>
      <section className="relative overflow-hidden px-5 py-24 sm:px-10 sm:py-32">
        <Orbits className="inset-0 h-full w-full opacity-80" />
        <motion.div className="relative mx-auto max-w-6xl" initial="hidden" animate="visible" variants={group} custom={reduceMotion}>
          <motion.div variants={item} custom={reduceMotion}><Logo size={54} /></motion.div>
          <motion.p className="eyebrow mt-10" variants={item} custom={reduceMotion}>{copy("A focused wallet for Robinhood Chain")}</motion.p>
          <motion.h1 className="mt-6 max-w-4xl font-display text-5xl leading-[1.05] text-cream sm:text-7xl" variants={item} custom={reduceMotion}>
            {copy("Your assets. Your keys.")} <span className="text-brand-gradient">{copy("Clear control.")}</span>
          </motion.h1>
          <motion.p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist" variants={item} custom={reduceMotion}>
            {copy("Hold ETH, USDG and supported Robinhood Chain assets. Send, receive, compare swap routes, and follow your transaction history in one simple wallet.")}
          </motion.p>
          <motion.div className="mt-10 flex flex-wrap gap-3" variants={item} custom={reduceMotion}>
            <Link to="/app" className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-semibold text-ink-900 hover:bg-gold-300">
              {copy("Open wallet")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/roadmap" className="inline-flex items-center gap-2 rounded-xl border border-cream/25 px-6 py-3 text-sm text-cream hover:border-gold-400">
              {copy("View roadmap")}
            </Link>
          </motion.div>
          <motion.div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" variants={group} custom={reduceMotion}>
            {features.map(({ icon: Icon, title, text }) => (
              <motion.article key={title} className="panel p-5" variants={item} custom={reduceMotion}>
                <Icon className="h-5 w-5 text-gold-300" />
                <h2 className="mt-4 font-medium text-cream">{copy(title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-mist">{copy(text)}</p>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </section>
      <section id="wallet" className="px-5 py-20 sm:px-10">
        <motion.div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={group} custom={reduceMotion}>
          <motion.div variants={item} custom={reduceMotion}>
            <SectionTitle eyebrow={copy("Threshold self-custody")} title={copy("Two keys approve every move.")}>
              {copy("A Veilora account uses a 2-of-3 threshold. The backend co-signer only signs after it verifies an authorization from your device key.")}
            </SectionTitle>
          </motion.div>
          <motion.div className="grid gap-3" variants={group} custom={reduceMotion}>
            {shards.map(({ icon: Icon, title, text }) => (
              <motion.div key={title} className="panel flex gap-4 p-5" variants={item} custom={reduceMotion}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold-400/30 bg-gold-400/5 text-gold-300"><Icon className="h-5 w-5" /></span>
                <div><h3 className="font-medium text-cream">{copy(title)}</h3><p className="mt-1 text-sm leading-relaxed text-mist">{copy(text)}</p></div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>
      <section className="px-5 py-20 text-center sm:px-10">
        <div className="mx-auto max-w-3xl">
          <SectionTitle eyebrow={copy("Robinhood Chain · 4663")} title={copy("Start with the essentials.")}>
            {copy("The wallet currently supports transparent on-chain transactions. Transaction details remain visible on the public blockchain.")}
          </SectionTitle>
          <Link to="/app" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-semibold text-ink-900 hover:bg-gold-300">
            {copy("Launch Veilora")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </div>
  );
}
