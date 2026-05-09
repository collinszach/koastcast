'use client'

import { useState, useEffect, useCallback } from 'react'

interface SavedSpots {
  spots: string[]
  resorts: string[]
  trails: string[]
}

const STORAGE_KEY = 'koastcast_saved_spots'

function load(): SavedSpots {
  if (typeof window === 'undefined') return { spots: [], resorts: [], trails: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { spots: [], resorts: [], trails: [] }
    const parsed = JSON.parse(raw) as Partial<SavedSpots>
    return {
      spots:   Array.isArray(parsed.spots)   ? parsed.spots   : [],
      resorts: Array.isArray(parsed.resorts) ? parsed.resorts : [],
      trails:  Array.isArray(parsed.trails)  ? parsed.trails  : [],
    }
  } catch {
    return { spots: [], resorts: [], trails: [] }
  }
}

function save(data: SavedSpots): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full or blocked
  }
}

type Category = keyof SavedSpots

export function useSavedSpots() {
  const [saved, setSaved] = useState<SavedSpots>({ spots: [], resorts: [], trails: [] })

  useEffect(() => {
    setSaved(load())
  }, [])

  const isSaved = useCallback(
    (category: Category, slug: string): boolean => saved[category].includes(slug),
    [saved]
  )

  const toggle = useCallback((category: Category, slug: string): void => {
    setSaved(prev => {
      const list = prev[category]
      const next: SavedSpots = {
        ...prev,
        [category]: list.includes(slug)
          ? list.filter(s => s !== slug)
          : [...list, slug],
      }
      save(next)
      return next
    })
  }, [])

  return { saved, isSaved, toggle }
}
