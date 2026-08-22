# Skilldex

A desktop app for browsing and managing agent **skills** discovered across a
machine — personal, plugin, and per-project — surfaced through a single
read/manage seam (`window.skilldex`).

## Language

**Skill**:
An agent capability living as one directory that contains a `SKILL.md`. The
directory's presence of a `SKILL.md` is the only requirement for it to be
discovered.

**Skill identity**:
A skill *is* its directory. Identity is the canonical on-disk location
(`realPath`, symlinks resolved), and the record `id` equals that `realPath`.
Editing a skill's content never changes its identity; only moving or renaming
the directory does.
_Avoid_: name-as-identity (the displayed name is content, not identity).

**SKILL.md**:
The single markdown file that defines a skill: a YAML **frontmatter** block
(`name`, `description`, and any other keys) followed by the markdown **body**.
The displayed name falls back to the directory basename when frontmatter has no
`name`.

**Source kind**:
Where a skill was discovered: `Personal` (`~/.claude/skills`), `Plugin`
(`~/.claude/plugins`), or `Project` (a configured project's `.claude/skills`).

**Manageable skill**:
A skill Skilldex may write to — every source kind except `Plugin`. Plugin
skills are owned by their plugin and are read-only here.
_Avoid_: editable (use "manageable" for the write-permission concept).

**Enabled / Disabled**:
A manageable skill is *disabled* by parking its directory in a `.disabled/`
sibling of its skills root, and *enabled* by moving it back. A disabled skill
keeps its identity and remains fully readable and editable.
