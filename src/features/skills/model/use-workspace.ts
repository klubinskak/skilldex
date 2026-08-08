import { useCallback, useEffect, useState } from 'react'
import {
  emptySnapshot,
  toSkill,
  type Skill,
  type SkillFile,
  type WorkspaceConfig,
  type WorkspaceSnapshot,
} from './skills'

export type WorkspaceState = {
  skills: Skill[]
  snapshot: WorkspaceSnapshot
  loading: boolean
  error: string | null
  rescan: () => Promise<void>
  configure: (config: WorkspaceConfig) => Promise<void>
  getReadme: (id: string) => Promise<string | null>
  listFiles: (id: string) => Promise<SkillFile[] | null>
  reveal: (id: string) => Promise<boolean>
}

const bridge = () => (typeof window !== 'undefined' ? window.skilldex?.workspace : undefined)

export function useWorkspace(): WorkspaceState {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (task: () => Promise<WorkspaceSnapshot>) => {
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await task())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  const rescan = useCallback(async () => {
    const workspace = bridge()
    if (!workspace) {
      setLoading(false)
      setError('Skilldex must run in the desktop app to read your skills.')
      return
    }
    await run(() => workspace.getSnapshot())
  }, [run])

  const configure = useCallback(
    async (config: WorkspaceConfig) => {
      const workspace = bridge()
      if (!workspace) return
      await run(() => workspace.configureSources(config))
    },
    [run],
  )

  const getReadme = useCallback((id: string) => bridge()?.getSkillReadme(id) ?? Promise.resolve(null), [])
  const listFiles = useCallback((id: string) => bridge()?.listSkillFiles(id) ?? Promise.resolve(null), [])
  const reveal = useCallback((id: string) => bridge()?.revealSkill(id) ?? Promise.resolve(false), [])

  useEffect(() => {
    void rescan()
  }, [rescan])

  return {
    skills: snapshot.skills.map(toSkill),
    snapshot,
    loading,
    error,
    rescan,
    configure,
    getReadme,
    listFiles,
    reveal,
  }
}
