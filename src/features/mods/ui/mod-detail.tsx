import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, FolderOpen, Info, Loader2, ShieldAlert } from 'lucide-react'
import { CodeView } from '@/features/skills/ui/code-view'
import { SkillToggle } from '@/features/skills/ui/skill-toggle'
import { ACCESS, modIcon, SURFACES, type ModDetail as ModDetailData, type ModRecord } from '../model/mods'
import { Markdown } from './markdown'
import { ModPreview } from './mod-preview'

type ModDetailProps = {
  mod: ModRecord
  getDetail: (id: string) => Promise<ModDetailData | null>
  reveal: (id: string) => Promise<boolean>
  onToggle: () => void
  onBack: () => void
}

type Tab = 'overview' | 'code' | 'files'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ModDetail({ mod, getDetail, reveal, onToggle, onBack }: ModDetailProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const [detail, setDetail] = useState<ModDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [zoomed, setZoomed] = useState<string | null>(null)
  const icon = modIcon(mod.name)

  useEffect(() => {
    let active = true
    setLoading(true)
    setDetail(null)
    setSourceIndex(0)
    void getDetail(mod.id).then((next) => {
      if (!active) return
      setDetail(next)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [mod.id, getDetail])

  const imagesByPath = useMemo(
    () => Object.fromEntries((detail?.images ?? []).map((image) => [image.relativePath, image.dataUrl])),
    [detail],
  )

  const meta: Array<{ label: string; value: string }> = [
    { label: 'Version', value: mod.version },
    { label: 'Scope', value: mod.scope },
    { label: 'Marketplace', value: mod.marketplace ?? '—' },
    { label: 'Author', value: mod.author ?? '—' },
    { label: 'Runs from', value: mod.readFrom === 'folder' ? 'its folder (live edits)' : 'installed copy' },
  ]

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'code', label: 'Code', count: detail?.sources.length },
    { key: 'files', label: 'Files', count: detail?.files.length },
  ]

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-5">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-[#71717a] transition hover:text-[#a1a1aa]"
        >
          <ArrowLeft className="size-[15px]" />
          All mods
        </button>

        <div className="flex items-start gap-4">
          <div
            className="grid size-14 shrink-0 place-items-center rounded-[15px] font-mono text-[21px] font-semibold"
            style={{ background: icon.bg, color: icon.fg }}
          >
            {icon.mono}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-[#fafafa]">{mod.name}</h1>
              {mod.kind === 'draft' && (
                <span className="rounded-md border border-[#3b2f0b] bg-[#1f1a08] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#facc15]">
                  Draft
                </span>
              )}
            </div>
            <p className="mt-1.5 max-w-[620px] text-[14px] leading-relaxed text-[#a1a1aa]">
              {mod.description || 'No description in plugin.json.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void reveal(mod.id)}
              className="flex h-9 items-center gap-1.5 rounded-[9px] border border-[#27272a] bg-[#18181b] px-3.5 text-[12.5px] font-medium text-[#e4e4e7] transition hover:border-[#3a3a42]"
            >
              <FolderOpen className="size-3.5" />
              Show in Finder
            </button>
            <span className="flex h-9 items-center gap-2 rounded-[9px] border border-[#27272a] bg-[#18181b] px-3">
              <span className="text-[12.5px] font-medium text-[#e4e4e7]">{mod.enabled ? 'On' : 'Off'}</span>
              <SkillToggle
                enabled={mod.enabled}
                size="lg"
                onToggle={mod.canToggle ? onToggle : undefined}
                disabled={!mod.canToggle}
                disabledTitle="Drafts load only in the Claude session that wrote them"
              />
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#1c1c20] bg-[#0f0f12] px-3.5 py-2.5 text-[12.5px] text-[#a1a1aa]">
          <Info className="mt-0.5 size-3.5 shrink-0 text-[#71717a]" />
          {mod.kind === 'draft' ? (
            <span>
              Claude wrote this mod in one session. It loads only there, after you answer “Turn them on”. Install it from a
              marketplace to switch it on everywhere.
            </span>
          ) : (
            <span>
              Switching a mod writes <code className="font-mono text-[#e4e4e7]">enabledPlugins</code> in your Claude settings.
              New sessions pick it up; in an open one, run <code className="font-mono text-[#e4e4e7]">/reload-plugins</code>.
            </span>
          )}
        </div>

        <div className="mt-6 flex items-center gap-5 border-b border-[#1c1c20]">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`-mb-px border-b-2 px-1 pb-2.5 text-[13px] transition ${
                tab === item.key ? 'border-[#f97316] font-semibold text-[#fafafa]' : 'border-transparent font-medium text-[#71717a]'
              }`}
            >
              {item.label}
              {item.count !== undefined && <span className="ml-1 font-mono text-[11px] opacity-60">{item.count}</span>}
            </button>
          ))}
        </div>

        <div className="pt-5">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-[#71717a]">
              <Loader2 className="size-4 animate-spin" /> Reading the mod…
            </div>
          ) : !detail ? (
            <div className="text-[13px] text-[#71717a]">This mod is no longer on disk. Rescan to refresh the list.</div>
          ) : tab === 'overview' ? (
            <div className="flex flex-col gap-6">
              <section>
                <SectionTitle>Where it shows up</SectionTitle>
                <ModPreview anatomy={mod.anatomy} name={mod.name} />
              </section>

              {detail.images.length > 0 && (
                <section>
                  <SectionTitle>Screenshots</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {detail.images.map((image) => (
                      <button
                        key={image.relativePath}
                        type="button"
                        onClick={() => setZoomed(image.dataUrl)}
                        className="group overflow-hidden rounded-[11px] border border-[#232328] bg-[#0b0b0d] text-left transition hover:border-[#3a3a42]"
                      >
                        <img src={image.dataUrl} alt={image.relativePath} className="aspect-video w-full object-cover object-top" />
                        <div className="truncate px-3 py-1.5 font-mono text-[11px] text-[#52525b]">{image.relativePath}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {detail.readme ? (
                <section>
                  <SectionTitle>README</SectionTitle>
                  <div className="rounded-[13px] border border-[#232328] bg-[#101013] px-6 py-5">
                    <Markdown source={detail.readme} images={imagesByPath} />
                  </div>
                </section>
              ) : (
                <div className="rounded-xl border border-dashed border-[#27272a] px-6 py-8 text-center text-[13px] text-[#71717a]">
                  No README.md in this mod. Add one, plus images in a <code className="font-mono">screenshots/</code> folder, and
                  they show up here.
                </div>
              )}
            </div>
          ) : tab === 'code' ? (
            detail.sources.length === 0 ? (
              <div className="text-[13px] text-[#71717a]">No hooks module source could be read.</div>
            ) : (
              <div className="overflow-hidden rounded-[13px] border border-[#232328] bg-[#0b0b0d]">
                <div className="flex gap-1 overflow-x-auto border-b border-[#1c1c20] px-2 py-1.5">
                  {detail.sources.map((source, index) => (
                    <button
                      key={source.relativePath}
                      type="button"
                      onClick={() => setSourceIndex(index)}
                      className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-[11.5px] transition ${
                        index === sourceIndex ? 'bg-[#1c1c20] text-[#fafafa]' : 'text-[#71717a] hover:text-[#a1a1aa]'
                      }`}
                    >
                      {source.relativePath}
                    </button>
                  ))}
                </div>
                <CodeView content={detail.sources[sourceIndex]?.content ?? ''} className="max-h-[620px]" />
              </div>
            )
          ) : (
            <div className="overflow-hidden rounded-[13px] border border-[#232328]">
              {detail.files.map((file, index) => (
                <div
                  key={file.relativePath}
                  className={`flex items-center justify-between px-4 py-2 font-mono text-[12px] ${index > 0 ? 'border-t border-[#1c1c20]' : ''}`}
                >
                  <span className="truncate text-[#d4d4d8]">{file.relativePath}</span>
                  <span className="shrink-0 text-[#52525b]">{formatSize(file.sizeBytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-[#1c1c20] bg-[#0b0b0d] px-5 py-5">
        <SectionTitle>What it adds</SectionTitle>
        {mod.anatomy.surfaces.length === 0 ? (
          <p className="text-[12.5px] text-[#71717a]">Nothing Skilldex could spot. It may build its hooks dynamically.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {mod.anatomy.surfaces.map((surface) => (
              <li key={surface} className="text-[12.5px]">
                <div className="font-medium text-[#e4e4e7]">
                  {SURFACES[surface].label}
                  {surface === 'command' && mod.anatomy.commands.length > 0 && (
                    <span className="ml-1.5 font-mono text-[11.5px] text-[#fb923c]">
                      {mod.anatomy.commands.map((command) => `/${command}`).join(' ')}
                    </span>
                  )}
                </div>
                <div className="text-[#71717a]">{SURFACES[surface].detail}</div>
              </li>
            ))}
          </ul>
        )}

        {mod.anatomy.access.length > 0 && (
          <>
            <div className="mt-6" />
            <SectionTitle>What it reaches</SectionTitle>
            <ul className="flex flex-col gap-1.5">
              {mod.anatomy.access.map((access) => (
                <li key={access} className="flex items-center gap-2 text-[12.5px] text-[#d4d4d8]">
                  <ShieldAlert className="size-3.5 text-[#f59e0b]" />
                  {ACCESS[access]}
                </li>
              ))}
            </ul>
          </>
        )}

        {mod.anatomy.events.length > 0 && (
          <>
            <div className="mt-6" />
            <SectionTitle>Hooked events</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {mod.anatomy.events.map((event) => (
                <span key={event} className="rounded-md border border-[#27272a] bg-[#18181b] px-1.5 py-0.5 font-mono text-[11px] text-[#a1a1aa]">
                  {event}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="mt-6" />
        <SectionTitle>Details</SectionTitle>
        <dl className="flex flex-col gap-2 text-[12.5px]">
          {meta.map((item) => (
            <div key={item.label} className="flex justify-between gap-3">
              <dt className="text-[#71717a]">{item.label}</dt>
              <dd className="truncate text-right text-[#d4d4d8]">{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 break-all font-mono text-[11px] leading-relaxed text-[#52525b]">{mod.displayPath}</div>
      </aside>

      {zoomed && (
        <button
          type="button"
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-10"
          aria-label="Close screenshot"
        >
          <img src={zoomed} alt="" className="max-h-full max-w-full rounded-[12px] border border-[#27272a]" />
        </button>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[#52525b]">{children}</div>
}
