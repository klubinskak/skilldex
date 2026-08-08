import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Command,
  FolderGit2,
  GitFork,
  Heart,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

type Skill = {
  id: string
  name: string
  summary: string
  source: string
  sourceKind: 'Global' | 'Repository' | 'Project'
  projects: string[]
  accent: string
  favourite?: boolean
}

const skills: Skill[] = [
  {
    id: 'codebase-design',
    name: 'codebase-design',
    summary: 'Design deep modules with small interfaces and clean seams.',
    source: '~/.agents/skills',
    sourceKind: 'Global',
    projects: ['skilldex', 'paloma'],
    accent: 'bg-violet-500',
    favourite: true,
  },
  {
    id: 'research',
    name: 'research',
    summary: 'Research questions against high-trust, primary sources.',
    source: '~/.agents/skills',
    sourceKind: 'Global',
    projects: ['skilldex'],
    accent: 'bg-amber-500',
    favourite: true,
  },
  {
    id: 'shadcn-ui',
    name: 'shadcn-ui',
    summary: 'Compose accessible interfaces from reusable UI primitives.',
    source: 'github.com/shadcn-ui/ui',
    sourceKind: 'Repository',
    projects: ['skilldex'],
    accent: 'bg-slate-700',
  },
  {
    id: 'tdd',
    name: 'tdd',
    summary: 'Build features through a focused red-green-refactor loop.',
    source: '~/.agents/skills',
    sourceKind: 'Global',
    projects: ['skilldex', 'paloma', 'moss'],
    accent: 'bg-emerald-500',
  },
]

