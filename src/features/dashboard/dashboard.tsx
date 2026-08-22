import { useMemo, useState } from 'react'
import { AlertCircle, ListFilter, Loader2, Plus, RefreshCw } from 'lucide-react'
import { Sidebar, type FilterKey, type SidebarCounts } from '@/features/navigation/ui/sidebar'
import { AddRepoDialog } from '@/features/repos/ui/add-repo-dialog'
import { InstallSkillDialog } from '@/features/repos/ui/install-skill-dialog'
import { RepoBrowser } from '@/features/repos/ui/repo-browser'
import { SettingsDialog } from '@/features/settings/ui/settings-dialog'
import { isOwned, type RepoSkill, type Skill } from '@/features/skills/model/skills'
import { useWorkspace } from '@/features/skills/model/use-workspace'
import { CreateSkillDialog } from '@/features/skills/ui/create-skill-dialog'
import { ProjectGroups } from '@/features/skills/ui/project-groups'
import { SkillCard } from '@/features/skills/ui/skill-card'
import { SkillDetail } from '@/features/skills/ui/skill-detail'

const HEADINGS: Record<FilterKey, { title: string; subtitle: string; pill: string }> = {
  all: {
    title: 'All Skills',
    subtitle: 'Every agent skill available on this machine and in your open projects.',
    pill: 'All sources',
  },
  favourites: {
    title: 'Favourites',
    subtitle: 'Skills you have starred. Enabled or not, they live here for quick access.',
    pill: 'Starred',
  },
  mine: {
    title: 'My Skills',
    subtitle: 'Skills you own locally — made or kept on this machine, not installed from a repo.',
    pill: 'Locally owned',
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
  disabled: {
    title: 'Disabled Skills',
    subtitle: 'Switched-off skills, parked on disk and hidden from Claude. Toggle one back on to restore it.',
    pill: 'Switched off',
  },
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'mine', label: 'Mine' },
  { key: 'global', label: 'Global' },
  { key: 'plugin', label: 'Plugins' },
  { key: 'project', label: 'Project' },
  { key: 'disabled', label: 'Disabled' },
]

