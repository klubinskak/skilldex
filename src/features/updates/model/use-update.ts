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

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

export function useUpdate() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null)

  useEffect(() => {
    let active = true
    void window.skilldex?.updates
      ?.check()
      .then((next) => {
        if (active && next && next.version !== readDismissed()) setUpdate(next)
      })
      .catch(() => {})
    return () => {
      active = false
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
