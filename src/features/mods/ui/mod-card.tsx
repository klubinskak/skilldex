import { Image as ImageIcon, Terminal } from 'lucide-react'
import { SkillToggle } from '@/features/skills/ui/skill-toggle'
import { modIcon, SURFACES, type ModRecord } from '../model/mods'

type ModCardProps = {
  mod: ModRecord
  onOpen: () => void
  onToggle: () => void
}

export function ModCard({ mod, onOpen, onToggle }: ModCardProps) {
  const icon = modIcon(mod.name)
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
      className={`flex cursor-pointer flex-col gap-3 rounded-[13px] border border-[#232328] bg-[#101013] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#3a3a42] focus-visible:border-[#3a3a42] focus-visible:outline-none ${
        mod.enabled || mod.kind === 'draft' ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-[11px] font-mono text-[15px] font-semibold"
          style={{ background: icon.bg, color: icon.fg }}
        >
          {icon.mono}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14.5px] font-semibold text-[#fafafa]">{mod.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-[#52525b]">v{mod.version}</span>
            {mod.kind === 'draft' && (
              <span className="shrink-0 rounded-md border border-[#3b2f0b] bg-[#1f1a08] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#facc15]">
                Draft
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-[#52525b]">
            {mod.marketplace ? `${mod.marketplace} · ${mod.scope}` : mod.displayPath}
          </div>
        </div>
        <span className="mt-0.5 shrink-0">
          <SkillToggle
            enabled={mod.enabled}
            onToggle={mod.canToggle ? onToggle : undefined}
            disabled={!mod.canToggle}
            disabledTitle="Drafts load only in the Claude session that wrote them"
          />
        </span>
      </div>

      <p className="line-clamp-2 min-h-[38px] text-[12.5px] leading-relaxed text-[#a1a1aa]">
        {mod.description || 'No description in plugin.json.'}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {mod.anatomy.surfaces.map((surface) => (
          <span key={surface} className="rounded-md border border-[#27272a] bg-[#1a1a1e] px-1.5 py-0.5 text-[11px] text-[#a1a1aa]">
            {SURFACES[surface].label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2.5 font-mono text-[11px] text-[#52525b]">
          {mod.anatomy.commands.length > 0 && (
            <span className="flex items-center gap-1">
              <Terminal className="size-3" />
              {mod.anatomy.commands.map((command) => `/${command}`).join(' ')}
            </span>
          )}
          {mod.imageCount > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="size-3" />
              {mod.imageCount}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
