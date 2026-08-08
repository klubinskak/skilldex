import { Command } from 'lucide-react'
import type { Skill } from '../model/skills'

type FavouriteCardProps = { favourites: ReadonlySet<string>; skills: Skill[] }

export function FavouriteCard({ favourites, skills }: FavouriteCardProps) {
  return <div className="rounded-xl bg-slate-950 p-5 text-white"><Command className="size-5 text-violet-300" /><h2 className="mt-6 text-lg font-medium tracking-tight">Keep the good ones close.</h2><p className="mt-2 text-sm leading-5 text-slate-400">Favourite a skill to surface it whenever you start a new project.</p><div className="mt-5 flex -space-x-2">{Array.from(favourites).slice(0, 4).map((id) => { const skill = skills.find((candidate) => candidate.id === id); return <div className={`grid size-8 place-items-center rounded-full border-2 border-slate-950 text-xs font-semibold ${skill?.accent ?? 'bg-slate-500'} text-white`} key={id}>{skill?.name.slice(0, 1).toUpperCase()}</div> })}</div></div>
}
