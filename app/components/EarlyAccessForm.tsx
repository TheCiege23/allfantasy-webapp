'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { gtagEvent } from '@/lib/gtag'

const track = gtagEvent

const earlyAccessSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
})
type EarlyAccessFormData = z.infer<typeof earlyAccessSchema>

interface UTMParams {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  referrer: string | null
}

interface EarlyAccessFormProps {
  variant?: 'hero' | 'footer'
}

export default function EarlyAccessForm({ variant = 'hero' }: EarlyAccessFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [utmParams, setUtmParams] = useState<UTMParams>({
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: null,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EarlyAccessFormData>({
    resolver: zodResolver(earlyAccessSchema),
    defaultValues: { email: '' },
  })

  useEffect(() => {
    setUtmParams({
      utm_source: searchParams.get('utm_source'),
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
      utm_content: searchParams.get('utm_content'),
      utm_term: searchParams.get('utm_term'),
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    })
  }, [searchParams])

  const onSubmit = async (formData: EarlyAccessFormData) => {
    try {
      const eventId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString()

      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          eventId,
          ...utmParams,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data?.error || 'Something went wrong. Please try again.')
        return
      }

      ;(window as any).fbq?.('track', 'CompleteRegistration', {}, { eventID: eventId })

      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
        return match ? match[2] : undefined
      }

      fetch('/api/meta/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          email: formData.email,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
          source_url: window.location.href,
        }),
      }).catch((err) => console.warn('Meta CAPI call failed:', err))

      track('early_access_signup_submitted', {
        is_new: !data?.alreadyExists,
      })

      toast.success("You're in! Redirecting...")

      const encodedEmail = encodeURIComponent(formData.email.trim())
      router.push(`/success?email=${encodedEmail}${data?.alreadyExists ? '&existing=true' : ''}`)
    } catch {
      toast.error('Network error. Please try again.')
    }
  }

  if (variant === 'footer') {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 p-2 rounded-2xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
          <div className="flex-1 w-full">
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="Enter your email"
              {...register('email')}
              className="w-full rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 outline-none text-base focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 transition-all min-h-[48px]"
              style={{ background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            {errors.email && (
              <p className="text-xs text-red-400 mt-1 px-1">{errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto rounded-xl px-6 sm:px-8 py-3.5 sm:py-4 font-bold text-black min-h-[48px]
                       bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto]
                       shadow-[0_8px_32px_rgba(34,211,238,0.4)]
                       hover:shadow-[0_12px_40px_rgba(34,211,238,0.5)] hover:translate-y-[-2px] hover:bg-right
                       active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-cyan-400/30
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSubmitting ? 'Saving...' : 'Get AI Early Access'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="rounded-2xl glow-box-strong backdrop-blur-xl p-2" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
          <div className="flex-1 w-full">
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="Enter your email"
              {...register('email')}
              className="w-full rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 outline-none text-base focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 transition-all min-h-[48px]"
              style={{ background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            {errors.email && (
              <p className="text-xs text-red-400 mt-1 px-1">{errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto rounded-xl px-6 sm:px-8 py-3.5 sm:py-4 font-bold text-base text-black min-h-[48px]
                       bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto]
                       shadow-[0_8px_32px_rgba(34,211,238,0.4),0_0_0_1px_rgba(34,211,238,0.2)]
                       hover:shadow-[0_12px_40px_rgba(34,211,238,0.5),0_0_0_1px_rgba(34,211,238,0.3)]
                       hover:translate-y-[-2px] hover:bg-right
                       active:translate-y-0 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-cyan-400/30
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSubmitting ? 'Saving...' : 'Get AI Early Access'}
          </button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-amber-500/15 border border-amber-400/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <span className="text-amber-400">🎁</span>
          <span className="text-[11px] sm:text-xs font-medium" style={{ color: 'var(--badge-text-amber)' }}>Founding users get 10 days of AF Pro free</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted2)' }}>
          No spam · Cancel anytime
        </p>
      </div>
    </form>
  )
}
