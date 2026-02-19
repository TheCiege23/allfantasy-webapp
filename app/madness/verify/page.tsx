'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { toast } from 'sonner'

function VerifyContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }

    fetch(`/api/madness/verify?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('success')
          toast.success('Account verified!')
          setTimeout(() => {
            window.location.href = '/madness/home'
          }, 1500)
        } else {
          setStatus('error')
          toast.error(data.error || 'Invalid token')
        }
      })
      .catch(() => {
        setStatus('error')
        toast.error('Verification failed')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-lg">Verifying your account...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl">&#10003;</div>
            <p className="text-green-400 text-lg font-semibold">Account verified!</p>
            <p className="text-gray-500 text-sm">Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl text-red-400">&#10007;</div>
            <p className="text-red-400 text-lg font-semibold">Verification failed</p>
            <p className="text-gray-500 text-sm">The link may be invalid or expired.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
