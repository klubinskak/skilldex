import { FolderGit2, Heart } from 'lucide-react'
import { Badge } from '@/ui/badge'
import type { Skill } from '../model/skills'

type SkillListProps = { skills: Skill[]; favourites: ReadonlySet<string>; query: string; onToggleFavourite: (id: string) => void }

export function SkillList({ skills, favourites, query, onToggleFavourite }: SkillListProps) {
  return <div className="mt-4 grid gap-3">
    {skills.map((skill) => <article className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm" key={skill.id}><div className="flex gap-4"><div className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-lg ${skill.accent} text-sm font-semibold text-white`}>{skill.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-mono text-sm font-semibold">{skill.name}</h2><Badge variant="secondary" className="font-normal">{skill.sourceKind}</Badge></div><p className="mt-1.5 text-sm leading-5 text-slate-500">{skill.summary}</p></div><button className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-500" onClick={() => onToggleFavourite(skill.id)} type="button" aria-label={`Toggle ${skill.name} favourite`}><Heart className={`size-4 ${favourites.has(skill.id) ? 'fill-rose-500 text-rose-500' : ''}`} /></button></div><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><FolderGit2 className="size-3.5" />{skill.projects.length} {skill.projects.length === 1 ? 'project' : 'projects'}</span><span className="truncate font-mono text-[11px] text-slate-400">{skill.source}</span></div></div></div></article>)}
    {skills.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No skills match “{query}”.</div>}
  </div>
}
