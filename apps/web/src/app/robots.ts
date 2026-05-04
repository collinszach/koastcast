import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nswell.zacharyjcollins.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/surf/', '/map'],
        disallow: ['/api/', '/onboarding', '/sessions', '/profile', '/api-portal'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
