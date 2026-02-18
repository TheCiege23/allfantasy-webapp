import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover' as const,
}

export const metadata: Metadata = {
  title: 'AllFantasy — AI Fantasy Sports, Early Access',
  description: 'AI-powered fantasy sports for drafts, waivers, and start/sit—across NFL, NBA, and MLB. Join early access and help shape the future of AllFantasy.',
  metadataBase: new URL('https://allfantasy.ai'),
  alternates: {
    canonical: 'https://allfantasy.ai/',
  },
  openGraph: {
    title: 'AllFantasy — AI Fantasy Sports, Upgraded',
    description: 'AI draft help, waivers, trades, and start/sit—built for modern fantasy players across NFL, NBA, and MLB. Join early access.',
    url: 'https://allfantasy.ai/',
    siteName: 'AllFantasy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AllFantasy — AI Fantasy Sports, Upgraded',
    description: 'AI draft help, waivers, trades, and start/sit—built for modern fantasy players across NFL, NBA, and MLB. Join early access.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17768764414"
          strategy="afterInteractive"
        />
        <Script id="google-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17768764414');
            gtag('config', 'G-LY788DCM6K');
          `}
        </Script>
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      </head>
      <body className={`${inter.className} min-h-screen`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: 'var(--panel)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
