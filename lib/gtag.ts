export function gtagEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, {
      ...params,
      page_path: window.location.pathname,
    });
  }
}
