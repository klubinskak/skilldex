/**
 * Minimal YAML frontmatter reader for `SKILL.md` files.
 *
 * Skills only need `name` and `description`, so this deliberately handles the
 * subset that appears in practice — plain scalars, single/double-quoted values,
 * and `|` / `>` block scalars — rather than pulling in a full YAML dependency.
 */

export type Frontmatter = {
  name?: string
  description?: string
}

const FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/
const KEY_VALUE = /^([A-Za-z0-9_-]+):\s?(.*)$/

export function parseFrontmatter(content: string): Frontmatter {
  const match = FRONTMATTER.exec(content)
  if (!match) return {}

  const lines = match[1].split(/\r?\n/)
  const result: Record<string, string> = {}

  for (let i = 0; i < lines.length; i++) {
    const kv = KEY_VALUE.exec(lines[i])
    if (!kv) continue

    const key = kv[1]
    const raw = kv[2].trim()

    if (raw === '|' || raw === '>' || raw === '|-' || raw === '>-') {
      const folded = raw.startsWith('>')
      const block: string[] = []
      while (i + 1 < lines.length && (lines[i + 1] === '' || /^\s/.test(lines[i + 1]))) {
        block.push(lines[++i].trim())
      }
      result[key] = block.join(folded ? ' ' : '\n').trim()
      continue
    }

    result[key] = stripQuotes(raw)
  }

  return { name: result.name, description: result.description }
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' || first === "'") && last === first) {
      return value.slice(1, -1).replace(/\\(["'\\])/g, '$1')
    }
  }
  return value
}
