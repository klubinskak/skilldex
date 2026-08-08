import { useMemo, useState } from 'react'
import { AlertCircle, ListFilter, Loader2, Plus, RefreshCw } from 'lucide-react'
import { Sidebar, type FilterKey, type SidebarCounts } from '@/features/navigation/ui/sidebar'
import type { Skill } from '@/features/skills/model/skills'
import { useWorkspace } from '@/features/skills/model/use-workspace'
import { CreateSkillDialog } from '@/features/skills/ui/create-skill-dialog'
import { SkillCard } from '@/features/skills/ui/skill-card'
import { SkillDetail } from '@/features/skills/ui/skill-detail'

const HEADINGS: Record<FilterKey, { title: string; subtitle: string; pill: string }> = {
  all: {
    title: 'All Skills',
    subtitle: 'Every agent skill available on this machine and in your open projects.',
    pill: 'All sources',
  },
  global: {
    title: 'Global Skills',
    subtitle: 'Personal skills installed on this machine. Available to every project you open.',
    pill: 'On this machine',
  },
  plugin: {
    title: 'Plugin Skills',
    subtitle: 'Skills provided by the plugins you have installed.',
    pill: 'From plugins',
  },
  project: {
    title: 'Project Skills',
    subtitle: 'Skills committed inside a project folder. They travel with the repo.',
    pill: 'In projects',
  },
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'global', label: 'Global' },
  { key: 'plugin', label: 'Plugins' },
  { key: 'project', label: 'Project' },
]

export function Dashboard() {
  const { skills, snapshot, loading, error, rescan, getReadme, listFiles, reveal, enable, disable, remove, create } =
    useWorkspace()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Enabling/disabling moves a skill on disk, so its id changes. Re-select the
  // same skill (by name + kind) in the new snapshot so the detail view stays put.
  const toggleSkill = async (skill: Skill) => {
    try {
      const next = await (skill.enabled ? disable(skill.id) : enable(skill.id))
      if (next && selectedId === skill.id) {
        const match = next.skills.find((s) => s.name === skill.name && s.sourceKind === skill.sourceKind)
        setSelectedId(match ? match.id : null)
      }
    } catch {
      // Error surfaced via the hook's error state.
    }
  }

  const removeSkill = async (id: string) => {
    try {
      await remove(id)
      setSelectedId(null)
    } catch {
      // Error surfaced via the hook's error state.
    }
  }

  const counts: SidebarCounts = useMemo(
    () => ({
      all: skills.length,
      global: skills.filter((skill) => skill.scope === 'global').length,
      plugin: skills.filter((skill) => skill.scope === 'plugin').length,
      project: skills.filter((skill) => skill.scope === 'project').length,
    }),
    [skills],
  )

  const visibleSkills = useMemo(() => {
    const scoped = filter === 'all' ? skills : skills.filter((skill) => skill.scope === filter)
    const value = query.trim().toLowerCase()
    if (!value) return scoped
    return scoped.filter((skill) =>
      [skill.name, skill.summary, skill.source, ...skill.projects].join(' ').toLowerCase().includes(value),
    )
  }, [skills, filter, query])

  const selected = selectedId ? skills.find((skill) => skill.id === selectedId) ?? null : null
  const heading = HEADINGS[filter]

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b] text-[#fafafa]">
      <Sidebar active={filter} counts={counts} projects={snapshot.projects} query={query} onQuery={setQuery} onFilter={(key) => { setFilter(key); setSelectedId(null) }} />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {selected ? (
          <SkillDetail
            skill={selected}
            getReadme={getReadme}
            listFiles={listFiles}
            reveal={reveal}
            onToggle={() => void toggleSkill(selected)}
            onRemove={() => void removeSkill(selected.id)}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-7 pt-5">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-[22px] font-semibold tracking-tight text-[#fafafa]">{heading.title}</h1>
                    <span className="rounded-[7px] border border-[#27272a] bg-[#18181b] px-2.5 py-1 text-[11px] font-medium text-[#a1a1aa]">
                      {heading.pill}
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-[#71717a]">{heading.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="flex h-[38px] items-center gap-1.5 rounded-[9px] bg-[#f97316] px-4 text-[13px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(249,115,22,.6)] transition hover:bg-[#ea580c]"
                >
                  <Plus className="size-[15px]" />
                  New Skill
                </button>
              </div>

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
                <div className="mb-2.5 flex items-center gap-1.5 text-[12px] text-[#52525b]">
                  <ListFilter className="size-3.5" />
                  Sort: Name
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 pt-5">
              {error ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#3f2020] bg-[#1a0f0f] px-4 py-3 text-[13px] text-[#f87171]">
                  <AlertCircle className="size-4" />
                  {error}
                </div>
              ) : loading && skills.length === 0 ? (
                <div className="flex items-center gap-2 text-[13px] text-[#71717a]">
                  <Loader2 className="size-4 animate-spin" /> Scanning your skill sources…
                </div>
              ) : visibleSkills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#27272a] px-6 py-14 text-center text-[13px] text-[#71717a]">
                  {query ? `No skills match “${query}”.` : 'No skills found in this scope yet.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
                  {visibleSkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onOpen={() => setSelectedId(skill.id)}
                      onToggle={() => void toggleSkill(skill)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <CreateSkillDialog
        open={showCreate}
        projects={snapshot.projects}
        onClose={() => setShowCreate(false)}
        onCreate={async (input) => {
          await create(input)
        }}
      />
    </div>
  )
}
