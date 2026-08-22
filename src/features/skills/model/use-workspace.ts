import { useCallback, useEffect, useState } from 'react'
import {
  emptySnapshot,
  toSkill,
  type CreateSkillInput,
  type InstallRepoSkillInput,
  type RepoCatalog,
  type Skill,
  type SkillFile,
  type WorkspaceConfig,
  type WorkspaceSnapshot,
} from './skills'

export type WorkspaceState = {
  skills: Skill[]
  snapshot: WorkspaceSnapshot
  config: WorkspaceConfig | null
  loading: boolean
  error: string | null
  rescan: () => Promise<void>
  configure: (config: WorkspaceConfig) => Promise<void>
  pickDirectory: () => Promise<string | null>
  getReadme: (id: string) => Promise<string | null>
  listFiles: (id: string) => Promise<SkillFile[] | null>
  reveal: (id: string) => Promise<boolean>
  enable: (id: string) => Promise<WorkspaceSnapshot | null>
  disable: (id: string) => Promise<WorkspaceSnapshot | null>
  remove: (id: string) => Promise<WorkspaceSnapshot | null>
  toggleFavourite: (id: string) => Promise<WorkspaceSnapshot | null>
  updateReadme: (id: string, content: string) => Promise<WorkspaceSnapshot | null>
  create: (input: CreateSkillInput) => Promise<WorkspaceSnapshot | null>
  repoCatalogs: RepoCatalog[]
  reposLoading: boolean
  addRepo: (input: string) => Promise<void>
  removeRepo: (slug: string) => Promise<void>
  refreshRepo: (slug: string) => Promise<void>
  installRepoSkill: (input: InstallRepoSkillInput) => Promise<WorkspaceSnapshot | null>
}

const bridge = () => (typeof window !== 'undefined' ? window.skilldex?.workspace : undefined)

export function useWorkspace(): WorkspaceState {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(emptySnapshot)
  const [config, setConfig] = useState<WorkspaceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [repoCatalogs, setRepoCatalogs] = useState<RepoCatalog[]>([])
  const [reposLoading, setReposLoading] = useState(false)

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
    void workspace.getConfig().then(setConfig)
    await run(() => workspace.getSnapshot())
  }, [run])

  // A mutation that surfaces its failure to the caller so the UI can react
  // (e.g. keep a confirmation dialog open) rather than only setting error state.
  const mutate = useCallback(
    async (
      op: (workspace: NonNullable<ReturnType<typeof bridge>>) => Promise<WorkspaceSnapshot>,
    ): Promise<WorkspaceSnapshot | null> => {
      const workspace = bridge()
      if (!workspace) return null
      try {
        const next = await op(workspace)
        setSnapshot(next)
        setError(null)
        return next
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        setError(message)
        throw new Error(message)
      }
    },
    [],
  )

  const configure = useCallback(async (next: WorkspaceConfig) => {
    const workspace = bridge()
    if (!workspace) return
    setLoading(true)
    setError(null)
    try {
      setSnapshot(await workspace.configureSources(next))
      setConfig(next) // only after the write succeeds, so state can't diverge
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const pickDirectory = useCallback(() => bridge()?.pickDirectory() ?? Promise.resolve(null), [])

  const getReadme = useCallback((id: string) => bridge()?.getSkillReadme(id) ?? Promise.resolve(null), [])
  const listFiles = useCallback((id: string) => bridge()?.listSkillFiles(id) ?? Promise.resolve(null), [])
  const reveal = useCallback((id: string) => bridge()?.revealSkill(id) ?? Promise.resolve(false), [])
  const enable = useCallback((id: string) => mutate((w) => w.enableSkill(id)), [mutate])
  const disable = useCallback((id: string) => mutate((w) => w.disableSkill(id)), [mutate])
  const remove = useCallback((id: string) => mutate((w) => w.removeSkill(id)), [mutate])
  const toggleFavourite = useCallback((id: string) => mutate((w) => w.toggleFavourite(id)), [mutate])
  const updateReadme = useCallback(
    (id: string, content: string) => mutate((w) => w.updateSkillReadme(id, content)),
    [mutate],
  )
  const create = useCallback((input: CreateSkillInput) => mutate((w) => w.createSkill(input)), [mutate])

  // A repo mutation that surfaces its failure to the caller (dialogs keep
  // their error inline) while keeping the catalog list in sync on success.
  const mutateRepos = useCallback(async (op: () => Promise<RepoCatalog[]> | undefined) => {
    setReposLoading(true)
    try {
      const next = await op()
      if (next) setRepoCatalogs(next)
    } finally {
      setReposLoading(false)
    }
  }, [])

  const addRepo = useCallback(
    (input: string) => mutateRepos(() => bridge()?.addSkillRepo(input)),
    [mutateRepos],
  )
  const removeRepo = useCallback(
    (slug: string) => mutateRepos(() => bridge()?.removeSkillRepo(slug)),
    [mutateRepos],
  )
  const refreshRepo = useCallback(
    (slug: string) => mutateRepos(() => bridge()?.refreshSkillRepo(slug)),
    [mutateRepos],
  )
  const installRepoSkill = useCallback(
    (input: InstallRepoSkillInput) => mutate((w) => w.installRepoSkill(input)),
    [mutate],
  )

  useEffect(() => {
    void rescan()
    // Repo catalogs load independently of the local scan — they hit the
    // network, so a slow or offline GitHub never blocks the local library.
    setReposLoading(true)
    bridge()
      ?.listRepoCatalogs()
      .then(setRepoCatalogs)
      .catch(() => {})
      .finally(() => setReposLoading(false))
  }, [rescan])

  return {
    skills: snapshot.skills.map(toSkill),
    snapshot,
    config,
    loading,
    error,
    rescan,
    configure,
    pickDirectory,
    getReadme,
    listFiles,
    reveal,
    enable,
    disable,
    remove,
    toggleFavourite,
    updateReadme,
    create,
    repoCatalogs,
    reposLoading,
    addRepo,
    removeRepo,
    refreshRepo,
    installRepoSkill,
  }
}
