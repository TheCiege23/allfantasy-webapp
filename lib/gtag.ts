export function gtagEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined') return

  const w = window as any
  const payload = {
    ...params,
    page_path: window.location.pathname,
  }

  if (typeof w.gtag === 'function') {
    w.gtag('event', eventName, payload)
    return
  }

  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push(['event', eventName, payload])
  }
}
