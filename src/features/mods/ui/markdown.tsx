import type { ReactNode } from 'react'

type MarkdownProps = {
  source: string
  /** Images the README points at, by path relative to the mod folder. */
  images?: Record<string, string>
}

/**
 * A small, safe Markdown renderer for mod READMEs: headings, paragraphs, lists,
 * tables, quotes, code blocks and inline code/bold/links/images. No raw HTML is
 * ever injected, and links render as text so the app window never navigates.
 */
export function Markdown({ source, images = {} }: MarkdownProps) {
  return <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[#d4d4d8]">{blocks(source, images)}</div>
}

function blocks(source: string, images: Record<string, string>): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  const inline = (text: string) => inlines(text, images)

  while (i < lines.length) {
    const line = lines[i]

    if (/^\s*```/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i++
      out.push(
        <pre key={out.length} className="overflow-x-auto rounded-[10px] border border-[#232328] bg-[#0b0b0d] px-4 py-3 font-mono text-[12px] leading-relaxed text-[#e4e4e7]">
          {body.join('\n')}
        </pre>,
      )
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const size = level === 1 ? 'text-[19px]' : level === 2 ? 'text-[16px]' : 'text-[14px]'
      out.push(
        <div key={out.length} className={`${size} mt-2 font-semibold tracking-tight text-[#fafafa]`}>
          {inline(heading[2])}
        </div>,
      )
      i++
      continue
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      out.push(<hr key={out.length} className="border-[#1c1c20]" />)
      i++
      continue
    }

    if (/^\s*\|/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
        if (!cells.every((cell) => /^:?-+:?$/.test(cell) || cell === '')) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      out.push(
        <div key={out.length} className="overflow-x-auto rounded-[10px] border border-[#232328]">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-[#111114] text-[#a1a1aa]">
              <tr>{head?.map((cell, c) => <th key={c} className="px-3 py-2 font-semibold">{inline(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r} className="border-t border-[#1c1c20]">
                  {row.map((cell, c) => <td key={c} className="px-3 py-2 align-top">{inline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''))
        i++
      }
      const List = ordered ? 'ol' : 'ul'
      out.push(
        <List key={out.length} className={`flex flex-col gap-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-[#52525b]`}>
          {items.map((item, n) => <li key={n}>{inline(item)}</li>)}
        </List>,
      )
      continue
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''))
      out.push(
        <blockquote key={out.length} className="border-l-2 border-[#3f3f46] pl-3 text-[#a1a1aa]">
          {inline(quote.join(' '))}
        </blockquote>,
      )
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|\||([-*+]|\d+\.)\s|>)/.test(lines[i])) {
      paragraph.push(lines[i++])
    }
    out.push(<p key={out.length}>{inline(paragraph.join(' '))}</p>)
  }
  return out
}

const INLINE = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g

function inlines(text: string, images: Record<string, string>): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (!part) return null
    const image = /^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/.exec(part)
    if (image) {
      const src = images[image[2].replace(/^\.\//, '')]
      return src ? (
        <img key={index} src={src} alt={image[1]} className="my-1 max-w-full rounded-[10px] border border-[#232328]" />
      ) : (
        <span key={index} className="text-[#52525b]">[{image[1] || 'image'}]</span>
      )
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) {
      return (
        <span key={index} title={link[2]} className="text-[#fb923c] underline decoration-[#fb923c]/40 underline-offset-2">
          {link[1]}
        </span>
      )
    }
    if (part.startsWith('`')) {
      return (
        <code key={index} className="rounded-[5px] border border-[#27272a] bg-[#18181b] px-1 py-px font-mono text-[12px] text-[#e4e4e7]">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**')) return <strong key={index} className="font-semibold text-[#fafafa]">{part.slice(2, -2)}</strong>
    if (part.startsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    return part
  })
}
