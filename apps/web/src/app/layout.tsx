import type { Metadata, Viewport } from 'next'
import { Syne, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: {
    default: 'Peakcast — AI Outdoor Intelligence',
    template: '%s | Peakcast',
  },
  description:
    'More accurate, more personal surf and outdoor forecasts powered by AI and full spectral wave analysis. Personalized Peak Score™, optimal window finder, real-time NOAA buoy data.',
  keywords: ['surf forecast', 'surf report', 'wave forecast', 'surf conditions', 'AI surf', 'outdoor intelligence'],
  authors: [{ name: 'Peakcast' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://peakcast.app'),
  openGraph: {
    title: 'Peakcast — AI Outdoor Intelligence',
    description: 'Personalized surf forecasts powered by AI. Peak Score™, optimal windows, full spectral analysis.',
    type: 'website',
    siteName: 'Peakcast',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Peakcast' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peakcast — AI Outdoor Intelligence',
    description: 'Personalized outdoor forecasts powered by AI.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Peakcast',
  },
}

export const viewport: Viewport = {
  themeColor: '#060D1A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${syne.variable} ${jetbrainsMono.variable} ${inter.variable} antialiased min-h-screen`}
        style={{ background: '#060D1A', color: '#E0F7FA' }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
