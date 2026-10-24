import { useCallback, useEffect, useState } from 'react'
import { emptyModsSnapshot, type ModDetail, type ModsSnapshot } from './mods'

export type ModsState = {
  snapshot: ModsSnapshot
  loading: boolean
  error: string | null
  rescan: () => Promise<void>
  setEnabled: (id: string, enabled: boolean) => Promise<void>
  getDetail: (id: string) => Promise<ModDetail | null>
  reveal: (id: string) => Promise<boolean>
}

const bridge = () => (typeof window !== 'undefined' ? window.skilldex?.mods : undefined)

export function useMods(): ModsState {
  const [snapshot, setSnapshot] = useState<ModsSnapshot>(emptyModsSnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const rescan = useCallback(async () => {
    const mods = bridge()
    if (!mods) {
      setLoading(false)
      setError('Skilldex must run in the desktop app to read your mods.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await mods.list())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void rescan()
  }, [rescan])

  const setEnabled = useCallback(async (id: string, enabled: boolean) => {
    const mods = bridge()
    if (!mods) return
    // Flip the switch right away; the snapshot from disk confirms or reverts it.
    setSnapshot((current) => ({
      ...current,
      mods: current.mods.map((mod) => (mod.id === id ? { ...mod, enabled } : mod)),
    }))
    try {
      setSnapshot(await mods.setEnabled(id, enabled))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setSnapshot(await mods.list())
    }
  }, [])

  const getDetail = useCallback((id: string) => bridge()?.getDetail(id) ?? Promise.resolve(null), [])
  const reveal = useCallback((id: string) => bridge()?.reveal(id) ?? Promise.resolve(false), [])

  return { snapshot, loading, error, rescan, setEnabled, getDetail, reveal }
}
