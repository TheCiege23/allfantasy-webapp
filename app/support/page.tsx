'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, ArrowLeft, Server, Brain, Zap, Shield, Users, BarChart3, ExternalLink } from 'lucide-react'
import { ModeToggle } from '@/components/theme/ModeToggle'

const DONATE_URL = 'https://buy.stripe.com/8x2dR97g99vh7Va9dl7ok01'

const FUND_ITEMS = [
  {
    icon: Server,
    title: 'Servers & Infrastructure',
    desc: 'Keeping the platform fast, reliable, and always available for your league.',
    color: '#22d3ee',
  },
  {
    icon: Brain,
    title: 'AI & Data Costs',
    desc: 'Powering trade evaluations, player rankings, and the AI tools you rely on.',
    color: '#a855f7',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Data Feeds',
    desc: 'Live scoring, injury updates, news, depth charts, and market values from multiple sources.',
    color: '#f59e0b',
  },
  {
    icon: Zap,
    title: 'New Features',
    desc: 'Building the next wave of tools — smarter drafts, deeper analytics, and more league types.',
    color: '#22c55e',
  },
  {
    icon: Shield,
    title: 'Security & Privacy',
    desc: 'Protecting your account, league data, and personal information.',
    color: '#ef4444',
  },
  {
    icon: Users,
    title: 'Community Growth',
    desc: 'Expanding to new sports, new platforms, and more fantasy formats.',
    color: '#3b82f6',
  },
]

export default function SupportPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium transition hover:opacity-80"
            style={{ color: 'var(--muted)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <ModeToggle className="rounded-xl px-3 py-2 text-sm font-semibold active:scale-[0.98] transition" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Heart className="w-8 h-8 text-red-400" fill="currentColor" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
              Support AllFantasy
            </h1>
            <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted)' }}>
              AllFantasy is built by a small team passionate about making fantasy sports smarter for everyone.
              Your donations go directly to keeping the lights on and building the tools you love.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FUND_ITEMS.map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="p-4 rounded-xl"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: item.color + '15' }}>
                    <item.icon className="w-4.5 h-4.5" style={{ color: item.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{item.title}</div>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--muted2)' }}>{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-md mx-auto p-6 rounded-2xl space-y-5"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Make a Donation</h2>
              <p className="text-[11px]" style={{ color: 'var(--muted2)' }}>One-time contribution · No account needed</p>
            </div>

            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-xl py-3.5 text-sm font-bold transition active:scale-[0.97] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(to right, #ef4444, #f97316)', color: 'white' }}
            >
              <Heart className="w-4 h-4" /> Donate Now <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>

            <div className="flex items-center justify-center gap-3">
              <img src="https://cdn.brandfolder.io/KGT2DTA4/at/8vbr53pc5rw" alt="Stripe" className="h-5 opacity-40" />
              <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>Secure payments via Stripe</span>
            </div>
          </motion.div>

          <div className="text-center pb-8">
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>
              Subscriptions coming soon — stay tuned for monthly supporter plans with exclusive perks.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
