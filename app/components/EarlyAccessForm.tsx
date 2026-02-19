'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { gtagEvent } from '@/lib/gtag'

const schema = z.object({
  name: z.string().optional().transform(v => v?.trim() || undefined),
  email: z.string().email('Please enter a valid email'),
})

type FormData = z.infer<typeof schema>

export default function EarlyAccessForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  })

  const [utmParams, setUtmParams] = useState({
    utm_source: null as string | null,
    utm_medium: null as string | null,
    utm_campaign: null as string | null,
    utm_content: null as string | null,
    utm_term: null as string | null,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setUtmParams({
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
    })
  }, [])

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const eventId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name || undefined,
          email: data.email,
          eventId,
          ...utmParams,
        }),
      })

      const result = await res.json()

      if (!res.ok) throw new Error(result.error || 'Failed to join')

      gtagEvent('early_access_signup_submitted', { is_new: !result?.alreadyExists })

      const getCookie = (name: string) =>
        document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))?.[2]
      fetch('/api/meta/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          email: data.email,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
          source_url: window.location.href,
        }),
      }).catch(() => {})

      toast.success("You're in! Check your email for next steps.", { duration: 5000 })
      reset()

      const encoded = encodeURIComponent(data.email)
      router.push(`/success?email=${encoded}${result?.alreadyExists ? '&existing=true' : ''}`)
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          {...register('name')}
          placeholder="Full name (optional)"
          className="flex-1 rounded-xl px-5 py-4 outline-none transition-all"
          style={{ background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          disabled={loading}
        />
        <input
          {...register('email')}
          type="email"
          required
          placeholder="your@email.com"
          className="flex-1 rounded-xl px-5 py-4 outline-none transition-all"
          style={{ background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          disabled={loading}
        />
      </div>
      {errors.email && (
        <p className="text-xs text-red-400 px-1">{errors.email.message}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl py-4 font-bold text-lg text-black shadow-xl
                   bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400
                   hover:shadow-2xl hover:brightness-110 active:scale-[0.985]
                   transition-all disabled:opacity-60 flex items-center justify-center gap-3"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Joining the revolution...
          </>
        ) : (
          'Get AI Early Access →'
        )}
      </button>

      <p className="text-center text-xs" style={{ color: 'var(--muted2)' }}>
        No spam ever. Founding members get 10 days Pro free.
      </p>
    </form>
  )
}
