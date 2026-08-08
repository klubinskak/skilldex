import { useState } from 'react'
import { Globe, Layers, X } from 'lucide-react'

type CreateSkillDialogProps = { open: boolean; onClose: () => void }

export function CreateSkillDialog({ open, onClose }: CreateSkillDialogProps) {
  const [scope, setScope] = useState<'global' | 'project'>('global')
  if (!open) return null

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[3px]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[520px] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#111114] shadow-[0_40px_100px_-20px_rgba(0,0,0,.9)]"
      >
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#fafafa]">New Skill</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-7 place-items-center rounded-lg text-[#71717a] transition hover:bg-[#1c1c20]"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[13px] text-[#71717a]">Scaffold a new agent skill folder with a SKILL.md.</p>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <Field label="Name">
            <input
              placeholder="e.g. PDF Form Filler"
              className="h-[38px] w-full rounded-[9px] border border-[#27272a] bg-[#0c0c0e] px-3 text-[13.5px] text-[#e4e4e7] outline-none placeholder:text-[#52525b] focus:border-[#3a3a42]"
            />
          </Field>
          <Field label="Description">
            <textarea
              placeholder="What this skill does and when the agent should use it…"
              className="h-[70px] w-full resize-none rounded-[9px] border border-[#27272a] bg-[#0c0c0e] px-3 py-2.5 text-[13.5px] leading-relaxed text-[#e4e4e7] outline-none placeholder:text-[#52525b] focus:border-[#3a3a42]"
            />
          </Field>
          <Field label="Scope">
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
                detail="Scoped to one project folder only"
                selected={scope === 'project'}
                onSelect={() => setScope('project')}
              />
            </div>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#1c1c20] bg-[#0c0c0e] px-6 py-4">
          <span className="text-[11.5px] text-[#52525b]">Creating skills lands with skill management.</span>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-[9px] border border-[#27272a] bg-transparent px-4 text-[13px] font-medium text-[#d4d4d8] transition hover:border-[#3a3a42]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled
              title="Skill management is coming soon"
              className="h-9 cursor-not-allowed rounded-[9px] bg-[#f97316] px-[18px] text-[13px] font-semibold text-white opacity-60"
            >
              Create skill
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-medium text-[#d4d4d8]">{label}</div>
      {children}
    </div>
  )
}

function ScopeOption({
  icon,
  title,
  detail,
  selected,
  onSelect,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[10px] border p-3 text-left transition ${
        selected ? 'border-[#f97316] bg-[#1a1109]' : 'border-[#27272a] bg-[#0c0c0e] hover:border-[#3a3a42]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: selected ? '#f97316' : '#a1a1aa' }}>{icon}</span>
        <span className="text-[13px] font-semibold text-[#e4e4e7]">{title}</span>
      </div>
      <div className="mt-1.5 text-[11.5px] leading-snug text-[#71717a]">{detail}</div>
    </button>
  )
}
