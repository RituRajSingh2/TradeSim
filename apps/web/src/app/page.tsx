'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  LineChart,
  Trophy,
  Users,
  Smartphone,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';

// ---- Animation Variants ----

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

// ---- Feature Data ----

const features = [
  {
    icon: LineChart,
    title: 'Professional Charts',
    description:
      'Candlestick, line & volume charts with RSI, MACD, EMA, Bollinger Bands and more.',
  },
  {
    icon: Zap,
    title: 'Real-Time Prices',
    description:
      'Live NSE stock prices streamed via WebSocket. Trade at actual market prices.',
  },
  {
    icon: BarChart3,
    title: 'Portfolio Analytics',
    description:
      'Track your P&L, holdings, and trade history with detailed analytics dashboards.',
  },
  {
    icon: Shield,
    title: 'Zero Risk',
    description:
      'Trade with ₹10,000 virtual balance. Learn the markets without risking real money.',
  },
  {
    icon: Trophy,
    title: 'Leaderboards',
    description:
      'Compete with traders across India. Daily, weekly, and monthly rankings.',
  },
  {
    icon: Users,
    title: 'Referral Rewards',
    description:
      'Invite friends and earn bonus virtual capital. Build your trading community.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Sign Up',
    description: 'Quick phone verification. No KYC. No documents. Under 30 seconds.',
  },
  {
    step: '02',
    title: 'Get ₹10,000',
    description: 'Receive virtual trading capital instantly. Ready to trade immediately.',
  },
  {
    step: '03',
    title: 'Start Trading',
    description: 'Buy and sell NSE stocks at live market prices. Build your portfolio.',
  },
];

// ---- Page Component ----

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg-primary">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="mx-auto flex h-16 max-w-[var(--container-max)] items-center justify-between px-[var(--spacing-page)]">
          <Logo size="md" />

          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg-primary transition-all duration-200 hover:bg-accent-hover hover:shadow-glow active:scale-95"
          >
            Start Trading
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-dvh items-center overflow-hidden pt-16">
        {/* Background gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-info/5 blur-3xl" />
          <div className="absolute -bottom-20 right-1/3 h-64 w-64 rounded-full bg-accent/3 blur-3xl" />
        </div>

        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative mx-auto max-w-[var(--container-max)] px-[var(--spacing-page)]">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="mx-auto max-w-3xl text-center"
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="mb-6 inline-block">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-primary bg-bg-card px-4 py-1.5 text-xs font-medium text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
                NSE Market — Live Paper Trading
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeInUp}
              className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              Practice Trading.
              <br />
              <span className="gradient-text">Real Markets.</span>
              <br />
              Zero Risk.
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg"
            >
              Get ₹10,000 virtual capital. Trade NSE stocks with live market data,
              professional charts, and compete on leaderboards — all without
              risking a single rupee.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            >
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-bg-primary transition-all duration-200 hover:bg-accent-hover hover:shadow-glow active:scale-[0.98] sm:w-auto"
              >
                Start Trading Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-sm text-text-tertiary">
                No KYC required • Free forever
              </span>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="mt-16 grid grid-cols-3 gap-4 sm:gap-8"
            >
              {[
                { value: '₹10K', label: 'Virtual Capital' },
                { value: '30+', label: 'NSE Stocks' },
                { value: 'Live', label: 'Market Data' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-text-primary sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-text-tertiary sm:text-sm">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-page)]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="text-center"
          >
            <motion.p
              variants={fadeInUp}
              className="mb-3 text-sm font-medium uppercase tracking-widest text-accent"
            >
              Features
            </motion.p>
            <motion.h2
              variants={fadeInUp}
              className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Everything you need to learn trading
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="mx-auto mb-16 max-w-lg text-text-secondary"
            >
              Professional-grade tools in a simulated environment. Build confidence
              before you invest real money.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="group rounded-xl border border-border-subtle bg-bg-card p-6 transition-all duration-300 hover:border-border-primary hover:bg-bg-card-hover"
              >
                <div className="mb-4 inline-flex rounded-lg bg-accent-muted p-2.5">
                  <feature.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-primary">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border-subtle py-20 sm:py-28">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-page)]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="text-center"
          >
            <motion.p
              variants={fadeInUp}
              className="mb-3 text-sm font-medium uppercase tracking-widest text-accent"
            >
              How It Works
            </motion.p>
            <motion.h2
              variants={fadeInUp}
              className="mb-16 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Start trading in under a minute
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid gap-8 sm:grid-cols-3"
          >
            {steps.map((item, index) => (
              <motion.div key={item.step} variants={fadeInUp} className="relative text-center">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute top-8 left-1/2 hidden h-px w-full bg-gradient-to-r from-border-primary to-transparent sm:block" />
                )}
                <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border-primary bg-bg-card">
                  <span className="text-xl font-bold text-accent">{item.step}</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="mx-auto max-w-xs text-sm text-text-secondary">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border-subtle py-20 sm:py-28">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-page)]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="relative overflow-hidden rounded-2xl border border-border-primary bg-bg-card p-8 text-center sm:p-16"
          >
            {/* BG Glow */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-accent/8 blur-3xl" />
            </div>

            <motion.div variants={fadeInUp} className="relative">
              <Smartphone className="mx-auto mb-6 h-10 w-10 text-accent" />
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to start trading?
              </h2>
              <p className="mx-auto mb-8 max-w-md text-text-secondary">
                Join thousands of aspiring traders. Sign up with your phone number
                and start practicing in under 30 seconds.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-bg-primary transition-all duration-200 hover:bg-accent-hover hover:shadow-glow active:scale-[0.98]"
              >
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8">
        <div className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-page)]">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Logo size="sm" />
            <p className="text-xs text-text-muted">
              © {new Date().getFullYear()} TradeSim. Paper trading only. Not a registered broker.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
