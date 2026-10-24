import { Download, Sparkles, X } from 'lucide-react'
import { useUpdate } from '../model/use-update'

/** Sidebar card saying a newer Skilldex is out (macOS, which can't self-update unsigned). */
export function UpdateCard() {
  const { update, dismiss, open } = useUpdate()
  if (!update) return null

  return (
    <div className="mb-3 shrink-0 rounded-[11px] border border-[#4a2a10] bg-[#1a1109] p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 shrink-0 text-[#fb923c]" />
        <span className="flex-1 text-[13px] font-semibold text-[#fdba74]">Skilldex {update.version} is out</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide until the next version"
          title="Hide until the next version"
          className="grid size-5 place-items-center rounded-md text-[#a16207] transition hover:bg-[#2a1709] hover:text-[#fdba74]"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[#d6a77a]">
        You have {update.currentVersion}. Download the new version and drag it into Applications.
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => open(update.downloadUrl)}
          className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[#f97316] px-2.5 text-[12px] font-semibold text-white transition hover:bg-[#ea580c]"
        >
          <Download className="size-3.5" />
          Download
        </button>
        <button
          type="button"
          onClick={() => open(update.releaseUrl)}
          className="h-7 rounded-[7px] px-2 text-[12px] font-medium text-[#fb923c] transition hover:bg-[#2a1709]"
        >
          What’s new
        </button>
      </div>
    </div>
  )
}
