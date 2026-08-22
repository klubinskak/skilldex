# Editing a skill never renames its directory

A skill's identity is its directory: the record `id` equals the canonical
`realPath` (`filesystem-source.ts`), the favourite key is derived from it
(`favouriteKeyFor(realPath)`), symlinks point at it, and project references name
it. Because of that blast radius, the "edit SKILL.md" feature rewrites **file
content only** — even when the user changes the frontmatter `name:` — and never
renames the directory to match the new slug.

## Considered options

- **Rename the directory to the new name's slug on save.** Rejected: it changes
  the `id`/`realPath` the renderer holds mid-session, orphans the favourite key,
  breaks any symlink targeting the folder, and invalidates project references —
  all as a silent side effect of a text edit.
- **Content-only (chosen).** The displayed name updates (the scanner re-reads
  frontmatter), identity stays put.

## Consequences

After editing, a skill's folder name and its displayed `name` can differ. That
is intentional and harmless. Renaming/moving a skill is a separate, deliberate
operation (a sibling of uninstall) and is out of scope here.
