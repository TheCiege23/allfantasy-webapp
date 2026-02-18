export function getBaseUrl(): string | null {
  const url = process.env.NEXTAUTH_URL
  if (url) return url.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`
  const replit = process.env.REPLIT_DEV_DOMAIN
  if (replit) return `https://${replit.replace(/\/$/, "")}`
  return null
}
