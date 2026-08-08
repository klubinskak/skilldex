import { useMemo, useState } from 'react'
import { ArrowUpRight, Check, ChevronRight, Search } from 'lucide-react'
import { Sidebar } from '@/features/navigation/ui/sidebar'
import { Metrics } from '@/features/overview/ui/metrics'
import { RepositoryWatch } from '@/features/repositories/ui/repository-watch'
import { skillCatalog } from '@/features/skills/model/skills'
import { FavouriteCard } from '@/features/skills/ui/favourite-card'
import { SkillList } from '@/features/skills/ui/skill-list'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'

export function Dashboard() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [favourites, setFavourites] = useState(() => new Set(skillCatalog.filter((skill) => skill.favourite).map((skill) => skill.id)))
  const [notice, setNotice] = useState('Ready to discover your local skill sources.')
  const visibleSkills = useMemo(() => { const value = query.trim().toLowerCase(); return value ? skillCatalog.filter((skill) => [skill.name, skill.summary, skill.source, skill.sourceKind].join(' ').toLowerCase().includes(value)) : skillCatalog }, [query])
  const showComingSoon = (message: string) => setNotice(message)
  const toggleFavourite = (id: string) => setFavourites((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })

  return <main className="min-h-screen bg-[#f8f8fa] text-slate-950"><div className="mx-auto grid min-h-screen max-w-[1540px] grid-cols-1 lg:grid-cols-[248px_1fr]"><Sidebar activeItem={activeNav} favouriteCount={favourites.size} onChange={setActiveNav} onAddSource={() => showComingSoon('Source setup will connect to the native filesystem adapter next.')} /><section className="min-w-0 px-5 py-6 sm:px-8 lg:px-10 lg:py-8"><header className="flex flex-col gap-5 border-b border-slate-200 pb-7 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-2 text-sm text-slate-500">Workspace <ChevronRight className="size-3.5" /><span className="text-slate-900">{activeNav}</span></div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">A home for every skill.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">See what is installed, where it lives, and which projects depend on it.</p></div><div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search skills" /></div><Button onClick={() => showComingSoon('Scan queued. The first native adapter will inspect your configured folders.')}>Discover skills</Button></div></header><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Check className="size-3.5 text-emerald-600" />{notice}</p><Metrics /><section className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_310px]"><div><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium">Your skills</p><p className="mt-1 text-sm text-slate-500">A normalized view across local folders and repositories.</p></div><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setActiveNav('All skills')}>View all <ArrowUpRight className="size-3.5" /></Button></div><SkillList skills={visibleSkills} favourites={favourites} query={query} onToggleFavourite={toggleFavourite} /></div><aside className="space-y-6"><FavouriteCard favourites={favourites} skills={skillCatalog} /><RepositoryWatch onAddRepository={() => showComingSoon('Repository source setup will be available after local Git discovery is connected.')} /></aside></section><footer className="mt-12 border-t border-slate-200 py-5 text-xs text-slate-400">Skilldex is local-first. Your filesystem and repository data stay on your machine.</footer></section></div></main>
}
