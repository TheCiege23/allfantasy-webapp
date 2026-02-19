import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700']
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover' as const,
};

export const metadata: Metadata = {
  title: 'AllFantasy \u2014 AI Fantasy Sports Co-GM',
  description: 'Real-time AI drafts, waivers, start/sit & rankings for NFL, NBA, MLB. Built for serious leagues.',
  metadataBase: new URL('https://allfantasy.ai'),
  alternates: {
    canonical: 'https://allfantasy.ai/',
  },
  openGraph: {
    title: 'AllFantasy \u2014 Your League\'s Secret Weapon',
    description: 'AI that actually understands modern fantasy. Join the waitlist.',
    url: 'https://allfantasy.ai/',
    siteName: 'AllFantasy',
    type: 'website',
    images: [{ url: '/og-image.jpg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AllFantasy \u2014 Your League\'s Secret Weapon',
    description: 'AI that actually understands modern fantasy. Join the waitlist.',
  },
  icons: { icon: '/af-crest.png' },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#22d3ee" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}
        </Script>
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
      <body className={`${inter.variable} bg-[#0a0a0f] text-white antialiased min-h-screen`}>
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
