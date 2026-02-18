'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { gtagEvent } from '@/lib/gtag'

const track = gtagEvent

const earlyAccessSchema = z.object({
  name: z.string().min(2, { message: 'Name is too short' }),
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
    reset,
  } = useForm<EarlyAccessFormData>({
    resolver: zodResolver(earlyAccessSchema),
    defaultValues: { name: '', email: '' },
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
          name: formData.name,
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="footer-name" className="sr-only">Name</Label>
            <Input
              id="footer-name"
              placeholder="Full name"
              autoComplete="name"
              disabled={isSubmitting}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-red-400 mt-1 px-1">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="footer-email" className="sr-only">Email</Label>
              <Input
                id="footer-email"
                type="email"
                placeholder="Email address"
                autoComplete="email"
                inputMode="email"
                disabled={isSubmitting}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-400 mt-1 px-1">{errors.email.message}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                'Get Early Access →'
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-center pt-1" style={{ color: 'var(--muted2)' }}>
          No spam · Cancel anytime
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <Label htmlFor="hero-name" className="sr-only">Name</Label>
        <Input
          id="hero-name"
          placeholder="Full name"
          autoComplete="name"
          disabled={isSubmitting}
          {...register('name')}
        />
        {errors.name && (
          <p className="mt-1.5 text-sm text-red-400">{errors.name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="hero-email" className="sr-only">Email</Label>
        <Input
          id="hero-email"
          type="email"
          placeholder="Email address"
          autoComplete="email"
          inputMode="email"
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email && (
          <p className="mt-1.5 text-sm text-red-400">{errors.email.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        size="lg"
        className="w-full py-6 text-lg rounded-xl shadow-lg"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Joining...
          </>
        ) : (
          'Get Early Access →'
        )}
      </Button>

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
