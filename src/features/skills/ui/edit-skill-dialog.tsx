import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'

type EditSkillDialogProps = {
  open: boolean
  skillName: string
  /** The raw SKILL.md loaded for this skill; the textarea starts from this. */
  initialContent: string
  onClose: () => void
  onSave: (content: string) => Promise<void>
}

export function EditSkillDialog({ open, skillName, initialContent, onClose, onSave }: EditSkillDialogProps) {
  const [content, setContent] = useState(initialContent)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const gutterRef = useRef<HTMLDivElement>(null)

  const lineCount = content.split('\n').length
  const gutterWidth = `${String(lineCount).length + 1}ch`

  // Keep the line-number gutter aligned with the textarea as it scrolls.
  const syncScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
  }

  // Re-seed whenever a different skill (or freshly-loaded content) opens the
  // dialog, so the textarea never shows a stale skill's instructions.
  useEffect(() => {
    if (open) {
      setContent(initialContent)
      setError(null)
      setConfirmingDiscard(false)
    }
  }, [open, initialContent])

  const dirty = content !== initialContent
  const canSubmit = content.trim().length > 0 && dirty && !submitting

  const requestClose = () => {
    if (dirty) {
      setConfirmingDiscard(true)
      return
    }
    onClose()
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSave(content)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  // Escape asks to close (with the dirty guard); Cmd/Ctrl+S saves.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (confirmingDiscard) setConfirmingDiscard(false)
        else requestClose()
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, confirmingDiscard, content, submitting, dirty])

  if (!open) return null

  return (
    <div
      onClick={requestClose}
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[3px]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-[720px] flex-col overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#111114] shadow-[0_40px_100px_-20px_rgba(0,0,0,.9)]"
      >
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#fafafa]">
              Edit <span className="font-mono text-[#e4e4e7]">{skillName}</span>
            </h2>
            <button
              type="button"
              onClick={requestClose}
              className="grid size-7 place-items-center rounded-lg text-[#71717a] transition hover:bg-[#1c1c20]"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 text-[13px] text-[#71717a]">
            Editing the raw SKILL.md — frontmatter and body. Changes are written to disk on save.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-[#d4d4d8]">SKILL.md</span>
            <span className="font-mono text-[11px] text-[#52525b]">markdown</span>
          </div>
          <div className="flex min-h-[320px] flex-1 overflow-hidden rounded-[9px] border border-[#27272a] bg-[#0c0c0e] focus-within:border-[#3a3a42]">
            <div
              ref={gutterRef}
              aria-hidden
              className="shrink-0 overflow-hidden py-3 pl-3 pr-2 text-right font-mono text-[12.5px] leading-relaxed text-[#3f3f46] select-none"
              style={{ width: gutterWidth, boxSizing: 'content-box' }}
            >
              {Array.from({ length: lineCount }, (_, index) => (
                <div key={index}>{index + 1}</div>
              ))}
            </div>
            <textarea
              autoFocus
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onScroll={syncScroll}
              spellCheck={false}
              wrap="off"
              className="flex-1 resize-none whitespace-pre bg-transparent py-3 pl-2 pr-4 font-mono text-[12.5px] leading-relaxed text-[#d4d4d8] outline-none"
            />
          </div>
          {error && <p className="mt-3 text-[12.5px] text-[#f87171]">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2.5 border-t border-[#1c1c20] bg-[#0c0c0e] px-6 py-4">
          <span className="text-[11.5px] text-[#52525b]">
            {dirty ? 'Unsaved changes' : 'No changes'} · ⌘S to save
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={requestClose}
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
              Save
            </button>
          </div>
        </div>
      </div>

      {confirmingDiscard && (
        <div
          onClick={(event) => {
            event.stopPropagation()
            setConfirmingDiscard(false)
          }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[3px]"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-[420px] overflow-hidden rounded-2xl border border-[#2a2a30] bg-[#111114] shadow-[0_40px_100px_-20px_rgba(0,0,0,.9)]"
          >
            <div className="px-6 pt-5">
              <h2 className="text-lg font-semibold text-[#fafafa]">Discard changes?</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#a1a1aa]">
                You have unsaved edits to this SKILL.md. Closing now will lose them.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2.5 border-t border-[#1c1c20] bg-[#0c0c0e] px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmingDiscard(false)}
                className="h-9 rounded-[9px] border border-[#27272a] bg-transparent px-4 text-[13px] font-medium text-[#d4d4d8] transition hover:border-[#3a3a42]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDiscard(false)
                  onClose()
                }}
                className="h-9 rounded-[9px] bg-[#dc2626] px-[18px] text-[13px] font-semibold text-white transition hover:bg-[#b91c1c]"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