export function Dashboard() {
  const {
    skills,
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
  } = useWorkspace()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeRepo, setActiveRepo] = useState<string | null>(null)
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [installTarget, setInstallTarget] = useState<RepoSkill | null>(null)

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

  const favourite = (skill: Skill) => {
    // Favouriting never moves the skill on disk, so its id (and any selection)
    // stays valid — no re-selection dance needed.
    void toggleFavourite(skill.id)
  }

  // Switched-off skills live only in the Disabled tab; the source tabs list the
  // active library so a skill never shows up greyed-out in two places at once.
  const counts: SidebarCounts = useMemo(() => {
    const active = skills.filter((skill) => skill.enabled)
    return {
      all: active.length,
      // Favourites are shown regardless of enabled state (Q7), so count them all.
      favourites: skills.filter((skill) => skill.isFavourite).length,
      // Owned skills are shown regardless of enabled state too, so count them all.
      mine: skills.filter(isOwned).length,
      global: active.filter((skill) => skill.scope === 'global').length,
      plugin: active.filter((skill) => skill.scope === 'plugin').length,
      project: active.filter((skill) => skill.scope === 'project').length,
      disabled: skills.filter((skill) => !skill.enabled).length,
    }
  }, [skills])

  const visibleSkills = useMemo(() => {
    const scoped =
      filter === 'disabled'
        ? skills.filter((skill) => !skill.enabled)
        : filter === 'favourites'
          ? skills.filter((skill) => skill.isFavourite)
          : filter === 'mine'
            ? skills.filter(isOwned)
            : filter === 'all'
              ? skills.filter((skill) => skill.enabled)
              : skills.filter((skill) => skill.enabled && skill.scope === filter)
    const value = query.trim().toLowerCase()
    if (!value) return scoped
    return scoped.filter((skill) =>
      [skill.name, skill.summary, skill.source, ...skill.projects].join(' ').toLowerCase().includes(value),
    )
  }, [skills, filter, query])

  // In the Project tab, organize the (already search-filtered) skills by project.
  const projectGroups = useMemo(() => {
    if (filter !== 'project') return null
    return snapshot.projects
      .map((project) => ({ project, skills: visibleSkills.filter((skill) => skill.projects.includes(project.name)) }))
      .filter((group) => group.skills.length > 0)
  }, [filter, snapshot.projects, visibleSkills])

  const selected = selectedId ? skills.find((skill) => skill.id === selectedId) ?? null : null
  const heading = HEADINGS[filter]
  const activeCatalog = activeRepo ? repoCatalogs.find((repo) => repo.slug === activeRepo) ?? null : null

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b] text-[#fafafa]">
      <Sidebar
        active={filter}
        counts={counts}
        projects={snapshot.projects}
        repos={repoCatalogs}
        activeRepo={activeRepo}
        query={query}
        onQuery={setQuery}
        onFilter={(key) => { setFilter(key); setSelectedId(null); setActiveRepo(null) }}
        onSelectRepo={(slug) => { setActiveRepo(slug); setSelectedId(null) }}
        onAddRepo={() => setShowAddRepo(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {activeCatalog ? (
          <RepoBrowser
            catalog={activeCatalog}
            localSkills={skills}
            configuredSlugs={repoCatalogs.map((repo) => repo.slug)}
            busy={reposLoading}
            onRefresh={() => void refreshRepo(activeCatalog.slug).catch(() => {})}
            onRemove={() => {
              setActiveRepo(null)
              void removeRepo(activeCatalog.slug).catch(() => {})
            }}
            onInstall={(skill) => setInstallTarget(skill)}
            onAddLinked={(slug) => addRepo(slug)}
          />
        ) : selected ? (
          <SkillDetail
            skill={selected}
            getReadme={getReadme}
            listFiles={listFiles}
            reveal={reveal}
            onToggle={() => void toggleSkill(selected)}
            onToggleFavourite={() => favourite(selected)}
            onSave={async (id, content) => {
              await updateReadme(id, content)
            }}
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
                  {query
                    ? `No skills match “${query}”.`
                    : filter === 'project'
                      ? 'No project skills yet. Add a project folder in Settings.'
                      : filter === 'disabled'
                        ? 'No disabled skills. Everything is switched on.'
                        : filter === 'favourites'
                          ? 'No favourites yet. Tap the heart on any skill to star it.'
                          : filter === 'mine'
                            ? 'No skills of your own yet. Create one with New Skill and it will show up here.'
                            : 'No skills found in this scope yet.'}
                </div>
              ) : projectGroups && projectGroups.length > 0 ? (
                <ProjectGroups
                  groups={projectGroups}
                  onOpen={(id) => setSelectedId(id)}
                  onToggle={(skill) => void toggleSkill(skill)}
                  onToggleFavourite={(skill) => favourite(skill)}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
                  {visibleSkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onOpen={() => setSelectedId(skill.id)}
                      onToggle={() => void toggleSkill(skill)}
                      onToggleFavourite={() => favourite(skill)}
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

      <SettingsDialog
        open={showSettings}
        config={config}
        homeDir={snapshot.homeDir}
        onClose={() => setShowSettings(false)}
        onConfigure={configure}
        onPickDirectory={pickDirectory}
      />

      <AddRepoDialog
        open={showAddRepo}
        onClose={() => setShowAddRepo(false)}
        onAdd={async (input) => {
          await addRepo(input)
        }}
      />

      <InstallSkillDialog
        skill={installTarget}
        repoSlug={activeRepo ?? ''}
        projects={snapshot.projects}
        onClose={() => setInstallTarget(null)}
        onInstall={async ({ scope, projectName }) => {
          if (!installTarget || !activeRepo) return
          await installRepoSkill({ repo: activeRepo, skillId: installTarget.id, scope, projectName })
        }}
      />
    </div>
  )
}
