import type { Metadata, Viewport } from 'next'
import './globals.css'
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: {
    default: 'Apex University — Premium Online Education',
    template: '%s | Apex University',
  },
  description:
    'Transform your career and finances with premium online courses from world-class instructors. Wealth, business, sales, AI, and more.',
  keywords: ['online courses', 'business education', 'wealth building', 'entrepreneurship'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Apex University',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Apex U',
  },
  icons: {
    apple: '/icons/icon-180.png',
    icon:  '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor:    '#eab308',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
  userScalable:  false,
  viewportFit:   'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}
