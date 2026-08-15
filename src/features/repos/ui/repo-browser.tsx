import { useMemo, useState } from 'react'
import { AlertCircle, Check, Download, FileText, Link2, ListTree, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { iconColorsFor, monoFor, type RepoCatalog, type RepoSkill, type Skill } from '@/features/skills/model/skills'

type RepoBrowserProps = {
  catalog: RepoCatalog
  /** The local library, used to mark catalog skills that are already installed. */
  localSkills: Skill[]
  /** Slugs of every configured repo, so linked repos already added show as such. */
  configuredSlugs: string[]
  busy: boolean
  onRefresh: () => void
  onRemove: () => void
  onInstall: (skill: RepoSkill) => void
  onAddLinked: (slug: string) => Promise<void>
}

export function RepoBrowser({
  catalog,
  localSkills,
  configuredSlugs,
  busy,
  onRefresh,
  onRemove,
  onInstall,
  onAddLinked,
}: RepoBrowserProps) {
  const [query, setQuery] = useState('')

  // A catalog skill counts as installed when a local skill folder shares its
  // directory name — the name the install flow itself would use.
  const installedDirs = useMemo(
    () => new Set(localSkills.map((skill) => skill.realPath.split('/').filter(Boolean).pop() ?? '')),
    [localSkills],
  )

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return catalog.skills
    return catalog.skills.filter((skill) =>
      [skill.name, skill.description, skill.path].join(' ').toLowerCase().includes(value),
    )
  }, [catalog.skills, query])

  const isIndexRepo = !catalog.error && catalog.skills.length === 0 && catalog.linkedRepos.length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-7 pt-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] font-semibold tracking-tight text-[#fafafa]">{catalog.slug}</h1>
              <span className="rounded-[7px] border border-[#27272a] bg-[#18181b] px-2.5 py-1 text-[11px] font-medium text-[#a1a1aa]">
                Skill repo
              </span>
            </div>
            <p className="mt-1.5 max-w-[560px] font-mono text-[12px] text-[#71717a]">{catalog.url}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-[#27272a] bg-[#18181b] px-3 text-[12.5px] font-medium text-[#e4e4e7] transition hover:border-[#3a3a42] disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="flex h-[34px] items-center gap-1.5 rounded-[9px] border border-[#27272a] bg-[#18181b] px-3 text-[12.5px] font-medium text-[#a1a1aa] transition hover:border-[#4a2020] hover:text-[#f87171] disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
            Remove
          </button>
        </div>

        {!isIndexRepo && !catalog.error && (
          <div className="mt-5 flex items-center gap-3 border-b border-[#1c1c20] pb-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter skills…"
              className="h-[32px] w-[260px] rounded-[9px] border border-[#27272a] bg-[#111114] px-3 text-[13px] text-[#e4e4e7] outline-none placeholder:text-[#52525b] focus:border-[#3a3a42]"
            />
            <span className="text-[12px] text-[#52525b]">
              {catalog.skills.length} {catalog.skills.length === 1 ? 'skill' : 'skills'} on{' '}
              <span className="font-mono">{catalog.ref}</span>
              {catalog.truncated ? ' (listing truncated — very large repo)' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 pt-5">
        {catalog.error ? (
          <div className="flex items-center gap-2 rounded-xl border border-[#3f2020] bg-[#1a0f0f] px-4 py-3 text-[13px] text-[#f87171]">
            <AlertCircle className="size-4 shrink-0" />
            {catalog.error}
          </div>
        ) : isIndexRepo ? (
          <IndexRepoView catalog={catalog} configuredSlugs={configuredSlugs} onAddLinked={onAddLinked} />
        ) : catalog.skills.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#27272a] px-6 py-14 text-center text-[13px] text-[#71717a]">
            No skills found in this repo — no folder contains a SKILL.md.
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#27272a] px-6 py-14 text-center text-[13px] text-[#71717a]">
            No skills match “{query}”.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
            {visible.map((skill) => {
              const dirName = skill.path.split('/').filter(Boolean).pop() ?? skill.name
              const installed = installedDirs.has(dirName)
              const colors = iconColorsFor(skill.id)
              return (
                <div
                  key={skill.id}
                  className="flex flex-col gap-3 rounded-[13px] border border-[#232328] bg-[#101013] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="grid size-10 shrink-0 place-items-center rounded-[11px] font-mono text-[15px] font-semibold"
                      style={{ background: colors.bg, color: colors.fg }}
                    >
                      {monoFor(skill.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-[#fafafa]">{skill.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-[#52525b]">
                        {skill.path || '(repo root)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInstall(skill)}
                      disabled={installed}
                      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] px-3 text-[12.5px] font-semibold transition ${
                        installed
                          ? 'cursor-default border border-[#1f3a24] bg-[#0f1a11] text-[#4ade80]'
                          : 'bg-[#f97316] text-white hover:bg-[#ea580c]'
                      }`}
                    >
                      {installed ? <Check className="size-3.5" /> : <Download className="size-3.5" />}
                      {installed ? 'Installed' : 'Install'}
                    </button>
                  </div>
                  <p className="line-clamp-2 min-h-[38px] text-[12.5px] leading-relaxed text-[#a1a1aa]">
                    {skill.description || 'No description provided.'}
                  </p>
                  <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-[#52525b]">
                    <FileText className="size-3" />
                    {skill.fileCount} {skill.fileCount === 1 ? 'file' : 'files'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Rendered when a repo contains no skills but links out to other GitHub repos
 * (an "awesome list") — each linked repo can be added as a source directly.
 */
function IndexRepoView({
  catalog,
  configuredSlugs,
  onAddLinked,
}: {
  catalog: RepoCatalog
  configuredSlugs: string[]
  onAddLinked: (slug: string) => Promise<void>
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState<Record<string, string>>({})
  const configured = new Set(configuredSlugs)

  const add = async (slug: string) => {
    setPending(slug)
    setFailed((prev) => ({ ...prev, [slug]: '' }))
    try {
      await onAddLinked(slug)
    } catch (cause) {
      setFailed((prev) => ({ ...prev, [slug]: cause instanceof Error ? cause.message : String(cause) }))
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#27272a] bg-[#111114] px-4 py-3.5 text-[13px] leading-relaxed text-[#a1a1aa]">
        <ListTree className="mt-0.5 size-4 shrink-0 text-[#fb923c]" />
        <span>
          This repo is an index — it doesn't contain skills itself, but its README links to{' '}
          {catalog.linkedRepos.length} GitHub {catalog.linkedRepos.length === 1 ? 'repo' : 'repos'} that might.
          Add any of them below to browse and install their skills.
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {catalog.linkedRepos.map((slug) => {
          const added = configured.has(slug)
          return (
            <div key={slug}>
              <div className="flex items-center justify-between gap-3 rounded-[9px] border border-[#232328] bg-[#0c0c0e] px-3.5 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Link2 className="size-3.5 shrink-0 text-[#52525b]" />
                  <span className="truncate font-mono text-[12.5px] text-[#d4d4d8]">{slug}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void add(slug)}
                  disabled={added || pending !== null}
                  className={`flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-semibold transition ${
                    added
                      ? 'cursor-default border border-[#1f3a24] bg-[#0f1a11] text-[#4ade80]'
                      : 'border border-[#27272a] bg-[#18181b] text-[#e4e4e7] hover:border-[#3a3a42] disabled:opacity-50'
                  }`}
                >
                  {added ? (
                    <Check className="size-3" />
                  ) : pending === slug ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : null}
                  {added ? 'Added' : pending === slug ? 'Scanning…' : 'Add repo'}
                </button>
              </div>
              {failed[slug] && <p className="mt-1 px-1 text-[12px] text-[#f87171]">{failed[slug]}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
