import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react'

type RepositoryWatchProps = { onAddRepository: () => void }

const repositories = [
  { name: 'shadcn-ui/ui', status: 'Up to date', statusClass: 'text-emerald-700' },
  { name: 'klubinskak/skilldex', status: 'New source', statusClass: 'text-violet-700' },
  { name: 'acme/agent-kit', status: '2 updates', statusClass: 'text-amber-700' },
]

export function RepositoryWatch({ onAddRepository }: RepositoryWatchProps) {
  return <div><div className="flex items-center justify-between"><p className="text-sm font-medium">Repository watch</p><MoreHorizontal className="size-4 text-slate-400" /></div><div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">{repositories.map((repository) => <div className="flex items-center justify-between gap-3 py-3.5" key={repository.name}><p className="truncate font-mono text-xs text-slate-700">{repository.name}</p><span className={`shrink-0 text-xs ${repository.statusClass}`}>{repository.status}</span></div>)}</div><button className="mt-6 flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 px-4 py-3 text-left text-sm text-slate-600 hover:border-slate-400 hover:bg-white" type="button" onClick={onAddRepository}><span className="flex items-center gap-2"><Plus className="size-4" />Add repository</span><ChevronRight className="size-4 text-slate-400" /></button></div>
}
