'use client'

import React, { useMemo, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles, Shield, Zap, Brain, Trophy, BarChart3, Search, FileText } from 'lucide-react'
import { ModeToggle } from '@/components/theme/ModeToggle'
import { BracketsNavLinks } from '@/components/bracket/BracketsNavLinks'
import EarlyAccessForm from '@/app/components/EarlyAccessForm'
import InstantTradeAnalyzer from '@/app/components/InstantTradeAnalyzer'

const NewsCrawl = dynamic(() => import('@/components/NewsCrawl'), {
  ssr: false,
  loading: () => null,
})

function DeferredNewsCrawl() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(() => setReady(true), { timeout: 4000 })
      return () => (window as any).cancelIdleCallback(id)
    } else {
      const t = setTimeout(() => setReady(true), 3000)
      return () => clearTimeout(t)
    }
  }, [])
  if (!ready) return null
  return <NewsCrawl />
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

function HomeContent() {
  const searchParams = useSearchParams()
  const [showCrestIntro, setShowCrestIntro] = useState(true)

  useEffect(() => {
    fetch('/api/track-visitor', { method: 'POST' }).catch(() => {})
  }, [searchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => setShowCrestIntro(false), 2400)
    return () => window.clearTimeout(timer)
  }, [])

  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'AllFantasy',
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Web',
      description:
        'AI-powered fantasy sports platform for drafts, waivers, start/sit, and modern league formats across NFL, NBA, and MLB.',
      url: 'https://allfantasy.ai/',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    }),
    []
  )

  return (
    <main className="min-h-screen relative overflow-x-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AnimatePresence>
        {showCrestIntro && (
          <motion.div
            className="crest-intro-overlay"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
          >
            <div className="crest-impact-flash" />
            <div className="crest-crack-overlay">
              <svg viewBox="0 0 1000 900" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <radialGradient id="crack-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                    <stop offset="40%" stopColor="rgba(200,220,255,0.6)" />
                    <stop offset="100%" stopColor="rgba(200,220,255,0)" />
                  </radialGradient>
                  <filter id="crack-blur">
                    <feGaussianBlur stdDeviation="0.8" />
                  </filter>
                </defs>
                {/* Central impact point */}
                <circle cx="500" cy="450" r="18" fill="rgba(255,255,255,0.25)" />
                <circle cx="500" cy="450" r="8" fill="rgba(255,255,255,0.5)" />
                {/* Main crack lines radiating from center - jagged paths like real cracked glass */}
                {/* Crack 1 - upper right */}
                <path d="M500 450 L518 430 L525 415 L540 400 L548 378 L560 355 L555 338 L570 310 L582 285 L590 260 L585 240 L598 210 L610 180 L605 155 L618 120" stroke="rgba(255,255,255,0.82)" strokeWidth="2.2" strokeLinecap="round" filter="url(#crack-blur)" />
                <path d="M540 400 L558 395 L575 382 L598 370 L620 358 L645 345 L670 330" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M570 310 L588 305 L610 298 L635 288 L660 275 L690 260" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
                {/* Crack 2 - upper left */}
                <path d="M500 450 L478 428 L465 412 L450 395 L435 375 L420 358 L408 335 L395 312 L385 288 L375 260 L368 235 L360 205 L355 175" stroke="rgba(255,255,255,0.78)" strokeWidth="2" strokeLinecap="round" filter="url(#crack-blur)" />
                <path d="M450 395 L432 388 L415 378 L395 372 L370 365 L345 355 L318 348" stroke="rgba(255,255,255,0.5)" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M408 335 L390 328 L372 325 L348 318 L320 310" stroke="rgba(255,255,255,0.35)" strokeWidth="1.1" strokeLinecap="round" />
                {/* Crack 3 - right */}
                <path d="M500 450 L525 455 L548 458 L575 462 L600 468 L628 470 L658 475 L690 478 L722 482 L755 485 L788 490 L820 492 L855 495" stroke="rgba(255,255,255,0.72)" strokeWidth="2" strokeLinecap="round" filter="url(#crack-blur)" />
                <path d="M628 470 L645 488 L665 505 L688 518 L715 532" stroke="rgba(255,255,255,0.42)" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M690 478 L708 465 L728 452 L752 438 L778 425" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" />
                {/* Crack 4 - left */}
                <path d="M500 450 L472 448 L445 445 L415 442 L385 438 L352 435 L318 432 L282 430 L245 428 L208 425 L170 422" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" filter="url(#crack-blur)" />
                <path d="M385 438 L368 422 L348 408 L325 395 L300 382" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
                {/* Crack 5 - lower right */}
                <path d="M500 450 L522 472 L535 492 L548 515 L558 540 L565 568 L572 598 L578 630 L585 665 L590 700 L595 738 L600 775" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" filter="url(#crack-blur)" />
                <path d="M548 515 L572 525 L598 535 L625 542 L655 548 L688 555" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M565 568 L545 582 L528 598 L510 618 L495 642" stroke="rgba(255,255,255,0.35)" strokeWidth="1.1" strokeLinecap="round" />
                {/* Crack 6 - lower left */}
                <path d="M500 450 L478 475 L462 498 L448 525 L435 555 L425 585 L418 618 L412 652 L408 688 L405 725" stroke="rgba(255,255,255,0.68)" strokeWidth="1.8" strokeLinecap="round" filter="url(#crack-blur)" />
                <path d="M448 525 L425 532 L400 538 L372 545 L342 552" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
                {/* Crack 7 - straight up */}
                <path d="M500 450 L502 420 L498 392 L503 360 L497 328 L502 295 L498 260 L503 225 L500 188 L502 150 L498 110" stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" strokeLinecap="round" filter="url(#crack-blur)" />
                <path d="M498 328 L480 315 L460 305 L438 295" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
                {/* Crack 8 - straight down */}
                <path d="M500 450 L498 482 L502 515 L497 548 L503 582 L498 618 L502 655 L497 692 L500 730 L498 768 L502 808" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" filter="url(#crack-blur)" />
                {/* Fine spider web cracks near center */}
                <path d="M500 450 L515 440 L528 425 L518 438" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round" />
                <path d="M500 450 L488 462 L475 470 L485 460" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round" />
                <path d="M500 450 L512 462 L520 478" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" strokeLinecap="round" />
                <path d="M500 450 L486 438 L478 422" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" strokeLinecap="round" />
                {/* Circular stress fractures around impact */}
                <path d="M468 418 Q480 408 500 410 Q520 408 532 418" stroke="rgba(255,255,255,0.25)" strokeWidth="0.7" fill="none" strokeLinecap="round" />
                <path d="M468 482 Q480 492 500 490 Q520 492 532 482" stroke="rgba(255,255,255,0.25)" strokeWidth="0.7" fill="none" strokeLinecap="round" />
                <path d="M445 395 Q470 375 500 378 Q530 375 555 395" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" fill="none" strokeLinecap="round" />
                <path d="M445 505 Q470 525 500 522 Q530 525 555 505" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <motion.img
              src="/af-crest.jpg"
              alt="AllFantasy Crest"
              className="crest-intro-image"
              initial={{ x: '-120vw', y: '-40vh', rotate: -24, scale: 0.55, opacity: 0 }}
              animate={{
                x: ['-120vw', '-5vw', '0vw', '2vw', '0vw', '45vw'],
                y: ['-40vh', '-5vh', '0vh', '-1vh', '0vh', '-20vh'],
                rotate: [-24, -5, 0, 2, -2, 18],
                scale: [0.55, 1.05, 1.2, 1.1, 1.12, 0.75],
                opacity: [0, 1, 1, 1, 1, 0],
              }}
              transition={{ duration: 2.1, ease: 'easeInOut', times: [0, 0.42, 0.55, 0.62, 0.74, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── HERO SECTION ── full viewport height */}
      <section className="relative min-h-screen flex flex-col justify-center px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-16 md:py-0">

        {/* AF Shield background watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img
            src="/af-logo-bg.png"
            alt=""
            aria-hidden="true"
            className="w-[90vw] h-[90vh] max-w-none object-contain opacity-[0.09] select-none"
            draggable={false}
          />
        </div>

        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -left-20 top-20 w-96 h-96 rounded-full blur-[120px] animate-pulse-slow" style={{ background: 'var(--hero-blob-1, rgba(34,211,238,0.08))' }} />
          <div className="absolute right-10 bottom-10 w-80 h-80 rounded-full blur-[120px] animate-pulse-slow" style={{ background: 'var(--hero-blob-2, rgba(168,85,247,0.08))' , animationDelay: '2s' }} />
          <div className="absolute left-1/2 top-1/3 w-64 h-64 rounded-full blur-[100px] animate-pulse-slow" style={{ background: 'var(--hero-blob-3, rgba(99,102,241,0.06))' , animationDelay: '4s' }} />
        </div>

        <div className="pointer-events-none absolute inset-0 noise-overlay" />

        {/* Top bar */}
        <div className="absolute top-6 left-0 right-0 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24 z-20">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <BracketsNavLinks />
            <img
              src="/af-logo-text.png"
              alt="AllFantasy"
              className="h-[48px] sm:h-[64px] md:h-[80px] object-contain select-none scale-[4] origin-center"
              draggable={false}
            />
            <ModeToggle className="rounded-xl px-3 py-2 text-sm font-semibold active:scale-[0.98] transition" />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-8 lg:gap-16 items-center"
        >
          {/* Left: Headline + Form */}
          <div className="text-center lg:text-left space-y-6 lg:space-y-8">
            <div className="space-y-3 lg:space-y-4">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]">
                <span className="block bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, var(--hero-from), var(--hero-via), var(--hero-to))' }}>
                  Stop guessing in fantasy football.
                </span>
                <span className="block mt-1 bg-[length:200%_auto] animate-gradient-x bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, var(--heading-from), var(--heading-to), var(--heading-from))' }}>
                  Let AI decide.
                </span>
              </h1>
              <p className="text-xl sm:text-2xl lg:text-3xl font-semibold leading-tight max-w-lg mx-auto lg:mx-0" style={{ color: 'var(--text)' }}>
                Smarter drafts, unbeatable trades, hidden waiver gems.
              </p>
            </div>

            <p className="text-base lg:text-lg leading-relaxed max-w-md mx-auto lg:mx-0 opacity-90" style={{ color: 'var(--muted)' }}>
              AI built for <strong style={{ color: 'var(--accent-cyan-strong)' }}>real players</strong> — dynasty, redraft, best ball. NFL now, more sports 2026.
            </p>

            {/* Inline Early Access Form */}
            <div className="mt-6 lg:mt-8 max-w-md mx-auto lg:mx-0">
              <EarlyAccessForm />
            </div>

            {/* Secondary CTAs */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-4 mt-6">
              <Link
                href="/af-legacy"
                className="group flex items-center gap-2 px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.97]"
                style={{ background: 'linear-gradient(to right, rgba(168,85,247,0.15), rgba(34,211,238,0.15))', border: '1px solid rgba(34,211,238,0.3)', color: 'var(--text)' }}
              >
                <Zap className="h-4 w-4" style={{ color: 'var(--accent-cyan-strong)' }} />
                AF Legacy Tools
              </Link>
              <Link
                href="/brackets"
                className="group flex items-center gap-2 px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.97]"
                style={{ background: 'linear-gradient(to right, rgba(99,102,241,0.15), rgba(168,85,247,0.15))', border: '1px solid rgba(168,85,247,0.3)', color: 'var(--text)' }}
              >
                <Trophy className="h-4 w-4" style={{ color: 'var(--accent-purple)' }} />
                Bracket Challenge
              </Link>
            </div>
          </div>

          {/* Right: Robot King + Trade Analyzer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative group flex flex-col items-center"
          >
            <img
              src="/af-robot-king.png"
              alt="AF Robot King"
              className="w-48 sm:w-56 md:w-64 object-contain select-none -mb-4"
              draggable={false}
            />
            <InstantTradeAnalyzer />
            <div className="absolute inset-0 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: 'linear-gradient(to bottom right, rgba(34,211,238,0.08), rgba(168,85,247,0.08))' }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── QUICK STATS ── */}
      <section className="py-16 sm:py-20 px-6" style={{ background: 'var(--panel)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 text-center">
          {[
            { value: '60s', label: 'Instant trade verdicts', color: 'var(--accent-cyan)' },
            { value: '4-Tier', label: 'Deterministic grading', color: 'var(--accent-purple)' },
            { value: 'Free', label: 'No signup required', color: 'var(--accent-emerald)' },
            { value: 'AI', label: 'Powered by GPT-4o', color: 'var(--accent-amber)' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <p className="mt-2 sm:mt-3 text-xs sm:text-sm" style={{ color: 'var(--muted2)' }}>{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── WHAT THE AI HELPS WITH ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 sm:mb-14"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent mb-3" style={{ backgroundImage: 'linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))' }}>
              What the AI Helps With
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--muted2)' }}>Three core tools. One smarter fantasy experience.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: BarChart3, title: 'Trade Coach', desc: 'Deterministic letter grades from a 4-layer engine — market value, lineup delta, replacement level, and manager context.', color: 'from-cyan-500/20 to-blue-500/20' },
              { icon: Search, title: 'Waiver Scout', desc: 'Scores every free agent using your roster needs, breakout age, athleticism, and dynasty ceiling.', color: 'from-emerald-500/20 to-teal-500/20' },
              { icon: FileText, title: 'Legacy Report', desc: 'Turns your league history into a shareable score with dynasty outlook, power rankings, and win window projections.', color: 'from-purple-500/20 to-pink-500/20' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="group p-5 sm:p-6 rounded-2xl transition-all hover:scale-[1.02]"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <item.icon className="h-6 w-6" style={{ color: 'var(--text)' }} />
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>{item.title}</h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI PREVIEW CARDS ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">

          {/* AI Trade Evaluator Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl p-5 sm:p-6"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/20 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4" style={{ color: 'var(--accent-cyan)' }} />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Trade Evaluator</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted2)' }}>Deterministic grades. No guesswork.</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 font-medium" style={{ color: 'var(--accent-cyan)' }}>4-Tier System</span>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.15)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black bg-gradient-to-br from-emerald-400/90 to-emerald-600/90 text-white shrink-0">B+</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text)' }}>Amon-Ra → Breece Hall + 1.08</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' }}>Dynasty</span>
                    <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>+420 delta</span>
                    <span className="text-[10px]" style={{ color: 'var(--accent-emerald)' }}>72% accept</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted2)' }}>Letter grades from a 4-layer deterministic engine — market value, lineup delta, replacement level, and manager context.</p>
          </motion.div>

          {/* Waiver AI Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl p-5 sm:p-6"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-500/20 flex items-center justify-center">
                  <Search className="h-4 w-4" style={{ color: 'var(--accent-emerald)' }} />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>Waiver Wire AI</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted2)' }}>Find hidden gems before your league does.</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 font-medium" style={{ color: 'var(--accent-emerald)' }}>League-Aware</span>
            </div>
            <div className="space-y-1.5 mb-3">
              {[
                { rank: 1, name: 'Jaylen Wright', tag: 'Stash', score: 91, color: 'from-emerald-400 to-emerald-500' },
                { rank: 2, name: 'Jaxon Smith-Njigba', tag: 'Start', score: 87, color: 'from-cyan-400 to-cyan-500' },
                { rank: 3, name: 'Quentin Johnston', tag: 'Stash', score: 74, color: 'from-amber-400 to-amber-500' },
              ].map((p) => (
                <div key={p.rank} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.06)' }}>
                  <span className="text-[10px] font-bold w-4 text-center" style={{ color: 'var(--muted2)' }}>{p.rank}</span>
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text)' }}>{p.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: p.tag === 'Start' ? 'rgba(34, 211, 238, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: p.tag === 'Start' ? 'var(--accent-cyan)' : 'var(--accent-purple)' }}>{p.tag}</span>
                  <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
                    <div className={`h-full bg-gradient-to-r ${p.color} rounded-full`} style={{ width: `${p.score}%` }} />
                  </div>
                  <span className="text-[10px] font-medium w-6 text-right" style={{ color: 'var(--accent-emerald)' }}>{p.score}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted2)' }}>Scores every free agent using your roster needs, breakout age, athleticism, and dynasty ceiling.</p>
          </motion.div>
        </div>
      </section>

      {/* ── LEAGUE TRANSFER ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto space-y-3"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))' }}>
              Bring Your League With You
            </h2>
            <p className="text-sm sm:text-base md:text-lg" style={{ color: 'var(--muted)' }}>
              Transfer your existing fantasy league into AllFantasy and let the AI take over — trades, rankings, lineups, and long-term insights included.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { status: 'Full Transfer', borderColor: 'rgba(16,185,129,0.2)', bgFrom: 'rgba(16,185,129,0.1)', dotColor: '#34d399', labelColor: 'var(--accent-emerald)', platforms: [{ icon: '😴', name: 'Sleeper' }, { icon: '🏈', name: 'MyFantasyLeague (MFL)' }], desc: 'League, rosters, settings, and history imported automatically.' },
              { status: 'Guided Transfer', borderColor: 'rgba(245,158,11,0.2)', bgFrom: 'rgba(245,158,11,0.1)', dotColor: '#fbbf24', labelColor: 'var(--accent-amber)', platforms: [{ icon: '🟣', name: 'Yahoo' }, { icon: '🔷', name: 'Fantrax' }, { icon: '🐝', name: 'Fleaflicker' }], desc: 'We import what\'s available and guide you through the rest.' },
              { status: 'Manual Import', borderColor: 'rgba(239,68,68,0.2)', bgFrom: 'rgba(239,68,68,0.1)', dotColor: '#f87171', labelColor: 'var(--accent-red)', platforms: [{ icon: '📺', name: 'ESPN' }, { icon: '🎯', name: 'FFPC' }], desc: 'Upload or paste league data — we handle the conversion.' },
            ].map((tier, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="rounded-2xl p-5"
                style={{ border: `1px solid ${tier.borderColor}`, background: `linear-gradient(to bottom right, ${tier.bgFrom}, transparent)` }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-3 h-3 rounded-full" style={{ background: tier.dotColor }} />
                  <span className="text-sm font-bold" style={{ color: tier.labelColor }}>{tier.status}</span>
                </div>
                <div className="space-y-2 mb-4">
                  {tier.platforms.map((p, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="text-base">{p.icon}</span>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{p.name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted2)' }}>{tier.desc}</p>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--muted2)' }}>
            <Shield className="inline h-3 w-3 mr-1" style={{ color: 'var(--muted2)' }} />
            Read-only. No passwords. Your original league stays untouched.
          </p>
        </div>
      </section>

      {/* ── AF LEGACY CTA ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6 sm:space-y-8"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))' }}>
              See the AI Work on Real Leagues
            </h2>
            <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: 'var(--muted2)' }}>Import your Sleeper leagues and watch the AI analyze trades, rosters, and dynasty trends instantly.</p>

            <div className="flex flex-col items-center gap-4">
              <Link
                href="/af-legacy"
                className="group inline-flex items-center justify-center gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-2xl text-base sm:text-lg font-bold text-white min-h-[52px]
                           bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 bg-[length:200%_100%] animate-gradient-x
                           shadow-[0_8px_40px_rgba(34,211,238,0.35),0_0_80px_rgba(168,85,247,0.15)]
                           hover:shadow-[0_12px_50px_rgba(34,211,238,0.5),0_0_100px_rgba(168,85,247,0.25)]
                           hover:scale-[1.03] active:scale-[0.97] transition-all duration-300"
              >
                <Zap className="h-5 w-5" />
                <span>Try AF Legacy Free</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <p className="text-xs" style={{ color: 'var(--muted2)' }}>No signup required · Most users try this before joining early access</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── BUILT BY PLAYERS ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24" style={{ borderTop: '1px solid var(--border)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto space-y-4 sm:space-y-5"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: 'var(--text)' }}>Built by players who actually play</h2>
          <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--muted2)' }}>
            AllFantasy isn't backed by a massive corporation or built to sell ads.
            It's built by competitive fantasy players who were tired of bad advice, shallow tools, and zero transparency.
          </p>
          <p className="text-xs sm:text-sm italic" style={{ color: 'var(--muted2)' }}>If you've ever said "this makes no sense," this is for you.</p>
        </motion.div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="waitlist" className="py-16 sm:py-24 px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24" style={{ borderTop: '1px solid var(--border)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-lg mx-auto text-center space-y-5"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))' }}>
            Be There When AllFantasy Launches
          </h2>
          <p className="text-sm sm:text-base" style={{ color: 'var(--muted2)' }}>Early access members get priority features, Pro trials, and early league tools.</p>

          <EarlyAccessForm />
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 sm:py-10 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-center">
            <a href="/privacy" className="px-3 sm:px-4 py-2 rounded-lg text-sm transition-all min-h-[44px] flex items-center hover:opacity-80" style={{ color: 'var(--muted2)' }}>Privacy</a>
            <a href="/terms" className="px-3 sm:px-4 py-2 rounded-lg text-sm transition-all min-h-[44px] flex items-center hover:opacity-80" style={{ color: 'var(--muted2)' }}>Terms</a>
            <a href="/pricing" className="px-3 sm:px-4 py-2 rounded-lg text-sm transition-all min-h-[44px] flex items-center hover:opacity-80" style={{ color: 'var(--muted2)' }}>Pricing</a>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted2)' }}>© {new Date().getFullYear()} AllFantasy — All rights reserved</p>
        </div>
      </footer>

      <a href="/admin" className="fixed bottom-14 right-4 opacity-20 hover:opacity-60 transition-opacity z-50" title="Admin">
        <svg viewBox="0 0 100 120" className="w-8 h-10">
          <defs>
            <linearGradient id="adminShield" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d="M50 5 L95 20 L95 55 C95 85 50 115 50 115 C50 115 5 85 5 55 L5 20 Z" fill="none" stroke="url(#adminShield)" strokeWidth="4" />
          <text x="50" y="65" textAnchor="middle" fill="url(#adminShield)" fontSize="28" fontWeight="bold">AF</text>
        </svg>
      </a>

      <DeferredNewsCrawl />
    </main>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
          <div style={{ color: 'var(--muted2)' }}>Loading...</div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
