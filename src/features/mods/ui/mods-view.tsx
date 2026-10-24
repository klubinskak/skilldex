import { useMemo, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import type { ModsState } from '../model/use-mods'
import { ModCard } from './mod-card'
import { ModDetail } from './mod-detail'

type ModsViewProps = {
  mods: ModsState
  query: string
}

type ModFilter = 'all' | 'on' | 'off' | 'drafts'

const FILTERS: Array<{ key: ModFilter; label: string }> = [
  { key: 'all', label: 'Installed' },
  { key: 'on', label: 'On' },
  { key: 'off', label: 'Off' },
  { key: 'drafts', label: 'Drafts' },
]

/** The Mods page: every Claude Code mod on this machine, with its on/off switch. */
export function ModsView({ mods, query }: ModsViewProps) {
  const { snapshot, loading, error, rescan, setEnabled, getDetail, reveal } = mods
  const [filter, setFilter] = useState<ModFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const counts: Record<ModFilter, number> = useMemo(() => {
    const installed = snapshot.mods.filter((mod) => mod.kind === 'installed')
    return {
      all: installed.length,
      on: installed.filter((mod) => mod.enabled).length,
      off: installed.filter((mod) => !mod.enabled).length,
      drafts: snapshot.mods.filter((mod) => mod.kind === 'draft').length,
    }
  }, [snapshot.mods])

  const visible = useMemo(() => {
    const scoped = snapshot.mods.filter((mod) =>
      filter === 'drafts'
        ? mod.kind === 'draft'
        : mod.kind === 'installed' && (filter === 'all' || (filter === 'on') === mod.enabled),
    )
    const value = query.trim().toLowerCase()
    if (!value) return scoped
    return scoped.filter((mod) =>
      [mod.name, mod.description, mod.marketplace ?? '', ...mod.anatomy.commands].join(' ').toLowerCase().includes(value),
    )
  }, [snapshot.mods, filter, query])

  const selected = selectedId ? snapshot.mods.find((mod) => mod.id === selectedId) ?? null : null
  if (selected) {
    return (
      <ModDetail
        mod={selected}
        getDetail={getDetail}
        reveal={reveal}
        onToggle={() => void setEnabled(selected.id, !selected.enabled)}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-7 pt-5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-tight text-[#fafafa]">Mods</h1>
          <span className="rounded-[7px] border border-[#27272a] bg-[#18181b] px-2.5 py-1 text-[11px] font-medium text-[#a1a1aa]">
            Claude Code
          </span>
        </div>
        <p className="mt-1.5 max-w-[620px] text-[13.5px] leading-relaxed text-[#71717a]">
          Mods change Claude Code itself: a pane beside the chat, a band above the prompt, a slash command. Switch one off
          and new sessions start without it.
        </p>

        <div className="mt-5 flex items-center gap-2 border-b border-[#1c1c20]">
          {FILTERS.map((item) => {
            const active = filter === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`-mb-px border-b-2 px-1 pb-2.5 text-[13px] transition ${
                  active ? 'border-[#f97316] font-semibold text-[#fafafa]' : 'border-transparent font-medium text-[#71717a]'
                }`}
              >
                {item.label} <span className="font-mono text-[11px] opacity-60">{counts[item.key]}</span>
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void rescan()}
            className="mb-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#71717a] transition hover:text-[#a1a1aa]"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Rescan
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 pt-5">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#3f2020] bg-[#1a0f0f] px-4 py-3 text-[13px] text-[#f87171]">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}
        {snapshot.errors.length > 0 && (
          <div className="mb-4 rounded-xl border border-[#3b2f0b] bg-[#1f1a08] px-4 py-3 text-[12.5px] text-[#facc15]">
            Some mods could not be read: {snapshot.errors.join('; ')}
          </div>
        )}
        {filter === 'drafts' && visible.length > 0 && (
          <p className="mb-4 text-[12.5px] text-[#71717a]">
            Drafts are mods Claude wrote in a session, kept under <code className="font-mono">~/.claude/dev-mods</code>. They
            load only in that session, so there is nothing to switch here.
          </p>
        )}
        {loading && snapshot.mods.length === 0 ? (
          <div className="flex items-center gap-2 text-[13px] text-[#71717a]">
            <Loader2 className="size-4 animate-spin" /> Looking for mods…
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#27272a] px-6 py-14 text-center text-[13px] text-[#71717a]">
            {query
              ? `No mods match “${query}”.`
              : filter === 'drafts'
                ? 'No drafts. When Claude writes a mod in a session, it shows up here.'
                : filter === 'off'
                  ? 'Every installed mod is switched on.'
                  : filter === 'on'
                    ? 'Every installed mod is switched off.'
                    : 'No mods installed yet. Ask Claude Code to “make a mod”, or install one from a marketplace.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
            {visible.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                onOpen={() => setSelectedId(mod.id)}
                onToggle={() => void setEnabled(mod.id, !mod.enabled)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
