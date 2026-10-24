import { useCallback, useEffect, useState } from 'react'

/** Mirror of the main process's update check (see electron/main/update-check.ts). */
export type AvailableUpdate = {
  version: string
  releaseUrl: string
  downloadUrl: string
  currentVersion: string
}

// The version the user closed the card for; a newer release shows it again.
const DISMISSED_KEY = 'skilldex.dismissedUpdate'

const RECHECK_MS = 6 * 60 * 60 * 1000

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

export function useUpdate() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null)

  // Ask on launch, whenever the window comes back into focus, and every few
  // hours, so a release (or a check that failed once) isn't missed until the
  // app restarts. The main process reuses a good answer for an hour.
  useEffect(() => {
    let active = true
    const check = () =>
      void window.skilldex?.updates
        ?.check()
        .then((next) => {
          if (active && next && next.version !== readDismissed()) setUpdate(next)
        })
        .catch(() => {})
    check()
    window.addEventListener('focus', check)
    const timer = window.setInterval(check, RECHECK_MS)
    return () => {
      active = false
      window.removeEventListener('focus', check)
      window.clearInterval(timer)
    }
  }, [])

  const dismiss = useCallback(() => {
    if (!update) return
    try {
      localStorage.setItem(DISMISSED_KEY, update.version)
    } catch {
      // Storage blocked: the card just comes back next launch.
    }
    setUpdate(null)
  }, [update])

  const open = useCallback((url: string) => void window.skilldex?.updates?.openRelease(url), [])

  return { update, dismiss, open }
}