const navItems = [
  { label: 'Overview', icon: LayoutGrid },
  { label: 'All skills', icon: Sparkles },
  { label: 'Projects', icon: FolderGit2 },
  { label: 'Repositories', icon: GitFork },
]

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [favourites, setFavourites] = useState(() =>
    new Set(skills.filter((skill) => skill.favourite).map((skill) => skill.id)),
  )
  const [notice, setNotice] = useState('Ready to discover your local skill sources.')

  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return skills
    return skills.filter((skill) =>
      [skill.name, skill.summary, skill.source, skill.sourceKind]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
  }, [query])

  function toggleFavourite(id: string) {
    setFavourites((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <main className="min-h-screen bg-[#f8f8fa] text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-[1540px] grid-cols-1 lg:grid-cols-[248px_1fr]">
        <aside className="border-b border-slate-200 bg-white px-5 py-6 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">S</div>
              <div>
                <p className="font-semibold tracking-tight">Skilldex</p>
                <p className="text-xs text-slate-500">Your skill workspace</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open settings">
              <Settings className="size-4" />
            </Button>
          </div>

          <nav className="mt-8 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeNav === item.label
              return (
                <button
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                  key={item.label}
                  onClick={() => setActiveNav(item.label)}
                  type="button"
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-8 hidden lg:block">
            <p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Collections</p>
            <button className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-100" type="button">
              <Heart className="size-4" />
              Favourites
              <span className="ml-auto text-xs text-slate-400">{favourites.size}</span>
            </button>
          </div>

          <div className="mt-8 hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:block">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Sources</p>
              <span className="flex size-2 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-500">2 global directories and 1 repository ready to scan.</p>
            <Button className="mt-4 w-full" variant="outline" size="sm" onClick={() => setNotice('Source setup will connect to the native filesystem adapter next.')}>
              <Plus className="size-3.5" /> Add source
            </Button>
          </div>

          <div className="mt-auto hidden pt-8 lg:block">
            <Separator />
            <button className="mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100" type="button">
              <Settings className="size-4" /> Settings
            </button>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
          <header className="flex flex-col gap-5 border-b border-slate-200 pb-7 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                Workspace <ChevronRight className="size-3.5" /> <span className="text-slate-900">{activeNav}</span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">A home for every skill.</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">See what is installed, where it lives, and which projects depend on it.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search skills" />
              </div>
              <Button onClick={() => setNotice('Scan queued. The first native adapter will inspect your configured folders.')}>Discover skills</Button>
            </div>
          </header>

          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Check className="size-3.5 text-emerald-600" /> {notice}</p>

          <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Workspace statistics">
            <Metric label="Skills discovered" value="24" detail="Across all sources" />
            <Metric label="Global skills" value="16" detail="Ready for any project" />
            <Metric label="Repositories" value="3" detail="1 needs attention" attention />
          </section>

          <section className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_310px]">
            <div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Your skills</p>
                  <p className="mt-1 text-sm text-slate-500">A normalized view across local folders and repositories.</p>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setActiveNav('All skills')}>View all <ArrowUpRight className="size-3.5" /></Button>
              </div>

              <div className="mt-4 grid gap-3">
                {filteredSkills.map((skill) => (
                  <article className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm" key={skill.id}>
                    <div className="flex gap-4">
                      <div className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg ${skill.accent} text-sm font-semibold text-white`}>{skill.name.slice(0, 1).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="font-mono text-sm font-semibold">{skill.name}</h2>
                              <Badge variant="secondary" className="font-normal">{skill.sourceKind}</Badge>
                            </div>
                            <p className="mt-1.5 text-sm leading-5 text-slate-500">{skill.summary}</p>
                          </div>
                          <button className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500" onClick={() => toggleFavourite(skill.id)} type="button" aria-label={`Toggle ${skill.name} favourite`}>
                            <Heart className={`size-4 ${favourites.has(skill.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5"><FolderGit2 className="size-3.5" /> {skill.projects.length} {skill.projects.length === 1 ? 'project' : 'projects'}</span>
                          <span className="truncate font-mono text-[11px] text-slate-400">{skill.source}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                {filteredSkills.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No skills match “{query}”.</div>}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-xl bg-slate-950 p-5 text-white">
                <Command className="size-5 text-violet-300" />
                <h2 className="mt-6 text-lg font-medium tracking-tight">Keep the good ones close.</h2>
                <p className="mt-2 text-sm leading-5 text-slate-400">Favourite a skill to surface it whenever you start a new project.</p>
                <div className="mt-5 flex -space-x-2">
                  {Array.from(favourites).slice(0, 4).map((id) => {
                    const skill = skills.find((candidate) => candidate.id === id)
                    return <div className={`grid size-8 place-items-center rounded-full border-2 border-slate-950 text-xs font-semibold ${skill?.accent ?? 'bg-slate-500'} text-white`} key={id}>{skill?.name.slice(0, 1).toUpperCase()}</div>
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Repository watch</p>
                  <MoreHorizontal className="size-4 text-slate-400" />
                </div>
                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
                  <Repository name="shadcn-ui/ui" status="Up to date" statusClass="text-emerald-700" />
                  <Repository name="klubinskak/skilldex" status="New source" statusClass="text-violet-700" />
                  <Repository name="acme/agent-kit" status="2 updates" statusClass="text-amber-700" />
                </div>
              </div>

              <button className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 px-4 py-3 text-left text-sm text-slate-600 hover:border-slate-400 hover:bg-white" type="button" onClick={() => setNotice('Repository source setup will be available after local Git discovery is connected.')}>
                <span className="flex items-center gap-2"><Plus className="size-4" /> Add repository</span>
                <ChevronRight className="size-4 text-slate-400" />
              </button>
            </aside>
          </section>

          <footer className="mt-12 border-t border-slate-200 py-5 text-xs text-slate-400">Skilldex is local-first. Your filesystem and repository data stay on your machine.</footer>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, detail, attention = false }: { label: string; value: string; detail: string; attention?: boolean }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className={`mt-2 text-xs ${attention ? 'text-amber-700' : 'text-slate-400'}`}>{detail}</p>
    </article>
  )
}

function Repository({ name, status, statusClass }: { name: string; status: string; statusClass: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div className="min-w-0"><p className="truncate font-mono text-xs text-slate-700">{name}</p></div>
      <span className={`shrink-0 text-xs ${statusClass}`}>{status}</span>
    </div>
  )
}

export default App
