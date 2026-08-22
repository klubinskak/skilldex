type CodeViewProps = {
  content: string
  className?: string
}

/**
 * Read-only source viewer with a line-number gutter. Numbers are per *logical*
 * line: each line is its own flex row, so a soft-wrapped long line keeps a
 * single number aligned to its first visual row.
 */
export function CodeView({ content, className }: CodeViewProps) {
  const lines = content.split('\n')
  const gutterWidth = `${String(lines.length).length + 1}ch`

  return (
    <div className={`overflow-auto font-mono text-[12.5px] leading-relaxed ${className ?? ''}`}>
      <div className="py-4">
        {lines.map((line, index) => (
          <div key={index} className="flex px-4">
            <span
              className="shrink-0 select-none pr-4 text-right text-[#3f3f46]"
              style={{ width: gutterWidth, boxSizing: 'content-box' }}
            >
              {index + 1}
            </span>
            <span className="min-w-0 whitespace-pre-wrap break-words text-[#d4d4d8]">{line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
