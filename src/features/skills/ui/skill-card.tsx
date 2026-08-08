import { FileText } from 'lucide-react'
import { scopePillClass, type Skill } from '../model/skills'
import { SkillToggle } from './skill-toggle'

type SkillCardProps = { skill: Skill; onOpen: () => void; onToggle: () => void }

export function SkillCard({ skill, onOpen, onToggle }: SkillCardProps) {
  const chips = skill.scope === 'project' ? skill.projects.slice(0, 2) : []

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-[13px] border border-[#232328] bg-[#101013] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#3a3a42] focus-visible:border-[#3a3a42] focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-[11px] font-mono text-[15px] font-semibold"
          style={{ background: skill.iconBg, color: skill.iconFg }}
        >
          {skill.mono}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-semibold text-[#fafafa]">{skill.name}</span>
            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${scopePillClass(skill.scope)}`}
            >
              {skill.scope}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-[#52525b]">{skill.source}</div>
        </div>
        <span className="mt-1 shrink-0">
          <SkillToggle enabled={skill.enabled} onToggle={onToggle} disabled={skill.scope === 'plugin'} />
        </span>
      </div>

      <p className="line-clamp-2 min-h-[38px] text-[12.5px] leading-relaxed text-[#a1a1aa]">{skill.summary}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-md border border-[#27272a] bg-[#1a1a1e] px-1.5 py-0.5 text-[11px] text-[#a1a1aa]"
          >
            {chip}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-[#52525b]">
          <FileText className="size-3" />
          {skill.fileCount} {skill.fileCount === 1 ? 'file' : 'files'}
        </span>
      </div>
    </div>
  )
}
