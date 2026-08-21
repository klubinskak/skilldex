import { useState } from 'react'
import { Loader2, X } from 'lucide-react'

type AddRepoDialogProps = {
  open: boolean
  onClose: () => void
  onAdd: (input: string) => Promise<void>
}

export function AddRepoDialog({ open, onClose, onAdd }: AddRepoDialogProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const close = () => {
    setValue('')
    setError(null)
    onClose()
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(value.trim())
      close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = value.trim().length > 0 && !submitting

  return (
    <div onClick={close} className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[3px]">
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[520px] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#111114] shadow-[0_40px_100px_-20px_rgba(0,0,0,.9)]"
      >
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#fafafa]">Add Skill Repo</h2>
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
            Point Skilldex at a GitHub repo of agent skills. Every folder with a SKILL.md becomes installable.
          </p>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-[#d4d4d8]">Repository</div>
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canSubmit) void submit()
              }}
              placeholder="https://github.com/owner/repo or owner/repo"
              className="h-[38px] w-full rounded-[9px] border border-[#27272a] bg-[#0c0c0e] px-3 font-mono text-[13px] text-[#e4e4e7] outline-none placeholder:text-[#52525b] focus:border-[#3a3a42]"
            />
          </div>
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
            {submitting ? 'Scanning repo…' : 'Add repo'}
          </button>
        </div>
      </div>
    </div>
  )
}
