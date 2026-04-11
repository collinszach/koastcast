import type { MetadataRoute } from 'next'

const SPOT_SLUGS = [
  'mavericks-ca',
  'steamer-lane-ca',
  'ocean-beach-sf-ca',
  'rincon-ca',
  'lower-trestles-ca',
  'blacks-beach-ca',
  'pipeline-oahu-hi',
  'sebastian-inlet-fl',
  'cape-hatteras-nc',
  'montauk-ny',
]

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://peakcast.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/map`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/upgrade`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ]

  // Public spot pages (high priority for SEO)
  const spotPages: MetadataRoute.Sitemap = SPOT_SLUGS.map(slug => ({
    url: `${BASE_URL}/surf/${slug}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.95,
  }))

  return [...staticPages, ...spotPages]
}
