import { useState } from 'react'
import { Globe, Layers, Loader2, X } from 'lucide-react'
import type { ProjectRecord, RepoSkill } from '@/features/skills/model/skills'

type InstallSkillDialogProps = {
  /** The catalog skill being installed, or null when the dialog is closed. */
  skill: RepoSkill | null
  repoSlug: string
  projects: ProjectRecord[]
  onClose: () => void
  onInstall: (input: { scope: 'global' | 'project'; projectName?: string }) => Promise<void>
}

export function InstallSkillDialog({ skill, repoSlug, projects, onClose, onInstall }: InstallSkillDialogProps) {
  const [scope, setScope] = useState<'global' | 'project'>('global')
  const [projectName, setProjectName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!skill) return null

  const resolvedProject = projectName || projects[0]?.name || ''
  const canProject = projects.length > 0
  const canSubmit = !submitting && (scope === 'global' || Boolean(resolvedProject))

  const close = () => {
    setScope('global')
    setProjectName('')
    setError(null)
    onClose()
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onInstall({ scope, projectName: scope === 'project' ? resolvedProject : undefined })
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div onClick={close} className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[3px]">
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[520px] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#111114] shadow-[0_40px_100px_-20px_rgba(0,0,0,.9)]"
      >
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#fafafa]">Install “{skill.name}”</h2>
            <button
              type="button"
              onClick={close}
              className="grid size-7 place-items-center rounded-lg text-[#71717a] transition hover:bg-[#1c1c20]"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[13px] text-[#71717a]">
            Downloads {skill.fileCount} {skill.fileCount === 1 ? 'file' : 'files'} from{' '}
            <span className="font-mono text-[12px]">{repoSlug}</span>.
          </p>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-[#d4d4d8]">Install to</div>
            <div className="grid grid-cols-2 gap-2.5">
              <ScopeOption
                icon={<Globe className="size-[15px]" />}
                title="Global"
                detail="Available to every project on this machine"
                selected={scope === 'global'}
                onSelect={() => setScope('global')}
              />
              <ScopeOption
                icon={<Layers className="size-[15px]" />}
                title="Project"
                detail={canProject ? 'Scoped to one project folder only' : 'Add a project source first'}
                selected={scope === 'project'}
                disabled={!canProject}
                onSelect={() => canProject && setScope('project')}
              />
            </div>
          </div>
          {scope === 'project' && canProject && (
            <div>
              <div className="mb-1.5 text-[12.5px] font-medium text-[#d4d4d8]">Project</div>
              <select
                value={resolvedProject}
                onChange={(event) => setProjectName(event.target.value)}
                className="h-[38px] w-full rounded-[9px] border border-[#27272a] bg-[#0c0c0e] px-3 text-[13.5px] text-[#e4e4e7] outline-none focus:border-[#3a3a42]"
              >
                {projects.map((project) => (
                  <option key={project.path} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-[12.5px] text-[#f87171]">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#1c1c20] bg-[#0c0c0e] px-6 py-4">
          <button
            type="button"
            onClick={close}
            className="h-9 rounded-[9px] border border-[#27272a] bg-transparent px-4 text-[13px] font-medium text-[#d4d4d8] transition hover:border-[#3a3a42]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className={`flex h-9 items-center gap-1.5 rounded-[9px] bg-[#f97316] px-[18px] text-[13px] font-semibold text-white transition ${
              canSubmit ? 'hover:bg-[#ea580c]' : 'cursor-not-allowed opacity-60'
            }`}
          >
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            {submitting ? 'Installing…' : 'Install skill'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ScopeOption({
  icon,
  title,
  detail,
  selected,
  disabled = false,
  onSelect,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`rounded-[10px] border p-3 text-left transition ${
        selected ? 'border-[#f97316] bg-[#1a1109]' : 'border-[#27272a] bg-[#0c0c0e] hover:border-[#3a3a42]'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: selected ? '#f97316' : '#a1a1aa' }}>{icon}</span>
        <span className="text-[13px] font-semibold text-[#e4e4e7]">{title}</span>
      </div>
      <div className="mt-1.5 text-[11.5px] leading-snug text-[#71717a]">{detail}</div>
    </button>
  )
}
