import { useState } from 'react'
import { FolderPlus, Loader2, Trash2, X } from 'lucide-react'
import { tildify, type WorkspaceConfig } from '@/features/skills/model/skills'
import { SkillToggle } from '@/features/skills/ui/skill-toggle'

type SettingsDialogProps = {
  open: boolean
  config: WorkspaceConfig | null
  homeDir: string
  onClose: () => void
  onConfigure: (config: WorkspaceConfig) => Promise<void>
  onPickDirectory: () => Promise<string | null>
}

export function SettingsDialog({ open, config, homeDir, onClose, onConfigure, onPickDirectory }: SettingsDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!open) return null

  const apply = async (next: WorkspaceConfig) => {
    setBusy(true)
    setError(null)
    try {
      await onConfigure(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const addFolder = async () => {
    if (!config) return
    const picked = await onPickDirectory()
    if (!picked || config.projectRoots.includes(picked)) return
    await apply({ ...config, projectRoots: [...config.projectRoots, picked] })
  }

  const removeFolder = (root: string) => {
    if (!config) return
    void apply({ ...config, projectRoots: config.projectRoots.filter((r) => r !== root) })
  }

  return (
    <div onClick={onClose} className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[3px]">
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80vh] w-[560px] flex-col overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#111114] shadow-[0_40px_100px_-20px_rgba(0,0,0,.9)]"
      >
        <div className="flex items-center justify-between px-6 pb-4 pt-5">
          <div>
            <h2 className="text-lg font-semibold text-[#fafafa]">Settings</h2>
            <p className="mt-1 text-[13px] text-[#71717a]">Choose where Skilldex looks for your skills.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-[#71717a] transition hover:bg-[#1c1c20]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
          <section>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-[#e4e4e7]">Project sources</div>
                <div className="mt-0.5 text-[12px] text-[#71717a]">
                  A folder can be one project, or a parent of many.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void addFolder()}
                disabled={busy || !config}
                className={`flex h-8 items-center gap-1.5 rounded-[9px] border border-[#27272a] bg-[#18181b] px-3 text-[12.5px] font-medium text-[#e4e4e7] transition ${
                  busy || !config ? 'cursor-not-allowed opacity-60' : 'hover:border-[#3a3a42]'
                }`}
              >
                <FolderPlus className="size-3.5" />
                Add folder…
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {config && config.projectRoots.length === 0 && (
                <div className="rounded-[9px] border border-dashed border-[#27272a] px-4 py-5 text-center text-[12.5px] text-[#71717a]">
                  No project folders yet. Add one to populate the Project tab.
                </div>
              )}
              {config?.projectRoots.map((root) => (
                <div
                  key={root}
                  className="flex items-center justify-between gap-3 rounded-[9px] border border-[#232328] bg-[#0c0c0e] px-3 py-2.5"
                >
                  <span className="truncate font-mono text-[12px] text-[#d4d4d8]">{tildify(root, homeDir)}</span>
                  <button
                    type="button"
                    onClick={() => removeFolder(root)}
                    disabled={busy}
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-[#71717a] transition hover:bg-[#1e1010] hover:text-[#f87171] disabled:opacity-50"
                    aria-label={`Remove ${root}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <div className="text-[13px] font-semibold text-[#e4e4e7]">Sources</div>
            <div className="mt-3 flex flex-col gap-2">
              <ToggleRow
                label="Personal skills"
                detail="~/.claude/skills"
                enabled={config?.includePersonal ?? true}
                disabled={busy || !config}
                onToggle={() => config && apply({ ...config, includePersonal: !config.includePersonal })}
              />
              <ToggleRow
                label="Plugin skills"
                detail="Installed plugin marketplaces"
                enabled={config?.includePlugins ?? true}
                disabled={busy || !config}
                onToggle={() => config && apply({ ...config, includePlugins: !config.includePlugins })}
              />
            </div>
          </section>

          {error && <p className="mt-4 text-[12.5px] text-[#f87171]">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-[#1c1c20] bg-[#0c0c0e] px-6 py-4">
          <span className="flex items-center gap-1.5 text-[12px] text-[#52525b]">
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {busy ? 'Rescanning…' : 'Changes apply immediately.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[9px] border border-[#27272a] bg-transparent px-4 text-[13px] font-medium text-[#d4d4d8] transition hover:border-[#3a3a42]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  detail,
  enabled,
  disabled,
  onToggle,
}: {
  label: string
  detail: string
  enabled: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[9px] border border-[#232328] bg-[#0c0c0e] px-3.5 py-2.5">
      <div>
        <div className="text-[12.5px] font-medium text-[#e4e4e7]">{label}</div>
        <div className="mt-0.5 font-mono text-[11px] text-[#52525b]">{detail}</div>
      </div>
      <SkillToggle enabled={enabled} onToggle={disabled ? undefined : onToggle} disabled={disabled} />
    </div>
  )
}
