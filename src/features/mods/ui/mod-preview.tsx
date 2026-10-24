import type { ReactNode } from 'react'
import type { ModAnatomy, ModSurface } from '../model/mods'

type ModPreviewProps = {
  anatomy: ModAnatomy
  name: string
}

const ON = 'border-[#f97316] bg-[#2a1709] text-[#fdba74] shadow-[0_0_0_3px_rgba(249,115,22,.15)]'
const OFF = 'border-[#1f1f24] bg-[#0f0f12] text-[#3f3f46]'

/**
 * A schematic Claude Code window with the places this mod draws into lit up.
 * It stands in for a screenshot when the mod ships none, and sits beside the
 * real ones when it does: it always tells you *where* to look for the mod.
 */
export function ModPreview({ anatomy, name }: ModPreviewProps) {
  const has = (surface: ModSurface) => anatomy.surfaces.includes(surface)
  const command = anatomy.commands[0]

  return (
    <div className="overflow-hidden rounded-[13px] border border-[#232328] bg-[#0b0b0d]">
      <div className="flex items-center gap-1.5 border-b border-[#1c1c20] px-3 py-2">
        <span className="size-2.5 rounded-full bg-[#3f3f46]" />
        <span className="size-2.5 rounded-full bg-[#3f3f46]" />
        <span className="size-2.5 rounded-full bg-[#3f3f46]" />
        <span className="ml-2 font-mono text-[10.5px] text-[#52525b]">Claude Code</span>
      </div>

      <div className="flex h-[268px] gap-2 p-2.5">
        <div className="relative flex min-w-0 flex-1 flex-col gap-2">
          {has('toast') && (
            <Region on className="absolute right-2.5 top-2.5 z-10 px-2.5 py-1.5" label="toast">
              {name}: done
            </Region>
          )}
          <div className="flex flex-1 flex-col gap-1.5 overflow-hidden rounded-[9px] border border-[#1f1f24] bg-[#0f0f12] p-2.5">
            <Line width="62%" />
            <Line width="84%" />
            <div
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10.5px] ${has('tool-hook') ? ON : OFF}`}
            >
              <span>● Bash</span>
              <span className="opacity-70">git status</span>
              {has('tool-hook') && <span className="ml-auto text-[9.5px] uppercase tracking-wide">tool hook</span>}
            </div>
            <Line width="48%" />
            {has('system-prompt') && (
              <div className={`mt-auto rounded-md border px-2 py-1 text-[10px] ${ON}`}>system prompt changed</div>
            )}
          </div>

          <Region on={has('band')} className="px-2.5 py-1.5" label="band above prompt">
            {has('band') ? `${name} band` : ''}
          </Region>

          <div
            className={`rounded-[9px] border px-2.5 py-2 font-mono text-[11px] ${has('prompt') || has('command') ? ON : OFF}`}
          >
            {command ? (
              <span>
                &gt; /{command}
                <span className="ml-2 text-[9.5px] uppercase tracking-wide opacity-80">command</span>
              </span>
            ) : has('prompt') ? (
              <span>
                &gt; your prompt
                <span className="ml-2 text-[9.5px] uppercase tracking-wide opacity-80">prompt hook</span>
              </span>
            ) : (
              <span className="text-[#3f3f46]">&gt; prompt</span>
            )}
          </div>

          <Region on={has('status')} className="px-2.5 py-1 text-[10px]" label="status line">
            {has('status') ? `${name} · status` : ''}
          </Region>
        </div>

        <div
          className={`flex w-[32%] shrink-0 flex-col gap-1.5 rounded-[9px] border p-2.5 ${has('pane') ? ON : OFF}`}
        >
          <span className="text-[10.5px] font-semibold">{has('pane') ? `${name} pane` : 'pane'}</span>
          {has('pane') ? (
            <>
              <Line width="80%" lit />
              <Line width="60%" lit />
              <Line width="70%" lit />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Region({ on, className, label, children }: { on: boolean; className: string; label: string; children: ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-[9px] border font-mono text-[10.5px] ${on ? ON : OFF} ${className}`}>
      <span>{children}</span>
      {on && <span className="text-[9.5px] uppercase tracking-wide opacity-80">{label}</span>}
    </div>
  )
}

function Line({ width, lit = false }: { width: string; lit?: boolean }) {
  return <span className={`h-1.5 rounded-full ${lit ? 'bg-[#fdba74]/40' : 'bg-[#1f1f24]'}`} style={{ width }} />
}
