import { FolderGit2, GitFork, Heart, LayoutGrid, Plus, Settings, Sparkles } from 'lucide-react'
import { Button } from '@/ui/button'

const navItems = [
  { label: 'Overview', icon: LayoutGrid },
  { label: 'All skills', icon: Sparkles },
  { label: 'Projects', icon: FolderGit2 },
  { label: 'Repositories', icon: GitFork },
]

type SidebarProps = {
  activeItem: string
  favouriteCount: number
  onChange: (item: string) => void
  onAddSource: () => void
}

export function Sidebar({ activeItem, favouriteCount, onChange, onAddSource }: SidebarProps) {
  return (
    <aside className="border-b border-slate-200 bg-white px-5 py-6 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between lg:block">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white">S</div>
          <div><p className="font-semibold tracking-tight">Skilldex</p><p className="text-xs text-slate-500">Your skill workspace</p></div>
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open settings"><Settings className="size-4" /></Button>
      </div>

      <nav className="mt-8 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1" aria-label="Primary navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = activeItem === item.label
          return <button className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`} key={item.label} onClick={() => onChange(item.label)} type="button"><Icon className="size-4" />{item.label}</button>
        })}
      </nav>

      <div className="mt-8 hidden lg:block"><p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Collections</p><button className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-100" type="button"><Heart className="size-4" />Favourites<span className="ml-auto text-xs text-slate-400">{favouriteCount}</span></button></div>

      <div className="mt-8 hidden rounded-xl border border-slate-200 bg-slate-50 p-4 lg:block"><div className="flex items-center justify-between"><p className="text-sm font-medium">Sources</p><span className="flex size-2 rounded-full bg-emerald-500" /></div><p className="mt-2 text-sm leading-5 text-slate-500">2 global directories and 1 repository ready to scan.</p><Button className="mt-4 w-full" variant="outline" size="sm" onClick={onAddSource}><Plus className="size-3.5" />Add source</Button></div>
      <div className="mt-auto hidden pt-8 lg:block"><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100" type="button"><Settings className="size-4" />Settings</button></div>
    </aside>
  )
}
