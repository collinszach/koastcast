import type { Metadata, Viewport } from 'next'
import { Archivo, JetBrains_Mono, Inter } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
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
    default: 'Koastcast — AI Outdoor Intelligence',
    template: '%s | Koastcast',
  },
  description:
    'More accurate, more personal surf and outdoor forecasts powered by AI and full spectral wave analysis. Personalized Peak Score™, optimal window finder, real-time NOAA buoy data.',
  keywords: ['surf forecast', 'surf report', 'wave forecast', 'surf conditions', 'AI surf', 'outdoor intelligence'],
  authors: [{ name: 'Koastcast' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://koastcast.com'),
  openGraph: {
    title: 'Koastcast — AI Outdoor Intelligence',
    description: 'Personalized surf forecasts powered by AI. Peak Score™, optimal windows, full spectral analysis.',
    type: 'website',
    siteName: 'Koastcast',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Koastcast' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Koastcast — AI Outdoor Intelligence',
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
    title: 'Koastcast',
  },
}

export const viewport: Viewport = {
  themeColor: '#F7F5F0',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${archivo.variable} ${jetbrainsMono.variable} ${inter.variable} antialiased min-h-screen`}
        style={{ background: '#F7F5F0', color: '#12181F' }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  )
}
