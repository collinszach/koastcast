'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export interface UserLocation {
  lat: number
  lng: number
  accuracy?: number
}

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unknown'

interface LocationState {
  location: UserLocation | null
  permission: LocationPermission
  locating: boolean
  error: string | null
  isWatching: boolean
}

interface LocationActions {
  requestLocation: () => void
  stopWatching: () => void
  clearLocation: () => void
}

export type LocationContextValue = LocationState & LocationActions

const LocationContext = createContext<LocationContextValue | null>(null)

const STORAGE_KEY = 'koastcast_user_location'
const DISMISS_KEY = 'koastcast_loc_prompt_dismissed'

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [permission, setPermission] = useState<LocationPermission>('unknown')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setIsWatching(false)
    }
  }, [])

  const startWatching = useCallback((silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) { setError('Geolocation not supported'); setTimeout(() => setError(null), 3000) }
      return
    }
    stopWatching()
    if (!silent) { setLocating(true); setError(null) }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords
        setLocating(false)
        setIsWatching(true)
        setLocation({ lat: latitude, lng: longitude, accuracy })
        setPermission('granted')
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: latitude, lng: longitude })) } catch { /* ignore */ }
      },
      err => {
        setLocating(false)
        setIsWatching(false)
        const denied = err.code === err.PERMISSION_DENIED
        setPermission(denied ? 'denied' : 'prompt')
        if (!silent || !denied) {
          const msg = denied ? 'Location access denied' : 'Could not get location'
          setError(msg)
          setTimeout(() => setError(null), 4000)
        }
        stopWatching()
      },
      { timeout: 15000, maximumAge: 30000, enableHighAccuracy: true }
    )
  }, [stopWatching])

  const requestLocation = useCallback(() => {
    startWatching(false)
  }, [startWatching])

  const clearLocation = useCallback(() => {
    setLocation(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  // On mount: restore cached location, check permission
  useEffect(() => {
    // Restore cached location from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as UserLocation
        if (parsed.lat && parsed.lng) setLocation(parsed)
      }
    } catch { /* ignore */ }

    // Check permission state
    if (!navigator.permissions) { setPermission('prompt'); return }
    navigator.permissions.query({ name: 'geolocation' }).then(status => {
      setPermission(status.state as LocationPermission)
      if (status.state === 'granted') startWatching(true)
      status.addEventListener('change', () => {
        setPermission(status.state as LocationPermission)
        if (status.state === 'granted') startWatching(true)
        if (status.state === 'denied') stopWatching()
      })
    }).catch(() => setPermission('prompt'))

    return () => { stopWatching() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <LocationContext.Provider value={{ location, permission, locating, error, isWatching, requestLocation, stopWatching, clearLocation }}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider')
  return ctx
}

export function dismissLocationPrompt() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
}

export function isLocationPromptDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    // Re-show after 7 days
    return Date.now() - Number(ts) < 7 * 24 * 60 * 60 * 1000
  } catch { return false }
}
