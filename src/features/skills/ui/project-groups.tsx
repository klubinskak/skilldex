import { FolderGit2 } from 'lucide-react'
import type { ProjectRecord, Skill } from '../model/skills'
import { SkillCard } from './skill-card'

export type ProjectGroup = { project: ProjectRecord; skills: Skill[] }

type ProjectGroupsProps = {
  groups: ProjectGroup[]
  onOpen: (id: string) => void
  onToggle: (skill: Skill) => void
}

export function ProjectGroups({ groups, onOpen, onToggle }: ProjectGroupsProps) {
  return (
    <div className="flex flex-col gap-9">
      {groups.map(({ project, skills }) => (
        <section key={project.path}>
          <div className="mb-3 flex items-center gap-2.5">
            <FolderGit2 className="size-4 text-[#71717a]" />
            <h3 className="text-[14px] font-semibold text-[#fafafa]">{project.name}</h3>
            <span className="truncate font-mono text-[11px] text-[#52525b]">{project.path}</span>
            <span className="ml-auto shrink-0 font-mono text-[11px] text-[#52525b]">
              {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onOpen={() => onOpen(skill.id)}
                onToggle={() => onToggle(skill)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
